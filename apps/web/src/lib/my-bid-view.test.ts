import { describe, expect, it } from "vitest";
import { myBidView, receiptHref } from "./my-bid-view";
import { item } from "./my-bids-fixtures";

const ENDS = Date.parse("2026-10-25T10:00:00.000Z");
const BEFORE = ENDS - 60_000;
const AFTER = ENDS + 1_000;

const labels = (view: ReturnType<typeof myBidView>) => view.actions.map((action) => action.label);

describe("myBidView — LEADING e OUTBID ao vivo (S07 §8, §9)", () => {
  it("LEADING: placar verde com a posição, frase do lance travado, só 'Ir para a sala'", () => {
    const view = myBidView(item("LEADING", { bidderCount: 3 }), BEFORE);
    expect(view.closing).toBe(false);
    expect(view.seal).toEqual({ kind: "placar", tone: "verde", title: "VOCÊ ESTÁ GANHANDO", sub: "1º de 3" });
    expect(view.sentence).toBe("Seu lance de R$ 33.000,00 está na frente. Esse valor está travado neste lote.");
    expect(view.actions).toEqual([
      { kind: "room", label: "Ir para a sala", ariaLabel: "Ir para a sala do lote 018, Gol GTI 2.0 1996", href: "/lotes/lot-18" },
    ]);
    expect(view.values).toEqual([
      { label: "SEU MAIOR LANCE", cents: 3_300_000 },
      { label: "LANCE ATUAL", cents: 3_350_000 },
    ]);
  });

  it("OUTBID: placar ferrugem com a posição e 'Cobrir lance' como a única ação ocre", () => {
    const view = myBidView(item("OUTBID", { myRank: 2, bidderCount: 2 }), BEFORE);
    expect(view.seal).toEqual({ kind: "placar", tone: "ferrugem", title: "VOCÊ FOI SUPERADO", sub: "2º de 2" });
    expect(view.sentence).toBe("Seu lance (R$ 33.000,00) é o 2º maior de 2");
    expect(view.actions).toEqual([
      { kind: "cover", label: "Cobrir lance", ariaLabel: "Cobrir lance no lote 018, Gol GTI 2.0 1996", href: "/lotes/lot-18" },
    ]);
    expect(view.actions.filter((action) => action.kind === "cover")).toHaveLength(1);
  });

  it("o relógio ainda antes do fim não é 'apurando'", () => {
    expect(myBidView(item("OUTBID", { myRank: 2 }), ENDS - 1).closing).toBe(false);
  });
});

describe("myBidView — apurando (AC-7.8, R-7.3)", () => {
  it.each(["LEADING", "OUTBID"] as const)("%s com o relógio depois de endsAt: selo neutro, frase do martelo, só 'Ir para a sala'", (state) => {
    const view = myBidView(item(state, { myRank: state === "LEADING" ? 1 : 2 }), AFTER);
    expect(view.closing).toBe(true);
    expect(view.seal).toEqual({ kind: "placar", tone: "neutro", title: "APURANDO", sub: null });
    expect(view.sentence).toBe("Martelo batido. Apurando o resultado…");
    expect(labels(view)).toEqual(["Ir para a sala"]);
    expect(view.actions.some((action) => action.kind === "cover")).toBe(false);
  });

  it("não mostra posição nem 'ganhando/superado' nenhum", () => {
    const text = JSON.stringify(myBidView(item("OUTBID", { myRank: 2, bidderCount: 5 }), AFTER));
    expect(text).not.toMatch(/GANHANDO|SUPERADO|º de|Cobrir lance/);
  });

  it("derivado do relógio: o servidor ainda diz LIVE, mas o relógio passou de endsAt", () => {
    expect(myBidView(item("OUTBID", { myRank: 2 }, { status: "LIVE" }), AFTER).closing).toBe(true);
  });

  it("o servidor já diz CLOSING: apurando, mesmo com o relógio local atrasado", () => {
    expect(myBidView(item("OUTBID", { myRank: 2 }, { status: "CLOSING" }), BEFORE).closing).toBe(true);
  });

  it("relógio ainda não acertado (0): confia no status do cartão", () => {
    expect(myBidView(item("OUTBID", { myRank: 2 }, { status: "LIVE" }), 0).closing).toBe(false);
    expect(myBidView(item("OUTBID", { myRank: 2 }, { status: "CLOSING" }), 0).closing).toBe(true);
  });

  it("estados finais nunca viram 'apurando', não importa o relógio", () => {
    for (const state of ["WON", "LOST", "CANCELLED"] as const) {
      expect(myBidView(item(state, {}, { status: state === "CANCELLED" ? "CANCELLED" : "SOLD" }), AFTER).closing).toBe(false);
    }
  });
});

