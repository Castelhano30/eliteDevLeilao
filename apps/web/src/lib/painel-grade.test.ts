import { describe, expect, it } from "vitest";
import { colunasDaGrade, encerradosVisiveis } from "./painel-grade";

describe("colunasDaGrade", () => {
  it("o que cabe de 330px com vão de 24px", () => {
    expect(colunasDaGrade(1320, 330, 24)).toBe(3);
    expect(colunasDaGrade(1392, 330, 24)).toBe(4);
    expect(colunasDaGrade(700, 330, 24)).toBe(2);
    expect(colunasDaGrade(330, 330, 24)).toBe(1);
  });

  it("largura menor que um cartão ou inválida: uma coluna", () => {
    expect(colunasDaGrade(280, 330, 24)).toBe(1);
    expect(colunasDaGrade(0, 330, 24)).toBe(1);
    expect(colunasDaGrade(Number.NaN, 330, 24)).toBe(1);
  });
});

describe("encerradosVisiveis", () => {
  it("duas linhas da grade, sem passar do total", () => {
    expect(encerradosVisiveis(20, 3, 2)).toBe(6);
    expect(encerradosVisiveis(4, 3, 2)).toBe(4);
    expect(encerradosVisiveis(20, 3, 4)).toBe(12);
    expect(encerradosVisiveis(0, 3, 2)).toBe(0);
  });
});
