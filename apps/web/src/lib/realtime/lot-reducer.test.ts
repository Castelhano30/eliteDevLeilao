import { describe, expect, it } from "vitest";
import {
  EVENTS,
  type BidPlacedPayload,
  type LotCancelledPayload,
  type LotClosedPayload,
  type LotEvent,
  type PlaceBidResponse,
} from "@lanceauto/shared";
import { applyBidResponse, applyLotEvent, mergeSnapshot, needsResultSnapshot } from "./lot-reducer";
import { bid, lotState } from "./fixtures";

const placed = (over: Partial<BidPlacedPayload> = {}): LotEvent => ({
  type: EVENTS.BID_PLACED,
  payload: {
    lotId: "lot-1",
    version: 1,
    bid: bid(1, "Licitante AAAA", 1_500_000),
    currentBidCents: 1_500_000,
    minimumBidCents: 1_550_000,
    bidCount: 1,
    bidderCount: 1,
    endsAt: "2026-10-25T10:00:00.000Z",
    extended: false,
    serverTime: "2026-10-24T15:00:05.000Z",
    ...over,
  },
});

const closed = (over: Partial<LotClosedPayload> = {}): LotEvent => ({
  type: EVENTS.LOT_CLOSED,
  payload: { lotId: "lot-1", version: 5, outcome: "SOLD", finalBidCents: 2_000_000, serverTime: "2026-10-25T10:00:01.000Z", ...over },
});

const cancelled = (over: Partial<LotCancelledPayload> = {}): LotEvent => ({
  type: EVENTS.LOT_CANCELLED,
  payload: { lotId: "lot-1", version: 6, serverTime: "2026-10-24T15:30:00.000Z", ...over },
});

/** Estado com 5 lances, em `version 5`. */
const atFive = () =>
  lotState(
    { currentBidCents: 1_900_000, minimumBidCents: 1_950_000 },
    [5, 4, 3, 2, 1].map((seq) => bid(seq, seq % 2 ? "Licitante AAAA" : "Licitante BBBB", 1_500_000 + seq * 80_000)),
  );

describe("applyLotEvent · bid:placed (AC-4.13)", () => {
  it("version 6 sobre o estado em 5 aplica; 6 de novo e 5 são descartados; 8 pede o GET sem mexer no estado", () => {
    const state = atFive();
    const sixth = applyLotEvent(state, placed({ version: 6, bid: bid(6, "Licitante CCCC", 2_000_000), currentBidCents: 2_000_000, minimumBidCents: 2_050_000, bidCount: 6, bidderCount: 3 }));
    expect(sixth.action).toBe("applied");
    expect(sixth.state.lot.version).toBe(6);

    const again = applyLotEvent(sixth.state, placed({ version: 6, bid: bid(6, "Licitante CCCC", 2_000_000) }));
    expect(again).toEqual({ state: sixth.state, action: "ignored" });
    expect(applyLotEvent(sixth.state, placed({ version: 5 }))).toEqual({ state: sixth.state, action: "ignored" });

    const jump = applyLotEvent(state, placed({ version: 8 }));
    expect(jump.action).toBe("refetch");
    expect(jump.state).toBe(state);
  });

  it("aplica o primeiro lance: usa o `minimumBidCents` do payload (não recalcula), contadores, versão e linha no topo", () => {
    // Incremento do lote 50 mil; o payload manda 77 mil de propósito: o cliente confia no servidor.
    const result = applyLotEvent(lotState(), placed({ minimumBidCents: 1_577_000 }));
    expect(result.action).toBe("applied");
    expect(result.state.lot).toMatchObject({
      currentBidCents: 1_500_000,
      minimumBidCents: 1_577_000,
      bidCount: 1,
      bidderCount: 1,
      version: 1,
      entryCount: 1,
    });
    expect(result.state.bids.map((b) => b.seq)).toEqual([1]);
    expect(result.state.serverTime).toBe("2026-10-24T15:00:05.000Z");
  });

  it("lance aceito prova que o lote está ao vivo: agendado ou apurando volta a LIVE; encerrado e cancelado ficam", () => {
    for (const status of ["SCHEDULED", "CLOSING", "LIVE"] as const) {
      expect(applyLotEvent(lotState({ status }), placed()).state.lot.status).toBe("LIVE");
    }
    for (const status of ["SOLD", "UNSOLD", "CANCELLED"] as const) {
      expect(applyLotEvent(lotState({ status }), placed()).state.lot.status).toBe(status);
    }
  });

  it("empilha o mais novo no topo e leva o fim prorrogado, sem mexer no original", () => {
    const first = applyLotEvent(lotState(), placed()).state;
    const next = applyLotEvent(
      first,
      placed({
        version: 2,
        bid: bid(2, "Licitante BBBB", 1_550_000),
        currentBidCents: 1_550_000,
        bidCount: 2,
        bidderCount: 2,
        endsAt: "2026-10-25T10:02:00.000Z",
        extended: true,
      }),
    ).state;
    expect(next.bids.map((b) => b.seq)).toEqual([2, 1]);
    expect(next.lot.endsAt).toBe("2026-10-25T10:02:00.000Z");
    expect(next.lot.originalEndsAt).toBe("2026-10-25T10:00:00.000Z");
  });

  it("recalcula a posição de quem tem pseudônimo: líder 1º, superado cai; quem não deu lance segue sem posição", () => {
    let current = applyLotEvent(lotState({ myPseudonym: "Licitante AAAA" }), placed()).state;
    expect(current.lot).toMatchObject({ myRank: 1, myBestBidCents: 1_500_000 });
    current = applyLotEvent(
      current,
      placed({ version: 2, bid: bid(2, "Licitante BBBB", 1_550_000), currentBidCents: 1_550_000, bidCount: 2, bidderCount: 2 }),
    ).state;
    expect(current.lot).toMatchObject({ myRank: 2, myBestBidCents: 1_500_000, bidderCount: 2 });

    const stranger = applyLotEvent(lotState({ myPseudonym: "Licitante ZZZZ" }), placed()).state;
    expect(stranger.lot.myRank).toBeNull();
    expect(stranger.lot.myBestBidCents).toBeNull();
  });

  it("evento de outro lote é ignorado, seja qual for a versão", () => {
    const state = atFive();
    expect(applyLotEvent(state, placed({ lotId: "outro", version: 6 }))).toEqual({ state, action: "ignored" });
    expect(applyLotEvent(state, closed({ lotId: "outro" })).action).toBe("ignored");
    expect(applyLotEvent(state, cancelled({ lotId: "outro" })).action).toBe("ignored");
  });

  it("o serverTime do estado só avança: evento atrasado não o faz voltar", () => {
    const state = { ...atFive(), serverTime: "2026-10-24T15:10:00.000Z" };
    const result = applyLotEvent(state, placed({ version: 6, bid: bid(6, "Licitante CCCC", 2_000_000), serverTime: "2026-10-24T15:00:09.000Z" }));
    expect(result.action).toBe("applied");
    expect(result.state.serverTime).toBe("2026-10-24T15:10:00.000Z");
  });
});

