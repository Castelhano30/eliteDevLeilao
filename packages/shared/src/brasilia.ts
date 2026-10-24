/** Brasília é UTC−3 fixo: o Brasil não tem horário de verão desde 2019. */
export const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;

const pad = (n: number, size = 2) => String(n).padStart(size, "0");

/**
 * Valor de `datetime-local` digitado em Brasília ("2026-10-25T10:00") para ISO UTC com ms
 * ("2026-10-25T13:00:00.000Z"). Entrada inválida volta `null`.
 */
export function brasiliaLocalToUtcIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map((part) => (part === undefined ? undefined : Number(part)));
  const asUtc = Date.UTC(y!, mo! - 1, d!, h!, mi!, s ?? 0);
  const check = new Date(asUtc);
  // Recusa datas que o Date "corrige" (31/02 vira 03/03).
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo! - 1 || check.getUTCDate() !== d || h! > 23 || mi! > 59) {
    return null;
  }
  return new Date(asUtc - BRASILIA_OFFSET_MS).toISOString();
}

/** Partes da data em Brasília, para formatar sem depender do fuso do aparelho. */
export function brasiliaParts(iso: string | Date) {
  const ms = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const local = new Date(ms + BRASILIA_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
    weekday: local.getUTCDay(),
  };
}

/** ISO UTC para o valor de um `datetime-local` em Brasília ("2026-10-25T10:00"). */
export function utcIsoToBrasiliaLocal(iso: string): string {
  const p = brasiliaParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "list" → "25/10 10:00"; "seconds" → "25/10/2026 10:00:00". Sempre em Brasília. */
export function formatBrasilia(iso: string, style: "list" | "seconds" = "list"): string {
  const p = brasiliaParts(iso);
  if (style === "seconds") {
    return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  }
  return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}`;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Qui" (dia da semana em Brasília). */
export function brasiliaWeekday(iso: string): string {
  return WEEKDAYS[brasiliaParts(iso).weekday] ?? "";
}

/** "Qui 22/out · 18:47": relógio da barra "Pátio aberto". */
export function formatBrasiliaClock(iso: string): string {
  const p = brasiliaParts(iso);
  return `${WEEKDAYS[p.weekday]} ${pad(p.day)}/${MONTHS[p.month - 1]} · ${pad(p.hour)}:${pad(p.minute)}`;
}

/** "25/10" e "10:00" separados, para frases como "abre em 25/10 às 10:00 (Brasília)". */
export function brasiliaDayAndTime(iso: string): { day: string; time: string } {
  const p = brasiliaParts(iso);
  return { day: `${pad(p.day)}/${pad(p.month)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}
