import type { ReactNode } from "react";

export interface PageShellProps {
  title?: string;
  /** "comprovante" estreita o contêiner para 1200px. */
  width?: "padrao" | "comprovante";
  children: ReactNode;
}

/** Contêiner de página: largura máxima, margem lateral fluida e título de tela opcional. */
export function PageShell({ title, width = "padrao", children }: PageShellProps) {
  const max = width === "comprovante" ? "1200px" : "1320px";
  return (
    <div className="mx-auto py-12" style={{ width: `min(100% - 2 * var(--gutter-lateral), ${max})` }}>
      {title ? <h1 className="t-display-titulo mb-8">{title}</h1> : null}
      {children}
    </div>
  );
}
