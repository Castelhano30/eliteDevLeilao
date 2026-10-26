import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { EVENTS, type DomainEvent, type LotClosedPayload, type WithoutServerTime } from "@lanceauto/shared";
import { AppError } from "../errors";
import type { Clock } from "../infra/clock";
import { lotRoom, SHOWCASE_ROOM, userRoom } from "../socket";
import { LOT_SELECT, toLotCard } from "./lot-mappers";
import { toNumber, toWalletDto } from "./mappers";

export interface SettlementServiceDeps {
  db: PrismaClient;
  clock: Clock;
}

/**
 * O que uma tentativa de liquidar um lote fez. `SKIPPED`: não era elegível, já estava liquidado, estava cancelado,
 * ou outra transação segurava o lote. O service NÃO publica nada (INV-4): quem chama entrega `events` ao `Publisher`
 * depois do commit daquele lote.
 */
export interface SettleOutcome {
  lotId: string;
  result: "SOLD" | "UNSOLD" | "SKIPPED";
  events: DomainEvent[];
}

interface LockedLot {
  id: string;
  auctioneerId: string;
  endsAt: Date;
  currentBidCents: bigint | null;
  leaderId: string | null;
  bidCount: number;
  entryCount: number;
  lastHash: string;
}

interface LockedWallet {
  userId: string;
  totalCents: bigint;
  committedCents: bigint;
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 } as const;

/** 24 bytes aleatórios em base64url = 32 caracteres (INV-13). */
const newReceiptToken = () => randomBytes(24).toString("base64url");

