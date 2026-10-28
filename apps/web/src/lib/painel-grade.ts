/** Quantas colunas cabem numa grade `repeat(auto-fill, minmax(minPx, 1fr))` de `largura` px com vão de `vaoPx`. */
export function colunasDaGrade(largura: number, minPx: number, vaoPx: number): number {
  if (!Number.isFinite(largura) || largura <= 0) return 1;
  return Math.max(1, Math.floor((largura + vaoPx) / (minPx + vaoPx)));
}

/** Encerrados à mostra: `linhas` linhas inteiras da grade, nunca mais que o total. */
export function encerradosVisiveis(total: number, colunas: number, linhas: number): number {
  return Math.min(total, Math.max(1, colunas) * Math.max(1, linhas));
}
