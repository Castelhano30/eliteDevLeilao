export interface PlacarPosicaoProps {
  /** Verde: ganhando. Ferrugem: superado. */
  tone: "verde" | "ferrugem";
  title: string;
  /** Contador/subtítulo ("1º de 3"). */
  sub: string;
}

/** Faixa de posição do licitante que já deu lance (§10). Vive dentro de uma região `aria-live`. */
export function PlacarPosicao({ tone, title, sub }: PlacarPosicaoProps) {
  return (
    <div className={`rounded-nenhum border-[3px] border-tinta px-4 pb-[10px] pt-3 text-sobreCor ${tone === "verde" ? "bg-verde" : "bg-ferrugem"}`}>
      <p className="t-placar">{title}</p>
      <p className="font-mono mt-1 text-[13px]">{sub}</p>
    </div>
  );
}
