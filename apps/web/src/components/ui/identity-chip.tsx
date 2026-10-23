export interface IdentityChipProps {
  role: "licitante" | "leiloeiro";
}

const ROLE_LABEL = { licitante: "Licitante", leiloeiro: "Leiloeiro" } as const;

/** "VOCÊ · Licitante": papel do usuário logado. Nunca mostra pseudônimo (ele é por lote). */
export function IdentityChip({ role }: IdentityChipProps) {
  return (
    <span className="t-mono inline-flex items-center gap-2 rounded-nenhum border-2 border-linha bg-papel px-3 py-2 text-tinta">
      <span className="bg-ocre px-1 font-semibold text-sobreOcre">VOCÊ</span>
      <span aria-hidden="true">·</span>
      {ROLE_LABEL[role]}
    </span>
  );
}
