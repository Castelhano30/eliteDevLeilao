import type { BidderLotState } from "@lanceauto/shared";
import { rankFrom } from "./rank";

/** Melhor lance de um licitante num lote: uma linha da consulta 2 de `GET /me/bids` (S07 §5). */
export interface BestRow {
  lotId: string;
  bidderId: string;
  bestCents: number;
}

/** `lotId` → (`bidderId` → maior lance). Linhas repetidas do mesmo licitante contam uma vez, pelo maior valor. */
export function bestByLot(rows: readonly BestRow[]): Map<string, Map<string, number>> {
  const lots = new Map<string, Map<string, number>>();
  for (const { lotId, bidderId, bestCents } of rows) {
    const bidders = lots.get(lotId) ?? new Map<string, number>();
    if (bestCents > (bidders.get(bidderId) ?? 0)) bidders.set(bidderId, bestCents);
    lots.set(lotId, bidders);
  }
  return lots;
}

export interface Position {
  rank: number;
  bidderCount: number;
  myBestBidCents: number;
}

/** Posição de `me` e licitantes distintos do lote; a regra é a do `rankFrom` da S03, sem reimplementar. */
export function positionOf(best: ReadonlyMap<string, number> | undefined, me: string): Position | null {
  if (!best) return null;
  const rank = rankFrom(best, me);
  return rank ? { rank: rank.rank, bidderCount: best.size, myBestBidCents: rank.myBestBidCents } : null;
}

export interface Sortable {
  state: BidderLotState;
  endsAtMs: number;
  number: number;
}

/** 0 = `OUTBID`, 1 = `LEADING`, 2 = finalizado (`WON`, `LOST`, `CANCELLED`). */
function band(state: BidderLotState): number {
  if (state === "OUTBID") return 0;
  if (state === "LEADING") return 1;
  return 2;
}

/**
 * Ordem de Meus arremates (R-7.9, decisão 3 do build): ativos antes, `OUTBID` antes de `LEADING`, cada um pelo fim
 * mais próximo; os finalizados juntos, pelo fim mais recente. O desempate é o número do lote, para a ordem ser estável.
 */
export function compareMyBids(a: Sortable, b: Sortable): number {
  const bandA = band(a.state);
  const bandB = band(b.state);
  if (bandA !== bandB) return bandA - bandB;
  const direction = bandA === 2 ? -1 : 1;
  if (a.endsAtMs !== b.endsAtMs) return direction * (a.endsAtMs - b.endsAtMs);
  return direction * (a.number - b.number);
}
