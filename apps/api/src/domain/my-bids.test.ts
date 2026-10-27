import { describe, expect, it } from "vitest";
import type { BidderLotState } from "@lanceauto/shared";
import { bestByLot, compareMyBids, positionOf, type BestRow, type Sortable } from "./my-bids";

const row = (lotId: string, bidderId: string, bestCents: number): BestRow => ({ lotId, bidderId, bestCents });

describe("bestByLot", () => {
  it("agrupa o maior lance de cada licitante por lote", () => {
    const map = bestByLot([row("L1", "A", 30_000), row("L1", "B", 28_000), row("L2", "A", 10_000)]);
    expect([...map.keys()].sort()).toEqual(["L1", "L2"]);
    expect(map.get("L1")?.get("A")).toBe(30_000);
    expect(map.get("L1")?.get("B")).toBe(28_000);
    expect(map.get("L2")?.size).toBe(1);
  });

  it("várias linhas do mesmo licitante contam uma vez, com o maior valor", () => {
    const map = bestByLot([row("L1", "B", 25_000), row("L1", "B", 28_000), row("L1", "B", 26_000)]);
    expect(map.get("L1")?.size).toBe(1);
    expect(map.get("L1")?.get("B")).toBe(28_000);
  });
});

describe("positionOf (R-7.5, rankFrom)", () => {
  const best = (entries: Array<[string, number]>) => new Map(entries);

  it("um só licitante: 1º de 1", () => {
    expect(positionOf(best([["A", 30_000]]), "A")).toEqual({ rank: 1, bidderCount: 1, myBestBidCents: 30_000 });
  });

  it("três licitantes: B com 28.000 entre 30.000 e 25.000 é 2º de 3 (AC-7.4)", () => {
    const map = best([
      ["A", 30_000],
      ["B", 28_000],
      ["C", 25_000],
    ]);
    expect(positionOf(map, "A")).toMatchObject({ rank: 1, bidderCount: 3 });
    expect(positionOf(map, "B")).toEqual({ rank: 2, bidderCount: 3, myBestBidCents: 28_000 });
    expect(positionOf(map, "C")).toMatchObject({ rank: 3, bidderCount: 3 });
  });

  it("vários lances do mesmo licitante contam só o maior e não inflam o número de licitantes", () => {
    const map = bestByLot([row("L", "A", 30_000), row("L", "B", 25_000), row("L", "B", 28_000), row("L", "C", 25_000)]).get("L");
    expect(positionOf(map, "B")).toEqual({ rank: 2, bidderCount: 3, myBestBidCents: 28_000 });
  });

  it("sem lance meu (ou lote sem linhas), null", () => {
    expect(positionOf(best([["A", 30_000]]), "Z")).toBeNull();
    expect(positionOf(undefined, "A")).toBeNull();
  });
});

describe("compareMyBids (R-7.9, decisão 3)", () => {
  const at = (hour: number) => Date.UTC(2026, 9, 27, hour);
  const item = (state: BidderLotState, hour: number, number: number): Sortable => ({ state, endsAtMs: at(hour), number });
  const order = (items: Sortable[]) =>
    [...items].sort(compareMyBids).map((i) => `${i.state}-${i.number}`);

  it("ativos antes dos finalizados; OUTBID antes de LEADING; cada um por fim crescente", () => {
    const sorted = order([
      item("LEADING", 10, 1),
      item("WON", 20, 2),
      item("OUTBID", 15, 3),
      item("OUTBID", 12, 4),
      item("LEADING", 11, 5),
    ]);
    expect(sorted).toEqual(["OUTBID-4", "OUTBID-3", "LEADING-1", "LEADING-5", "WON-2"]);
  });

  it("WON, LOST e CANCELLED ficam juntos, pelo fim decrescente", () => {
    const sorted = order([
      item("CANCELLED", 8, 1),
      item("WON", 9, 2),
      item("LOST", 10, 3),
      item("CANCELLED", 7, 4),
    ]);
    expect(sorted).toEqual(["LOST-3", "WON-2", "CANCELLED-1", "CANCELLED-4"]);
  });

  it("empate no fim: ativos pelo número crescente, finalizados pelo número decrescente", () => {
    expect(order([item("OUTBID", 10, 9), item("OUTBID", 10, 2)])).toEqual(["OUTBID-2", "OUTBID-9"]);
    expect(order([item("LOST", 10, 2), item("WON", 10, 9)])).toEqual(["WON-9", "LOST-2"]);
  });

  it("é determinística qualquer que seja a ordem de entrada", () => {
    const items = [
      item("WON", 20, 2),
      item("OUTBID", 12, 4),
      item("LEADING", 10, 1),
      item("CANCELLED", 21, 5),
      item("LOST", 20, 3),
    ];
    const expected = order(items);
    expect(order([...items].reverse())).toEqual(expected);
    expect(expected).toEqual(["OUTBID-4", "LEADING-1", "CANCELLED-5", "LOST-3", "WON-2"]);
  });
});
