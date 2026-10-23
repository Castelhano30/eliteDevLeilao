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
