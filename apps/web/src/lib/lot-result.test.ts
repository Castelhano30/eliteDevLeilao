import { describe, expect, it } from "vitest";
import type { LotResult } from "@lanceauto/shared";
import { lotState } from "./realtime/fixtures";
import { decideLotResult, isAwaitingResult } from "./lot-result";

const HAMMER = "2026-10-24T17:20:41.000Z"; // 14:20:41 em Brasília
const sold: LotResult = {
  outcome: "SOLD",
  finalBidCents: 3_200_000,
  winnerPseudonym: "Licitante 7F3A",
  hammerAt: HAMMER,
  settledAt: "2026-10-24T17:20:44.000Z",
};
const unsold: LotResult = { outcome: "UNSOLD", finalBidCents: null, winnerPseudonym: null, hammerAt: HAMMER, settledAt: HAMMER };

const lotOf = (over: Parameters<typeof lotState>[0]) => lotState({ title: "Uno Way", endsAt: HAMMER, ...over }).lot;

describe("isAwaitingResult", () => {
  it("apurando é o servidor ainda sem liquidar, ou encerrado cujo resultado ainda não chegou", () => {
    expect(isAwaitingResult({ status: "CLOSING", result: null })).toBe(true);
    expect(isAwaitingResult({ status: "SOLD", result: null })).toBe(true);
    expect(isAwaitingResult({ status: "UNSOLD", result: null })).toBe(true);
    expect(isAwaitingResult({ status: "SOLD", result: sold })).toBe(false);
    for (const status of ["LIVE", "SCHEDULED", "CANCELLED"] as const) expect(isAwaitingResult({ status, result: null })).toBe(false);
  });
});

describe("decideLotResult", () => {
  it("lote que não terminou não tem resultado a mostrar", () => {
    for (const status of ["LIVE", "SCHEDULED", "CANCELLED"] as const) expect(decideLotResult(lotOf({ status }), null)).toBeNull();
  });

  it("apurando: CLOSING ou encerrado sem result; nunca mostra vencedor, carimbo nem comprovante", () => {
    for (const status of ["CLOSING", "SOLD", "UNSOLD"] as const) {
      expect(decideLotResult(lotOf({ status, result: null, myReceiptToken: "x".repeat(32) }), { role: "BIDDER" })).toEqual({ kind: "apurando" });
    }
  });

  it("você arrematou: decide pelo token do servidor e leva faixa verde, frase, carimbo animável e o link do comprovante", () => {
    const token = "A".repeat(32);
    const view = decideLotResult(lotOf({ status: "SOLD", result: sold, myReceiptToken: token, myBestBidCents: 3_200_000 }), { role: "BIDDER" });
    expect(view).toEqual({
      kind: "arrematou",
      band: { title: "Você arrematou", sub: "Martelo batido às 14:20:41 · R$ 32.000,00" },
      sentence: "Você levou o Uno Way por R$ 32.000,00. O valor saiu do saldo e o comprovante já tem link público.",
      receiptToken: token,
      stamp: "arrematado",
      backToShowcase: false,
    });
  });

  it("quem tem o mesmo pseudônimo mas não tem o token não venceu (colisão de 4 hex)", () => {
    const view = decideLotResult(
      lotOf({ status: "SOLD", result: sold, myReceiptToken: null, myPseudonym: "Licitante 7F3A", myBestBidCents: 3_000_000 }),
      { role: "BIDDER" },
    );
    expect(view).toMatchObject({ kind: "nao-venceu" });
    expect(view).not.toHaveProperty("receiptToken");
  });

  it("não venceu, participou: faixa neutra com o vencedor e a frase do saldo liberado; sem comprovante nem volta à vitrine", () => {
    const view = decideLotResult(lotOf({ status: "SOLD", result: sold, myBestBidCents: 3_000_000 }), { role: "BIDDER" });
    expect(view).toEqual({
      kind: "nao-venceu",
      band: { title: "Martelo batido", sub: "Licitante 7F3A levou por R$ 32.000,00" },
      sentence: "Seu saldo foi liberado quando seu lance foi superado.",
      stamp: "arrematado",
      backToShowcase: false,
    });
  });

  it("não venceu, nunca deu lance: igual, sem a frase do saldo e sem volta à vitrine", () => {
    const view = decideLotResult(lotOf({ status: "SOLD", result: sold, myBestBidCents: null }), { role: "BIDDER" });
    expect(view).toMatchObject({ kind: "nao-venceu", sentence: null, backToShowcase: false });
  });

  it("visitante e leiloeiro: sem frase do saldo e com 'Voltar à vitrine', mesmo que o dado traga lance dele", () => {
    for (const viewer of [null, { role: "AUCTIONEER" as const }]) {
      const view = decideLotResult(lotOf({ status: "SOLD", result: sold, myBestBidCents: 3_000_000 }), viewer);
      expect(view).toMatchObject({ kind: "nao-venceu", sentence: null, backToShowcase: true, band: { title: "Martelo batido" } });
    }
  });

  it("sem lances: carimbo tracejado, faixa e frase próprias, sem vencedor; visitante e leiloeiro voltam à vitrine", () => {
    const base = { kind: "sem-lances", band: { title: "Martelo batido", sub: "Este lote encerrou sem lances" }, sentence: "Ninguém quis. Lote fechado sem vencedor.", stamp: "sem-lances" };
    expect(decideLotResult(lotOf({ status: "UNSOLD", result: unsold }), { role: "BIDDER" })).toEqual({ ...base, backToShowcase: false });
    expect(decideLotResult(lotOf({ status: "UNSOLD", result: unsold }), null)).toEqual({ ...base, backToShowcase: true });
    expect(decideLotResult(lotOf({ status: "UNSOLD", result: unsold }), { role: "AUCTIONEER" })).toEqual({ ...base, backToShowcase: true });
  });

  it("o valor mostrado vem do result, não do lance corrente do cache", () => {
    const view = decideLotResult(lotOf({ status: "SOLD", result: sold, currentBidCents: 1, myBestBidCents: 1 }), null);
    expect(view).toMatchObject({ band: { sub: "Licitante 7F3A levou por R$ 32.000,00" } });
  });
});
