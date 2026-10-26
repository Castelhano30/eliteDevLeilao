"use client";

import { useId } from "react";
import { CANCEL_TEXT, cancelDialogBody, cancelDialogTitle, formatBRL, pluralBids, type MyLotCard } from "@lanceauto/shared";
import { Dialog } from "@/components/ui/dialog";
import { RefusalMessage } from "@/components/ui/refusal-message";
import { isDismissible, type CancelDialogState } from "@/lib/cancel-dialog";

export interface CancelDialogProps {
  open: boolean;
  /** O lote em questão; fica guardado enquanto o diálogo fecha, para o conteúdo não piscar vazio. */
  lot: Pick<MyLotCard, "number" | "title" | "currentBidCents"> | null;
  state: CancelDialogState;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Diálogo de cancelamento (S06 §10) sobre o `Dialog` da S00: foco no título, fundo inerte, Tab preso, Esc e "Voltar"
 * ignorados durante o envio. A contagem do título é a que vai no corpo como `confirmEntryCount`. Nunca mostra nome,
 * e-mail nem pseudônimo de quem lidera.
 */
export function CancelDialog({ open, lot, state, onConfirm, onClose }: CancelDialogProps) {
  const bodyId = useId();
  const { bidCount } = state;
  const hasBids = bidCount > 0;
  const refusal = state.status === "changed" || state.status === "error";
  const arrival = state.status === "idle" ? state.message : null;

  return (
    <Dialog
      open={open && lot !== null}
      onClose={onClose}
      title={lot ? cancelDialogTitle(lot.number, bidCount) : ""}
      describedBy={bodyId}
      dismissible={isDismissible(state)}
      confirm={{ label: CANCEL_TEXT.confirm, onConfirm, loading: state.status === "submitting", loadingText: CANCEL_TEXT.confirming }}
      cancelLabel={CANCEL_TEXT.back}
    >
      <div id={bodyId} className="space-y-3">
        {lot ? (
          <p className="t-mono">
            {lot.title} · {pluralBids(bidCount)}
            {hasBids && lot.currentBidCents !== null ? ` · lance atual ${formatBRL(lot.currentBidCents)}` : ""}
          </p>
        ) : null}
        <p className={hasBids ? "text-ferrugem" : undefined}>{cancelDialogBody(bidCount)}</p>
        <p className="t-body-nota">{CANCEL_TEXT.irreversible}</p>
        <div aria-live="polite" className="space-y-2">
          <p className="t-body-nota">{CANCEL_TEXT.newBidWarning}</p>
          {arrival ? <p className="t-body-nota font-semibold">{arrival}</p> : null}
        </div>
        {refusal && state.message ? <RefusalMessage>{state.message}</RefusalMessage> : null}
      </div>
    </Dialog>
  );
}
