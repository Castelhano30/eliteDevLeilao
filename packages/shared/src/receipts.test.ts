import { describe, expect, it } from "vitest";
import {
  RECEIPT_TOKEN_PATTERN,
  copyLinkAriaLabel,
  isReceiptToken,
  receiptCode,
  receiptPath,
} from "./receipts";
import { saleDebitLabel, saleDebitNote } from "./texts";

describe("token do comprovante", () => {
  it("aceita 32 caracteres de base64url e nada além disso", () => {
    expect(isReceiptToken("A".repeat(32))).toBe(true);
    expect(isReceiptToken("aB3_-xYz".repeat(4))).toBe(true);
    expect(isReceiptToken("A".repeat(31))).toBe(false);
    expect(isReceiptToken("A".repeat(33))).toBe(false);
    expect(isReceiptToken("A".repeat(31) + "+")).toBe(false);
    expect(isReceiptToken("A".repeat(31) + "/")).toBe(false);
    expect(isReceiptToken("A".repeat(31) + "=")).toBe(false);
    expect(isReceiptToken("")).toBe(false);
  });

  it("não aceita quebra de linha escondida no fim (âncoras)", () => {
    expect(RECEIPT_TOKEN_PATTERN.test("A".repeat(32) + "\n")).toBe(false);
  });
});

describe("receiptCode", () => {
  it("junta o lote com 3 dígitos e os 4 primeiros do token em caixa alta", () => {
    expect(receiptCode(18, "7q2kZZZZ")).toBe("018-7Q2K");
    expect(receiptCode(1, "abcdEFGH")).toBe("001-ABCD");
  });

  it("passa de 3 dígitos sem cortar", () => {
    expect(receiptCode(1234, "xxxxyyyy")).toBe("1234-XXXX");
  });
});

describe("textos do comprovante", () => {
  it("caminho e nome acessível do botão levam o lote", () => {
    expect(receiptPath("tok")).toBe("/c/tok");
    expect(copyLinkAriaLabel(7)).toBe("Copiar link do comprovante do lote 007");
  });
});

describe("arremate no extrato", () => {
  it("rótulo com o número do lote e, sem ele, só Arremate", () => {
    expect(saleDebitLabel(18)).toBe("Arremate · lote 018");
    expect(saleDebitLabel(null)).toBe("Arremate");
  });

  it("linha de apoio: total e comprometido caem, disponível não muda", () => {
    expect(saleDebitNote(3_200_000)).toBe("TOTAL −R$ 32.000,00 · COMPROMETIDO −R$ 32.000,00 · DISPONÍVEL não muda");
  });
});