describe("applyLotEvent · lot:closed (AC-4.14)", () => {
  it("mesma versão aplica (terminal, `>=`); versão à frente pede o GET; repetido dá resultado idêntico", () => {
    const state = atFive();
    const first = applyLotEvent(state, closed());
    expect(first.action).toBe("applied");
    expect(first.state.lot).toMatchObject({ status: "SOLD", currentBidCents: 2_000_000, version: 5 });

    const ahead = applyLotEvent(state, closed({ version: 7 }));
    expect(ahead).toEqual({ state, action: "refetch" });

    const repeated = applyLotEvent(first.state, closed());
    expect(repeated.action).toBe("applied");
    expect(repeated.state).toEqual(first.state);
  });

  it("sem lances: UNSOLD, e o lance atual segue nulo", () => {
    const result = applyLotEvent(lotState(), closed({ version: 0, outcome: "UNSOLD", finalBidCents: undefined }));
    expect(result.action).toBe("applied");
    expect(result.state.lot).toMatchObject({ status: "UNSOLD", currentBidCents: null });
  });

  it("versão atrás do estado é descartada", () => {
    expect(applyLotEvent(atFive(), closed({ version: 4 })).action).toBe("ignored");
  });
});

describe("needsResultSnapshot (lot:closed não traz result nem token)", () => {
  it("aplicar o lot:closed pede o GET que traz o resultado; os outros eventos não", () => {
    expect(needsResultSnapshot(closed(), "applied")).toBe(true);
    expect(needsResultSnapshot(closed(), "ignored")).toBe(false);
    expect(needsResultSnapshot(closed({ version: 9 }), "refetch")).toBe(false);
  });
});

describe("applyLotEvent · lot:cancelled (AC-4.15)", () => {
  it("version 6 com o estado em 5 pede o GET (sem cancelledAt no payload, o estado não fecha sozinho); em 4 também", () => {
    const five = atFive();
    expect(applyLotEvent(five, cancelled())).toEqual({ state: five, action: "refetch" });
    const four = lotState({ version: 4, entryCount: 4 }, [4, 3, 2, 1].map((s) => bid(s, "Licitante AAAA", 1_000_000 + s)));
    expect(applyLotEvent(four, cancelled()).action).toBe("refetch");
  });

  it("com o estado em 6 ou mais, ignora", () => {
    const six = lotState({ version: 6, entryCount: 6 });
    expect(applyLotEvent(six, cancelled()).action).toBe("ignored");
    expect(applyLotEvent(lotState({ version: 9, entryCount: 9 }), cancelled()).action).toBe("ignored");
  });
});

