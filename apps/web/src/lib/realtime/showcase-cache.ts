import {
  showcaseGroup,
  type LotCard,
  type LotListResponse,
  type LotStatus,
  type MyLotsResponse,
  type ShowcaseGroup,
} from "@lanceauto/shared";
import type { VitrineFilters } from "../vitrine-query";

const GROUP_ORDER: Record<ShowcaseGroup, number> = { LIVE: 0, SCHEDULED: 1, ENDED: 2 };

const ms = (iso: string) => Date.parse(iso);

/**
 * Ordem da Vitrine (R-2.13): ao vivo por fim crescente, agendados por início crescente, encerrados por fim
 * decrescente; o número do lote desempata. Cancelado não tem grupo e nunca chega aqui. Devolve lista nova.
 */
export function sortShowcase(lots: readonly LotCard[]): LotCard[] {
  const groupOf = (card: LotCard): ShowcaseGroup => group(card) ?? "ENDED";
  const key = (card: LotCard) => {
    const g = groupOf(card);
    if (g === "SCHEDULED") return ms(card.startsAt);
    if (g === "ENDED") return -ms(card.endsAt);
    return ms(card.endsAt);
  };
  return [...lots].sort((a, b) => {
    const byNumber = groupOf(a) === "ENDED" ? b.number - a.number : a.number - b.number;
    return GROUP_ORDER[groupOf(a)] - GROUP_ORDER[groupOf(b)] || key(a) - key(b) || byNumber;
  });
}

function group(card: LotCard): ShowcaseGroup | null {
  return showcaseGroup(card.status);
}

const COUNT_KEY = { LIVE: "live", SCHEDULED: "scheduled", ENDED: "ended" } as const;

function moveCount(counts: LotListResponse["counts"], from: ShowcaseGroup | null, to: ShowcaseGroup | null): LotListResponse["counts"] {
  if (from === to) return counts;
  const next = { ...counts };
  if (from) next[COUNT_KEY[from]] = Math.max(0, next[COUNT_KEY[from]] - 1);
  if (to) next[COUNT_KEY[to]] += 1;
  return next;
}

/** A consulta tem busca, marca ou aba? Aí o cliente não sabe dizer se um lote novo entra na lista. */
export function isFiltered(filters: VitrineFilters): boolean {
  return filters.q.trim() !== "" || filters.brand !== "" || filters.status !== "ALL";
}

export interface ShowcaseUpsert {
  data: LotListResponse;
  /** O cliente não consegue decidir sozinho (filtro ativo): refazer a consulta no servidor. */
  invalidate: boolean;
}

/**
 * `showcase:lot` aplicado a uma lista da Vitrine (R-4.13): descarta o evento se `card.version < version` do cartão
 * que a lista já tem (dois lances quase simultâneos podem sair fora de ordem); versão igual aplica, e é assim que
 * o fechamento, que não incrementa `entryCount`, chega. Cancelado sai da lista. Id desconhecido entra direto
 * numa lista sem filtro; com filtro, só o servidor sabe se casa, então pede nova consulta.
 */
export function upsertShowcaseCard(data: LotListResponse, card: LotCard, filtered: boolean): ShowcaseUpsert {
  const current = data.lots.find((lot) => lot.id === card.id);
  if (!current) {
    if (card.status === "CANCELLED") return { data, invalidate: false };
    if (filtered) return { data, invalidate: true };
    return {
      data: { ...data, lots: sortShowcase([...data.lots, card]), counts: moveCount(data.counts, null, group(card)) },
      invalidate: false,
    };
  }
  if (card.version < current.version) return { data, invalidate: false };
  const from = group(current);
  if (card.status === "CANCELLED") {
    return {
      data: { ...data, lots: data.lots.filter((lot) => lot.id !== card.id), counts: moveCount(data.counts, from, null) },
      invalidate: false,
    };
  }
  const to = group(card);
  return {
    data: {
      ...data,
      lots: sortShowcase(data.lots.map((lot) => (lot.id === card.id ? card : lot))),
      counts: moveCount(data.counts, from, to),
    },
    // Com aba ou filtro, o lote que mudou de grupo pode ter deixado de casar com a consulta.
    invalidate: filtered && from !== to,
  };
}

/**
 * Status do cartão pelo relógio do servidor, sem esperar evento: o agendado vira ao vivo em `startsAt` e o ao vivo
 * passa a "apurando" em `endsAt`. Encerrado só quando o servidor confirmar (S05): sem `settledAt` no cartão, o
 * cliente nunca decide SOLD/UNSOLD. Relógio ainda não acertado (`now <= 0`) não muda nada.
 */
export function cardStatusAt(card: LotCard, now: number): LotStatus {
  if (now <= 0) return card.status;
  if (card.status === "SCHEDULED" && now >= ms(card.startsAt)) return now < ms(card.endsAt) ? "LIVE" : "CLOSING";
  if (card.status === "LIVE" && now >= ms(card.endsAt)) return "CLOSING";
  return card.status;
}

/** Há cartão apurando (ou ao vivo com o relógio em 00:00)? Então a lista é refeita a cada 3 s até o servidor decidir. */
export function needsClosingPoll(lots: readonly LotCard[] | undefined, now: number): boolean {
  return (lots ?? []).some((card) => cardStatusAt(card, now) === "CLOSING");
}

export interface MyLotUpsert {
  data: MyLotsResponse;
  /** O lote próprio chegou a um estado final: refazer `GET /my/lots` (resultado e total recebido). */
  refetch: boolean;
}

/**
 * `showcase:lot` aplicado ao Painel (§9.3). Id desconhecido é ignorado (pode ser de outro leiloeiro; o lote que o
 * próprio leiloeiro cria entra pela invalidação da criação). A ordem da lista não muda: o Painel separa por status.
 */
export function upsertMyLot(data: MyLotsResponse, card: LotCard): MyLotUpsert {
  const current = data.lots.find((lot) => lot.id === card.id);
  if (!current || card.version < current.version) return { data, refetch: false };
  const final = card.status === "SOLD" || card.status === "UNSOLD" || card.status === "CANCELLED";
  return {
    data: { ...data, lots: data.lots.map((lot) => (lot.id === card.id ? card : lot)) },
    refetch: final && card.status !== current.status,
  };
}
