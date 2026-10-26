import { z } from "zod";
import { brasiliaParts } from "./brasilia";
import { formatLotNumber } from "./catalog";
import { formatBRL } from "./money";

/** Textos do cancelamento (S06 §8). Os marcados "texto a revisar" na fatia seguem para a revisão de voz da S09. */
export const CANCEL_TEXT = {
  invalidCount: "Informe a contagem de lances que você viu.",
  roleNotAllowed: "Só leiloeiros cancelam lotes.",
  forbidden: "Este lote é de outro leiloeiro. Só o dono pode cancelar.",
  notFound: "Esse lote não existe mais.",
  lotCancelled: "Este lote já foi cancelado.",
  lotEnded: "Martelo já bateu. Este lote não pode mais ser cancelado.",
  networkAmbiguous: "Não deu para falar com o pátio. Confira o lote antes de tentar de novo.",
  bodyNoBids: "Ninguém deu lance ainda.",
  bodyWithBids:
    "O saldo comprometido de quem lidera volta para ele, e o cancelamento fica registrado no histórico da auditoria.",
  irreversible: "Não dá para desfazer.",
  newBidWarning: "Lance novo pode entrar até você confirmar. A contagem acompanha.",
  back: "Voltar",
  confirm: "Cancelar o lote",
  confirming: "Cancelando…",
} as const;

const MAX_COUNT = Number.MAX_SAFE_INTEGER;

/** Corpo de `POST /lots/:id/cancel`: a contagem de linhas da cadeia que o leiloeiro viu (R-6.7). */
export const cancelLotSchema = z.object({
  confirmEntryCount: z
    .number({ error: CANCEL_TEXT.invalidCount })
    .int(CANCEL_TEXT.invalidCount)
    .min(0, CANCEL_TEXT.invalidCount)
    .max(MAX_COUNT, CANCEL_TEXT.invalidCount),
});
export type CancelLotInput = z.infer<typeof cancelLotSchema>;

/** "0 lances", "1 lance", "2 lances". */
export function pluralBids(count: number): string {
  return `${count} ${count === 1 ? "lance" : "lances"}`;
}

/** "Cancelar o lote 019 com 2 lances?" ("com 1 lance"); sem lances, "Cancelar o lote 019?". */
export function cancelDialogTitle(lotNumber: number, bidCount: number): string {
  const number = formatLotNumber(lotNumber);
  return bidCount > 0 ? `Cancelar o lote ${number} com ${pluralBids(bidCount)}?` : `Cancelar o lote ${number}?`;
}

export function cancelDialogBody(bidCount: number): string {
  return bidCount > 0 ? CANCEL_TEXT.bodyWithBids : CANCEL_TEXT.bodyNoBids;
}

/** `LOT_CHANGED`: a contagem real que o servidor viu, com concordância ("Agora é 1 lance"). */
export function lotChangedMessage(entryCount: number): string {
  const now = entryCount === 0 ? "Agora não há lances." : entryCount === 1 ? "Agora é 1 lance." : `Agora são ${entryCount} lances.`;
  return `Entrou lance enquanto você decidia. ${now} Confirme de novo.`;
}

/** Confirmação do Painel; `refundedCents` é o estorno devolvido ao líder, `null` sem lances. */
export function cancelDoneMessage(lotNumber: number, refundedCents: number | null): string {
  const base = `Lote ${formatLotNumber(lotNumber)} cancelado.`;
  return refundedCents === null ? base : `${base} Estorno de ${formatBRL(refundedCents)} devolvido a quem liderava.`;
}

/** Aviso com o diálogo aberto quando entra lance novo: a contagem do título já acompanha (texto a revisar, S06 §9.1). */
export function newBidMessage(bidCount: number): string {
  return `Chegou lance novo: agora ${bidCount === 1 ? "é 1 lance" : `são ${bidCount} lances`}.`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Cancelado em 26/10 às 20:36:12" (Brasília, com segundos), da Sala cancelada (S06 §9.2). */
export function cancelledAtLabel(iso: string): string {
  const p = brasiliaParts(iso);
  return `Cancelado em ${pad(p.day)}/${pad(p.month)} às ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}
