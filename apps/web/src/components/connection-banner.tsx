"use client";

import { Notice } from "@/components/ui/notice";
import { clockTime } from "@/lib/format";
import type { BannerView } from "@/lib/realtime/connection-status";

export interface ConnectionBannerProps {
  view: BannerView;
  /** Relógio do servidor (ms) no último snapshot aplicado. */
  lastSyncedAt: number | null;
}

/**
 * Aviso de conexão (S04 §10, DESIGN 4.9): no fluxo da página, nunca `position: fixed`, sem botão. Sem sinal é um alerta; "de volta"
 * é informativo (o verde é só para "ganhando" e "íntegro"). `role="status"` fica sempre montado no contêiner e só o conteúdo muda,
 * para o leitor de tela anunciar a troca; por isso os avisos de dentro não levam papel próprio.
 */
export function ConnectionBanner({ view, lastSyncedAt }: ConnectionBannerProps) {
  return (
    <div role="status" aria-live="polite" className={view === "hidden" ? undefined : "mb-6"}>
      {view === "offline" ? (
        <Notice kind="alerta" role="none">
          <p className="font-semibold">Sem sinal com o pátio. Tentando reconectar.</p>
          {lastSyncedAt !== null ? <p className="t-body-nota mt-1">Última atualização às {clockTime(lastSyncedAt)}.</p> : null}
        </Notice>
      ) : null}
      {view === "back" ? (
        <Notice kind="info" role="none">
          <p className="font-semibold">De volta ao pátio. Estado do lote atualizado.</p>
        </Notice>
      ) : null}
    </div>
  );
}
