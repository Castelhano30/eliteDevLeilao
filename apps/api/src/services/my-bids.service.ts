import type { PrismaClient } from "@prisma/client";
import { bidderLotState, type MyBidItem, type MyBidsResponse } from "@lanceauto/shared";
import { AppError } from "../errors";
import { bestByLot, compareMyBids, positionOf, type BestRow } from "../domain/my-bids";
import type { Clock } from "../infra/clock";
import { LOT_SELECT, toLotCard } from "./lot-mappers";
import { toNumber } from "./mappers";

export interface MyBidsServiceDeps {
  db: PrismaClient;
  clock: Clock;
}

interface MyBestRow {
  lotId: string;
  myBest: bigint;
  myPseudonym: string | null;
}

interface BidderBestRow {
  lotId: string;
  bidderId: string;
  best: bigint;
}

export function makeMyBidsService({ db, clock }: MyBidsServiceDeps) {
  return {
    /**
     * Os lotes em que `userId` deu lance, cada um com o estado dele, já ordenados (R-7.9). Três leituras num só
     * snapshot (RepeatableRead): a posição nunca mistura dois instantes. Só lê; nunca liquida (INV-10).
     * Sem lance, devolve a lista vazia sem rodar a segunda consulta nem o `findMany`.
     */
    async list(userId: string): Promise<MyBidsResponse> {
      const now = clock.now();
      const items = await db.$transaction(
        async (tx): Promise<MyBidItem[]> => {
          // 1) lotes onde tenho lance, meu maior lance e o meu pseudônimo (constante por usuário e lote).
          const mine = await tx.$queryRaw<MyBestRow[]>`
            SELECT b."lotId", MAX(b."amountCents") AS "myBest", MAX(b."pseudonym") AS "myPseudonym"
            FROM "Bid" b
            WHERE b."bidderId" = ${userId} AND b."kind" = 'BID'
            GROUP BY b."lotId"`;
          if (mine.length === 0) return [];
          const lotIds = mine.map((row) => row.lotId);

          // 2) o maior lance de cada licitante nesses lotes: posição e número de licitantes (ids são TEXT, nunca uuid).
          const bidders = await tx.$queryRaw<BidderBestRow[]>`
            SELECT b."lotId", b."bidderId", MAX(b."amountCents") AS "best"
            FROM "Bid" b
            WHERE b."kind" = 'BID' AND b."bidderId" IS NOT NULL AND b."lotId" = ANY(${lotIds}::text[])
            GROUP BY b."lotId", b."bidderId"`;
          const bestRows: BestRow[] = bidders.map((row) => ({
            lotId: row.lotId,
            bidderId: row.bidderId,
            bestCents: toNumber(row.best),
          }));
          const best = bestByLot(bestRows);

          const lots = await tx.lot.findMany({
            where: { id: { in: lotIds } },
            select: {
              ...LOT_SELECT,
              leaderId: true,
              receipt: { select: { winnerId: true, pseudonym: true, token: true } },
            },
          });
          const lotsById = new Map(lots.map((lot) => [lot.id, lot]));

          return mine.flatMap((row): MyBidItem[] => {
            const lot = lotsById.get(row.lotId);
            const position = positionOf(best.get(row.lotId), userId);
            // As três leituras são do mesmo snapshot: faltar lote, lance ou pseudônimo é defeito, não dado.
            if (!lot || !position || row.myPseudonym === null) throw new AppError("INTERNAL");

            const state = bidderLotState(lot, userId);
            const active = state === "LEADING" || state === "OUTBID";
            const receipt = lot.receipt;
            return [
              {
                lot: toLotCard(lot, now),
                state,
                myBestBidCents: toNumber(row.myBest),
                myPseudonym: row.myPseudonym,
                myRank: active ? position.rank : null,
                bidderCount: position.bidderCount,
                winnerPseudonym: (state === "WON" || state === "LOST") && receipt ? receipt.pseudonym : null,
                // Só o vencedor logado recebe o token (T9, R-7.6): estado WON e Receipt dele.
                receiptToken: state === "WON" && receipt && receipt.winnerId === userId ? receipt.token : null,
                refundedCents:
                  state === "CANCELLED" && lot.leaderId === userId && lot.currentBidCents !== null
                    ? toNumber(lot.currentBidCents)
                    : null,
              },
            ];
          });
        },
        { isolationLevel: "RepeatableRead" },
      );

      items.sort((a, b) =>
        compareMyBids(
          { state: a.state, endsAtMs: Date.parse(a.lot.endsAt), number: a.lot.number },
          { state: b.state, endsAtMs: Date.parse(b.lot.endsAt), number: b.lot.number },
        ),
      );
      return { items, serverTime: now.toISOString() };
    },
  };
}

export type MyBidsService = ReturnType<typeof makeMyBidsService>;
