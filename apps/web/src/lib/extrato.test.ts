import { describe, expect, it } from "vitest";
import { dataBr, descreverPeriodo, diaDeBrasilia, EXTRATO_POR_PAGINA, filtrarPorPeriodo, periodoInvertido } from "./extrato";

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

describe("EXTRATO_POR_PAGINA", () => {
  it("são dez movimentos por página", () => {
    expect(EXTRATO_POR_PAGINA).toBe(10);
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