describe("myBidView — estados finais", () => {
  it("WON: carimbo Arrematado, frase do valor final, 'Ver comprovante' para o token e 'Copiar link'", () => {
    const view = myBidView(item("WON", { myBestBidCents: 3_350_000 }, { status: "SOLD" }), AFTER);
    expect(view.seal).toEqual({ kind: "stamp", variant: "arrematado" });
    expect(view.sentence).toBe("Você arrematou por R$ 33.500,00.");
    expect(view.actions).toEqual([
      { kind: "receipt", label: "Ver comprovante", ariaLabel: "Ver comprovante do lote 018, Gol GTI 2.0 1996", href: "/c/tok-abc" },
      { kind: "copy", label: "Copiar link", ariaLabel: "Copiar link do comprovante do lote 018, Gol GTI 2.0 1996", token: "tok-abc" },
    ]);
    expect(view.values).toEqual([
      { label: "SEU MAIOR LANCE", cents: 3_350_000 },
      { label: "VALOR FINAL", cents: 3_350_000 },
    ]);
  });

  it("WON sem token (defeito): sem 'Ver comprovante' nem 'Copiar link', só a frase", () => {
    const view = myBidView(item("WON", { receiptToken: null }, { status: "SOLD" }), AFTER);
    expect(view.actions).toEqual([]);
    expect(view.sentence).toBe("Você arrematou por R$ 33.500,00.");
  });

  it("LOST: carimbo Perdido, quem levou e o maior lance meu, sem ação (S08 acrescenta a auditoria)", () => {
    const view = myBidView(item("LOST", { myBestBidCents: 3_300_000 }, { status: "SOLD", currentBidCents: 3_350_000 }), AFTER);
    expect(view.seal).toEqual({ kind: "stamp", variant: "perdido" });
    expect(view.sentence).toBe("Licitante 7F3A levou por R$ 33.500,00. Seu maior lance foi R$ 33.000,00.");
    expect(view.actions).toEqual([]);
    expect(view.values[1]).toEqual({ label: "VALOR FINAL", cents: 3_350_000 });
  });

  it("CANCELLED sem estorno: carimbo Cancelado, 'ÚLTIMO LANCE', sem a frase do saldo", () => {
    const view = myBidView(item("CANCELLED", { refundedCents: null }, { status: "CANCELLED" }), AFTER);
    expect(view.seal).toEqual({ kind: "stamp", variant: "cancelado" });
    expect(view.sentence).toBe("O leiloeiro cancelou este lote. Nada foi vendido.");
    expect(view.values[1]).toEqual({ label: "ÚLTIMO LANCE", cents: 3_350_000 });
    expect(view.actions).toEqual([]);
  });

  it("CANCELLED liderando: acrescenta que o saldo voltou", () => {
    const view = myBidView(item("CANCELLED", { refundedCents: 3_350_000 }, { status: "CANCELLED" }), AFTER);
    expect(view.sentence).toBe("O leiloeiro cancelou este lote. Nada foi vendido. O saldo que estava travado voltou para você.");
  });

  it("LOST e CANCELLED nunca ganham botão ocre nem 'Conferir na auditoria' (S08)", () => {
    for (const state of ["LOST", "CANCELLED"] as const) {
      const view = myBidView(item(state, {}, { status: state === "CANCELLED" ? "CANCELLED" : "SOLD" }), AFTER);
      expect(view.actions.some((action) => action.kind === "cover" || /auditoria/i.test(action.label))).toBe(false);
    }
  });

  it("valor final ausente no cartão cai no meu maior lance, sem 'R$ NaN'", () => {
    const view = myBidView(item("LOST", {}, { status: "SOLD", currentBidCents: null }), AFTER);
    expect(view.values[1]?.cents).toBe(3_300_000);
  });
});

describe("myBidView — nomes acessíveis e privacidade", () => {
  it("o nome acessível de cada ação carrega o número e o título do lote, então é único na lista", () => {
    const items = [
      item("OUTBID", { myRank: 2 }, { id: "a", number: 18 }),
      item("WON", {}, { id: "b", number: 9, status: "SOLD", title: "Fusca 1300 1975" }),
      item("LEADING", {}, { id: "c", number: 2, title: "Uno Mille 2010" }),
      item("WON", { receiptToken: "tok-2" }, { id: "d", number: 8, status: "SOLD", title: "Opala 1980" }),
    ];
    const names = items.flatMap((entry) => myBidView(entry, BEFORE).actions.map((action) => action.ariaLabel));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Ver comprovante do lote 009, Fusca 1300 1975");
    expect(names).toContain("Ver comprovante do lote 008, Opala 1980");
  });

  it("cada 'Ver comprovante' aponta para o token do PRÓPRIO lote", () => {
    const a = myBidView(item("WON", { receiptToken: "tok-a" }, { id: "a", number: 9, status: "SOLD" }), AFTER);
    const b = myBidView(item("WON", { receiptToken: "tok-b" }, { id: "b", number: 8, status: "SOLD" }), AFTER);
    expect(a.actions.find((action) => action.kind === "receipt")).toMatchObject({ href: "/c/tok-a" });
    expect(b.actions.find((action) => action.kind === "receipt")).toMatchObject({ href: "/c/tok-b" });
  });

  it("a visão não carrega userId, nome nem e-mail", () => {
    const text = JSON.stringify(myBidView(item("WON", {}, { status: "SOLD" }), AFTER));
    expect(text).not.toMatch(/userId|"name"|email|leaderId/);
  });

  it("pseudônimo próprio no formato da fatia", () => {
    expect(myBidView(item("LEADING"), BEFORE).ownPseudonym).toBe("Neste lote você é Licitante C3E8.");
  });

  it("receiptHref é o caminho público do comprovante", () => {
    expect(receiptHref("tok-abc")).toBe("/c/tok-abc");
  });
});
