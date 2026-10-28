import type { Prisma } from "@prisma/client";
import {
  lotStatus,
  minimumNextCents,
  type BidDTO,
  type LotCard,
  type LotResult,
  type LotState,
  type MyLotCard,
} from "@lanceauto/shared";
import { toNumber } from "./mappers";

/**
 * Colunas lidas em toda lista e estado de lote. **Nunca** lê `ItemImage.data` (R-2.15):
 * só `GET /items/:id/image(s)` lê o blob; `imageCount` diz quantas fotos há.
 */
export const LOT_SELECT = {
  id: true,
  number: true,
  title: true,
  startingBidCents: true,
  minIncrementCents: true,
  currentBidCents: true,
  bidCount: true,
  entryCount: true,
  startsAt: true,
  endsAt: true,
  originalEndsAt: true,
  cancelledAt: true,
  settledAt: true,
  itemId: true,
  item: {
    select: {
      brand: true,
      model: true,
      year: true,
      fuel: true,
      referencePriceCents: true,
      referenceMonth: true,
      imageCount: true,
      imageCredit: true,
      imageCreditUrl: true,
    },
  },
} satisfies Prisma.LotSelect;

export type LotRow = Prisma.LotGetPayload<{ select: typeof LOT_SELECT }>;

/** Caminho relativo da capa do item; `null` ⇔ não há imagem guardada. */
export function itemImagePath(row: Pick<LotRow, "itemId" | "item">): string | null {
  return row.item.imageCount > 0 ? `/items/${row.itemId}/image` : null;
}

/**
 * Caminhos relativos das fotos da galeria, na ordem de exibição. `[0]` é a capa e é exatamente `imageUrl`
 * (`/items/:id/image`); as demais seguem `/items/:id/images/N`. Vazio sem imagem.
 */
export function itemGalleryPaths(itemId: string, imageCount: number): string[] {
  return Array.from({ length: imageCount }, (_, position) =>
    position === 0 ? `/items/${itemId}/image` : `/items/${itemId}/images/${position}`,
  );
}

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

export function toLotCard(row: LotRow, now: Date): LotCard {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    brand: row.item.brand,
    model: row.item.model,
    year: row.item.year,
    fuel: row.item.fuel,
    status: lotStatus(row, now),
    currentBidCents: row.currentBidCents === null ? null : toNumber(row.currentBidCents),
    startingBidCents: toNumber(row.startingBidCents),
    minIncrementCents: toNumber(row.minIncrementCents),
    referencePriceCents: toNumber(row.item.referencePriceCents),
    bidCount: row.bidCount,
    version: row.entryCount,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    originalEndsAt: iso(row.originalEndsAt),
    cancelledAt: isoOrNull(row.cancelledAt),
    imageUrl: itemImagePath(row),
  };
}

/**
 * Resultado do fechamento (R-5.9): `null` até o lote ser liquidado e sempre `null` no cancelado. O pseudônimo do
 * vencedor vem do `Receipt` (o do lance vencedor); nunca se compara pseudônimo no cliente.
 */
export function toLotResult(
  row: Pick<LotRow, "endsAt" | "settledAt" | "cancelledAt" | "bidCount" | "currentBidCents">,
  winnerPseudonym: string | null,
): LotResult | null {
  if (row.settledAt === null || row.cancelledAt !== null) return null;
  const base = { hammerAt: iso(row.endsAt), settledAt: iso(row.settledAt) };
  if (row.bidCount === 0 || row.currentBidCents === null) {
    return { outcome: "UNSOLD", finalBidCents: null, winnerPseudonym: null, ...base };
  }
  return { outcome: "SOLD", finalBidCents: toNumber(row.currentBidCents), winnerPseudonym, ...base };
}

