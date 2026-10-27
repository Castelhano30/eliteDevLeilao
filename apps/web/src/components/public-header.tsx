import { Logo } from "@/components/ui/logo";

export interface PublicHeaderProps {
  /** Legenda da página, ex.: "PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN". */
  legend: string;
}

/** Cabeçalho mínimo das páginas públicas (Comprovante e Auditoria): igual para quem está logado ou não. */
export function PublicHeader({ legend }: PublicHeaderProps) {
  return (
    <header className="cabecalho">
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-3 py-[14px]"
        style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}
      >
        <Logo />
        <p className="t-mono-rotulo text-tinta2">{legend}</p>
      </div>
    </header>
  );
}
