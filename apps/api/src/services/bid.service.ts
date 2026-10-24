import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AUTH_TEXT,
  EVENTS,
  LOT_TEXT,
  type BidPlacedPayload,
  type DomainEvent,
  type PlaceBidInput,
  type PlaceBidResponse,
  type Role,
  type WithoutServerTime,
} from "@lanceauto/shared";
import { entryHash, sealHash } from "../domain/audit-chain";
import { minimumBid, nextEndsAt, validateBalance, validateBidPreWallet } from "../domain/bid-rules";
import { pseudonymFor } from "../domain/pseudonym";
import { rankFrom } from "../domain/rank";
import { AppError } from "../errors";
import type { Clock } from "../infra/clock";
import { lotRoom, SHOWCASE_ROOM, userRoom } from "../socket";
import { LOT_SELECT, toLotCard } from "./lot-mappers";
import { toNumber, toWalletDto } from "./mappers";

export interface BidServiceDeps {
  db: PrismaClient;
  clock: Clock;
  auditKey: string;
}

export interface PlaceBidResult {
  response: PlaceBidResponse;
  /** Entregues ao `Publisher` pela rota, só depois do commit (INV-4). */
  events: DomainEvent[];
}

/** Lote como sai da query que o trava (colunas cruas). */
interface LockedLot {
  id: string;
  startsAt: Date;
  endsAt: Date;
  originalEndsAt: Date;
  cancelledAt: Date | null;
  startingBidCents: bigint;
  minIncrementCents: bigint;
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

export function makeBidService({ db, clock, auditKey }: BidServiceDeps) {
  return {
    /**
     * Lance numa única transação (INV-4, INV-5, INV-8): trava o lote, valida na ordem do PRD com o `now` lido depois
     * do lock, trava as carteiras por `userId` ascendente, compromete o saldo de quem lidera, libera o do superado,
     * grava o lance na cadeia e prorroga o fim se for nos 2 minutos finais.
     */
    async placeBid(userId: string, role: Role, lotId: string, input: PlaceBidInput): Promise<PlaceBidResult> {
      try {
        return await db.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<LockedLot[]>`
            SELECT "id", "startsAt", "endsAt", "originalEndsAt", "cancelledAt", "startingBidCents", "minIncrementCents",
                   "currentBidCents", "leaderId", "bidCount", "entryCount", "lastHash"
            FROM "Lot" WHERE "id" = ${lotId} FOR UPDATE`;
          const lot = locked[0];
          if (!lot) throw new AppError("NOT_FOUND", undefined, LOT_TEXT.notFoundTitle);

          // O relógio é lido depois do lock: quem esperou na fila vê o instante em que realmente decide.
          const now = clock.now();
          const currentBidCents = lot.currentBidCents === null ? null : toNumber(lot.currentBidCents);
          const rules = {
            startsAt: lot.startsAt,
            endsAt: lot.endsAt,
            cancelledAt: lot.cancelledAt,
            startingBidCents: toNumber(lot.startingBidCents),
            minIncrementCents: toNumber(lot.minIncrementCents),
            currentBidCents,
            leaderId: lot.leaderId,
          };
          const pre = validateBidPreWallet({
            lot: rules,
            userId,
            role,
            amountCents: input.amountCents,
            expectedCurrentCents: input.expectedCurrentCents,
            now,
          });
          if (!pre.ok) throw new AppError(pre.code, pre.details, pre.message);

          // Carteiras sempre depois do lote e em ordem de userId; os saldos vêm desta query, não de leitura anterior.
          const walletIds = [...new Set([userId, ...(lot.leaderId ? [lot.leaderId] : [])])];
          const wallets = await tx.$queryRaw<LockedWallet[]>`
            SELECT "userId", "totalCents", "committedCents" FROM "Wallet"
            WHERE "userId" IN (${Prisma.join(walletIds)}) ORDER BY "userId" FOR UPDATE`;
          const mine = wallets.find((wallet) => wallet.userId === userId);
          const available = mine ? toNumber(mine.totalCents - mine.committedCents) : 0;
          const balance = validateBalance(available, input.amountCents);
          if (!balance.ok) throw new AppError(balance.code, balance.details, balance.message);
          if (!mine) throw new AppError("INTERNAL");

          const amount = BigInt(input.amountCents);
          const events: DomainEvent[] = [];
          let previous: { userId: string; totalCents: bigint; committedCents: bigint } | null = null;

          if (lot.leaderId !== null && lot.currentBidCents !== null) {
            const leader = wallets.find((wallet) => wallet.userId === lot.leaderId);
            if (!leader) throw new AppError("INTERNAL");
            const committedCents = leader.committedCents - lot.currentBidCents;
            await tx.wallet.update({ where: { userId: leader.userId }, data: { committedCents, updatedAt: now } });
            await tx.ledgerEntry.create({
              data: {
                userId: leader.userId,
                kind: "RELEASE",
                amountCents: lot.currentBidCents,
                lotId,
                totalAfter: leader.totalCents,
                committedAfter: committedCents,
                createdAt: now,
              },
            });
            previous = { userId: leader.userId, totalCents: leader.totalCents, committedCents };
          }

          const committedCents = mine.committedCents + amount;
          const walletRow = await tx.wallet.update({
            where: { userId },
            data: { committedCents, updatedAt: now },
          });
          await tx.ledgerEntry.create({
            data: {
              userId,
              kind: "HOLD",
              amountCents: amount,
              lotId,
              totalAfter: mine.totalCents,
              committedAfter: committedCents,
              createdAt: now,
            },
          });

          const seq = lot.entryCount + 1;
          const pseudonym = pseudonymFor(auditKey, userId, lotId);
          const hash = entryHash(auditKey, {
            lotId,
            seq,
            kind: "BID",
            pseudonym,
            amountCents: amount,
            at: now,
            prevHash: lot.lastHash,
          });
          await tx.bid.create({
            data: {
              lotId,
              seq,
              kind: "BID",
              bidderId: userId,
              pseudonym,
              amountCents: amount,
              at: now,
              prevHash: lot.lastHash,
              hash,
            },
          });

          const ends = nextEndsAt(lot.endsAt, now);
          await tx.lot.update({
            where: { id: lotId },
            data: {
              currentBidCents: amount,
              leaderId: userId,
              bidCount: lot.bidCount + 1,
              entryCount: seq,
              lastHash: hash,
              seal: sealHash(auditKey, lotId, seq, hash),
              endsAt: ends.endsAt,
            },
          });

          // Licitantes distintos já contando este lance (mesma transação).
          const grouped = await tx.bid.groupBy({
            by: ["bidderId"],
            where: { lotId, kind: "BID" },
            _max: { amountCents: true },
          });
          const bestByBidder = new Map<string, number>();
          for (const row of grouped) {
            if (row.bidderId !== null && row._max.amountCents !== null) {
              bestByBidder.set(row.bidderId, toNumber(row._max.amountCents));
            }
          }
          const bidderCount = bestByBidder.size;
          const myPosition = rankFrom(bestByBidder, userId);

          const lotRow = await tx.lot.findUniqueOrThrow({ where: { id: lotId }, select: LOT_SELECT });
          const card = toLotCard(lotRow, now);
          const bid = { seq, kind: "BID" as const, pseudonym, amountCents: input.amountCents, at: now.toISOString() };
          const wallet = toWalletDto(walletRow);

          const minimumBidCents = minimumBid({ ...rules, currentBidCents: input.amountCents });
          // Sem `serverTime`: quem carimba é o Publisher, ao emitir (R-4.3).
          const payload: WithoutServerTime<BidPlacedPayload> = {
            lotId,
            version: seq,
            bid,
            currentBidCents: input.amountCents,
            minimumBidCents,
            bidCount: card.bidCount,
            bidderCount,
            endsAt: card.endsAt,
            extended: ends.extended,
          };
          events.push({ type: EVENTS.BID_PLACED, room: lotRoom(lotId), payload });
          events.push({ type: EVENTS.SHOWCASE_LOT, room: SHOWCASE_ROOM, payload: card });
          events.push({ type: EVENTS.WALLET_UPDATED, room: userRoom(userId), payload: wallet });
          if (previous) {
            events.push({
              type: EVENTS.WALLET_UPDATED,
              room: userRoom(previous.userId),
              payload: toWalletDto(previous),
            });
          }

          return {
            response: {
              bid,
              lot: {
                id: lotId,
                status: card.status,
                currentBidCents: input.amountCents,
                minimumBidCents,
                bidCount: card.bidCount,
                bidderCount,
                version: seq,
                entryCount: seq,
                endsAt: card.endsAt,
                originalEndsAt: card.originalEndsAt,
                extended: ends.endsAt.getTime() > lotRow.originalEndsAt.getTime(),
                myRank: myPosition?.rank ?? null,
                myBestBidCents: myPosition?.myBestBidCents ?? null,
                myPseudonym: pseudonym,
              },
              wallet,
              serverTime: now.toISOString(),
            },
            events,
          };
        }, TX_OPTIONS);
      } catch (err) {
        // Usuário apagado com token ainda válido: violação de FK vira 401, nunca 500.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
          throw new AppError("UNAUTHENTICATED", undefined, AUTH_TEXT.unauthenticated);
        }
        throw err;
      }
    },
  };
}

export type BidService = ReturnType<typeof makeBidService>;
