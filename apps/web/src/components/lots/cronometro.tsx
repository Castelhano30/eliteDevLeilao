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
      className="absolute font-display font-black text-sobreOcre"
      style={{
        right: -14,
        top: -14,
        background: "var(--c-ocre)",
        border: "3px solid var(--c-tinta)",
        fontSize: size === "sala" ? 22 : 18,
        padding: "2px 8px 0",
        transform: "rotate(-6deg)",
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
  const ariaLabel = closed ? "Encerrado" : `${scheduled ? "Abre em" : "Tempo restante"} ${spoken}`;
  const digits = size === "sala" ? 58 : 28;

  return (
    <div
      className="relative inline-flex flex-col gap-1 bg-painel"
      style={{ border: `3px solid ${alert ? "var(--c-ferrugem)" : "var(--c-linha)"}`, padding: "10px 14px 12px" }}
    >
      <span className="t-mono-rotulo-pequeno" style={{ color: alert ? "var(--c-led-alerta)" : "var(--f-rotulo-relogio)" }}>
        {shownLabel}
      </span>
      <span role="timer" aria-label={ariaLabel} className="relative font-mono font-semibold leading-none" style={{ fontSize: digits }}>
        <span aria-hidden="true" className="absolute inset-0 opacity-10" style={{ color: "var(--c-led)" }}>
          {text.replace(/\d/g, "8")}
        </span>
        <span
          aria-hidden="true"
          className="relative"
          style={{ color: alert ? "var(--c-led-alerta)" : "var(--c-led)", animation: alert ? "la-pulsa 1s infinite" : undefined }}
        >
          {text}
        </span>
      </span>
      {state.extended && !closed ? <SeloProrrogacao size={size} /> : null}
      <span className="sr-only" aria-live="polite">
        {announced ? "Últimos 2 minutos" : ""}
      </span>
    </div>
  );
}
