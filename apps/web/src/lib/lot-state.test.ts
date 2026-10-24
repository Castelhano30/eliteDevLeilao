import { describe, expect, it } from "vitest";
import type { BidDTO, LotState, PlaceBidResponse } from "@lanceauto/shared";
import {
  INITIAL_OPENING_CHECKS,
  OPENING_CHECKS,
  nextOpeningCheck,
  applyBidResponse,
  applyLotEvent,
  applyShortcut,
  deriveSituation,
  initialField,
  lockedFooter,
  minimumText,
  ordinal,
  plural,
  positionFromBids,
  situationText,
  syncField,
  type BidEvent,
} from "./lot-state";

const bid = (seq: number, pseudonym: string, amountCents: number): BidDTO => ({
  seq,
  kind: "BID",
  pseudonym,
  amountCents,
  at: `2026-10-24T15:00:0${seq}.000Z`,
});

function state(over: Partial<LotState["lot"]> = {}, bids: BidDTO[] = []): LotState {
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

const event = (over: Partial<BidEvent> = {}): BidEvent => ({
  bid: bid(1, "Licitante AAAA", 1_500_000),
  currentBidCents: 1_500_000,
  bidCount: 1,
  bidderCount: 1,
  version: 1,
  endsAt: "2026-10-25T10:00:00.000Z",
  serverTime: "2026-10-24T15:00:05.000Z",
  ...over,
});

describe("ordinal e plural", () => {
  it("ordinal", () => {
    expect(ordinal(1)).toBe("1º");
    expect(ordinal(12)).toBe("12º");
  });
  it("plural escolhe a palavra pelo número", () => {
    expect(plural(1, "lance")).toBe("lance");
    expect(plural(0, "lance")).toBe("lances");
    expect(plural(2, "lance")).toBe("lances");
    expect(plural(2, "papel", "papéis")).toBe("papéis");
  });
});

describe("applyLotEvent", () => {
  it("aplica o primeiro lance: lance atual, mínimo, contagens, versão e linha no topo", () => {
    const next = applyLotEvent(state(), event());
    expect(next.lot).toMatchObject({ currentBidCents: 1_500_000, minimumBidCents: 1_550_000, bidCount: 1, bidderCount: 1, version: 1, entryCount: 1 });
    expect(next.bids.map((b) => b.seq)).toEqual([1]);
    expect(next.serverTime).toBe("2026-10-24T15:00:05.000Z");
  });

  it("descarta evento com versão menor ou igual à atual (mesmo lance por REST e por evento)", () => {
    const first = applyLotEvent(state(), event());
    expect(applyLotEvent(first, event())).toBe(first);
    expect(applyLotEvent(first, event({ version: 0 }))).toBe(first);
  });

  it("empilha o mais novo no topo e leva o fim prorrogado", () => {
    const first = applyLotEvent(state(), event());
    const next = applyLotEvent(
      first,
      event({
        bid: bid(2, "Licitante BBBB", 1_550_000),
        currentBidCents: 1_550_000,
        bidCount: 2,
        bidderCount: 2,
        version: 2,
        endsAt: "2026-10-25T10:02:00.000Z",
      }),
    );
    expect(next.bids.map((b) => b.seq)).toEqual([2, 1]);
    expect(next.lot.endsAt).toBe("2026-10-25T10:02:00.000Z");
    expect(next.lot.originalEndsAt).toBe("2026-10-25T10:00:00.000Z");
  });

  it("recalcula a posição de quem já tem pseudônimo: líder passa a 1º, superado cai", () => {
    let current = state({ myPseudonym: "Licitante AAAA" });
    current = applyLotEvent(current, event());
    expect(current.lot).toMatchObject({ myRank: 1, myBestBidCents: 1_500_000 });
    current = applyLotEvent(
      current,
      event({ bid: bid(2, "Licitante BBBB", 1_550_000), currentBidCents: 1_550_000, bidCount: 2, bidderCount: 2, version: 2 }),
    );
    expect(current.lot).toMatchObject({ myRank: 2, myBestBidCents: 1_500_000 });
  });

  it("quem ainda não deu lance continua sem posição", () => {
    const next = applyLotEvent(state({ myPseudonym: "Licitante ZZZZ" }), event());
    expect(next.lot.myRank).toBeNull();
    expect(next.lot.myBestBidCents).toBeNull();
  });
});

describe("applyBidResponse", () => {
  const response: PlaceBidResponse = {
    bid: bid(1, "Licitante AAAA", 1_500_000),
    lot: {
      id: "lot-1",
      status: "LIVE",
      currentBidCents: 1_500_000,
      minimumBidCents: 1_550_000,
      bidCount: 1,
      bidderCount: 1,
      version: 1,
      entryCount: 1,
      endsAt: "2026-10-25T10:02:00.000Z",
      originalEndsAt: "2026-10-25T10:00:00.000Z",
      extended: true,
      myRank: 1,
      myBestBidCents: 1_500_000,
      myPseudonym: "Licitante AAAA",
    },
    wallet: { totalCents: 5_000_000, committedCents: 1_500_000, availableCents: 3_500_000 },
    serverTime: "2026-10-24T15:00:05.000Z",
  };

  it("fica com a posição e o pseudônimo que o servidor calculou", () => {
    const next = applyBidResponse(state(), response);
    expect(next.lot).toMatchObject({ myRank: 1, myBestBidCents: 1_500_000, myPseudonym: "Licitante AAAA", version: 1 });
    expect(next.lot.endsAt).toBe("2026-10-25T10:02:00.000Z");
    expect(next.bids).toHaveLength(1);
  });

  it("se um refetch já trouxe essa versão, não mexe no estado", () => {
    const fresh = applyBidResponse(state(), response);
    expect(applyBidResponse(fresh, response)).toBe(fresh);
  });
});

describe("positionFromBids", () => {
  const bids = [bid(4, "Licitante AAAA", 3_300_000), bid(3, "Licitante CCCC", 3_200_000), bid(2, "Licitante BBBB", 3_100_000), bid(1, "Licitante AAAA", 3_000_000)];
  it("conta cada pseudônimo uma vez, pelo maior lance", () => {
    expect(positionFromBids(bids, "Licitante AAAA")).toEqual({ rank: 1, best: 3_300_000 });
    expect(positionFromBids(bids, "Licitante BBBB")).toEqual({ rank: 3, best: 3_100_000 });
  });
  it("sem lance ou sem pseudônimo, null", () => {
    expect(positionFromBids(bids, "Licitante ZZZZ")).toBeNull();
    expect(positionFromBids(bids, null)).toBeNull();
  });
});

describe("deriveSituation (viewer × estado)", () => {
  const live = { status: "LIVE" as const, bidderCount: 4, minimumBidCents: 3_100_000 };

  it("visitante assiste", () => {
    const s = deriveSituation({ ...live, myRank: null, myBestBidCents: null }, null)!;
    expect(s).toEqual({ kind: "visitor", minimumCents: 3_100_000 });
    expect(situationText(s)).toEqual({ title: "Você está assistindo", sub: "Sem conta você vê tudo, só não pode levantar a mão." });
  });

  it("leiloeiro é espectador", () => {
    const s = deriveSituation({ ...live, myRank: null, myBestBidCents: null }, { role: "AUCTIONEER" })!;
    expect(situationText(s).title).toBe("Leiloeiros não podem dar lances");
  });

  it("licitante que nunca deu lance: nunca vira '0º maior'", () => {
    const s = deriveSituation({ ...live, myRank: null, myBestBidCents: null }, { role: "BIDDER" })!;
    expect(s.kind).toBe("none");
    const text = situationText(s);
    expect(text).toEqual({ title: "Você ainda não deu lance", sub: "Mínimo aceito R$ 31.000,00." });
    expect(`${text.title} ${text.sub}`).not.toMatch(/0º/);
    expect(lockedFooter(s)).toBe("Nada travado neste lote");
  });

  it("líder: ganhando, 1º de N, com o valor travado", () => {
    const s = deriveSituation({ ...live, myRank: 1, myBestBidCents: 3_000_000 }, { role: "BIDDER" })!;
    expect(situationText(s)).toEqual({ title: "Você está ganhando", sub: "1º de 4" });
    expect(lockedFooter(s)).toBe("R$ 30.000,00 travados neste lote");
  });

  it("superado: posição do maior lance dele entre os N", () => {
    const s = deriveSituation({ ...live, myRank: 2, myBestBidCents: 3_000_000 }, { role: "BIDDER" })!;
    expect(situationText(s)).toEqual({ title: "Você foi superado", sub: "Seu lance (R$ 30.000,00) é o 2º maior de 4" });
    expect(lockedFooter(s)).toBe("Nada travado neste lote");
  });

  it("apurando vale para todos; agendado, cancelado e encerrado não têm faixa", () => {
    expect(deriveSituation({ ...live, status: "CLOSING", myRank: 1, myBestBidCents: 1 }, { role: "BIDDER" })).toEqual({ kind: "closing" });
    expect(situationText({ kind: "closing" }).title).toBe("Martelo batido. Apurando o resultado…");
    for (const status of ["SCHEDULED", "CANCELLED", "SOLD", "UNSOLD"] as const) {
      expect(deriveSituation({ ...live, status, myRank: null, myBestBidCents: null }, null)).toBeNull();
    }
  });
});

describe("campo de lance", () => {
  it("começa no mínimo, sem estar editado", () => {
    expect(initialField(3_100_000)).toEqual({ text: "31.000", dirty: false });
    expect(initialField(1_500_000)).toEqual({ text: "15.000", dirty: false });
  });

  it("acompanha o mínimo enquanto não editado", () => {
    expect(syncField(initialField(3_100_000), 3_200_000)).toEqual({ text: "32.000", dirty: false });
  });

  it("depois de editado, mantém o que foi digitado", () => {
    const edited = { text: "31.250", dirty: true };
    expect(syncField(edited, 3_200_000)).toBe(edited);
  });

  it("mínimo com centavos arredonda para cima, para o campo nunca ficar abaixo", () => {
    expect(minimumText(1_000_050)).toBe("10.001");
  });

  it("atalho soma ao valor do campo, não ao lance atual, e marca como editado", () => {
    expect(applyShortcut({ text: "31.000", dirty: false }, 1_000, 3_100_000)).toEqual({ text: "32.000", dirty: true });
    expect(applyShortcut({ text: "31.000", dirty: true }, 500, 3_100_000)).toEqual({ text: "31.500", dirty: true });
  });

  it("atalho com campo vazio parte do mínimo", () => {
    expect(applyShortcut({ text: "", dirty: true }, 500, 3_100_000)).toEqual({ text: "31.500", dirty: true });
    expect(applyShortcut({ text: "", dirty: true }, 5_000, 3_100_000)).toEqual({ text: "36.000", dirty: true });
  });

  it("atalho respeita o limite de 13 dígitos", () => {
    const next = applyShortcut({ text: "9.999.999.999.999", dirty: true }, 500, 100);
    expect(next.text.replace(/\D/g, "")).toHaveLength(13);
  });
});

describe("nextOpeningCheck", () => {
  it("a carga que já estava na tela não conta como conferência", () => {
    const { next, keepPolling } = nextOpeningCheck(INITIAL_OPENING_CHECKS, 1_000);
    expect(next).toEqual({ seenAt: 1_000, count: 0 });
    expect(keepPolling).toBe(true);
  });

  it("reavaliar o intervalo sem resposta nova (cada render) não gasta tentativa", () => {
    let current = nextOpeningCheck(INITIAL_OPENING_CHECKS, 1_000).next;
    for (let render = 0; render < 50; render++) current = nextOpeningCheck(current, 1_000).next;
    expect(current.count).toBe(0);
  });

  it("cada resposta nova do servidor conta uma e, na décima, para de insistir", () => {
    let step = nextOpeningCheck(INITIAL_OPENING_CHECKS, 0);
    for (let check = 1; check <= OPENING_CHECKS; check++) {
      step = nextOpeningCheck(step.next, check * 2_000);
      expect(step.next.count).toBe(check);
      expect(step.keepPolling).toBe(check < OPENING_CHECKS);
    }
  });
});
