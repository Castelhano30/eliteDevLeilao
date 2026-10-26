import { formatBRL, type MyLotResult } from "@lanceauto/shared";
import { fipeVariation } from "./fipe-variation";

/** "Nenhum lance", "1 lance", "4 lances": o texto dos cartões. */
export function bidsText(n: number): string {
  if (n === 0) return "Nenhum lance";
  return n === 1 ? "1 lance" : `${n} lances`;
}

export type EndedCardLines =
  | { kind: "sold"; headline: string; value: string; bids: string; fipe: string | null }
  | { kind: "unsold"; headline: string };

/**
 * Linhas do cartão Encerrado do Painel (§9.3). `null` enquanto o `resultado` da linha não chegou: o cartão cai no
 * rodapé genérico. A variação sobre a FIPE some sem referência; o cartão sem lances não compara nada.
 */
export function endedCardLines(resultado: MyLotResult | null | undefined, bidCount: number): EndedCardLines | null {
  if (!resultado) return null;
  if (resultado.outcome === "UNSOLD" || resultado.finalBidCents === null) return { kind: "unsold", headline: "Fechado sem lances" };
  const variation = fipeVariation(resultado.finalBidCents, resultado.referencePriceCents);
  const reference = resultado.referencePriceCents > 0 ? `FIPE ${formatBRL(resultado.referencePriceCents)}` : null;
  return {
    kind: "sold",
    headline: `${resultado.winnerPseudonym ?? "Licitante"} levou`,
    value: formatBRL(resultado.finalBidCents),
    bids: bidsText(bidCount),
    fipe: reference === null ? null : variation === null ? reference : `${reference} · ${variation}`,
  };
}

/** "TOTAL RECEBIDO · 3 ARREMATES": o rótulo do resumo do Painel. */
export function receivedLabel(sold: number): string {
  return `TOTAL RECEBIDO · ${sold} ${sold === 1 ? "ARREMATE" : "ARREMATES"}`;
}
