import type { ReactNode } from "react";

export interface CanhotoProps {
  number: number;
  title: string;
  children: ReactNode;
}

/**
 * Cartão-canhoto do "Como funciona" (§10.6), versão simples: numeral grande em ocre com contorno, título e texto,
 * rodapé tracejado "CANHOTO / Nº 0X". O picote fica para a S09 (T12).
 */
export function Canhoto({ number, title, children }: CanhotoProps) {
  const label = String(number).padStart(2, "0");
  return (
    <article className="flex flex-col rounded-nenhum border-2 border-linha bg-papel p-4 shadow-cartao">
      <span
        aria-hidden="true"
        className="font-extrabold leading-none"
        style={{ fontSize: 56, color: "var(--c-ocre)", WebkitTextStroke: "2px var(--c-linha)" }}
      >
        {label}
      </span>
      <h3 className="t-cartaz-subtitulo mt-3">
        <span className="sr-only">{label} · </span>
        {title}
      </h3>
      <p className="t-body mt-3 flex-1">{children}</p>
      <p className="t-mono-rotulo-pequeno mt-6 border-t-2 border-dashed border-tracejado pt-3 text-tinta2">CANHOTO / Nº {label}</p>
    </article>
  );
}
