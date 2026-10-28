export type FaixaTone = "neutra" | "verde" | "ferrugem";

export interface FaixaStatusProps {
  title: string;
  sub?: string;
  /** Neutra (`suave` com fio) por padrão; verde para "Você arrematou". */
  tone?: "neutra" | "verde";
}

// Classes literais, para o Tailwind gerá-las. Verde e ferrugem são cheios (`sobreCor` sobre a cor forte); a neutra é `suave` com fio `borda`.
const TONE: Record<FaixaTone, string> = {
  neutra: "border-borda bg-suave text-tinta",
  verde: "border-verde bg-verde text-sobreCor",
  ferrugem: "border-ferrugem bg-ferrugem text-sobreCor",
};

/** Ícone de 24px que reforça o tom sem depender da cor: check no verde, seta para baixo no ferrugem. Decorativo (o título é o status). */
function Glyph({ tone }: { tone: FaixaTone }) {
  if (tone === "neutra") return null;
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
      {tone === "verde" ? <path d="m5 12.5 4.5 4.5L19 7" /> : <path d="M12 5v14m0 0-6-6m6 6 6-6" />}
    </svg>
  );
}

export interface FaixaBaseProps {
  tone: FaixaTone;
  title: string;
  sub?: string | null;
  /** Versão baixa para listas (Meus arremates): menos respiro e título de 18px. */
  compacto?: boolean;
}

/**
 * Faixa de situação da Sala (DESIGN 4.11): `rounded-xl`, padding 14px 16px, ícone, título de 18 a 22px/800 e o contador ou a frase de apoio.
 * Os textos são os de sempre; só o desenho muda. Vive dentro de uma região `aria-live` do painel.
 */
export function FaixaBase({ tone, title, sub, compacto = false }: FaixaBaseProps) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${compacto ? "px-4 py-3" : "px-4 py-[14px]"} ${TONE[tone]}`}>
      <Glyph tone={tone} />
      <div className="min-w-0">
        <p className="font-extrabold uppercase leading-tight [overflow-wrap:anywhere]" style={{ fontSize: compacto ? 18 : "clamp(18px, 3.2vw, 22px)" }}>
          {title}
        </p>
        {sub ? <p className="mt-1 text-[13px]">{sub}</p> : null}
      </div>
    </div>
  );
}

/** Faixa de situação sem ação (assistindo, ainda não deu lance, leiloeiro, apurando, resultado). Dentro de uma região `aria-live`. */
export function FaixaStatus({ title, sub, tone = "neutra" }: FaixaStatusProps) {
  return <FaixaBase tone={tone} title={title} sub={sub} />;
}
