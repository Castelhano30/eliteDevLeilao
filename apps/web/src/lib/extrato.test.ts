import { describe, expect, it } from "vitest";
import { dataBr, descreverPeriodo, diaDeBrasilia, EXTRATO_POR_PAGINA, filtrarPorPeriodo, paginar, periodoInvertido } from "./extrato";

const mov = (createdAt: string) => ({ createdAt });

describe("diaDeBrasilia", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    expect(diaDeBrasilia("2026-10-28T15:11:00.000Z")).toBe("2026-10-28");
    // 01:30 UTC ainda é a noite do dia anterior em Brasília (UTC−3).
    expect(diaDeBrasilia("2026-10-29T01:30:00.000Z")).toBe("2026-10-28");
    expect(diaDeBrasilia("2026-10-29T03:00:00.000Z")).toBe("2026-10-29");
  });
});

describe("filtrarPorPeriodo", () => {
  const lista = [mov("2026-10-28T15:00:00.000Z"), mov("2026-10-25T12:00:00.000Z"), mov("2026-10-23T17:55:00.000Z")];

  it("sem datas devolve tudo", () => {
    expect(filtrarPorPeriodo(lista, "", "")).toHaveLength(3);
  });

  it("os dois extremos entram no período", () => {
    expect(filtrarPorPeriodo(lista, "2026-10-25", "2026-10-28")).toHaveLength(2);
    expect(filtrarPorPeriodo(lista, "2026-10-28", "2026-10-28")).toHaveLength(1);
  });

  it("um lado só deixa o outro aberto", () => {
    expect(filtrarPorPeriodo(lista, "2026-10-26", "")).toHaveLength(1);
    expect(filtrarPorPeriodo(lista, "", "2026-10-24")).toHaveLength(1);
  });

  it("o movimento da noite de Brasília conta no dia de Brasília", () => {
    const noite = [mov("2026-10-29T01:30:00.000Z")];
    expect(filtrarPorPeriodo(noite, "2026-10-28", "2026-10-28")).toHaveLength(1);
    expect(filtrarPorPeriodo(noite, "2026-10-29", "2026-10-29")).toHaveLength(0);
  });

  it("data inicial depois da final: nada passa e o período é dado como invertido", () => {
    expect(periodoInvertido("2026-10-28", "2026-10-25")).toBe(true);
    expect(periodoInvertido("2026-10-25", "2026-10-28")).toBe(false);
    expect(periodoInvertido("", "2026-10-28")).toBe(false);
    expect(filtrarPorPeriodo(lista, "2026-10-28", "2026-10-25")).toHaveLength(0);
  });
});

describe("paginar", () => {
  const itens = Array.from({ length: 23 }, (_, i) => i + 1);

  it("dez por página, a última com o resto", () => {
    expect(EXTRATO_POR_PAGINA).toBe(10);
    expect(paginar(itens, 0)).toMatchObject({ atual: 0, paginas: 3, items: itens.slice(0, 10) });
    expect(paginar(itens, 2).items).toEqual([21, 22, 23]);
  });

  it("até dez itens é uma página só", () => {
    expect(paginar(itens.slice(0, 10), 0).paginas).toBe(1);
    expect(paginar([], 0)).toEqual({ items: [], atual: 0, paginas: 1 });
  });

  it("página fora do que existe é limitada (a lista encolheu)", () => {
    expect(paginar(itens, 9).atual).toBe(2);
    expect(paginar(itens, -1).atual).toBe(0);
  });
});

describe("descreverPeriodo", () => {
  it("escreve o período do jeito que o brasileiro lê", () => {
    expect(dataBr("2026-10-28")).toBe("28/10/2026");
    expect(descreverPeriodo("2026-10-24", "2026-10-28")).toBe("24/10/2026 a 28/10/2026");
    expect(descreverPeriodo("2026-10-24", "2026-10-24")).toBe("24/10/2026");
    expect(descreverPeriodo("2026-10-24", "")).toBe("A partir de 24/10/2026");
    expect(descreverPeriodo("", "2026-10-28")).toBe("Até 28/10/2026");
    expect(descreverPeriodo("", "")).toBe("");
  });
});
