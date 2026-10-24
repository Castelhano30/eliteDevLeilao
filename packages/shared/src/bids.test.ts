import { describe, expect, it } from "vitest";
import {
  BID_TEXT,
  belowMinimumMessage,
  insufficientBalanceMessage,
  lotEndedMessage,
  lotNotStartedMessage,
  placeBidSchema,
} from "./bids";

describe("textos de recusa do lance", () => {
  it("BELOW_MINIMUM muda de texto conforme o motivo", () => {
    expect(belowMinimumMessage("MINIMUM", 3_100_000)).toBe("Seu lance precisa ser de pelo menos R$ 31.000,00.");
    expect(belowMinimumMessage("OUTDATED", 3_100_000)).toBe("Alguém levantou a mão antes de você. O mínimo agora é R$ 31.000,00.");
    expect(belowMinimumMessage("OWN_LEAD", 3_100_000)).toBe(
      "Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ 31.000,00.",
    );
  });

  it("saldo insuficiente traz o disponível exato", () => {
    expect(insufficientBalanceMessage(2_000_000)).toBe("Saldo insuficiente: você tem R$ 20.000,00 disponíveis.");
    expect(insufficientBalanceMessage(0)).toBe("Saldo insuficiente: você tem R$ 0,00 disponíveis.");
  });

  it("lote encerrado usa o horário de Brasília", () => {
    expect(lotEndedMessage("2026-10-24T17:05:00.000Z")).toBe("Martelo batido às 14:05. Este lote não aceita mais lances.");
  });

  it("lote que ainda não abriu: dia da semana, data e hora sem minutos quando zero", () => {
    // 24/10/2026 é sábado; 17:00Z = 14h em Brasília
    expect(lotNotStartedMessage("2026-10-24T17:00:00.000Z")).toBe(
      "O lote abre sábado, 24/10, às 14h. Até lá o martelo fica na gaveta.",
    );
    expect(lotNotStartedMessage("2026-10-26T17:30:00.000Z")).toBe(
      "O lote abre segunda-feira, 26/10, às 14h30. Até lá o martelo fica na gaveta.",
    );
    expect(lotNotStartedMessage("2026-10-26T17:05:00.000Z")).toContain("às 14h05.");
  });

  it("textos fixos", () => {
    expect(BID_TEXT.alreadyWinning).toBe("Você já está na frente. Cobrir o próprio lance só gasta saldo.");
    expect(BID_TEXT.lotCancelled).toBe("Este lote foi cancelado pelo leiloeiro.");
    expect(BID_TEXT.roleNotAllowed).toBe("Leiloeiro vende, não compra. Lance é coisa de licitante.");
  });
});

describe("placeBidSchema", () => {
  it("aceita valor inteiro e expected nulo ou número", () => {
    expect(placeBidSchema.safeParse({ amountCents: 2_500_000, expectedCurrentCents: null }).success).toBe(true);
    expect(placeBidSchema.safeParse({ amountCents: 2_500_000, expectedCurrentCents: 0 }).success).toBe(true);
    expect(placeBidSchema.safeParse({ amountCents: Number.MAX_SAFE_INTEGER, expectedCurrentCents: 3_000_000 }).success).toBe(true);
  });

  it.each([
    [{ amountCents: 100 }],
    [{ expectedCurrentCents: null }],
    [{ amountCents: 0, expectedCurrentCents: null }],
    [{ amountCents: -1, expectedCurrentCents: null }],
    [{ amountCents: 10.5, expectedCurrentCents: null }],
    [{ amountCents: "2500000", expectedCurrentCents: null }],
    [{ amountCents: Number.MAX_SAFE_INTEGER + 2, expectedCurrentCents: null }],
    [{ amountCents: 100, expectedCurrentCents: -1 }],
    [{ amountCents: 100, expectedCurrentCents: "x" }],
    [{ amountCents: 100, expectedCurrentCents: undefined }],
  ])("recusa %j", (body) => {
    expect(placeBidSchema.safeParse(body).success).toBe(false);
  });
});
