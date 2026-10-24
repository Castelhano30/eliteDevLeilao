import { formatBRL, type BidDTO, type LotState, type PlaceBidResponse } from "@lanceauto/shared";
import { BID_MAX_DIGITS, maskReais } from "./money-mask";

type Lot = LotState["lot"];

/** Atalhos do campo de lance, em reais (§9.3.4). Fixos para todos os lotes, independentes do incremento. */
export const BID_SHORTCUTS = [500, 1_000, 5_000] as const;

/** "2º". */
export function ordinal(n: number): string {
  return `${n}º`;
}

/** Palavra no singular ou no plural conforme `n` ("lance", "lances"); sem plural informado, acrescenta "s". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? singular : pluralForm;
}

// ---------------------------------------------------------------- reducer único (T4)

/** O que um lance novo faz ao estado da Sala. O `bid:placed` da S04 tem exatamente este formato. */
export interface BidEvent {
  bid: BidDTO;
  currentBidCents: number;
  bidCount: number;
  bidderCount: number;
  /** = entryCount do lote depois deste lance. */
  version: number;
  endsAt: string;
  serverTime: string;
}

/** Posição de quem tem o pseudônimo, pelo maior lance de cada pseudônimo no histórico completo. */
export function positionFromBids(bids: readonly BidDTO[], pseudonym: string | null): { rank: number; best: number } | null {
  if (pseudonym === null) return null;
  const best = new Map<string, number>();
  for (const bid of bids) if (bid.amountCents > (best.get(bid.pseudonym) ?? 0)) best.set(bid.pseudonym, bid.amountCents);
  const mine = best.get(pseudonym);
  if (mine === undefined) return null;
  let above = 0;
  for (const value of best.values()) if (value > mine) above += 1;
  return { rank: 1 + above, best: mine };
}

/**
 * Reducer único do estado da Sala (puro). Lê só `version`: evento com versão menor ou igual à atual é descartado,
 * então a mesma resposta chegando por REST e por evento não duplica linha. A S04 reaproveita para `bid:placed`.
 */
export function applyLotEvent(state: LotState, event: BidEvent): LotState {
  if (event.version <= state.lot.version) return state;
  const bids = [event.bid, ...state.bids.filter((bid) => bid.seq !== event.bid.seq)].sort((a, b) => b.seq - a.seq);
  const position = positionFromBids(bids, state.lot.myPseudonym);
  return {
    ...state,
    serverTime: event.serverTime,
    lot: {
      ...state.lot,
      currentBidCents: event.currentBidCents,
      minimumBidCents: event.currentBidCents + state.lot.minIncrementCents,
      bidCount: event.bidCount,
      bidderCount: event.bidderCount,
      version: event.version,
      entryCount: event.version,
      endsAt: event.endsAt,
      myRank: position?.rank ?? null,
      myBestBidCents: position?.best ?? null,
    },
    bids,
  };
}

/** Resposta do próprio lance: aplica o evento e fica com a posição que o servidor calculou. */
export function applyBidResponse(state: LotState, response: PlaceBidResponse): LotState {
  const next = applyLotEvent(state, {
    bid: response.bid,
    currentBidCents: response.lot.currentBidCents ?? response.bid.amountCents,
    bidCount: response.lot.bidCount,
    bidderCount: response.lot.bidderCount,
    version: response.lot.version,
    endsAt: response.lot.endsAt,
    serverTime: response.serverTime,
  });
  if (next === state) return state;
  return {
    ...next,
    lot: {
      ...next.lot,
      myRank: response.lot.myRank,
      myBestBidCents: response.lot.myBestBidCents,
      myPseudonym: response.lot.myPseudonym ?? next.lot.myPseudonym,
    },
  };
}

// ---------------------------------------------------------------- viewer × estado (§9.2)

export type Viewer = { role: "BIDDER" | "AUCTIONEER" } | null;

