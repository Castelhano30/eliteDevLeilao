import { z } from "zod";
import { brasiliaParts } from "./brasilia";
import type { LotStatus } from "./lots";
import { formatBRL } from "./money";
import type { WalletDto } from "./wallet";

/** Janela de prorrogação: lance com `endsAt − now <= 2 min` leva o fim a `now + 2 min` (INV-9). */
export const EXTENSION_WINDOW_MS = 2 * 60 * 1000;

export const BID_TEXT = {
  alreadyWinning: "Você já está na frente. Cobrir o próprio lance só gasta saldo.",
  lotCancelled: "Este lote foi cancelado pelo leiloeiro.",
  roleNotAllowed: "Leiloeiro vende, não compra. Lance é coisa de licitante.",
  unauthenticated: "Entre para dar lances.",
  invalidAmount: "Informe um valor de lance válido.",
  invalidExpected: "Informe o último lance que você viu, ou nulo se ainda não havia lances.",
  rateLimited: "Calma: lances demais em pouco tempo. Tente de novo em instantes.",
  emptyField: "Informe o valor do lance.",
  networkAmbiguous: "Sem resposta do pátio. Seu lance pode ou não ter entrado: confira o histórico antes de tentar de novo.",
  sending: "Enviando…",
  noBidsYet: "Nenhum lance ainda. O mínimo é o lance inicial.",
} as const;

export type BelowMinimumReason = "MINIMUM" | "OUTDATED" | "OWN_LEAD";

/** `BELOW_MINIMUM`: o texto muda conforme o motivo (R-3.7); o código é sempre o mesmo. */
export function belowMinimumMessage(reason: BelowMinimumReason, minimumCents: number): string {
  const minimum = formatBRL(minimumCents);
  if (reason === "OWN_LEAD") return `Você já está na frente. Para cobrir o próprio lance, o mínimo é ${minimum}.`;
  if (reason === "OUTDATED") return `Alguém levantou a mão antes de você. O mínimo agora é ${minimum}.`;
  return `Seu lance precisa ser de pelo menos ${minimum}.`;
}

export function insufficientBalanceMessage(availableCents: number): string {
  return `Saldo insuficiente: você tem ${formatBRL(availableCents)} disponíveis.`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Martelo batido às 14:05. Este lote não aceita mais lances." (horário de Brasília). */
export function lotEndedMessage(endsAt: string): string {
  const p = brasiliaParts(endsAt);
  return `Martelo batido às ${pad(p.hour)}:${pad(p.minute)}. Este lote não aceita mais lances.`;
}

const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** "O lote abre sexta-feira, 24/10, às 14h. Até lá o martelo fica na gaveta." (14h30 quando há minutos). */
export function lotNotStartedMessage(startsAt: string): string {
  const p = brasiliaParts(startsAt);
  const time = p.minute === 0 ? `${p.hour}h` : `${p.hour}h${pad(p.minute)}`;
  return `O lote abre ${WEEKDAY_NAMES[p.weekday]}, ${pad(p.day)}/${pad(p.month)}, às ${time}. Até lá o martelo fica na gaveta.`;
}

const MAX_BID_CENTS = Number.MAX_SAFE_INTEGER;

/** Corpo de `POST /lots/:id/bids`: as duas chaves são obrigatórias; `expectedCurrentCents` aceita `null` (sem lances). */
export const placeBidSchema = z.object({
  amountCents: z
    .number({ error: BID_TEXT.invalidAmount })
    .int(BID_TEXT.invalidAmount)
    .min(1, BID_TEXT.invalidAmount)
    .max(MAX_BID_CENTS, BID_TEXT.invalidAmount),
  expectedCurrentCents: z
    .number({ error: BID_TEXT.invalidExpected })
    .int(BID_TEXT.invalidExpected)
    .min(0, BID_TEXT.invalidExpected)
    .max(MAX_BID_CENTS, BID_TEXT.invalidExpected)
    .nullable(),
});
export type PlaceBidInput = z.infer<typeof placeBidSchema>;

/** Lance como o público o vê: nunca carrega usuário (INV-13). */
export interface BidDTO {
  seq: number;
  kind: "BID";
  pseudonym: string;
  amountCents: number;
  at: string;
}

export interface BelowMinimumDetails {
  minimumCents: number;
  currentBidCents: number | null;
  reason: BelowMinimumReason;
}

export interface InsufficientBalanceDetails {
  availableCents: number;
}

export interface LotNotStartedDetails {
  startsAt: string;
}

/** Resumo do lote devolvido pelo lance e usado pelo reducer da Sala. */
export interface LotSummary {
  id: string;
  status: LotStatus;
  currentBidCents: number | null;
  minimumBidCents: number;
  bidCount: number;
  bidderCount: number;
  version: number;
  /** Alias de `version`. */
  entryCount: number;
  endsAt: string;
  originalEndsAt: string;
  /** O lote foi prorrogado em algum momento (`endsAt > originalEndsAt`), diferente do `extended` do evento. */
  extended: boolean;
  myRank: number | null;
  myBestBidCents: number | null;
  myPseudonym: string | null;
}

export interface PlaceBidResponse {
  bid: BidDTO;
  lot: LotSummary;
  wallet: WalletDto;
  serverTime: string;
}

/** Payload de `bid:placed` (S04 entrega por Socket.IO; o service já o produz). */
export interface BidPlacedPayload {
  lotId: string;
  version: number;
  bid: BidDTO;
  currentBidCents: number;
  bidCount: number;
  bidderCount: number;
  endsAt: string;
  /** Este lance prorrogou o fim. */
  extended: boolean;
  serverTime: string;
}
