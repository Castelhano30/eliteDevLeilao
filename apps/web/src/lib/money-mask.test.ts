import { describe, expect, it } from "vitest";
import { parseReais } from "@lanceauto/shared";
import { maskReais } from "./money-mask";

describe("maskReais", () => {
  it("aplica o ponto de milhar enquanto digita", () => {
    expect(maskReais("1").value).toBe("1");
    expect(maskReais("1000").value).toBe("1.000");
    expect(maskReais("50000").value).toBe("50.000");
    expect(maskReais("10000000").value).toBe("10.000.000");
  });

  it("ignora o que não é dígito e zeros à esquerda", () => {
    expect(maskReais("R$ 31.000,00x").value).toBe("3.100.000");
    expect(maskReais("000").value).toBe("");
    expect(maskReais("0012").value).toBe("12");
    expect(maskReais("").value).toBe("");
  });

  it("corta a colagem em 9 dígitos, sem passar do intervalo seguro", () => {
    const pasted = maskReais("123456789012345678901234");
    expect(pasted.value).toBe("123.456.789");
    expect(Number.isSafeInteger(parseReais(pasted.value)!)).toBe(true);
  });

  it("10.000.001 cabe na máscara e vira mais que o limite em centavos", () => {
    const { value } = maskReais("10000001");
    expect(value).toBe("10.000.001");
    expect(parseReais(value)).toBe(1_000_000_100);
  });

  it("mantém o cursor depois do mesmo dígito ao reformatar", () => {
    // "1000" com cursor após o 2º dígito (…10|00) vira "1.000" com cursor após o 2º dígito (1.0|00)
    expect(maskReais("1000", 2)).toEqual({ value: "1.000", caret: 3 });
    // digitou um 5 no fim de "1.000" -> "1.0005": cursor no fim
    expect(maskReais("1.0005")).toEqual({ value: "10.005", caret: 6 });
    // apagar o primeiro dígito com cursor no começo
    expect(maskReais("000", 0)).toEqual({ value: "", caret: 0 });
    expect(maskReais("12345", 1)).toEqual({ value: "12.345", caret: 1 });
  });
});
