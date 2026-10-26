import { describe, expect, it } from "vitest";
import type { LotStatus, MyLotCard } from "@lanceauto/shared";
import { canCancel, cancelButtonLabel, cancelledColumns, refundLabel, splitMyLots } from "./panel-sections";

function row(over: Partial<MyLotCard> & { id: string; status: LotStatus }): MyLotCard {
  return {
    number: 1,
    title: "Lote",
    brand: "Fiat",
    model: "Uno",
    year: 2010,
    fuel: "Flex",
    currentBidCents: null,
    startingBidCents: 1_000_000,
    minIncrementCents: 50_000,
    referencePriceCents: 2_000_000,
    bidCount: 0,
    version: 0,
    startsAt: "2026-10-23T10:00:00.000Z",
    endsAt: "2026-10-24T10:00:00.000Z",
    originalEndsAt: "2026-10-24T10:00:00.000Z",
    cancelledAt: null,
    imageUrl: null,
    resultado: null,
    refundedCents: null,
    ...over,
  };
}

describe("splitMyLots (S06 §9.1)", () => {
  const lots = [
    row({ id: "live", status: "LIVE" }),
    row({ id: "closing", status: "CLOSING" }),
    row({ id: "sched", status: "SCHEDULED" }),
    row({ id: "sold", status: "SOLD" }),
    row({ id: "unsold", status: "UNSOLD" }),
    row({ id: "c1", status: "CANCELLED", cancelledAt: "2026-10-23T12:00:00.000Z" }),
    row({ id: "c2", status: "CANCELLED", cancelledAt: "2026-10-23T11:00:00.000Z" }),
  ];

  it("separa ao vivo (com apurando), agendados, encerrados e cancelados, mantendo a ordem do servidor", () => {
    const sections = splitMyLots(lots);
    expect(sections.live.map((l) => l.id)).toEqual(["live", "closing"]);
    expect(sections.scheduled.map((l) => l.id)).toEqual(["sched"]);
    expect(sections.ended.map((l) => l.id)).toEqual(["sold", "unsold"]);
    expect(sections.cancelled.map((l) => l.id)).toEqual(["c1", "c2"]);
  });

  it("cancelado não entra nos placares nem na contagem de arrematados", () => {
    const sections = splitMyLots(lots);
    expect(sections.live.length + sections.scheduled.length + sections.ended.length).toBe(5);
    expect(sections.soldCount).toBe(1);
  });

  it("sem cancelados a seção vem vazia (a tela não desenha nenhuma caixa)", () => {
    expect(splitMyLots(lots.filter((l) => l.status !== "CANCELLED")).cancelled).toEqual([]);
  });
});

describe("botão Cancelar", () => {
  it("só em lote ao vivo ou agendado, com ou sem lances; nunca em apurando, encerrado ou cancelado", () => {
    expect(canCancel(row({ id: "a", status: "LIVE", bidCount: 3 }))).toBe(true);
    expect(canCancel(row({ id: "a", status: "LIVE" }))).toBe(true);
    expect(canCancel(row({ id: "a", status: "SCHEDULED" }))).toBe(true);
    for (const status of ["CLOSING", "SOLD", "UNSOLD", "CANCELLED"] as const) expect(canCancel(row({ id: "a", status }))).toBe(false);
  });

  it("nome acessível único por linha: número com 3 dígitos e título", () => {
    expect(cancelButtonLabel(row({ id: "a", status: "LIVE", number: 19, title: "Hilux SRX 2020" }))).toBe("Cancelar lote 019, Hilux SRX 2020");
    expect(cancelButtonLabel(row({ id: "b", status: "LIVE", number: 20, title: "Hilux SRX 2020" }))).not.toBe(
      cancelButtonLabel(row({ id: "a", status: "LIVE", number: 19, title: "Hilux SRX 2020" })),
    );
  });
});

describe("linha de Cancelados", () => {
  it("estorno em reais inteiros ou traço quando ninguém liderava", () => {
    expect(refundLabel(row({ id: "a", status: "CANCELLED", refundedCents: 2_050_000 }))).toBe("R$ 20.500,00");
    expect(refundLabel(row({ id: "a", status: "CANCELLED", refundedCents: null }))).toBe("—");
  });

  it("colunas da §9.1: lote, carro, lances, último lance, estorno, cancelado em (Brasília)", () => {
    const view = cancelledColumns(
      row({ id: "a", status: "CANCELLED", number: 10, title: "Onix", currentBidCents: 2_050_000, bidCount: 2, refundedCents: 2_050_000, cancelledAt: "2026-10-26T20:36:12.967Z" }),
    );
    expect(view).toEqual({
      car: "Fiat Uno 2010",
      bids: "2",
      lastBid: "R$ 20.500,00",
      refund: "R$ 20.500,00",
      cancelledAt: "26/10 17:36",
    });
  });

  it("sem lances: último lance e estorno viram traço", () => {
    const view = cancelledColumns(row({ id: "a", status: "CANCELLED", cancelledAt: "2026-10-26T20:36:12.967Z" }));
    expect([view.bids, view.lastBid, view.refund]).toEqual(["0", "—", "—"]);
  });
});
