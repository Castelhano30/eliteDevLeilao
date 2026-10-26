export interface FaixaStatusProps {
  title: string;
  sub?: string;
  /** Neutra (tinta) por padrão; verde para "Você arrematou". */
  tone?: "neutra" | "verde";
}

/** Faixa de situação sem ação (assistindo, ainda não deu lance, leiloeiro, apurando, resultado). Dentro de uma região `aria-live`. */
export function FaixaStatus({ title, sub, tone = "neutra" }: FaixaStatusProps) {
  const colors = tone === "verde" ? "bg-verde text-sobreCor" : "bg-tinta text-fundo";
  return (
    <div className={`rounded-nenhum border-[3px] border-tinta px-4 pb-3 pt-3 ${colors}`}>
      <p className="font-display font-black uppercase leading-none" style={{ fontSize: "clamp(30px, 5vw, 42px)" }}>
        {title}
      </p>
      {sub ? <p className="font-mono mt-2 text-[13px]">{sub}</p> : null}
    </div>
  );
}
