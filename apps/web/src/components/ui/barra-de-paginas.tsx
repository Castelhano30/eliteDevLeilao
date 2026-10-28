import { buttonClasses } from "@/components/ui/button";

export interface BarraDePaginasProps {
  /** Nome da navegação ("Páginas do extrato"). */
  label: string;
  /** Página mostrada, a partir de 0. */
  atual: number;
  paginas: number;
  onChange: (pagina: number) => void;
  className?: string;
}

/** "Anterior · Página X de Y · Próxima": o botão da ponta fica inerte. Com uma página só, não aparece. */
export function BarraDePaginas({ label, atual, paginas, onChange, className = "" }: BarraDePaginasProps) {
  if (paginas <= 1) return null;
  return (
    <nav aria-label={label} className={`flex items-center justify-between gap-3 ${className}`.trim()}>
      <button type="button" className={buttonClasses("secundario", false, "compacto")} disabled={atual === 0} onClick={() => onChange(atual - 1)}>
        Anterior
      </button>
      <span className="t-mono-dado">
        Página {atual + 1} de {paginas}
      </span>
      <button type="button" className={buttonClasses("secundario", false, "compacto")} disabled={atual === paginas - 1} onClick={() => onChange(atual + 1)}>
        Próxima
      </button>
    </nav>
  );
}
