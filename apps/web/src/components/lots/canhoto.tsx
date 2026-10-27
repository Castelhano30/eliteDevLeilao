import type { ReactNode } from "react";

export interface CanhotoProps {
  number: number;
  title: string;
  children: ReactNode;
}

/** Cartão compacto do "Como funciona" (§10.6): numeral, título e texto numa linha curta. O picote fica para a S09 (T12). */
export function Canhoto({ number, title, children }: CanhotoProps) {
  const label = String(number).padStart(2, "0");
  return (
    <article className="flex items-start gap-3 rounded-xl border border-borda bg-papel p-3 shadow-cartao">
      <span aria-hidden="true" className="text-[24px] font-extrabold leading-none tabular-nums text-ocreTexto">
        {label}
      </span>
      <div className="min-w-0">
        <h3 className="text-[14px] font-bold leading-tight">
          <span className="sr-only">{label} · </span>
          {title}
        </h3>
        <p className="mt-1 text-[14px] leading-snug text-tinta2">{children}</p>
      </div>
    </article>
  );
}
