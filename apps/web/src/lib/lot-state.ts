import { formatBRL, type LotState } from "@lanceauto/shared";
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

// ---------------------------------------------------------------- Sala agendada que devia ter aberto (§9.2)

/** Quantas respostas do servidor, de 2 em 2 s, a Sala agendada confere antes de desistir de esperar a abertura. */
export const OPENING_CHECKS = 10;

export interface OpeningChecks {
  /** `dataUpdatedAt` da última resposta contada; `null` até a primeira avaliação. */
  seenAt: number | null;
  /** Respostas do servidor vistas depois que o início passou. */
  count: number;
}

export const INITIAL_OPENING_CHECKS: OpeningChecks = { seenAt: null, count: 0 };

/**
 * Passo puro da conferência de abertura (e, com `limit`, de qualquer polling com teto, como o da Vitrine apurando). O TanStack reavalia o `refetchInterval` a cada render, então contar
 * avaliações gastaria as tentativas em segundos: só conta quando chega uma resposta nova (`dataUpdatedAt` mudou).
 * A carga que já estava na tela não conta como conferência.
 */
export function nextOpeningCheck(
  prev: OpeningChecks,
  dataUpdatedAt: number,
  limit: number = OPENING_CHECKS,
): { next: OpeningChecks; keepPolling: boolean } {
  const next: OpeningChecks =
    prev.seenAt === null
      ? { seenAt: dataUpdatedAt, count: 0 }
      : prev.seenAt === dataUpdatedAt
        ? prev
        : { seenAt: dataUpdatedAt, count: prev.count + 1 };
  return { next, keepPolling: next.count < limit };
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
      return { title: "Martelo batido", sub: "Apurando o resultado…" };
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
