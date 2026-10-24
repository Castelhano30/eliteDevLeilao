import { describe, expect, it } from "vitest";
import {
  brasiliaLocalToUtcIso,
  formatBrasilia,
  formatBrasiliaClock,
  utcIsoToBrasiliaLocal,
} from "./brasilia";
import {
  cleanBrand,
  formatLotNumber,
  formatReferenceMonth,
  isVehicleExtract,
  parseBRL,
  parseReferenceMonth,
  wikiTitleCandidates,
  wikiTitlePath,
} from "./catalog";
import { buildSearchText, normalizeSearch, searchTerms } from "./search";

describe("cleanBrand", () => {
  it("fica com a parte depois do último ' - ' e aplica a grafia canônica", () => {
    expect(cleanBrand("VW - VolksWagen")).toBe("Volkswagen");
    expect(cleanBrand("GM - Chevrolet")).toBe("Chevrolet");
    expect(cleanBrand("Volkswagen")).toBe("Volkswagen");
    expect(cleanBrand("  Toyota ")).toBe("Toyota");
    expect(cleanBrand("Mercedes-Benz")).toBe("Mercedes-Benz");
  });
});

describe("normalizeSearch e searchTerms", () => {
  it("ignora caixa, acento e espaços repetidos", () => {
    expect(normalizeSearch("  ÓPÁLA   Comodoro ")).toBe("opala comodoro");
    expect(buildSearchText("Opala Comodoro", "Chevrolet", "Opala 4.1", 1988)).toBe("opala comodoro chevrolet opala 4.1 1988");
  });

  it("AC-2.18d: escapa os curingas do LIKE (busca literal) e corta em 100 caracteres", () => {
    expect(searchTerms("%")).toEqual(["\\%"]);
    expect(searchTerms("_")).toEqual(["\\_"]);
    expect(searchTerms("\\")).toEqual(["\\\\"]);
    expect(searchTerms("go%l  OPALA")).toEqual(["go\\%l", "opala"]);
    expect(searchTerms(`${"a".repeat(100)}b`)).toEqual(["a".repeat(100)]);
    expect(searchTerms(undefined)).toEqual([]);
  });
});

describe("parseBRL (AC-2.8)", () => {
  it("converte o preço da FIPE em centavos", () => {
    expect(parseBRL("R$ 45.000,00")).toBe(4_500_000);
    expect(parseBRL("R$ 1.234.567,89")).toBe(123_456_789);
    expect(parseBRL("R$ 45.000")).toBe(4_500_000);
    expect(parseBRL("R$ 80.061,00")).toBe(8_006_100);
    expect(parseBRL("sem preço")).toBeNull();
  });
});

describe("mês de referência", () => {
  it("'outubro de 2026' vira '2026-10' e a UI mostra 'OUT/2026'", () => {
    expect(parseReferenceMonth("outubro de 2026")).toBe("2026-10");
    expect(parseReferenceMonth("março de 2025")).toBe("2025-03");
    expect(formatReferenceMonth("2026-10")).toBe("OUT/2026");
  });
  it("formato desconhecido fica cru e a UI o mostra em maiúsculas", () => {
    expect(parseReferenceMonth("out/26")).toBe("out/26");
    expect(formatReferenceMonth("out/26")).toBe("OUT/26");
  });
});

describe("formatLotNumber", () => {
  it("três dígitos, mais se precisar", () => {
    expect(formatLotNumber(18)).toBe("018");
    expect(formatLotNumber(1234)).toBe("1234");
  });
});

describe("wikiTitleCandidates (AC-2.7)", () => {
  it("marca canônica + primeiro token de modelo, depois só o modelo", () => {
    expect(wikiTitleCandidates("VW - VolksWagen", "Gol 1.0 MPI")).toEqual(["Volkswagen Gol", "Gol"]);
    expect(wikiTitleCandidates("Toyota", "Corolla XEi 2.0")).toEqual(["Toyota Corolla", "Corolla"]);
    expect(wikiTitleCandidates("Hyundai", "HB20 Comfort 1.0")).toEqual(["Hyundai HB20", "HB20"]);
    expect(wikiTitleCandidates("VW - VolksWagen", "T-Cross 200 TSI")).toEqual(["Volkswagen T-Cross", "T-Cross"]);
    expect(wikiTitleCandidates("Peugeot", "208 Active 1.6")).toEqual(["Peugeot 208", "208"]);
    expect(wikiTitleCandidates("Fiat", "1.0 Flex")).toEqual(["Fiat"]);
  });

  it("o candidato só-modelo exige um resumo que fale de veículo", () => {
    expect(isVehicleExtract("O Gol é um automóvel produzido pela Volkswagen.")).toBe(true);
    expect(isVehicleExtract("A Gol Linhas Aéreas é uma companhia aérea brasileira.")).toBe(false);
    expect(isVehicleExtract("Uno é um jogo de cartas.")).toBe(false);
    expect(isVehicleExtract(undefined)).toBe(false);
  });

  it("título na URL troca espaço por _ e codifica", () => {
    expect(wikiTitlePath("Volkswagen Gol")).toBe("Volkswagen_Gol");
    expect(wikiTitlePath("Citroën C3")).toBe("Citro%C3%ABn_C3");
  });
});

describe("Brasília ↔ UTC", () => {
  it("converte o datetime-local de Brasília para UTC com ms", () => {
    expect(brasiliaLocalToUtcIso("2026-10-25T10:00")).toBe("2026-10-25T13:00:00.000Z");
  });

  it("vira o dia e o mês", () => {
    expect(brasiliaLocalToUtcIso("2026-10-25T22:30")).toBe("2026-10-26T01:30:00.000Z");
    expect(brasiliaLocalToUtcIso("2026-10-31T23:00")).toBe("2026-11-01T02:00:00.000Z");
    expect(brasiliaLocalToUtcIso("2026-12-31T21:00")).toBe("2027-01-01T00:00:00.000Z");
  });

  it("recusa entrada inválida", () => {
    expect(brasiliaLocalToUtcIso("")).toBeNull();
    expect(brasiliaLocalToUtcIso("2026-02-31T10:00")).toBeNull();
    expect(brasiliaLocalToUtcIso("2026-10-25T25:00")).toBeNull();
  });

  it("volta de UTC para o datetime-local e formata", () => {
    expect(utcIsoToBrasiliaLocal("2026-10-26T01:30:00.000Z")).toBe("2026-10-25T22:30");
    expect(formatBrasilia("2026-10-25T13:00:00.000Z")).toBe("25/10 10:00");
    expect(formatBrasilia("2026-10-25T13:00:07.000Z", "seconds")).toBe("25/10/2026 10:00:07");
    expect(formatBrasiliaClock("2026-10-22T21:47:00.000Z")).toBe("Qui 22/out · 18:47");
  });
});
