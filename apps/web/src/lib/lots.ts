import { brasiliaDayAndTime, brasiliaWeekday, type LotCard, type LotStatus } from "@lanceauto/shared";
import { API_URL } from "./api-client";

/** Destino do cartão: sempre a Sala, inclusive no encerrado. A auditoria é o link "Auditar este lote" dentro da Sala. */
export function lotCardHref(card: Pick<LotCard, "id" | "status">): string {
  return `/lotes/${card.id}`;
}

/** Caminho relativo da API ("/items/…/image") para URL absoluta. URL absoluta e `blob:` (foto escolhida no aparelho) passam direto. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:\/\/|blob:)/i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Tempo restante do cronômetro: `< 1 h` → mm:ss; `< 24 h` → hh:mm:ss; senão `Nd hh:mm:ss`.
 * Arredonda os segundos para cima (0,4 s mostra 00:01) e nunca mostra negativo.
 */
export function formatCountdown(ms: number): string {
  if (!(ms > 0)) return "00:00";
  const total = Math.ceil(ms / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (total < 3_600) return `${pad(minutes)}:${pad(seconds)}`;
  if (total < 86_400) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export type CountdownVariant = "normal" | "ultimos" | "encerrado";

export interface CountdownState {
  variant: CountdownVariant;
  /** Alvo: início se agendado, senão o fim. */
  target: number;
  remainingMs: number;
  extended: boolean;
  text: string;
}

/** Variante do cronômetro (§10.3). Últimos 2 min é inclusivo (≤ 120 s), como a regra de prorrogação. */
export function countdownState(
  lot: { status: LotStatus; startsAt: string; endsAt: string; originalEndsAt?: string },
  now: number,
): CountdownState {
  const scheduled = lot.status === "SCHEDULED";
  const target = Date.parse(scheduled ? lot.startsAt : lot.endsAt);
  const remainingMs = Math.max(0, target - now);
  const extended = lot.originalEndsAt !== undefined && Date.parse(lot.endsAt) > Date.parse(lot.originalEndsAt);
  const closed = !scheduled && (lot.status !== "LIVE" || remainingMs <= 0);
  const variant: CountdownVariant = closed ? "encerrado" : !scheduled && remainingMs <= 120_000 ? "ultimos" : "normal";
  return { variant, target, remainingMs: closed ? 0 : remainingMs, extended, text: formatCountdown(closed ? 0 : remainingMs) };
}

/** "ABRE QUI 24/10 14:00" do cartão agendado. */
export function opensLabel(iso: string): string {
  const { day, time } = brasiliaDayAndTime(iso);
  return `ABRE ${brasiliaWeekday(iso).toUpperCase()} ${day} ${time}`;
}

/** "02 LOTES", "01 LOTE". */
export function lotCountLabel(n: number): string {
  return `${String(n).padStart(2, "0")} ${n === 1 ? "LOTE" : "LOTES"}`;
}

/** "00 LANCES", "01 LANCE". */
export function bidCountLabel(n: number): string {
  return `${String(n).padStart(2, "0")} ${n === 1 ? "LANCE" : "LANCES"}`;
}

/** Só `http:`/`https:` vira link; o resto é mostrado como texto (AC-2.18b). */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
