import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_ANNOUNCEMENT,
  MY_BIDS_DEBOUNCE_MS,
  advanceAnnouncement,
  anchorId,
  createDebounced,
  decideEvent,
  mergeSeen,
  resolveAnchor,
  seenFromItems,
  transitionAnnouncements,
} from "./my-bids-events";
import { card, item } from "./my-bids-fixtures";

describe("decideEvent — showcase:lot (S07 §7)", () => {
  const seen = seenFromItems([item("OUTBID", { myRank: 2 }, { id: "a", version: 5, status: "LIVE" })]);

  it("evento de lote fora da lista: ignorado, sem refazer a consulta", () => {
    const result = decideEvent(seen, card({ id: "outro", version: 9 }));
    expect(result.action).toBe("ignore");
    expect(result.seen).toBe(seen);
  });

  it("versão maior do lote da lista: refaz", () => {
    expect(decideEvent(seen, card({ id: "a", version: 6, status: "LIVE" })).action).toBe("refetch");
  });

  it("versão menor que a já vista: descartada", () => {
    const result = decideEvent(seen, card({ id: "a", version: 4, status: "LIVE" }));
    expect(result.action).toBe("ignore");
    expect(result.seen).toBe(seen);
  });

  it("versão igual e mesmo status: ignorada (evento repetido)", () => {
    expect(decideEvent(seen, card({ id: "a", version: 5, status: "LIVE" })).action).toBe("ignore");
  });

  it("versão igual, status mudou (o fechamento não sobe a versão): refaz", () => {
    expect(decideEvent(seen, card({ id: "a", version: 5, status: "SOLD" })).action).toBe("refetch");
  });

  it("depois de refazer, o mesmo evento repetido não refaz de novo", () => {
    const first = decideEvent(seen, card({ id: "a", version: 6, status: "LIVE" }));
    expect(first.action).toBe("refetch");
    expect(decideEvent(first.seen, card({ id: "a", version: 6, status: "LIVE" })).action).toBe("ignore");
  });

  it("evento mais velho depois de um mais novo continua descartado", () => {
    const first = decideEvent(seen, card({ id: "a", version: 7, status: "LIVE" }));
    expect(decideEvent(first.seen, card({ id: "a", version: 6, status: "LIVE" })).action).toBe("ignore");
  });

  it("lista ainda sem dados: nada é da lista, tudo é ignorado", () => {
    expect(decideEvent(seenFromItems(undefined), card({ id: "a", version: 1 })).action).toBe("ignore");
  });
});

describe("mergeSeen — a resposta do GET renova o que foi visto", () => {
  it("a resposta vale, inclusive em empate de versão (o próximo evento corrige)", () => {
    const afterEvent = decideEvent(seenFromItems([item("OUTBID", {}, { id: "a", version: 5, status: "LIVE" })]), card({ id: "a", version: 5, status: "SOLD" })).seen;
    const merged = mergeSeen(afterEvent, [item("OUTBID", {}, { id: "a", version: 5, status: "CLOSING" })]);
    expect(merged.get("a")).toEqual({ version: 5, status: "CLOSING" });
  });

  it("não regride para versão menor do que um evento já trouxe", () => {
    const afterEvent = decideEvent(seenFromItems([item("OUTBID", {}, { id: "a", version: 5 })]), card({ id: "a", version: 7, status: "LIVE" })).seen;
    const merged = mergeSeen(afterEvent, [item("OUTBID", {}, { id: "a", version: 6 })]);
    expect(merged.get("a")?.version).toBe(7);
  });

  it("lote que saiu da resposta sai do que foi visto", () => {
    const merged = mergeSeen(seenFromItems([item("LEADING", {}, { id: "a" }), item("LEADING", {}, { id: "b", number: 2 })]), [item("LEADING", {}, { id: "a" })]);
    expect([...merged.keys()]).toEqual(["a"]);
  });
});

