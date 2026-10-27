import type { InputHTMLAttributes } from "react";
import { CONTROL_BOX } from "./control";

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  id: string;
  label: string;
  /** Classes do invólucro (largura e `flex` na barra de filtros). */
  className?: string;
}

/** Busca da Vitrine: o `type="search"` nativo (com o "x" do navegador) e uma lupa decorativa à esquerda, que fica azul com o foco. */
export function SearchField({ id, label, className = "", ...rest }: SearchFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="t-rotulo-campo mb-[6px] block">
        {label}
      </label>
      <div className="group relative">
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-tinta2 transition-colors duration-150 group-focus-within:text-ocreTexto"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input id={id} type="search" className={`${CONTROL_BOX} !pl-[42px]`} {...rest} />
      </div>
    </div>
  );
}