/** Linha do Painel do leiloeiro: o cartão mais o resultado, quando há. */
export function toMyLotCard(row: LotRow, now: Date, winnerPseudonym: string | null): MyLotCard {
  const result = toLotResult(row, winnerPseudonym);
  return {
    ...toLotCard(row, now),
    resultado: result
      ? {
          outcome: result.outcome,
          finalBidCents: result.finalBidCents,
          winnerPseudonym: result.winnerPseudonym,
          referencePriceCents: toNumber(row.item.referencePriceCents),
          settledAt: result.settledAt,
        }
      : null,
    // Todo lote com lance tem líder; o estorno devolvido é o lance atual (R-6.4). Sem cancelamento ou sem lances, `null`.
    refundedCents: row.cancelledAt !== null && row.bidCount > 0 && row.currentBidCents !== null ? toNumber(row.currentBidCents) : null,
  };
}

/** Linha de `Bid` (kind BID) como a leitura a seleciona. */
export interface BidRow {
  seq: number;
  pseudonym: string | null;
  amountCents: bigint | null;
  at: Date;
  bidderId: string | null;
}

/**
 * Lances públicos e o melhor lance de cada licitante. `bidderId` só serve para contar licitantes distintos e a
 * posição de quem olha: o DTO público leva o pseudônimo, nunca o usuário (INV-13).
 */
export function summarizeBids(rows: BidRow[]): { bids: BidDTO[]; bestByBidder: Map<string, number> } {
  const bestByBidder = new Map<string, number>();
  for (const bid of rows) {
    if (bid.bidderId === null || bid.amountCents === null) continue;
    const amount = toNumber(bid.amountCents);
    if (amount > (bestByBidder.get(bid.bidderId) ?? 0)) bestByBidder.set(bid.bidderId, amount);
  }
  const bids = rows.map((bid) => ({
    seq: bid.seq,
    kind: "BID" as const,
    pseudonym: bid.pseudonym ?? "",
    amountCents: toNumber(bid.amountCents ?? 0n),
    at: bid.at.toISOString(),
  }));
  return { bids, bestByBidder };
}

/** O que a leitura acrescenta ao lote: lances, licitantes distintos, a posição de quem olha e o resultado. */
export interface LotStateExtras {
  bids: BidDTO[];
  bidderCount: number;
  myPseudonym: string | null;
  myRank: number | null;
  myBestBidCents: number | null;
  result: LotResult | null;
  myReceiptToken: string | null;
}

const NO_EXTRAS: LotStateExtras = {
  bids: [],
  bidderCount: 0,
  myPseudonym: null,
  myRank: null,
  myBestBidCents: null,
  result: null,
  myReceiptToken: null,
};

export function toLotState(row: LotRow, now: Date, extras: LotStateExtras = NO_EXTRAS): LotState {
  const card = toLotCard(row, now);
  return {
    serverTime: now.toISOString(),
    lot: {
      id: card.id,
      number: card.number,
      title: card.title,
      status: card.status,
      startingBidCents: card.startingBidCents,
      minIncrementCents: card.minIncrementCents,
      currentBidCents: card.currentBidCents,
      minimumBidCents: minimumNextCents(card),
      bidderCount: extras.bidderCount,
      bidCount: card.bidCount,
      version: card.version,
      entryCount: card.version,
      startsAt: card.startsAt,
      endsAt: card.endsAt,
      originalEndsAt: card.originalEndsAt,
      cancelledAt: card.cancelledAt,
      settledAt: isoOrNull(row.settledAt),
      myPseudonym: extras.myPseudonym,
      myRank: extras.myRank,
      myBestBidCents: extras.myBestBidCents,
      result: extras.result,
      myReceiptToken: extras.myReceiptToken,
    },
    car: {
      brand: row.item.brand,
      model: row.item.model,
      year: row.item.year,
      fuel: row.item.fuel,
      referencePriceCents: card.referencePriceCents,
      referenceMonth: row.item.referenceMonth,
      imageUrl: card.imageUrl,
      gallery: itemGalleryPaths(row.itemId, row.item.imageCount),
      imageCredit: card.imageUrl ? row.item.imageCredit : null,
      imageCreditUrl: card.imageUrl ? row.item.imageCreditUrl : null,
    },
    bids: extras.bids,
  };
}
