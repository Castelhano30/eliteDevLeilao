import { normalizeSearch, type ShowcaseGroup } from "@lanceauto/shared";

export type VitrineTab = "ALL" | ShowcaseGroup;

export interface VitrineFilters {
  q: string;
  brand: string;
  status: VitrineTab;
}

export const DEFAULT_FILTERS: VitrineFilters = { q: "", brand: "", status: "ALL" };

/** Chave do TanStack: a mesma no SSR (hidratação) e no cliente. */
export const lotsKey = (filters: VitrineFilters) => ["lots", filters] as const;

export function lotsPath({ q, brand, status }: VitrineFilters): string {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  if (brand) params.set("brand", brand);
  const query = params.toString();
  return query ? `/lots?${query}` : "/lots";
}

/** Chave das marcas do seletor (FIPE mais as dos lotes). */
export const BRANDS_KEY = ["brands"] as const;

/**
 * Opções do seletor de Marca: a lista da FIPE, as marcas dos lotes (que cobrem a FIPE fora do ar e a lista ainda carregando) e a marca
 * escolhida, para o seletor nunca mostrar um valor que não está nas opções. Sem repetir por maiúsculas ou acento (vale a primeira grafia).
 */
export function brandOptions(fipe: string[] | undefined, published: string[] | undefined, selected: string): string[] {
  const byKey = new Map<string, string>();
  for (const name of [...(fipe ?? []), ...(published ?? []), selected]) {
    if (name.trim() !== "" && !byKey.has(normalizeSearch(name))) byKey.set(normalizeSearch(name), name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
