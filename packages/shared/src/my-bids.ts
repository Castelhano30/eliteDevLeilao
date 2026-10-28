import { formatLotNumber } from "./catalog";
import { formatBRL } from "./money";
import type { LotCard } from "./lots";

export const BIDDER_LOT_STATES = ["LEADING", "OUTBID", "WON", "LOST", "CANCELLED"] as const;
/** Estado pessoal do licitante num lote (R-7.2): Ganhando, Superado, Arrematado, Perdido, Cancelado. */
export type BidderLotState = (typeof BIDDER_LOT_STATES)[number];

type Instant = Date | string | null;

export interface BidderLotStateInput {
  cancelledAt: Instant;
  settledAt: Instant;
  leaderId: string | null;
}

/**
 * Estado do licitante `me` no lote, só pelas colunas do banco, sem relógio (R-7.2). `cancelledAt` vence tudo:
 * cancelado nunca é `LOST`. Lote vencido e ainda não liquidado segue `LEADING`/`OUTBID`; o "apurando" é só rótulo.
 */
export function bidderLotState(lot: BidderLotStateInput, me: string): BidderLotState {
  if (lot.cancelledAt !== null) return "CANCELLED";
  const settled = lot.settledAt !== null;
  if (lot.leaderId === me) return settled ? "WON" : "LEADING";
  return settled ? "LOST" : "OUTBID";
}

/** Um ingresso de Meus arremates (S07 §6). Sem `userId`, nome, e-mail nem `leaderId` (INV-13). */
export interface MyBidItem {
  lot: LotCard;
  state: BidderLotState;
  /** Meu maior lance no lote. */
  myBestBidCents: number;
  /** "Licitante C3E8", deste lote. */
  myPseudonym: string;
  /** Só `LEADING`/`OUTBID`: 1 + licitantes cujo maior lance supera o meu. */
  myRank: number | null;
  /** Licitantes distintos com lance no lote. */
  bidderCount: number;
  /** Só `WON`/`LOST`: o vencedor naquele lote. */
  winnerPseudonym: string | null;
  /** Só `WON`, do `Receipt` cujo vencedor sou eu (T9). */
  receiptToken: string | null;
  /** Só `CANCELLED` em que eu liderava: o saldo que voltou. */
  refundedCents: number | null;
}

export interface MyBidsResponse {
  items: MyBidItem[];
  serverTime: string;
}

/** Textos de Meus arremates (S07 §8). Os marcados "(a revisar)" na fatia seguem para a revisão de voz da S09. */
export const MY_BIDS_TEXT = {
  title: "MEUS ARREMATES",
  emptyIntro: "Arremate é cada lote em que você dá lance. Aqui você acompanha se está ganhando, se foi superado ou se já levou o carro.",
  empty: "Você ainda não tem arremates. Escolha um carro na vitrine e dê o seu primeiro lance.",
  emptyAction: "Ver a vitrine",
  emptyTab: "Nenhum lote nesta aba. Troque de aba para ver o resto.",
  loading: "Carregando…",
  loadError: "Não deu para carregar seus arremates.",
  retry: "Tentar novamente",
  stale: "Lista possivelmente desatualizada.",
  roleNotAllowed: "Meus arremates é coisa de licitante.",
  closingSeal: "APURANDO",
  closingSentence: "Martelo batido. Apurando o resultado…",
  leadingSeal: (bidderCount: number) => `VOCÊ ESTÁ GANHANDO · 1º de ${bidderCount}`,
  outbidSeal: (rank: number, bidderCount: number) => `VOCÊ FOI SUPERADO · ${rank}º de ${bidderCount}`,
  leadingSentence: (bestCents: number) =>
    `Seu lance de ${formatBRL(bestCents)} está na frente. Esse valor está travado neste lote.`,
  outbidSentence: (bestCents: number, rank: number, bidderCount: number) =>
    `Seu lance (${formatBRL(bestCents)}) é o ${rank}º maior de ${bidderCount}`,
  wonSentence: (finalCents: number) => `Você arrematou por ${formatBRL(finalCents)}.`,
  lostSentence: (winnerPseudonym: string, finalCents: number, bestCents: number) =>
    `${winnerPseudonym} levou por ${formatBRL(finalCents)}. Seu maior lance foi ${formatBRL(bestCents)}.`,
  cancelledSentence: (refunded: boolean) =>
    `O leiloeiro cancelou este lote. Nada foi vendido.${refunded ? " O saldo que estava travado voltou para você." : ""}`,
  ownPseudonym: (pseudonym: string) => `Neste lote você é ${pseudonym}.`,
} as const;

/**
 * Anúncio da região viva quando o estado de um lote muda entre duas respostas do servidor (§8). Só os quatro da
 * fatia; voltar a `LEADING` e manter o estado não anunciam. Nunca chamar na carga inicial.
 */
export function transitionAnnouncement(prev: BidderLotState, next: BidderLotState, lotNumber: number): string | null {
  if (prev === next) return null;
  const lot = `Lote ${formatLotNumber(lotNumber)}`;
  switch (next) {
    case "OUTBID":
      return `${lot}: você foi superado.`;
    case "WON":
      return `${lot}: você arrematou.`;
    case "LOST":
      return `${lot}: não foi desta vez.`;
    case "CANCELLED":
      return `${lot}: cancelado.`;
    case "LEADING":
      return null;
  }
}
