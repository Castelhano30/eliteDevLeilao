// Classes literais, para o Tailwind gerá-las. O casco do cartão de lote e o do esqueleto de carregamento são o mesmo: só aqui o raio, o fio e a
// sombra mudam, e o esqueleto nunca destoa do cartão que ele anuncia.

/** Casco: 16px de raio, fio `borda`, nível 1, recortado, em coluna e com a altura da célula da grade. */
export const LOT_CARD_SHELL = "relative flex h-full flex-col overflow-hidden rounded-2xl border border-borda bg-papel text-tinta no-underline shadow-cartao";

/** Colunas da grade de cartões da Vitrine. O esqueleto usa a mesma, para as células terem a largura dos cartões reais. */
export const LOT_GRID_COLUMNS = "repeat(auto-fill, minmax(min(100%, 330px), 1fr))";
