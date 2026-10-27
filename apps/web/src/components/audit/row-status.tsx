import type { AuditRowStatus } from "@lanceauto/shared";
import { rowStatusView, type RowIcon } from "@/lib/audit-view";

function Icon({ icon }: { icon: RowIcon }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "square" as const, "aria-hidden": true };
  if (icon === "check") {
    return (
      <svg {...common}>
        <path d="M2.5 8.5 6.2 12 13.5 4" />
      </svg>
    );
  }
  if (icon === "x") {
    return (
      <svg {...common}>
        <path d="M3 3 13 13M13 3 3 13" />
      </svg>
    );
  }
  // Corrente partida: dois elos e um vão entre eles.
  return (
    <svg {...common}>
      <path d="M1.5 8H5M11 8h3.5M5 5.5v5M11 5.5v5" />
    </svg>
  );
}

const TEXT = { verde: "text-verde", ferrugem: "text-ferrugem", tinta: "text-tinta" } as const;

/** Situação da linha: texto + ícone, nunca só cor (S08 §9). */
export function RowStatusBadge({ status }: { status: AuditRowStatus }) {
  const view = rowStatusView(status);
  return (
    <span className={`t-mono-rotulo inline-flex items-center gap-2 font-semibold ${TEXT[view.tone]}`}>
      <span className={`inline-flex ${view.iconTone === "verde" ? "text-verde" : "text-ferrugem"}`}>
        <Icon icon={view.icon} />
      </span>
      {view.label}
    </span>
  );
}
