import { describe, expect, it } from "vitest";
import { clockTime, describeMovement, formatWhen, lotNumberLabel } from "./format";

describe("formatWhen", () => {
  it("converte UTC para Brasília (UTC−3)", () => {
    expect(formatWhen("2026-10-23T12:05:00.000Z")).toBe("23/10 09:05");
    expect(formatWhen("2026-10-24T02:30:00.000Z")).toBe("23/10 23:30");
  });
});

describe("lotNumberLabel", () => {
  it("usa três dígitos", () => {
    expect(lotNumberLabel(1)).toBe("001");
    expect(lotNumberLabel(42)).toBe("042");
  });
});

describe("describeMovement", () => {
  it("depósito soma e não leva nota", () => {
    expect(describeMovement({ kind: "DEPOSIT", amountCents: 5_000_000 })).toEqual({
      label: "Depósito",
      value: "+ R$ 50.000,00",
      note: null,
    });
  });

  it("liberação e estorno usam os textos canônicos do shared", () => {
    expect(describeMovement({ kind: "RELEASE", amountCents: 10_000 })).toMatchObject({
      label: "Saldo liberado · lance superado",
      value: "R$ 100,00",
      note: "VOLTOU AO DISPONÍVEL · TOTAL NÃO MUDA",
    });
    expect(describeMovement({ kind: "REFUND", amountCents: 10_000 }).label).toBe("Estorno · lote cancelado");
  });

  it("arremate leva o número do lote e a nota de que só o total e o comprometido caem", () => {
    expect(describeMovement({ kind: "SALE_DEBIT", amountCents: 5_750_000, lotNumber: 6 })).toEqual({
      label: "Arremate · lote 006",
      value: "− R$ 57.500,00",
      note: "TOTAL −R$ 57.500,00 · COMPROMETIDO −R$ 57.500,00 · DISPONÍVEL não muda",
    });
    expect(describeMovement({ kind: "SALE_DEBIT", amountCents: 10_000, lotNumber: null }).label).toBe("Arremate");
    expect(describeMovement({ kind: "SALE_CREDIT", amountCents: 10_000, lotNumber: 6 })).toMatchObject({ label: "Venda", note: null });
  });

  it("travar saldo não muda o total; arremate debita e venda credita", () => {
    expect(describeMovement({ kind: "HOLD", amountCents: 10_000 }).note).toBe("TOTAL NÃO MUDA");
    expect(describeMovement({ kind: "SALE_DEBIT", amountCents: 10_000 }).value).toBe("− R$ 100,00");
    expect(describeMovement({ kind: "SALE_CREDIT", amountCents: 10_000 }).value).toBe("+ R$ 100,00");
  });
});

describe("clockTime", () => {
  it("HH:mm:ss em Brasília", () => {
    expect(clockTime("2026-10-23T12:05:09.000Z")).toBe("09:05:09");
    expect(clockTime("2026-10-24T02:30:00.999Z")).toBe("23:30:00");
  });
});