export function makeSettlementService({ db, clock }: SettlementServiceDeps) {
  return {
    /**
     * Liquida o lote numa única transação (R-5.1 a R-5.5, INV-5, INV-10). Trava o lote com `SKIP LOCKED` (quem
     * encontra o lote travado pula) e só enxerga lote sem `settledAt` nem `cancelledAt`; o `now` é lido depois do
     * lock. Com lances: debita o líder (total e comprometido), credita o leiloeiro e emite o `Receipt`. Sem lances:
     * só `settledAt`. Nunca escreve na cadeia (INV-12). Falha (ex.: CHECK de carteira) desfaz a transação e lança.
     */
    async settleLot(lotId: string): Promise<SettleOutcome> {
      const skipped: SettleOutcome = { lotId, result: "SKIPPED", events: [] };
      return db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<LockedLot[]>`
          SELECT "id", "auctioneerId", "endsAt", "currentBidCents", "leaderId", "bidCount", "entryCount", "lastHash"
          FROM "Lot"
          WHERE "id" = ${lotId} AND "settledAt" IS NULL AND "cancelledAt" IS NULL
          FOR UPDATE SKIP LOCKED`;
        const lot = locked[0];
        if (!lot) return skipped;

        const now = clock.now();
        // Prorrogado depois da listagem de candidatos: o fim novo ainda não chegou.
        if (lot.endsAt.getTime() > now.getTime()) return skipped;

        const events: DomainEvent[] = [];
        let closed: WithoutServerTime<LotClosedPayload>;

        if (lot.bidCount === 0) {
          await tx.lot.update({ where: { id: lotId }, data: { settledAt: now } });
          closed = { lotId, version: lot.entryCount, outcome: "UNSOLD" };
          events.push({ type: EVENTS.LOT_CLOSED, room: lotRoom(lotId), payload: closed });
        } else {
          // Com lances, líder e lance atual existem (gravados na mesma transação do lance); sem eles o dado está quebrado.
          if (lot.leaderId === null || lot.currentBidCents === null) throw new AppError("INTERNAL");
          const amount = lot.currentBidCents;
          const winnerId = lot.leaderId;
          const auctioneerId = lot.auctioneerId;

          // O lance vencedor é o último da cadeia: dele saem o pseudônimo daquele lote e a conferência do líder.
          const winningBid = await tx.bid.findFirst({
            where: { lotId, kind: "BID" },
            orderBy: { seq: "desc" },
            select: { bidderId: true, pseudonym: true, amountCents: true },
          });
          if (!winningBid || winningBid.bidderId !== winnerId || winningBid.amountCents !== amount || !winningBid.pseudonym) {
            throw new AppError("INTERNAL");
          }

          // Carteiras sempre depois do lote e em ordem de userId (INV-5); os saldos vêm desta query.
          const walletIds = [...new Set([winnerId, auctioneerId])].sort();
          const wallets = await tx.$queryRaw<LockedWallet[]>`
            SELECT "userId", "totalCents", "committedCents" FROM "Wallet"
            WHERE "userId" IN (${Prisma.join(walletIds)}) ORDER BY "userId" FOR UPDATE`;
          const winnerWallet = wallets.find((wallet) => wallet.userId === winnerId);
          const auctioneerWallet = wallets.find((wallet) => wallet.userId === auctioneerId);
          if (!winnerWallet || !auctioneerWallet) throw new AppError("INTERNAL");

          const winnerTotal = winnerWallet.totalCents - amount;
          const winnerCommitted = winnerWallet.committedCents - amount;
          const winnerRow = await tx.wallet.update({
            where: { userId: winnerId },
            data: { totalCents: winnerTotal, committedCents: winnerCommitted, updatedAt: now },
          });
          await tx.ledgerEntry.create({
            data: {
              userId: winnerId,
              kind: "SALE_DEBIT",
              amountCents: amount,
              lotId,
              totalAfter: winnerTotal,
              committedAfter: winnerCommitted,
              createdAt: now,
            },
          });

          const auctioneerTotal = auctioneerWallet.totalCents + amount;
          const auctioneerRow = await tx.wallet.update({
            where: { userId: auctioneerId },
            data: { totalCents: auctioneerTotal, updatedAt: now },
          });
          await tx.ledgerEntry.create({
            data: {
              userId: auctioneerId,
              kind: "SALE_CREDIT",
              amountCents: amount,
              lotId,
              totalAfter: auctioneerTotal,
              committedAfter: auctioneerWallet.committedCents,
              createdAt: now,
            },
          });

          await tx.receipt.create({
            data: {
              lotId,
              winnerId,
              pseudonym: winningBid.pseudonym,
              amountCents: amount,
              token: newReceiptToken(),
              finalHash: lot.lastHash,
              issuedAt: now,
            },
          });
          await tx.lot.update({ where: { id: lotId }, data: { settledAt: now } });

          closed = {
            lotId,
            version: lot.entryCount,
            outcome: "SOLD",
            finalBidCents: toNumber(amount),
            winnerPseudonym: winningBid.pseudonym,
            finalHash: lot.lastHash,
          };
          events.push({ type: EVENTS.LOT_CLOSED, room: lotRoom(lotId), payload: closed });
          events.push(...(await showcaseEvent(tx, lotId, now)));
          events.push({ type: EVENTS.WALLET_UPDATED, room: userRoom(winnerId), payload: toWalletDto(winnerRow) });
          events.push({ type: EVENTS.WALLET_UPDATED, room: userRoom(auctioneerId), payload: toWalletDto(auctioneerRow) });
          return { lotId, result: "SOLD", events };
        }

        events.push(...(await showcaseEvent(tx, lotId, now)));
        return { lotId, result: "UNSOLD", events };
      }, TX_OPTIONS);
    },
  };
}

/** O cartão da Vitrine já com o status final (o `settledAt` acabou de ser gravado na mesma transação). */
async function showcaseEvent(tx: Prisma.TransactionClient, lotId: string, now: Date): Promise<DomainEvent[]> {
  const row = await tx.lot.findUniqueOrThrow({ where: { id: lotId }, select: LOT_SELECT });
  return [{ type: EVENTS.SHOWCASE_LOT, room: SHOWCASE_ROOM, payload: toLotCard(row, now) }];
}

export type SettlementService = ReturnType<typeof makeSettlementService>;
