import { CANCEL_TEXT, lotChangedMessage, type ErrorEnvelope } from "@lanceauto/shared";

/** Estados do diálogo de cancelamento (S06 §10). `changed`: o servidor viu outra contagem e pede nova confirmação. */
export type CancelDialogStatus = "idle" | "submitting" | "changed" | "error";

export interface CancelDialogState {
  status: CancelDialogStatus;
  /** A contagem de lances que o diálogo mostra, e que vai no corpo como `confirmEntryCount`. */
  bidCount: number;
  message: string | null;
}

export type CancelDialogAction =
  | { type: "submit" }
  /** `showcase:lot` ou nova leitura do Painel trouxe uma contagem. */
  | { type: "bids"; bidCount: number }
  /** `LOT_CHANGED`: a contagem real do servidor. */
  | { type: "changed"; entryCount: number }
  /** Falha que mantém o diálogo aberto (rede ambígua ou erro do servidor). */
  | { type: "failed"; message: string };

export function initialCancelDialog(bidCount: number): CancelDialogState {
  return { status: "idle", bidCount, message: null };
}

export function cancelDialogReducer(state: CancelDialogState, action: CancelDialogAction): CancelDialogState {
  switch (action.type) {
    case "submit":
      // Envio duplo (duplo clique, Enter repetido) é ignorado.
      return state.status === "submitting" ? state : { status: "submitting", bidCount: state.bidCount, message: null };
    case "bids":
      // A contagem só sobe (evento atrasado não a devolve) e não muda sob os pés de quem acabou de confirmar.
      if (state.status === "submitting" || action.bidCount <= state.bidCount) return state;
      return { ...state, bidCount: action.bidCount };
    case "changed":
      return { status: "changed", bidCount: action.entryCount, message: lotChangedMessage(action.entryCount) };
    case "failed":
      return { status: "error", bidCount: state.bidCount, message: action.message };
  }
}

/** O que vai no corpo: sempre a contagem que o diálogo está mostrando. */
export function confirmCountOf(state: CancelDialogState): number {
  return state.bidCount;
}

/** `Esc` e "Voltar" são ignorados enquanto a resposta não chega. */
export function isDismissible(state: CancelDialogState): boolean {
  return state.status !== "submitting";
}

export type CancelFailure =
  | { kind: "changed"; entryCount: number; message: string }
  /** Fecha o diálogo, mostra o aviso e refaz a lista (o lote já mudou de estado). */
  | { kind: "close"; message: string; refetchList: true }
  /** Rede caiu ou estourou o tempo: o resultado é incerto; confere o lote antes de tentar de novo. */
  | { kind: "ambiguous"; message: string }
  | { kind: "error"; message: string };

/** Mapeia a resposta de erro de `POST /lots/:id/cancel` para o que a tela faz e diz (S06 §8, §9.1). */
export function describeCancelFailure(status: number | null, error: ErrorEnvelope["error"] | null): CancelFailure {
  if (status === null || error === null) return { kind: "ambiguous", message: CANCEL_TEXT.networkAmbiguous };
  switch (error.code) {
    case "LOT_CHANGED": {
      const entryCount = (error.details as { entryCount?: unknown } | undefined)?.entryCount;
      if (typeof entryCount === "number") return { kind: "changed", entryCount, message: lotChangedMessage(entryCount) };
      return { kind: "error", message: error.message };
    }
    case "LOT_CANCELLED":
      return { kind: "close", message: CANCEL_TEXT.lotCancelled, refetchList: true };
    case "LOT_ENDED":
      return { kind: "close", message: CANCEL_TEXT.lotEnded, refetchList: true };
    case "FORBIDDEN":
      return { kind: "close", message: CANCEL_TEXT.forbidden, refetchList: true };
    case "NOT_FOUND":
      return { kind: "close", message: CANCEL_TEXT.notFound, refetchList: true };
    case "ROLE_NOT_ALLOWED":
      return { kind: "close", message: CANCEL_TEXT.roleNotAllowed, refetchList: true };
    case "VALIDATION": {
      const fields = (error.details as { fields?: Record<string, string> } | undefined)?.fields;
      return { kind: "error", message: fields?.confirmEntryCount ?? error.message };
    }
    default:
      return { kind: "error", message: error.message };
  }
}