describe("applyBidResponse (R-4.14: a resposta do POST passa pelo mesmo reducer)", () => {
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

  it("aplica e fica com a posição e o pseudônimo que o servidor calculou", () => {
    const result = applyBidResponse(lotState(), response);
    expect(result.action).toBe("applied");
    expect(result.state.lot).toMatchObject({ myRank: 1, myBestBidCents: 1_500_000, myPseudonym: "Licitante AAAA", version: 1, minimumBidCents: 1_550_000 });
    expect(result.state.lot.endsAt).toBe("2026-10-25T10:02:00.000Z");
    expect(result.state.bids).toHaveLength(1);
  });

  it("o evento do próprio lance que chega depois, com o mesmo version, é descartado: sem linha duplicada", () => {
    const fromResponse = applyBidResponse(lotState(), response).state;
    const late = applyLotEvent(fromResponse, placed({ endsAt: "2026-10-25T10:02:00.000Z" }));
    expect(late).toEqual({ state: fromResponse, action: "ignored" });
    expect(fromResponse.bids).toHaveLength(1);
  });

  it("evento primeiro, resposta depois: a resposta é descartada, também sem duplicar", () => {
    const fromEvent = applyLotEvent(lotState({ myPseudonym: "Licitante AAAA" }), placed()).state;
    const afterResponse = applyBidResponse(fromEvent, response);
    expect(afterResponse.action).toBe("ignored");
    expect(afterResponse.state.bids).toHaveLength(1);
  });

  it("resposta à frente de um lance que o cliente perdeu pede o GET", () => {
    const behind = lotState();
    const result = applyBidResponse(behind, { ...response, lot: { ...response.lot, version: 3 } });
    expect(result).toEqual({ state: behind, action: "refetch" });
  });
});

describe("mergeSnapshot (R-4.8)", () => {
  it("snapshot mais velho que o cache não o substitui (um evento já passou dele)", () => {
    const cache = atFive();
    const old = lotState({ version: 4, entryCount: 4 }, [4, 3, 2, 1].map((s) => bid(s, "Licitante AAAA", 1_000_000 + s)));
    expect(mergeSnapshot(cache, old)).toBe(cache);
  });

  it("mesma versão ou mais nova substitui; sem cache, vale o snapshot", () => {
    const cache = atFive();
    const same = { ...atFive(), serverTime: "2026-10-24T15:09:00.000Z" };
    expect(mergeSnapshot(cache, same)).toBe(same);
    const newer = lotState({ version: 6, entryCount: 6 });
    expect(mergeSnapshot(cache, newer)).toBe(newer);
    expect(mergeSnapshot(undefined, same)).toBe(same);
  });

  it("snapshot da mesma versão, de antes do fechamento, não desfaz um lot:closed já aplicado", () => {
    const closedState = applyLotEvent(atFive(), closed()).state;
    const stale = lotState({ status: "CLOSING", version: 5, entryCount: 5 });
    expect(mergeSnapshot(closedState, stale)).toBe(closedState);
  });
});

describe("reconexão do cliente (AC-4.18, AC-4.19)", () => {
  it("perdeu um lance de prorrogação: o evento seguinte é salto, o GET refeito vira o estado, sem duplicata", () => {
    // O cliente está em 5; o servidor foi a 7. Os lances 6 (prorrogação) e 7 não chegaram.
    const cache = atFive();
    const sevenBids = [7, 6, 5, 4, 3, 2, 1].map((seq) => bid(seq, seq % 2 ? "Licitante AAAA" : "Licitante BBBB", 1_500_000 + seq * 80_000));
    const server = lotState(
      { version: 7, entryCount: 7, endsAt: "2026-10-25T10:02:00.000Z", currentBidCents: 2_060_000, minimumBidCents: 2_110_000, bidCount: 7, bidderCount: 2 },
      sevenBids,
    );

    // Chega o evento 8 depois de reconectar: salto, o reducer não aplica e pede o GET.
    const jump = applyLotEvent(cache, placed({ version: 8, bid: bid(8, "Licitante CCCC", 2_200_000) }));
    expect(jump.action).toBe("refetch");

    // O GET (version 7) chega: a guarda de snapshot aceita (7 >= 5) e o estado equivale ao do servidor.
    const merged = mergeSnapshot(cache, server);
    expect(merged).toBe(server);
    expect(merged.bids.map((b) => b.seq)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(new Set(merged.bids.map((b) => b.seq)).size).toBe(merged.bids.length);
    expect(Date.parse(merged.lot.endsAt)).toBeGreaterThan(Date.parse(merged.lot.originalEndsAt));

    // O evento 8, reaplicado sobre o snapshot, agora encaixa (8 == 7 + 1) e o 7 repetido é descartado.
    expect(applyLotEvent(merged, placed({ version: 8, bid: bid(8, "Licitante CCCC", 2_200_000) })).action).toBe("applied");
    expect(applyLotEvent(merged, placed({ version: 7, bid: bid(7, "Licitante AAAA", 2_060_000) })).action).toBe("ignored");
  });
});
