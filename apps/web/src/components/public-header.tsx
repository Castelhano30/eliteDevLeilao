import { Logo } from "@/components/ui/logo";

export interface PublicHeaderProps {
  /** Legenda da página, ex.: "PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN". */
  legend: string;
}

/** Cabeçalho mínimo das páginas públicas (Comprovante e Auditoria): igual para quem está logado ou não. */
export function PublicHeader({ legend }: PublicHeaderProps) {
  return (
    <header className="border-b-4 border-linha bg-papel">
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-4 py-4"
        style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}
      >
        <Logo />
        <p className="t-mono-rotulo">{legend}</p>
      </div>
    </header>
  );
}
