import type { SelectHTMLAttributes } from "react";
import { CONTROL_BOX } from "./control";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  /** Classes do invólucro (largura e `flex` na barra de filtros). */
  className?: string;
}

/** Seletor da Vitrine: `select` nativo sem a seta do navegador, com chevron próprio. O menu aberto é o do navegador (acompanha `color-scheme`). */
export function SelectField({ id, label, className = "", children, ...rest }: SelectFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="t-rotulo-campo mb-[6px] block">
        {label}
      </label>
      <div className="relative">
        <select id={id} className={`${CONTROL_BOX} appearance-none !pr-10`} {...rest}>
          {children}
        </select>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-tinta2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
