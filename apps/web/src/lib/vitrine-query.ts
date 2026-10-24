import type { ShowcaseGroup } from "@lanceauto/shared";

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
