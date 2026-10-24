/** Minúsculas, sem acento e com espaços colapsados: base da busca da Vitrine (R-2.13). */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto que a busca procura: título, marca, modelo e ano, normalizados. */
export function buildSearchText(title: string, brand: string, model: string, year: number | string): string {
  return normalizeSearch(`${title} ${brand} ${model} ${year}`);
}

export const SEARCH_MAX_LENGTH = 100;

/**
 * Termos da busca: corta em 100 caracteres, normaliza e escapa os curingas do LIKE (`%`, `_`, `\`), para o termo
 * ser procurado literalmente: o `contains` do Prisma não escapa, e `q=%` casaria todos os lotes.
 * Todos os termos precisam aparecer.
 */
export function searchTerms(q: string | undefined): string[] {
  if (!q) return [];
  return normalizeSearch(q.slice(0, SEARCH_MAX_LENGTH))
    .split(" ")
    .filter((term) => term.length > 0)
    .map((term) => term.replace(/[\\%_]/g, (char) => `\\${char}`));
}
