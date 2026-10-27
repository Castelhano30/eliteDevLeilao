import { AUDIT_TEXT } from "@lanceauto/shared";

/** "Refazendo a conta, elo por elo…" com o ponto ocre pulsando (parado em reduced-motion, pelo CSS global). */
export function VerifyingIndicator() {
  return (
    <p className="t-body-lead flex items-center gap-3">
      <span aria-hidden="true" className="inline-block h-[10px] w-[10px] shrink-0 rounded-circulo bg-ocre" style={{ animation: "la-pulsa 1.2s infinite" }} />
      {AUDIT_TEXT.verifying}
    </p>
  );
}
