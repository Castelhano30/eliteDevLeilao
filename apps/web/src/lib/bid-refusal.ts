import type { ErrorEnvelope } from "@lanceauto/shared";
import { BID_TEXT } from "@lanceauto/shared";

export interface BidFailure {
  /** O texto do servidor, na íntegra; só a falha de rede usa texto do cliente. */
  message: string;
  /** Borda ferrugem e `aria-invalid` no campo (só valor abaixo do mínimo, saldo e valor inválido). */
  invalid: boolean;
  action?: { href: string; label: string };
  /** O estado do lote mudou ou ficou incerto: refaz o `GET /lots/:id`. */
  refetch: boolean;
}

/**
 * Como a Sala reage a um lance que não entrou (§9.3.8). O texto exibido é o `message` do servidor; `details` só
 * dispara efeito colateral. Falha de rede é resultado ambíguo: nunca reenvia sozinho, só refaz o GET.
 */
export function describeBidFailure(status: number | null, error: ErrorEnvelope["error"] | null): BidFailure {
  if (status === null || error === null) return { message: BID_TEXT.networkAmbiguous, invalid: false, refetch: true };
  switch (error.code) {
    case "BELOW_MINIMUM":
      return { message: error.message, invalid: true, refetch: true };
    case "INSUFFICIENT_BALANCE":
      return { message: error.message, invalid: true, action: { href: "/carteira", label: "Depositar na carteira →" }, refetch: false };
    case "LOT_ENDED":
    case "LOT_CANCELLED":
    case "LOT_NOT_STARTED":
      return { message: error.message, invalid: false, refetch: true };
    case "VALIDATION": {
      const fields = (error.details as { fields?: Record<string, string> } | undefined)?.fields;
      return { message: fields?.amountCents ?? error.message, invalid: true, refetch: false };
    }
    default:
      return { message: error.message, invalid: false, refetch: false };
  }
}
