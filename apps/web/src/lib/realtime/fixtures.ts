import type { BidDTO, LotCard, LotState } from "@lanceauto/shared";

/** Dados de teste da Sala e da Vitrine. Só os testes importam. */

export const bid = (seq: number, pseudonym: string, amountCents: number): BidDTO => ({
  seq,
  kind: "BID",
  pseudonym,
  amountCents,
  at: `2026-10-24T15:00:0${seq % 10}.000Z`,
});

/** Lote ao vivo `lot-1`; `bids` do mais novo para o mais antigo, e os contadores saem deles. */
export function lotState(over: Partial<LotState["lot"]> = {}, bids: BidDTO[] = []): LotState {
  return {
    serverTime: "2026-10-24T15:00:00.000Z",
    lot: {
      id: "lot-1",
      number: 1,
      title: "Uno",
      status: "LIVE",
      startingBidCents: 1_500_000,
      minIncrementCents: 50_000,
      currentBidCents: bids[0]?.amountCents ?? null,
      minimumBidCents: bids[0] ? bids[0].amountCents + 50_000 : 1_500_000,
      bidCount: bids.length,
      bidderCount: new Set(bids.map((b) => b.pseudonym)).size,
      version: bids.length,
      entryCount: bids.length,
      startsAt: "2026-10-24T10:00:00.000Z",
      endsAt: "2026-10-25T10:00:00.000Z",
      originalEndsAt: "2026-10-25T10:00:00.000Z",
      cancelledAt: null,
      settledAt: null,
      myPseudonym: null,
      myRank: null,
      myBestBidCents: null,
      ...over,
    },
    car: {
      brand: "Fiat",
      model: "Uno",
      year: 2010,
      fuel: "Flex",
      referencePriceCents: 2_000_000,
      referenceMonth: "2026-10",
      imageUrl: null,
      imageCredit: null,
      imageCreditUrl: null,
    },
    bids,
  };
}

export function card(over: Partial<LotCard> = {}): LotCard {
  return {
    id: "lot-1",
    number: 1,
    title: "Uno",
    brand: "Fiat",
    model: "Uno",
    year: 2010,
    fuel: "Flex",
    status: "LIVE",
    currentBidCents: null,
    startingBidCents: 1_500_000,
    minIncrementCents: 50_000,
    referencePriceCents: 2_000_000,
    bidCount: 0,
    version: 0,
    startsAt: "2026-10-24T10:00:00.000Z",
    endsAt: "2026-10-25T10:00:00.000Z",
    originalEndsAt: "2026-10-25T10:00:00.000Z",
    cancelledAt: null,
    imageUrl: null,
    ...over,
  };
}
