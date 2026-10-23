import { describe, expect, it } from "vitest";
import { MAX_DEPOSIT_CENTS, formatBRL, parseReais } from "./money";

describe("formatBRL", () => {
  it("formata reais inteiros com ,00 fixo e ponto de milhar", () => {
    expect(formatBRL(3100000)).toBe("R$ 31.000,00");
    expect(formatBRL(MAX_DEPOSIT_CENTS)).toBe("R$ 10.000.000,00");
  });

  it("cobre os limites 0, 1 real e o teto do depósito", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(100)).toBe("R$ 1,00");
    expect(formatBRL(99900)).toBe("R$ 999,00");
    expect(formatBRL(MAX_DEPOSIT_CENTS + 100)).toBe("R$ 10.000.001,00");
  });
});

describe("parseReais", () => {
  it("converte reais com ou sem ponto de milhar em centavos", () => {
    expect(parseReais("31.000")).toBe(3100000);
    expect(parseReais("31000")).toBe(3100000);
    expect(parseReais("R$ 31.000,00")).toBe(3100000);
    expect(parseReais("0")).toBe(0);
    expect(parseReais("1")).toBe(100);
  });

  it("devolve null para vazio ou não numérico", () => {
    expect(parseReais("")).toBeNull();
    expect(parseReais("   ")).toBeNull();
    expect(parseReais("abc")).toBeNull();
    expect(parseReais("12,50")).toBeNull();
    expect(parseReais("1.00")).toBeNull();
    expect(parseReais("-5")).toBeNull();
  });

  it("não deixa estourar o inteiro seguro", () => {
    expect(parseReais("9".repeat(20))).toBeNull();
  });
});
