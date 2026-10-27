import { MY_BIDS_TEXT, type BidderLotState, type MyBidItem } from "@lanceauto/shared";
import type { FilterTab } from "@/components/ui/filter-tabs";

export type MyBidsTab = "ALL" | "ACTIVE" | "WON" | "LOST";

const TAB_STATES: Record<Exclude<MyBidsTab, "ALL">, readonly BidderLotState[]> = {
  ACTIVE: ["LEADING", "OUTBID"],
  WON: ["WON"],
  LOST: ["LOST"],
};

const TAB_LABEL: Record<MyBidsTab, string> = { ALL: "Todos", ACTIVE: "Em disputa", WON: "Arrematados", LOST: "Perdidos" };
const TAB_ORDER: readonly MyBidsTab[] = ["ALL", "ACTIVE", "WON", "LOST"];

/**
 * Ingressos da aba (R-7.4). "Todos" é tudo, `CANCELLED` incluído, que não pertence a nenhuma outra aba. Mantém a
 * ordem do servidor (R-7.9): o cliente não reordena.
 */
export function filterByTab(items: readonly MyBidItem[], tab: MyBidsTab): MyBidItem[] {
  if (tab === "ALL") return [...items];
  const states = TAB_STATES[tab];
  return items.filter((entry) => states.includes(entry.state));
}

export type TabCounts = Record<MyBidsTab, number>;

/** Contadores sobre a lista já recebida; nada deles vem do relógio. */
export function tabCounts(items: readonly MyBidItem[]): TabCounts {
  return {
    ALL: items.length,
    ACTIVE: filterByTab(items, "ACTIVE").length,
    WON: filterByTab(items, "WON").length,
    LOST: filterByTab(items, "LOST").length,
  };
}

export function tabsFor(items: readonly MyBidItem[]): FilterTab<MyBidsTab>[] {
  const counts = tabCounts(items);
  return TAB_ORDER.map((value) => ({ value, label: TAB_LABEL[value], count: counts[value] }));
}

/** `total`: a conta não tem lances (frase da §8 e link para a vitrine); `tab`: há lances, mas não nesta aba. */
export function emptyKind(items: readonly MyBidItem[], tab: MyBidsTab): "total" | "tab" | null {
  if (items.length === 0) return "total";
  return filterByTab(items, tab).length === 0 ? "tab" : null;
}

export const EMPTY_TEXT = { total: MY_BIDS_TEXT.empty, tab: MY_BIDS_TEXT.emptyTab } as const;
