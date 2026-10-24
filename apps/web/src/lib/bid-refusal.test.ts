import { describe, expect, it } from "vitest";
import type { ErrorEnvelope } from "@lanceauto/shared";
import { describeBidFailure } from "./bid-refusal";

const error = (code: ErrorEnvelope["error"]["code"], message: string, details?: unknown): ErrorEnvelope["error"] => ({ code, message, details });

describe("describeBidFailure", () => {
  it("abaixo do mínimo: texto do servidor, borda de erro e novo GET", () => {
    expect(describeBidFailure(422, error("BELOW_MINIMUM", "Seu lance precisa ser de pelo menos R$ 31.000,00."))).toEqual({
      message: "Seu lance precisa ser de pelo menos R$ 31.000,00.",
      invalid: true,
      refetch: true,
    });
  });

  it("saldo insuficiente: borda de erro e o link para a carteira, sem GET", () => {
    expect(describeBidFailure(422, error("INSUFFICIENT_BALANCE", "Saldo insuficiente: você tem R$ 20.000,00 disponíveis."))).toEqual({
      message: "Saldo insuficiente: você tem R$ 20.000,00 disponíveis.",
      invalid: true,
      action: { href: "/carteira", label: "Depositar na carteira →" },
      refetch: false,
    });
  });

  it("já está ganhando: só o texto, sem borda de erro e sem GET", () => {
    expect(describeBidFailure(409, error("ALREADY_WINNING", "Você já está na frente. Cobrir o próprio lance só gasta saldo."))).toEqual({
      message: "Você já está na frente. Cobrir o próprio lance só gasta saldo.",
      invalid: false,
      refetch: false,
    });
  });

  it.each(["LOT_ENDED", "LOT_CANCELLED", "LOT_NOT_STARTED"] as const)("%s refaz o GET sem borda de erro", (code) => {
    const failure = describeBidFailure(409, error(code, "texto"));
    expect(failure).toMatchObject({ message: "texto", invalid: false, refetch: true });
  });

  it("valor inválido usa a mensagem do campo", () => {
    expect(describeBidFailure(400, error("VALIDATION", "Confira os campos", { fields: { amountCents: "Informe um valor de lance válido." } }))).toMatchObject({
      message: "Informe um valor de lance válido.",
      invalid: true,
    });
  });

  it("falha de rede é ambígua: texto do cliente, refaz o GET e nunca reenvia", () => {
    const failure = describeBidFailure(null, null);
    expect(failure.message).toBe("Não deu para confirmar o lance. Confira o histórico antes de tentar de novo.");
    expect(failure.refetch).toBe(true);
  });

  it("resposta fora do envelope também é tratada como ambígua", () => {
    expect(describeBidFailure(502, null).refetch).toBe(true);
  });

  it("limite de requisições e papel mostram o texto do servidor", () => {
    expect(describeBidFailure(429, error("RATE_LIMITED", "Calma: lances demais em pouco tempo. Tente de novo em instantes."))).toMatchObject({
      message: "Calma: lances demais em pouco tempo. Tente de novo em instantes.",
      invalid: false,
      refetch: false,
    });
  });
});
