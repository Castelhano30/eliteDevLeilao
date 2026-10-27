import {
  formatLotNumber,
  transitionAnnouncement,
  type LotCard,
  type LotStatus,
  type MyBidItem,
  type MyBidsResponse,
} from "@lanceauto/shared";
import type { MyBidsTab } from "./my-bids-tabs";

/** Rajada de eventos vira uma só consulta (S07 §7). */
export const MY_BIDS_DEBOUNCE_MS = 300;

/** O que a tela já viu de cada lote da lista: versão (`entryCount`, T4) e status do cartão. */
export interface SeenLot {
  version: number;
  status: LotStatus;
}
export type SeenMap = ReadonlyMap<string, SeenLot>;

export function seenFromItems(items: readonly MyBidItem[] | undefined): SeenMap {
  return new Map((items ?? []).map((entry) => [entry.lot.id, { version: entry.lot.version, status: entry.lot.status }]));
}

/**
 * Nova resposta do `GET` sobre o que já foi visto. A resposta vale (inclusive em empate de versão: se o evento
 * chegou antes de a liquidação ser visível na leitura, o próximo evento ainda refaz, §13), exceto quando um evento
 * já trouxe versão estritamente maior. Lote que saiu da resposta sai do mapa.
 */
export function mergeSeen(previous: SeenMap, items: readonly MyBidItem[]): SeenMap {
  const merged = new Map<string, SeenLot>();
  for (const entry of items) {
    const before = previous.get(entry.lot.id);
    merged.set(
      entry.lot.id,
      before && before.version > entry.lot.version ? before : { version: entry.lot.version, status: entry.lot.status },
    );
  }
  return merged;
}

export interface EventDecision {
  action: "ignore" | "refetch";
  seen: SeenMap;
}

/**
 * `showcase:lot` na tela (S07 §7, decisão do build 8). Lote fora da lista: ignorado (lance novo do próprio usuário
 * chega por `wallet:updated`). Versão menor que a já vista: descartada (dois lances quase simultâneos saem fora de
 * ordem). Versão igual só refaz se o status mudou, porque o fechamento não sobe a versão (C10). Nada daqui vira
 * estado na tela: o evento só diz "refaça o GET" (INV-1).
 */
export function decideEvent(seen: SeenMap, card: LotCard): EventDecision {
  const current = seen.get(card.id);
  if (!current) return { action: "ignore", seen };
  if (card.version < current.version) return { action: "ignore", seen };
  if (card.version === current.version && card.status === current.status) return { action: "ignore", seen };
  const next = new Map(seen);
  next.set(card.id, { version: card.version, status: card.status });
  return { action: "refetch", seen: next };
}

export interface Debounced {
  call: () => void;
  cancel: () => void;
}

export function createDebounced(fn: () => void, ms: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    call() {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}

/**
 * Anúncios da região viva: só quando o estado de um lote muda entre duas respostas do servidor. Sem resposta
 * anterior (carga inicial) não anuncia nada, e lote que acabou de aparecer na lista também não.
 */
export function transitionAnnouncements(previous: readonly MyBidItem[] | undefined, next: readonly MyBidItem[]): string[] {
  if (!previous) return [];
  const before = new Map(previous.map((entry) => [entry.lot.id, entry.state]));
  const messages: string[] = [];
  for (const entry of next) {
    const was = before.get(entry.lot.id);
    if (was === undefined) continue;
    const message = transitionAnnouncement(was, entry.state, entry.lot.number);
    if (message) messages.push(message);
  }
  return messages;
}

/** O que a região viva mostra e a última lista vista; `seq` troca a cada anúncio novo (o nó da região é refeito). */
export interface AnnouncementState {
  items: readonly MyBidItem[] | undefined;
  seq: number;
  text: string;
}

export const INITIAL_ANNOUNCEMENT: AnnouncementState = { items: undefined, seq: 0, text: "" };

/** Passo a cada resposta nova do `GET`: guarda a lista e, se algum lote mudou de estado desde a anterior, anuncia. */
export function advanceAnnouncement(state: AnnouncementState, response: MyBidsResponse): AnnouncementState {
  const messages = transitionAnnouncements(state.items, response.items);
  if (messages.length === 0) return { ...state, items: response.items };
  return { items: response.items, seq: state.seq + 1, text: messages.join(" ") };
}

/** `id` do `<li>` de um ingresso, e o destino do link da Carteira. */
export function anchorId(lotNumber: number): string {
  return `lote-${formatLotNumber(lotNumber)}`;
}

/**
 * `#lote-018` aponta para um ingresso da lista? Então a aba volta a "Todos" (o ingresso pode estar numa aba
 * filtrada) e a tela rola e foca o `<li>`. Hash que não bate com nenhum lote: nada a fazer.
 */
export function resolveAnchor(hash: string, items: readonly MyBidItem[]): { elementId: string; tab: MyBidsTab } | null {
  const match = /^#lote-(\d{1,9})$/.exec(hash);
  if (!match) return null;
  const number = Number(match[1]);
  return items.some((entry) => entry.lot.number === number) ? { elementId: anchorId(number), tab: "ALL" } : null;
}
