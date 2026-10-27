export interface PlacarPosicaoProps {
  /** Verde: ganhando. Ferrugem: superado. Neutro: sem posição (apurando). */
  tone: "verde" | "ferrugem" | "neutro";
  title: string;
  /** Contador/subtítulo ("1º de 3"). Sem ele o placar mostra só o título. */
  sub?: string | null;
}

const TONE = { verde: "bg-verde text-sobreCor", ferrugem: "bg-ferrugem text-sobreCor", neutro: "bg-tinta text-fundo" } as const;

/** Faixa de posição do licitante que já deu lance (§10). Vive dentro de uma região `aria-live`. */
export function PlacarPosicao({ tone, title, sub }: PlacarPosicaoProps) {
  return (
    <div className={`rounded-nenhum border-[3px] border-tinta px-4 pb-[10px] pt-3 ${TONE[tone]}`}>
      <p className="t-placar">{title}</p>
      {sub ? <p className="mt-1 text-[13px]">{sub}</p> : null}
    </div>
  );
}
