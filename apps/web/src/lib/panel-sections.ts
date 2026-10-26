import { formatBRL, formatBrasilia, formatLotNumber, type MyLotCard } from "@lanceauto/shared";

export interface PanelSections {
  /** Ao vivo e apurando. */
  live: MyLotCard[];
  scheduled: MyLotCard[];
  /** Arrematados e sem lances. */
  ended: MyLotCard[];
  cancelled: MyLotCard[];
  soldCount: number;
}

/**
 * Separa as linhas do Painel por status do servidor, mantendo a ordem em que vieram. Cancelado fica só na sua seção:
 * não entra nos placares AO VIVO/AGENDADOS/ENCERRADOS nem na contagem de arremates (S06 §9.1).
 */
export function splitMyLots(lots: MyLotCard[]): PanelSections {
  return {
    live: lots.filter((lot) => lot.status === "LIVE" || lot.status === "CLOSING"),
    scheduled: lots.filter((lot) => lot.status === "SCHEDULED"),
    ended: lots.filter((lot) => lot.status === "SOLD" || lot.status === "UNSOLD"),
    cancelled: lots.filter((lot) => lot.status === "CANCELLED"),
    soldCount: lots.filter((lot) => lot.status === "SOLD").length,
  };
}

/** Cancelar vale para lote ao vivo ou agendado, com ou sem lances. Apurando já passou do fim (`LOT_ENDED`). */
export function canCancel(lot: Pick<MyLotCard, "status">): boolean {
  return lot.status === "LIVE" || lot.status === "SCHEDULED";
}

/** Nome acessível único por linha: "Cancelar lote 019, Hilux SRX 2020". */
export function cancelButtonLabel(lot: Pick<MyLotCard, "number" | "title">): string {
  return `Cancelar lote ${formatLotNumber(lot.number)}, ${lot.title}`;
}

/** Estorno em reais inteiros, ou traço quando ninguém liderava. */
export function refundLabel(lot: Pick<MyLotCard, "refundedCents">): string {
  return lot.refundedCents === null ? "—" : formatBRL(lot.refundedCents);
}

/** Textos das colunas da seção "Cancelados" (a coluna Lote usa o mesmo link das outras tabelas). */
export function cancelledColumns(lot: MyLotCard) {
  return {
    car: `${lot.brand} ${lot.model} ${lot.year}`,
    bids: String(lot.bidCount),
    lastBid: lot.bidCount > 0 && lot.currentBidCents !== null ? formatBRL(lot.currentBidCents) : "—",
    refund: refundLabel(lot),
    cancelledAt: lot.cancelledAt ? formatBrasilia(lot.cancelledAt) : "—",
  };
}
