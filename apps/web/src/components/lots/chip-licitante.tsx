export interface ChipLicitanteProps {
  /** "Licitante 7F3A": o pseudônimo é por lote, nunca nome nem e-mail. */
  name: string;
  /** O lance é meu: a marca VOCÊ vai junto do chip, nunca só em cor. */
  mine?: boolean;
}

/** Pseudônimo do licitante no histórico (§10). */
export function ChipLicitante({ name, mine = false }: ChipLicitanteProps) {
  return (
    <span className="t-mono inline-flex items-stretch rounded-nenhum border-2 border-tinta text-[14px] text-tinta">
      <span className="px-2 py-[3px]">{name}</span>
      {mine ? <span className="bg-ocre px-2 py-[3px] font-semibold text-sobreOcre">VOCÊ</span> : null}
    </span>
  );
}
