"use client";

import { clockTime } from "@/lib/format";
import type { BannerView } from "@/lib/realtime/connection-status";

export interface ConnectionBannerProps {
  view: BannerView;
  /** Relógio do servidor (ms) no último snapshot aplicado. */
  lastSyncedAt: number | null;
}

/**
 * Aviso de conexão (S04 §10): no fluxo da página, nunca `position: fixed`, sem botão. Neutro (`tinta`/`fundo`):
 * o DESIGN não usa verde para sucesso genérico. `role="status"` fica sempre montado e só o conteúdo muda, para o
 * leitor de tela anunciar a troca. O ponto pulsa enquanto reconecta (parado em reduced-motion, por CSS global).
 */
export function ConnectionBanner({ view, lastSyncedAt }: ConnectionBannerProps) {
  return (
    <div role="status" aria-live="polite" className={view === "hidden" ? undefined : "mb-6"}>
      {view === "offline" ? (
        <div className="flex items-start gap-3 border-[3px] border-linha bg-tinta px-4 py-[10px] text-fundo">
          <span aria-hidden="true" className="mt-[6px] inline-block h-[10px] w-[10px] shrink-0 rounded-circulo bg-fundo" style={{ animation: "la-pulsa 1.2s infinite" }} />
          <div>
            <p className="t-mono-dado font-semibold">Sem sinal com o pátio. Tentando reconectar.</p>
            {lastSyncedAt !== null ? <p className="t-mono-rotulo mt-1">Última atualização às {clockTime(lastSyncedAt)}.</p> : null}
          </div>
        </div>
      ) : null}
      {view === "back" ? (
        <div className="border-[3px] border-linha bg-tinta px-4 py-[10px] text-fundo">
          <p className="t-mono-dado font-semibold">De volta ao pátio. Estado do lote atualizado.</p>
        </div>
      ) : null}
    </div>
  );
}