describe("debounce de 300 ms", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a constante é 300 ms (S07 §7)", () => {
    expect(MY_BIDS_DEBOUNCE_MS).toBe(300);
  });

  it("uma rajada vira uma só chamada, 300 ms depois da última", () => {
    const fn = vi.fn();
    const debounced = createDebounced(fn, MY_BIDS_DEBOUNCE_MS);
    debounced.call();
    vi.advanceTimersByTime(200);
    debounced.call();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancelar impede a chamada pendente", () => {
    const fn = vi.fn();
    const debounced = createDebounced(fn, MY_BIDS_DEBOUNCE_MS);
    debounced.call();
    debounced.cancel();
    vi.advanceTimersByTime(1_000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("transitionAnnouncements — só entre duas respostas do servidor (§8)", () => {
  const before = [item("LEADING", {}, { id: "a", number: 18 }), item("OUTBID", { myRank: 2 }, { id: "b", number: 2 })];

  it("na carga inicial (sem resposta anterior) não anuncia nada", () => {
    expect(transitionAnnouncements(undefined, [item("OUTBID", { myRank: 2 }, { number: 18 })])).toEqual([]);
  });

  it("LEADING → OUTBID anuncia 'você foi superado'", () => {
    const after = [item("OUTBID", { myRank: 2 }, { id: "a", number: 18 }), before[1]!];
    expect(transitionAnnouncements(before, after)).toEqual(["Lote 018: você foi superado."]);
  });

  it("os quatro anúncios da fatia", () => {
    const prev = [
      item("LEADING", {}, { id: "a", number: 1 }),
      item("OUTBID", {}, { id: "b", number: 2 }),
      item("LEADING", {}, { id: "c", number: 3 }),
      item("OUTBID", {}, { id: "d", number: 4 }),
    ];
    const next = [
      item("OUTBID", {}, { id: "a", number: 1 }),
      item("WON", {}, { id: "b", number: 2 }),
      item("CANCELLED", {}, { id: "c", number: 3 }),
      item("LOST", {}, { id: "d", number: 4 }),
    ];
    expect(transitionAnnouncements(prev, next)).toEqual([
      "Lote 001: você foi superado.",
      "Lote 002: você arrematou.",
      "Lote 003: cancelado.",
      "Lote 004: não foi desta vez.",
    ]);
  });

  it("voltar a LEADING e manter o estado não anunciam", () => {
    const next = [item("LEADING", {}, { id: "a", number: 18 }), item("LEADING", {}, { id: "b", number: 2 })];
    expect(transitionAnnouncements(before, next)).toEqual([]);
  });

  it("lote que apareceu agora (não estava na resposta anterior) não anuncia", () => {
    expect(transitionAnnouncements(before, [...before, item("OUTBID", { myRank: 2 }, { id: "z", number: 30 })])).toEqual([]);
  });

  it("lista anterior vazia (conta sem lances que deu o primeiro): não anuncia", () => {
    expect(transitionAnnouncements([], [item("OUTBID", { myRank: 2 })])).toEqual([]);
  });
});

describe("âncora #lote-NNN (AC-7.20)", () => {
  const list = [item("WON", {}, { id: "a", number: 18, status: "SOLD" }), item("LEADING", {}, { id: "b", number: 2 })];

  it("o id do <li> tem três dígitos", () => {
    expect(anchorId(18)).toBe("lote-018");
    expect(anchorId(2)).toBe("lote-002");
  });

  it("acha o ingresso e manda a aba de volta para 'Todos'", () => {
    expect(resolveAnchor("#lote-018", list)).toEqual({ elementId: "lote-018", tab: "ALL" });
    expect(resolveAnchor("#lote-002", list)).toEqual({ elementId: "lote-002", tab: "ALL" });
  });

  it("aceita o número sem zeros à esquerda", () => {
    expect(resolveAnchor("#lote-18", list)).toEqual({ elementId: "lote-018", tab: "ALL" });
  });

  it("lote que não está na lista, hash vazio ou estranho: nada a fazer", () => {
    expect(resolveAnchor("#lote-099", list)).toBeNull();
    expect(resolveAnchor("", list)).toBeNull();
    expect(resolveAnchor("#outra-coisa", list)).toBeNull();
    expect(resolveAnchor("#lote-", list)).toBeNull();
    expect(resolveAnchor("#lote-1x", list)).toBeNull();
  });
});

describe("advanceAnnouncement — o estado da região viva", () => {
  const response = (items: ReturnType<typeof item>[]) => ({ items, serverTime: "2026-10-25T09:00:00.000Z" });

  it("a primeira resposta guarda a lista e não anuncia", () => {
    const state = advanceAnnouncement(INITIAL_ANNOUNCEMENT, response([item("OUTBID", { myRank: 2 }, { number: 18 })]));
    expect(state.text).toBe("");
    expect(state.seq).toBe(0);
    expect(state.items).toHaveLength(1);
  });

  it("a segunda resposta, com transição, anuncia e sobe a sequência (a região é um nó novo a cada anúncio)", () => {
    const first = advanceAnnouncement(INITIAL_ANNOUNCEMENT, response([item("LEADING", {}, { id: "a", number: 18 })]));
    const second = advanceAnnouncement(first, response([item("OUTBID", { myRank: 2 }, { id: "a", number: 18 })]));
    expect(second.text).toBe("Lote 018: você foi superado.");
    expect(second.seq).toBe(1);
  });

  it("segunda resposta sem transição mantém o último texto e a sequência", () => {
    const first = advanceAnnouncement(INITIAL_ANNOUNCEMENT, response([item("LEADING", {}, { id: "a", number: 18 })]));
    const second = advanceAnnouncement(first, response([item("OUTBID", { myRank: 2 }, { id: "a", number: 18 })]));
    const third = advanceAnnouncement(second, response([item("OUTBID", { myRank: 2 }, { id: "a", number: 18 })]));
    expect(third.text).toBe(second.text);
    expect(third.seq).toBe(second.seq);
  });

  it("o mesmo anúncio duas vezes seguidas ganha outra sequência, para o leitor de tela repetir", () => {
    let state = advanceAnnouncement(INITIAL_ANNOUNCEMENT, response([item("LEADING", {}, { id: "a", number: 18 })]));
    state = advanceAnnouncement(state, response([item("OUTBID", { myRank: 2 }, { id: "a", number: 18 })]));
    state = advanceAnnouncement(state, response([item("LEADING", {}, { id: "a", number: 18 })]));
    state = advanceAnnouncement(state, response([item("OUTBID", { myRank: 2 }, { id: "a", number: 18 })]));
    expect(state.text).toBe("Lote 018: você foi superado.");
    expect(state.seq).toBe(2);
  });
});
