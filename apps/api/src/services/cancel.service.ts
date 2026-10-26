import type { PrismaClient } from "@prisma/client";
import {
  CANCEL_TEXT,
  EVENTS,
  lotChangedMessage,
  type DomainEvent,
  type LotCancelledPayload,
  type LotState,
  type WithoutServerTime,
} from "@lanceauto/shared";
import { entryHash, sealHash } from "../domain/audit-chain";
import { AppError } from "../errors";
import type { Clock } from "../infra/clock";
import { lotRoom, SHOWCASE_ROOM, userRoom } from "../socket";
import { LOT_SELECT, summarizeBids, toLotCard, toLotState } from "./lot-mappers";
import { toWalletDto } from "./mappers";

export interface CancelServiceDeps {
  db: PrismaClient;
  clock: Clock;
  auditKey: string;
}

export interface CancelLotResult {
  /** O lote já cancelado, como a Sala o lê; não identifica o líder (INV-13). */
  response: LotState;
  /** Entregues ao `Publisher` pela rota, só depois do commit (INV-4). */
  events: DomainEvent[];
}

/** Lote como sai da query que o trava (colunas cruas). */
interface LockedLot {
  id: string;
  auctioneerId: string;
  endsAt: Date;
  cancelledAt: Date | null;
  settledAt: Date | null;
  currentBidCents: bigint | null;
  leaderId: string | null;
  entryCount: number;
  lastHash: string;
}

interface LockedWallet {
  userId: string;
  totalCents: bigint;
  committedCents: bigint;
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 } as const;

export function makeCancelService({ db, clock, auditKey }: CancelServiceDeps) {
  return {
    /**
     * Cancela o lote numa única transação (R-6.1 a R-6.10, INV-5, INV-6): trava o lote, confere dono, estado e
     * contagem, devolve ao líder o comprometido (`REFUND`, o total não muda), grava a linha CANCEL na cadeia e atualiza
     * contagem, último hash e selo. O `now` é lido uma vez, depois do lock. Qualquer falha desfaz tudo.
     */
    async cancelLot(userId: string, lotId: string, confirmEntryCount: number): Promise<CancelLotResult> {
      return db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<LockedLot[]>`
          SELECT "id", "auctioneerId", "endsAt", "cancelledAt", "settledAt", "currentBidCents", "leaderId", "entryCount", "lastHash"
          FROM "Lot" WHERE "id" = ${lotId} FOR UPDATE`;
        const lot = locked[0];
        if (!lot) throw new AppError("NOT_FOUND", undefined, CANCEL_TEXT.notFound);

        const now = clock.now();
        if (lot.auctioneerId !== userId) throw new AppError("FORBIDDEN", undefined, CANCEL_TEXT.forbidden);
        if (lot.cancelledAt !== null) throw new AppError("LOT_CANCELLED", undefined, CANCEL_TEXT.lotCancelled);
        if (now.getTime() >= lot.endsAt.getTime() || lot.settledAt !== null) {
          throw new AppError("LOT_ENDED", undefined, CANCEL_TEXT.lotEnded);
        }
        if (lot.entryCount !== confirmEntryCount) {
          throw new AppError("LOT_CHANGED", { entryCount: lot.entryCount }, lotChangedMessage(lot.entryCount));
        }

        const events: DomainEvent[] = [];
        let refunded: { userId: string; totalCents: bigint; committedCents: bigint } | null = null;

        // Só o líder atual tem saldo comprometido neste lote; quem foi superado já foi liberado por `RELEASE` (R-6.4).
        if (lot.leaderId !== null) {
          if (lot.currentBidCents === null) throw new AppError("INTERNAL");
          // Os saldos vêm desta query, nunca de leitura anterior (mesma regra da S03 §4.3).
          const wallets = await tx.$queryRaw<LockedWallet[]>`
            SELECT "userId", "totalCents", "committedCents" FROM "Wallet" WHERE "userId" = ${lot.leaderId} FOR UPDATE`;
          const leader = wallets[0];
          if (!leader || leader.committedCents < lot.currentBidCents) throw new AppError("INTERNAL");
          const committedCents = leader.committedCents - lot.currentBidCents;
          await tx.wallet.update({ where: { userId: leader.userId }, data: { committedCents, updatedAt: now } });
          await tx.ledgerEntry.create({
            data: {
              userId: leader.userId,
              kind: "REFUND",
              amountCents: lot.currentBidCents,
              lotId,
              totalAfter: leader.totalCents,
              committedAfter: committedCents,
              createdAt: now,
            },
          });
          refunded = { userId: leader.userId, totalCents: leader.totalCents, committedCents };
        }

        // A linha CANCEL é gravada sempre, com ou sem lances: sem autor nem valor (R-6.5).
        const seq = lot.entryCount + 1;
        const hash = entryHash(auditKey, {
          lotId,
          seq,
          kind: "CANCEL",
          pseudonym: null,
          amountCents: null,
          at: now,
          prevHash: lot.lastHash,
        });
        await tx.bid.create({
          data: { lotId, seq, kind: "CANCEL", bidderId: null, pseudonym: null, amountCents: null, at: now, prevHash: lot.lastHash, hash },
        });
        const row = await tx.lot.update({
          where: { id: lotId },
          data: { cancelledAt: now, entryCount: seq, lastHash: hash, seal: sealHash(auditKey, lotId, seq, hash) },
          select: LOT_SELECT,
        });

        const card = toLotCard(row, now);
        const cancelled: WithoutServerTime<LotCancelledPayload> = { lotId, version: seq };
        events.push({ type: EVENTS.LOT_CANCELLED, room: lotRoom(lotId), payload: cancelled });
        events.push({ type: EVENTS.SHOWCASE_LOT, room: SHOWCASE_ROOM, payload: card });
        if (refunded) {
          events.push({ type: EVENTS.WALLET_UPDATED, room: userRoom(refunded.userId), payload: toWalletDto(refunded) });
        }

        const bidRows = await tx.bid.findMany({
          where: { lotId, kind: "BID" },
          orderBy: { seq: "desc" },
          select: { seq: true, pseudonym: true, amountCents: true, at: true, bidderId: true },
        });
        const { bids, bestByBidder } = summarizeBids(bidRows);
        const response = toLotState(row, now, {
          bids,
          bidderCount: bestByBidder.size,
          myPseudonym: null,
          myRank: null,
          myBestBidCents: null,
          result: null,
          myReceiptToken: null,
        });
        return { response, events };
      }, TX_OPTIONS);
    },
  };
}

export type CancelService = ReturnType<typeof makeCancelService>;