export type Situation =
  | { kind: "winning"; rank: number; of: number; lockedCents: number }
  | { kind: "outbid"; rank: number; of: number; bestCents: number }
  | { kind: "none"; minimumCents: number }
  | { kind: "visitor"; minimumCents: number }
  | { kind: "auctioneer" }
  | { kind: "closing" };

/**
 * Situação de quem olha a Sala. `null` quando o lote não está ao vivo nem apurando (agendado, cancelado e encerrado
 * têm tela própria). Quem nunca deu lance nunca vira "0º maior": é a situação `none`.
 */
export function deriveSituation(
  lot: Pick<Lot, "status" | "myRank" | "myBestBidCents" | "bidderCount" | "minimumBidCents">,
  viewer: Viewer,
): Situation | null {
  if (lot.status === "CLOSING") return { kind: "closing" };
  if (lot.status !== "LIVE") return null;
  if (viewer === null) return { kind: "visitor", minimumCents: lot.minimumBidCents };
  if (viewer.role === "AUCTIONEER") return { kind: "auctioneer" };
  if (lot.myBestBidCents === null || lot.myRank === null) return { kind: "none", minimumCents: lot.minimumBidCents };
  if (lot.myRank === 1) return { kind: "winning", rank: 1, of: lot.bidderCount, lockedCents: lot.myBestBidCents };
  return { kind: "outbid", rank: lot.myRank, of: lot.bidderCount, bestCents: lot.myBestBidCents };
}

export interface BandText {
  title: string;
  sub: string;
}

/** Título e subtítulo da faixa/placar de cada situação. */
export function situationText(situation: Situation): BandText {
  switch (situation.kind) {
    case "winning":
      return { title: "Você está ganhando", sub: `${ordinal(situation.rank)} de ${situation.of}` };
    case "outbid":
      return {
        title: "Você foi superado",
        sub: `Seu lance (${formatBRL(situation.bestCents)}) é o ${ordinal(situation.rank)} maior de ${situation.of}`,
      };
    case "none":
      return { title: "Você ainda não deu lance", sub: `Mínimo aceito ${formatBRL(situation.minimumCents)}.` };
    case "visitor":
      return { title: "Você está assistindo", sub: "Sem conta você vê tudo, só não pode levantar a mão." };
    case "auctioneer":
      return { title: "Leiloeiros não podem dar lances", sub: "Você vê a Sala como espectador." };
    case "closing":
      return { title: "Martelo batido. Apurando o resultado…", sub: "" };
  }
}

/** Rodapé do campo de lance: quanto está travado neste lote. */
export function lockedFooter(situation: Situation): string {
  return situation.kind === "winning" ? `${formatBRL(situation.lockedCents)} travados neste lote` : "Nada travado neste lote";
}

// ---------------------------------------------------------------- campo de lance (§9.3)

export interface BidField {
  text: string;
  /** O usuário já editou: o campo deixa de acompanhar o mínimo. */
  dirty: boolean;
}

/** Texto do mínimo no campo: reais inteiros, arredondando para cima se o lote tiver centavos. */
export function minimumText(minimumCents: number): string {
  return maskReais(String(Math.ceil(minimumCents / 100)), undefined, BID_MAX_DIGITS).value;
}

export function initialField(minimumCents: number): BidField {
  return { text: minimumText(minimumCents), dirty: false };
}

/** Enquanto não editado, o campo acompanha o mínimo; depois de editado, mantém o que foi digitado. */
export function syncField(field: BidField, minimumCents: number): BidField {
  if (field.dirty) return field;
  const text = minimumText(minimumCents);
  return text === field.text ? field : { text, dirty: false };
}

/** Atalho "+ R$ N": soma ao valor atual do campo; campo vazio parte do mínimo. Marca como editado. */
export function applyShortcut(field: BidField, addReais: number, minimumCents: number): BidField {
  const digits = field.text.replace(/\D/g, "");
  const base = digits === "" ? Math.ceil(minimumCents / 100) : Number(digits);
  return { text: maskReais(String(base + addReais), undefined, BID_MAX_DIGITS).value, dirty: true };
}
