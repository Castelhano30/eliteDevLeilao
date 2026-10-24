export interface FaixaStatusProps {
  title: string;
  sub?: string;
}

/** Faixa de situação neutra, sem ação (assistindo, ainda não deu lance, leiloeiro, apurando). Dentro de uma região `aria-live`. */
export function FaixaStatus({ title, sub }: FaixaStatusProps) {
  return (
    <div className="rounded-nenhum border-[3px] border-tinta bg-tinta px-4 pb-3 pt-3 text-fundo">
      <p className="font-display font-black uppercase leading-none" style={{ fontSize: "clamp(30px, 5vw, 42px)" }}>
        {title}
      </p>
      {sub ? <p className="font-mono mt-2 text-[13px]">{sub}</p> : null}
    </div>
  );
}
