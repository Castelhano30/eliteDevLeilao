export interface Pagina<T> {
  items: T[];
  /** Página mostrada, a partir de 0 (já limitada ao que existe). */
  atual: number;
  paginas: number;
}

/** Fatia `items` em páginas de `porPagina`. A página pedida é limitada ao que existe (a lista pode ter encolhido). */
export function paginar<T>(items: readonly T[], pagina: number, porPagina: number): Pagina<T> {
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  const atual = Math.min(Math.max(0, pagina), paginas - 1);
  return { items: items.slice(atual * porPagina, (atual + 1) * porPagina), atual, paginas };
}
