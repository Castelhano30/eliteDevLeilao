import { describe, expect, it } from "vitest";
import { parseReais } from "@lanceauto/shared";
import { BID_MAX_DIGITS, DEPOSIT_MAX_DIGITS, maskReais } from "./money-mask";

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

describe("maskReais com limite de dígitos por parâmetro", () => {
  it("lance aceita 13 dígitos e corta o excedente", () => {
    expect(maskReais("12345678901234567", undefined, BID_MAX_DIGITS).value).toBe("1.234.567.890.123");
    expect(maskReais("9999999999999", undefined, BID_MAX_DIGITS).value).toBe("9.999.999.999.999");
  });

  it("depósito continua em 9 dígitos por padrão", () => {
    expect(maskReais("12345678901234567").value).toBe("123.456.789");
    expect(maskReais("12345678901234567", undefined, DEPOSIT_MAX_DIGITS).value).toBe("123.456.789");
  });

  it("13 dígitos em reais ainda cabem em centavos seguros", () => {
    const cents = parseReais(maskReais("9999999999999", undefined, BID_MAX_DIGITS).value);
    expect(cents).toBe(999_999_999_999_900);
    expect(Number.isSafeInteger(cents!)).toBe(true);
  });

  it("colar 'R$ 12.500,00' vira só dígitos (o ,00 colado entra como dígitos)", () => {
    expect(maskReais("R$ 12.500,00", undefined, BID_MAX_DIGITS).value).toBe("1.250.000");
  });

  it("digitar 1234567 mostra 1.234.567 com o cursor no fim", () => {
    expect(maskReais("1234567", 7, BID_MAX_DIGITS)).toEqual({ value: "1.234.567", caret: 9 });
  });
});
