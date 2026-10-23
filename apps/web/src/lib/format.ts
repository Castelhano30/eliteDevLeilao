import { formatBRL, LEDGER_LABEL, LEDGER_NOTE, type LedgerEntryDto, type LedgerKind } from "@lanceauto/shared";

const parts = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "dd/mm HH:mm" em horário de Brasília, a partir de uma data ISO UTC. */
export function formatWhen(iso: string): string {
  const get = (type: string) => parts.formatToParts(new Date(iso)).find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

/** "001": número do lote com três dígitos. */
export function lotNumberLabel(number: number): string {
  return String(number).padStart(3, "0");
}

export interface MovementView {
  label: string;
  /** Valor já formatado, com o sinal que o extrato mostra. */
  value: string;
  note: string | null;
}

/** Rótulo, valor e nota de cada linha do extrato (S01 9.4). */
export function describeMovement(entry: Pick<LedgerEntryDto, "kind" | "amountCents">): MovementView {
  const money = formatBRL(entry.amountCents);
  const kind: LedgerKind = entry.kind;
  const signed: Partial<Record<LedgerKind, string>> = {
    DEPOSIT: `+ ${money}`,
    SALE_DEBIT: `− ${money}`,
    SALE_CREDIT: `+ ${money}`,
  };
  const note = kind === "HOLD" || kind === "RELEASE" || kind === "REFUND" ? LEDGER_NOTE[kind] : null;
  return { label: LEDGER_LABEL[kind], value: signed[kind] ?? money, note };
}
