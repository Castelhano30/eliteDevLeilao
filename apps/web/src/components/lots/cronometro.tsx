"use client";

import { useState } from "react";
import type { LotStatus } from "@lanceauto/shared";
import { countdownState, formatCountdown } from "@/lib/lots";
import { useServerNow } from "@/lib/use-server-clock";

export interface CronometroProps {
  status: LotStatus;
  startsAt: string;
  endsAt: string;
  originalEndsAt?: string;
  size: "sala" | "cartao";
  /** Rótulo fixo; sem ele, sai da variante. */
  label?: string;
  /** `serverTime` da carga, para o primeiro render casar com o HTML do servidor. */
  serverTime?: string;
}

/**
 * "+2 MIN": aparece quando o fim passou do original. Fica no fluxo, na linha dos dígitos, à direita deles (nunca em `position: absolute`
 * sobre o rótulo); se a linha não couber, desce para baixo dos dígitos. Pílula `led` sobre `painel`, 20px no cartão e 24px na Sala.
 */
export function SeloProrrogacao({ size }: { size: "sala" | "cartao" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center rounded-full bg-led px-2 text-[12px] font-extrabold uppercase leading-none text-painel ${size === "sala" ? "h-6" : "h-5"}`}
      style={{ animation: "la-mais 0.6s both" }}
    >
      +2 MIN
    </span>
  );
}

/** Ícone de alerta de 14px do rótulo "ÚLTIMOS 2 MIN": o estado não depende só da cor. */
function AlertGlyph() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.3" r="0.6" fill="currentColor" />
    </svg>
  );
}

/**
 * "LCD de bomba de gasolina" (§10.3): conta até o início (agendado) ou até o fim, pelo relógio do servidor.
 * Variantes: normal, últimos 2 min, prorrogado (e as duas juntas), apurando, agendado e encerrado. Nada depende da animação.
 */
export function Cronometro({ status, startsAt, endsAt, originalEndsAt, size, label, serverTime }: CronometroProps) {
  const now = useServerNow(serverTime);
  const state = countdownState({ status, startsAt, endsAt, originalEndsAt }, now);
  const [announced, setAnnounced] = useState(false);
  // Anuncia "Últimos 2 minutos" uma vez (estado derivado no render, sem efeito).
  if (state.variant === "ultimos" && !announced && now > 0) setAnnounced(true);

  const scheduled = status === "SCHEDULED";
  const alert = state.variant === "ultimos";
  const closed = state.variant === "encerrado";
  // Apurando: o fim passou (ou o lote já saiu de LIVE) e o servidor ainda não fechou. Os resultados finais não entram aqui.
  const settling = closed && (status === "CLOSING" || status === "LIVE");
  const text = now > 0 || closed ? state.text : "--:--";
  const shownLabel =
    label ??
    (settling
      ? "APURANDO…"
      : closed
        ? "ENCERRADO"
        : scheduled
          ? "ABRE EM"
          : alert
            ? "ÚLTIMOS 2 MIN"
            : state.extended
              ? "PRORROGADO"
              : size === "sala"
                ? "TEMPO RESTANTE"
                : "RESTAM");
  // Leitor de tela: a cada 10 s, não a cada segundo.
  const spoken = formatCountdown(Math.ceil(state.remainingMs / 10_000) * 10_000);
  const ariaLabel = closed ? "Tempo restante 00:00" : `${scheduled ? "Abre em" : "Tempo restante"} ${spoken}`;
  // Sem quebra de linha, "26d 10:18:34" a 44 px passa do painel da Sala em telas estreitas: a fonte encolhe com a largura.
  const digits = size === "sala" ? "clamp(32px, 10vw, 44px)" : 24;
  // Dígitos brancos no cartão e na Sala; os segmentos apagados (CSS) usam a mesma cor.
  const led = "var(--c-led-digito)";

  // Borda de 2px em `ledAlerta` nos últimos 2 min e na apuração (o `alerta` do claro dá só 2,65:1 sobre o painel); 1px `linha` nas demais.
  const thick = alert || settling;
  const accent = "var(--c-led-alerta)";

  return (
    <div
      className={`inline-flex max-w-full flex-col gap-1 rounded-xl bg-painel ${size === "sala" ? "px-[14px] py-[10px]" : "px-3 py-2"}`}
      style={{ border: `${thick ? 2 : 1}px solid ${thick ? accent : "var(--c-linha)"}` }}
    >
      <span
        className="inline-flex items-center gap-1 text-[12px] font-bold uppercase leading-none tracking-[0.08em]"
        style={{ color: alert || settling ? accent : "var(--f-rotulo-relogio)" }}
      >
        {alert ? <AlertGlyph /> : null}
        {shownLabel}
      </span>
      {/* Linha dos dígitos: o "+2 MIN" entra aqui, à direita; se não couber, desce para baixo dos dígitos. Os dígitos nunca quebram. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span role="timer" aria-label={ariaLabel} className="la-mostrador relative whitespace-nowrap font-bold leading-none" style={{ fontSize: digits }}>
          {/* Segmentos apagados do mostrador: decoração pura, fora do DOM como texto (pseudo-elemento em globals.css). */}
          <span aria-hidden="true" data-ghost={text.replace(/\d/g, "8")} className="la-segmentos-apagados absolute inset-0" />
          <span
            aria-hidden="true"
            className="relative"
            style={{ color: alert ? accent : led, animation: alert ? "la-pulsa 1s infinite" : undefined }}
          >
            {text}
          </span>
        </span>
        <span className="sr-only" aria-live="polite">
          {announced ? "Últimos 2 minutos" : ""}
        </span>
        {/* `key`: cada novo fim remonta o selo e a animação `la-mais` roda de novo (R-4.11). */}
        {state.extended && !closed ? <SeloProrrogacao key={endsAt} size={size} /> : null}
      </div>
    </div>
  );
}
