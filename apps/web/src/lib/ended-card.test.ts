import { describe, expect, it } from "vitest";
import type { MyLotResult } from "@lanceauto/shared";
import { endedCardLines, receivedLabel } from "./ended-card";

const sold: MyLotResult = {
  outcome: "SOLD",
  finalBidCents: 5_750_000,
  winnerPseudonym: "Licitante 7F3A",
  referencePriceCents: 5_000_000,
  settledAt: "2026-10-24T17:20:44.000Z",
};

describe("endedCardLines (cartão Encerrado do Painel)", () => {
  it("arrematado: quem levou, o valor, os lances e a comparação com a FIPE", () => {
    expect(endedCardLines(sold, 4)).toEqual({
      kind: "sold",
      headline: "Licitante 7F3A levou",
      value: "R$ 57.500,00",
      bids: "4 lances",
      fipe: "FIPE R$ 50.000,00 · +15,0%",
    });
  });

  it("um lance só fica no singular", () => {
    expect(endedCardLines(sold, 1)).toMatchObject({ bids: "1 lance" });
  });

  it("abaixo da FIPE leva o sinal de menos; sem referência, a linha traz só a FIPE ou some", () => {
    expect(endedCardLines({ ...sold, finalBidCents: 4_850_000 }, 2)).toMatchObject({ fipe: "FIPE R$ 50.000,00 · −3,0%" });
    expect(endedCardLines({ ...sold, referencePriceCents: 0 }, 2)).toMatchObject({ fipe: null });
  });

  it("sem lances: fechado sem lances, sem valor nem FIPE", () => {
    const unsold: MyLotResult = { ...sold, outcome: "UNSOLD", finalBidCents: null, winnerPseudonym: null };
    expect(endedCardLines(unsold, 0)).toEqual({ kind: "unsold", headline: "Fechado sem lances" });
  });

  it("resultado que ainda não chegou ao Painel não inventa nada", () => {
    expect(endedCardLines(null, 3)).toBeNull();
    expect(endedCardLines(undefined, 3)).toBeNull();
  });
});

describe("receivedLabel", () => {
  it("conta os arremates com o plural certo", () => {
    expect(receivedLabel(0)).toBe("TOTAL RECEBIDO · 0 ARREMATES");
    expect(receivedLabel(1)).toBe("TOTAL RECEBIDO · 1 ARREMATE");
    expect(receivedLabel(3)).toBe("TOTAL RECEBIDO · 3 ARREMATES");
  });
});
