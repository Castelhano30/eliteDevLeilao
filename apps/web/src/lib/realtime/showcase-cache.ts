import {
  showcaseGroup,
  type LotCard,
  type LotListResponse,
  type LotStatus,
  type MyLotsResponse,
  type ShowcaseGroup,
} from "@lanceauto/shared";
import { INITIAL_OPENING_CHECKS, nextOpeningCheck, type OpeningChecks } from "../lot-state";
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

function olderThanFinal(current: LotCard, incoming: LotCard): boolean {
  return (current.status === "SOLD" || current.status === "UNSOLD" || current.status === "CANCELLED") &&
    incoming.version === current.version &&
    (incoming.status === "LIVE" || incoming.status === "CLOSING" || incoming.status === "SCHEDULED");
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
 * que a lista já tem (dois lances quase simultâneos podem sair fora de ordem); versão igual aplica o fechamento,
 * mas nunca reabre um estado final. Cancelado sai da lista. Id desconhecido entra direto
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
  if (card.version < current.version || olderThanFinal(current, card)) return { data, invalidate: false };
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

/** Vitrine com cartão apurando: confere de 3 em 3 s, no máximo `SHOWCASE_CLOSING_CHECKS` respostas novas. */
export const SHOWCASE_CLOSING_POLL_MS = 3_000;
export const SHOWCASE_CLOSING_CHECKS = 20;
/** API caída: tenta de novo sozinha a cada 10 s (AC-2.35). */
export const SHOWCASE_ERROR_POLL_MS = 10_000;

export function checksForFilter(
  state: { key: string; checks: OpeningChecks },
  key: string,
): { key: string; checks: OpeningChecks } {
  return state.key === key ? state : { key, checks: INITIAL_OPENING_CHECKS };
}

/**
 * `refetchInterval` da Vitrine (puro). O polling de 3 s só existe enquanto há cartão apurando e tem teto: conta só
 * respostas novas (como a conferência de abertura da Sala) e zera quando não há cartão apurando, que é o que o
 * `showcase:lot` do fechamento provoca. Passado o teto, o evento e o `connect` continuam atualizando a lista.
 */
export function showcaseRefetchInterval({
  failed,
  lots,
  now,
  checks,
  dataUpdatedAt,
}: {
  failed: boolean;
  lots: readonly LotCard[] | undefined;
  now: number;
  checks: OpeningChecks;
  dataUpdatedAt: number;
}): { interval: number | false; checks: OpeningChecks } {
  if (failed) return { interval: SHOWCASE_ERROR_POLL_MS, checks };
  if (!needsClosingPoll(lots, now)) return { interval: false, checks: INITIAL_OPENING_CHECKS };
  const step = nextOpeningCheck(checks, dataUpdatedAt, SHOWCASE_CLOSING_CHECKS);
  return { interval: step.keepPolling ? SHOWCASE_CLOSING_POLL_MS : false, checks: step.next };
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
  if (!current || card.version < current.version || olderThanFinal(current, card)) return { data, refetch: false };
  const final = card.status === "SOLD" || card.status === "UNSOLD" || card.status === "CANCELLED";
  return {
    // O cartão do evento não traz o resultado: a linha guarda o que já tinha e o `GET` seguinte o traz (R-5.8).
    data: { ...data, lots: data.lots.map((lot) => (lot.id === card.id ? { ...card, resultado: lot.resultado } : lot)) },
    refetch: final && card.status !== current.status,
  };
}
