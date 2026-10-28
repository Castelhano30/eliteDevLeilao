import { FaixaBase } from "./faixa-status";

export interface PlacarPosicaoProps {
  /** Verde: ganhando. Ferrugem: superado. Neutro: sem posição (apurando). */
  tone: "verde" | "ferrugem" | "neutro";
  title: string;
  /** Contador/subtítulo ("1º de 3"). Sem ele o placar mostra só o título. */
  sub?: string | null;
  compacto?: boolean;
}

/** Faixa de posição do licitante que já deu lance (§10). Vive dentro de uma região `aria-live`. */
export function PlacarPosicao({ tone, title, sub, compacto }: PlacarPosicaoProps) {
  return <FaixaBase tone={tone === "neutro" ? "neutra" : tone} title={title} sub={sub} compacto={compacto} />;
}
