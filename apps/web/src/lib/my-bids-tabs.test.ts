import { describe, expect, it } from "vitest";
import { emptyKind, filterByTab, tabCounts, tabsFor, type MyBidsTab } from "./my-bids-tabs";
import { item } from "./my-bids-fixtures";

const list = [
  item("OUTBID", {}, { id: "a", number: 18 }),
  item("LEADING", {}, { id: "b", number: 2 }),
  item("WON", {}, { id: "c", number: 9, status: "SOLD" }),
  item("WON", {}, { id: "d", number: 8, status: "SOLD" }),
  item("LOST", {}, { id: "e", number: 4, status: "SOLD" }),
  item("CANCELLED", {}, { id: "f", number: 10, status: "CANCELLED" }),
];
const ids = (tab: MyBidsTab) => filterByTab(list, tab).map((entry) => entry.lot.id);

describe("abas de Meus arremates (R-7.4, AC-7.15)", () => {
  it("'Todos' tem tudo, inclusive o cancelado", () => {
    expect(ids("ALL")).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("'Em disputa' = ganhando + superado", () => {
    expect(ids("ACTIVE")).toEqual(["a", "b"]);
  });

  it("'Arrematados' só WON e 'Perdidos' só LOST", () => {
    expect(ids("WON")).toEqual(["c", "d"]);
    expect(ids("LOST")).toEqual(["e"]);
  });

  it("CANCELLED só aparece em 'Todos'", () => {
    for (const tab of ["ACTIVE", "WON", "LOST"] as const) expect(ids(tab)).not.toContain("f");
    expect(ids("ALL")).toContain("f");
  });

  it("filtrar mantém a ordem do servidor (o cliente não reordena)", () => {
    const reversed = [...list].reverse();
    expect(filterByTab(reversed, "ALL").map((entry) => entry.lot.id)).toEqual(["f", "e", "d", "c", "b", "a"]);
  });

  it("os contadores batem com as listas filtradas", () => {
    const counts = tabCounts(list);
    expect(counts).toEqual({ ALL: 6, ACTIVE: 2, WON: 2, LOST: 1 });
    for (const tab of ["ALL", "ACTIVE", "WON", "LOST"] as const) expect(counts[tab]).toBe(ids(tab).length);
  });

  it("o cancelado conta em 'Todos' e em nenhuma outra aba", () => {
    const only = [item("CANCELLED", {}, { status: "CANCELLED" })];
    expect(tabCounts(only)).toEqual({ ALL: 1, ACTIVE: 0, WON: 0, LOST: 0 });
  });

  it("lista vazia zera tudo", () => {
    expect(tabCounts([])).toEqual({ ALL: 0, ACTIVE: 0, WON: 0, LOST: 0 });
  });

  it("'Apurando' segue em 'Em disputa': a aba olha o estado, não o relógio", () => {
    const closing = [item("OUTBID", { myRank: 2 }, { status: "CLOSING" })];
    expect(tabCounts(closing).ACTIVE).toBe(1);
  });
});

describe("tabsFor", () => {
  it("monta as quatro abas na ordem da fatia, com os contadores", () => {
    expect(tabsFor(list)).toEqual([
      { value: "ALL", label: "Todos", count: 6 },
      { value: "ACTIVE", label: "Em disputa", count: 2 },
      { value: "WON", label: "Arrematados", count: 2 },
      { value: "LOST", label: "Perdidos", count: 1 },
    ]);
  });
});

describe("emptyKind (S07 §9)", () => {
  it("sem lances nenhum: vazio total, em qualquer aba", () => {
    expect(emptyKind([], "ALL")).toBe("total");
    expect(emptyKind([], "WON")).toBe("total");
  });

  it("aba sem itens, mas o usuário tem lances em outras: vazio por aba", () => {
    const onlyActive = [item("LEADING")];
    expect(emptyKind(onlyActive, "WON")).toBe("tab");
    expect(emptyKind(onlyActive, "LOST")).toBe("tab");
  });

  it("aba com itens: não está vazia", () => {
    expect(emptyKind(list, "ACTIVE")).toBeNull();
    expect(emptyKind(list, "ALL")).toBeNull();
  });

  it("só cancelados: 'Em disputa' fica vazia por aba, 'Todos' não", () => {
    const onlyCancelled = [item("CANCELLED", {}, { status: "CANCELLED" })];
    expect(emptyKind(onlyCancelled, "ACTIVE")).toBe("tab");
    expect(emptyKind(onlyCancelled, "ALL")).toBeNull();
  });
});
