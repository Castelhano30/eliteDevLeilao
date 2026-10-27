import type { BidderLotState, LotCard, MyBidItem } from "@lanceauto/shared";

/** Dados de teste de Meus arremates. Só os testes importam. */

export function card(over: Partial<LotCard> = {}): LotCard {
  return {
    id: "lot-18",
    number: 18,
    title: "Gol GTI 2.0 1996",
    brand: "VW",
    model: "Gol",
    year: 1996,
    fuel: "Gasolina",
    status: "LIVE",
    currentBidCents: 3_350_000,
    startingBidCents: 3_000_000,
    minIncrementCents: 50_000,
    referencePriceCents: 4_000_000,
    bidCount: 3,
    version: 3,
    startsAt: "2026-10-24T10:00:00.000Z",
    endsAt: "2026-10-25T10:00:00.000Z",
    originalEndsAt: "2026-10-25T10:00:00.000Z",
    cancelledAt: null,
    imageUrl: null,
    ...over,
  };
}

export function item(state: BidderLotState, over: Partial<MyBidItem> = {}, lot: Partial<LotCard> = {}): MyBidItem {
  return {
    lot: card(lot),
    state,
    myBestBidCents: 3_300_000,
    myPseudonym: "Licitante C3E8",
    myRank: state === "LEADING" ? 1 : state === "OUTBID" ? 2 : null,
    bidderCount: 2,
    winnerPseudonym: state === "WON" || state === "LOST" ? "Licitante 7F3A" : null,
    receiptToken: state === "WON" ? "tok-abc" : null,
    refundedCents: null,
    ...over,
  };
}
