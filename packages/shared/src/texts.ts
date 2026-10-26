import { formatLotNumber } from "./catalog";
import { formatBRL } from "./money";

/** Textos canônicos do extrato da carteira (T8): as fatias importam, não redigitam. */
export const LEDGER_TEXT = {
  RELEASE: "Saldo liberado · lance superado",
  REFUND: "Estorno · lote cancelado",
  NOTE: "TOTAL NÃO MUDA",
} as const;

/** Rótulo de cada movimento do extrato (S01 9.4); as notas explicam o que não muda no total. */
export const LEDGER_LABEL = {
  DEPOSIT: "Depósito",
  HOLD: "Saldo travado · lance",
  RELEASE: LEDGER_TEXT.RELEASE,
  REFUND: LEDGER_TEXT.REFUND,
  SALE_DEBIT: "Arremate",
  SALE_CREDIT: "Venda",
} as const;

export const LEDGER_NOTE = {
  HOLD: LEDGER_TEXT.NOTE,
  RELEASE: `VOLTOU AO DISPONÍVEL · ${LEDGER_TEXT.NOTE}`,
  REFUND: `VOLTOU AO DISPONÍVEL · ${LEDGER_TEXT.NOTE}`,
} as const;

/** "Arremate · lote 018"; sem o número do lote, só "Arremate". */
export function saleDebitLabel(lotNumber: number | null): string {
  return lotNumber === null ? LEDGER_LABEL.SALE_DEBIT : `${LEDGER_LABEL.SALE_DEBIT} · lote ${formatLotNumber(lotNumber)}`;
}

/** Linha de apoio do arremate: sai do total e do comprometido, o disponível não muda. */
export function saleDebitNote(amountCents: number): string {
  const money = formatBRL(amountCents);
  return `TOTAL −${money} · COMPROMETIDO −${money} · DISPONÍVEL não muda`;
}
