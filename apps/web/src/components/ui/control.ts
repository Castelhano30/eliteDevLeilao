/**
 * Caixa dos controles da barra de filtros (busca e Marca): 44px, 12px de raio, fio `linha` sobre `papel` nos dois temas.
 * O anel de foco é o global (`:focus-visible`); aqui só a borda troca para `foco`. Classes literais, para o Tailwind gerá-las.
 */
export const CONTROL_BOX =
  "h-11 w-full rounded-xl border border-linha bg-papel px-3 text-[16px] text-tinta transition-[border-color] duration-150 ease-out placeholder:text-tinta2 hover:border-tinta2 focus-visible:border-foco disabled:cursor-not-allowed disabled:border-borda disabled:bg-suave disabled:text-tinta2 disabled:hover:border-borda";
