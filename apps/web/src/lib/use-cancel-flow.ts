"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { CANCEL_TEXT, cancelDoneMessage, type LotState, type MyLotCard, type MyLotsResponse } from "@lanceauto/shared";
import { apiPost } from "@/lib/api-client";
import { canCancel } from "@/lib/panel-sections";
import { cancelDialogReducer, confirmCountOf, describeCancelFailure, initialCancelDialog } from "@/lib/cancel-dialog";

/** `id` do botão "Cancelar" de uma linha: o foco volta a ele quando o diálogo fecha sem cancelar. */
export const cancelButtonId = (lotId: string) => `cancelar-${lotId}`;

/** Títulos das seções, na ordem em que o foco procura um destino quando a linha de origem sumiu. */
const FALLBACK_HEADINGS = ["painel-cancelados", "painel-ao-vivo", "painel-agendados", "painel-encerrados"];

function focusOriginOrSection(lotId: string): void {
  const target = document.getElementById(cancelButtonId(lotId)) ?? FALLBACK_HEADINGS.map((id) => document.getElementById(id)).find(Boolean);
  target?.focus();
}

/**
 * Fluxo do cancelamento no Painel (S06 §9.1): abre o diálogo com a contagem da linha, envia sempre a contagem que o
 * diálogo mostra, e só move a linha de seção quando o servidor confirma (a lista é refeita por `GET /my/lots`, INV-1).
 */
export function useCancelFlow(query: UseQueryResult<MyLotsResponse>) {
  const [target, setTarget] = useState<MyLotCard | null>(null);
  const [open, setOpen] = useState(false);
  const [dialog, dispatch] = useReducer(cancelDialogReducer, 0, initialCancelDialog);
  const [notice, setNotice] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [focusCancelled, setFocusCancelled] = useState(false);
  /** Objeto novo a cada pedido: o efeito de foco roda uma vez por pedido, sem precisar limpar o estado. */
  const [focusRequest, setFocusRequest] = useState<{ lotId: string } | null>(null);
  /** Depois de uma falha de rede o resultado é incerto: a próxima tentativa começa conferindo o lote. */
  const uncertain = useRef(false);

  const current = target ? query.data?.lots.find((lot) => lot.id === target.id) : undefined;

  const closeWithNotice = useCallback(
    async (lotId: string, message: string) => {
      setOpen(false);
      setNotice(message);
      await query.refetch();
      setFocusRequest({ lotId });
    },
    [query],
  );

  useEffect(() => {
    if (!focusRequest) return;
    const frame = requestAnimationFrame(() => focusOriginOrSection(focusRequest.lotId));
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  // A contagem acompanha o `showcase:lot` do mesmo lote (a linha do Painel é atualizada pelo evento).
  useEffect(() => {
    if (open && current) dispatch({ type: "bids", bidCount: current.bidCount });
  }, [open, current?.bidCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // O lote foi cancelado ou fechado por outro caminho com o diálogo aberto: fecha com o aviso, menos no meio de um
  // envio (a resposta dele decide). Estado derivado no render, sem efeito.
  if (open && current && dialog.status !== "submitting" && !canCancel(current)) {
    setOpen(false);
    setNotice(current.status === "CANCELLED" ? CANCEL_TEXT.lotCancelled : CANCEL_TEXT.lotEnded);
    setFocusRequest({ lotId: current.id });
  }

  const begin = useCallback((lot: MyLotCard) => {
    uncertain.current = false;
    setTarget(lot);
    setNotice(null);
    dispatch({ type: "open", bidCount: lot.bidCount });
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const succeed = useCallback(
    async (lot: Pick<LotState["lot"], "number" | "bidCount" | "currentBidCents">) => {
      setOpen(false);
      setNotice(null);
      const refunded = lot.bidCount > 0 ? lot.currentBidCents : null;
      setAnnounce(cancelDoneMessage(lot.number, refunded));
      // A linha só muda de seção com a resposta do servidor; o foco vai ao título de "Cancelados" quando ele existir.
      await query.refetch();
      setFocusCancelled(true);
    },
    [query],
  );

  const confirm = useCallback(async () => {
    if (!target || dialog.status === "submitting") return;
    const confirmEntryCount = confirmCountOf(dialog);
    dispatch({ type: "submit" });

    if (uncertain.current) {
      // Falha de rede anterior: o cancelamento pode ter entrado. Confere antes de tentar de novo, sem reenvio às cegas.
      const fresh = await query.refetch();
      if (fresh.isError) {
        dispatch({ type: "failed", message: CANCEL_TEXT.networkAmbiguous });
        return;
      }
      const row = fresh.data?.lots.find((lot) => lot.id === target.id);
      if (row?.status === "CANCELLED") {
        uncertain.current = false;
        await succeed(row);
        return;
      }
    }

    const result = await apiPost<LotState>(`/lots/${target.id}/cancel`, { confirmEntryCount });
    if (result.ok) {
      uncertain.current = false;
      await succeed(result.data.lot);
      return;
    }
    const failure = describeCancelFailure(result.status, result.error);
    switch (failure.kind) {
      case "changed":
        uncertain.current = false;
        dispatch({ type: "changed", entryCount: failure.entryCount });
        break;
      case "close":
        uncertain.current = false;
        await closeWithNotice(target.id, failure.message);
        break;
      case "ambiguous":
        uncertain.current = true;
        dispatch({ type: "failed", message: failure.message });
        break;
      case "error":
        dispatch({ type: "failed", message: failure.message });
        break;
    }
  }, [target, dialog, query, succeed, closeWithNotice]);

  return { target, open, dialog, notice, announce, begin, close, confirm, focusCancelled, clearFocusCancelled: () => setFocusCancelled(false) };
}
