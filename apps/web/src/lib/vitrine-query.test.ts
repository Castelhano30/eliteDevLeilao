import { describe, expect, it } from "vitest";
import { brandOptions } from "./vitrine-query";

describe("brandOptions", () => {
  it("usa a lista da FIPE em ordem pt-BR, mesmo sem nenhum lote", () => {
    expect(brandOptions(["Volkswagen", "Chevrolet", "Ásia Motors"], [], "")).toEqual(["Ásia Motors", "Chevrolet", "Volkswagen"]);
  });

  it("soma as marcas dos lotes, sem repetir por maiúsculas ou acento; vale a grafia da FIPE", () => {
    expect(brandOptions(["Citroën", "Fiat"], ["CITROEN", "fiat", "Lada"], "")).toEqual(["Citroën", "Fiat", "Lada"]);
  });

  it("com a FIPE ainda carregando ou fora do ar, segue com as marcas dos lotes", () => {
    expect(brandOptions(undefined, ["Honda", "Fiat"], "")).toEqual(["Fiat", "Honda"]);
    expect(brandOptions(undefined, undefined, "")).toEqual([]);
  });

  it("mantém a marca escolhida nas opções, para o seletor não mostrar um valor que não existe", () => {
    expect(brandOptions(["Fiat"], ["Fiat"], "Lada")).toEqual(["Fiat", "Lada"]);
    expect(brandOptions(["Fiat"], [], "fiat")).toEqual(["Fiat"]);
  });

  it("ignora nomes vazios", () => {
    expect(brandOptions(["", "  ", "Fiat"], [""], "")).toEqual(["Fiat"]);
  });
});
