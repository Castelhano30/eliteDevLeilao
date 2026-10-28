export interface ChipLicitanteProps {
  /** "Licitante 7F3A": o pseudônimo é por lote, nunca nome nem e-mail. */
  name: string;
  /** O lance é meu: a marca VOCÊ vai junto do chip, nunca só em cor. */
  mine?: boolean;
}

/** Pseudônimo do licitante no histórico (§10): pílula de fio; o meu vai em `selecionado` com `ocreTexto` e peso 700, mais a palavra VOCÊ. */
export function ChipLicitante({ name, mine = false }: ChipLicitanteProps) {
  return (
    <span
      // Sem `.t-mono`: a classe `.t-*` fica fora de layer e venceria o `font-bold` do meu chip.
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-[3px] text-[14px] leading-[1.3] ${
        mine ? "border-ocreTexto bg-selecionado font-bold text-ocreTexto" : "border-linha font-medium text-tinta"
      }`}
    >
      <span>{name}</span>
      {mine ? <span className="font-bold uppercase tracking-[0.04em]">VOCÊ</span> : null}
    </span>
  );
}
