export interface IdentityChipProps {
  role: "licitante" | "leiloeiro";
}

const ROLE_LABEL = { licitante: "Licitante", leiloeiro: "Leiloeiro" } as const;

/** "VOCÊ · Licitante": papel do usuário logado. Nunca mostra pseudônimo (ele é por lote). */
export function IdentityChip({ role }: IdentityChipProps) {
  return (
    <span className="t-mono inline-flex items-center gap-2 rounded-full border border-linha bg-papel px-3 py-2 text-tinta">
      <span className="rounded-full bg-selecionado px-2 font-bold text-ocreTexto">VOCÊ</span>
      <span aria-hidden="true">·</span>
      {ROLE_LABEL[role]}
    </span>
  );
}
