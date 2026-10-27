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

/** "+2 MIN": aparece quando o fim passou do original. */
export function SeloProrrogacao({ size }: { size: "sala" | "cartao" }) {
  return (
    <span
      aria-hidden="true"
      className="absolute font-extrabold text-sobreOcre"
      style={{
        right: -14,
        top: -14,
        background: "var(--c-ocre)",
        border: "3px solid var(--c-tinta)",
        fontSize: size === "sala" ? 22 : 18,
        padding: "2px 8px 0",
        // `rotate` (e não `transform`) para a inclinação somar ao `translateY` da animação, sem ser sobrescrita.
        rotate: "-6deg",
        animation: "la-mais 0.6s both",
      }}
    >
      +2 MIN
    </span>
  );
}

/**
 * "LCD de bomba de gasolina" (§10.3): conta até o início (agendado) ou até o fim, pelo relógio do servidor.
 * Variantes: normal, últimos 2 min, prorrogado e encerrado. Nada depende da animação.
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
  const text = now > 0 || closed ? state.text : "--:--";
  const shownLabel =
    label ??
    (closed
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
  const digits = size === "sala" ? 44 : 24;

  return (
    <div
      className="relative inline-flex flex-col gap-1 bg-painel"
      style={{ border: `2px solid ${alert ? "var(--c-ferrugem)" : "var(--c-linha)"}`, padding: "8px 10px" }}
    >
      <span className="t-mono-rotulo-pequeno" style={{ color: alert ? "var(--c-led-alerta)" : "var(--f-rotulo-relogio)" }}>
        {shownLabel}
      </span>
      <span role="timer" aria-label={ariaLabel} className="relative font-semibold leading-none" style={{ fontSize: digits }}>
        {/* Segmentos apagados do mostrador: decoração pura, fora do DOM como texto (pseudo-elemento em globals.css). */}
        <span aria-hidden="true" data-ghost={text.replace(/\d/g, "8")} className="la-segmentos-apagados absolute inset-0" />
        <span
          aria-hidden="true"
          className="relative"
          style={{ color: alert ? "var(--c-led-alerta)" : "var(--c-led)", animation: alert ? "la-pulsa 1s infinite" : undefined }}
        >
          {text}
        </span>
      </span>
      {/* `key`: cada novo fim remonta o selo e a animação `la-mais` roda de novo (R-4.11). */}
      {state.extended && !closed ? <SeloProrrogacao key={endsAt} size={size} /> : null}
      <span className="sr-only" aria-live="polite">
        {announced ? "Últimos 2 minutos" : ""}
      </span>
    </div>
  );
}
