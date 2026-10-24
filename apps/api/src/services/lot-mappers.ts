import type { Prisma } from "@prisma/client";
import { lotStatus, minimumNextCents, type LotCard, type LotState } from "@lanceauto/shared";
import { toNumber } from "./mappers";

/**
 * Colunas lidas em toda lista e estado de lote. **Nunca** inclui `Item.imageData` (R-2.15):
 * só `GET /items/:id/image` lê o blob; `imageMime` diz se há imagem.
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
      imageMime: true,
      imageCredit: true,
      imageCreditUrl: true,
    },
  },
} satisfies Prisma.LotSelect;

export type LotRow = Prisma.LotGetPayload<{ select: typeof LOT_SELECT }>;

/** Caminho relativo da imagem do item; `null` ⇔ não há imagem guardada. */
export function itemImagePath(row: Pick<LotRow, "itemId" | "item">): string | null {
  return row.item.imageMime ? `/items/${row.itemId}/image` : null;
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

export function toLotState(row: LotRow, now: Date): LotState {
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
      bidderCount: 0,
      bidCount: card.bidCount,
      version: card.version,
      entryCount: card.version,
      startsAt: card.startsAt,
      endsAt: card.endsAt,
      originalEndsAt: card.originalEndsAt,
      cancelledAt: card.cancelledAt,
      settledAt: isoOrNull(row.settledAt),
      myPseudonym: null,
      myRank: null,
      myBestBidCents: null,
    },
    car: {
      brand: row.item.brand,
      model: row.item.model,
      year: row.item.year,
      fuel: row.item.fuel,
      referencePriceCents: card.referencePriceCents,
      referenceMonth: row.item.referenceMonth,
      imageUrl: card.imageUrl,
      imageCredit: card.imageUrl ? row.item.imageCredit : null,
      imageCreditUrl: card.imageUrl ? row.item.imageCreditUrl : null,
    },
    bids: [],
  };
}
