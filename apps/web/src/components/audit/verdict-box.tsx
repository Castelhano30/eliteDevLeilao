import { AUDIT_TEXT, verdictSentence, type AuditView } from "@lanceauto/shared";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import { counterView, shouldStartVerify, verifiedAtLabel } from "@/lib/audit-view";
import { HashCell } from "./hash-cell";
import { VerifyingIndicator } from "./verifying-indicator";

export interface VerdictBoxProps {
  /** O último resultado; ausente na primeira carga. */
  view: AuditView | undefined;
  /** Verificando (primeira carga ou "Verificar de novo"): carimbo e frase somem. */
  verifying: boolean;
  /** A última tentativa falhou e o resultado exibido é o anterior. */
  stale: boolean;
  onVerify: () => void;
}

function Counter({ label, alert = false, children }: { label: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t-2 border-dashed border-tracejado pt-2">
      <dt className="t-mono-rotulo">{label}</dt>
      <dd className={`t-mono-dado mt-1 ${alert ? "font-bold text-ferrugem" : ""}`}>{children}</dd>
    </div>
  );
}

/** A caixa de veredito: carimbo e frase à esquerda/direita, hora da verificação, contadores e "Verificar de novo". */
export function VerdictBox({ view, verifying, stale, onVerify }: VerdictBoxProps) {
  const ok = view?.verdict.code === "OK";
  const counters = view ? counterView(view.verdict, { hasReceipt: view.receipt !== null }) : null;
  return (
    <section aria-label="Veredito" className="border-[3px] border-linha bg-papel p-6" style={{ boxShadow: "6px 6px 0 var(--c-sombra)" }}>
      {verifying || !view ? (
        <VerifyingIndicator />
      ) : (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="shrink-0 px-2 py-3">
            <Stamp variant={ok ? "integro" : "adulterado"} animate rotate={ok ? -7 : 4} />
          </div>
          <p className="t-body-lead min-w-0" style={{ flex: "1 1 320px" }}>
            {verdictSentence(view)}
          </p>
        </div>
      )}

      {view && counters && !verifying ? (
        <dl className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
          <Counter label={AUDIT_TEXT.counters.inChain} alert={counters.chainAlert}>
            {counters.inChain}
          </Counter>
          <Counter label={AUDIT_TEXT.counters.inSeal} alert={counters.sealAlert}>
            {counters.inSeal}
          </Counter>
          <Counter label={AUDIT_TEXT.counters.finalHash}>
            <HashCell id="hash-final" hash={view.finalHash} what="final" />
          </Counter>
          {counters.receiptShown && view.receipt ? (
            <Counter label={AUDIT_TEXT.counters.receiptHash} alert={counters.receiptAlert}>
              <HashCell id="hash-comprovante" hash={view.receipt.finalHash} what="do comprovante" alert={counters.receiptAlert} />
            </Counter>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {view && !verifying ? (
          <p className="t-mono-dado flex flex-wrap items-center gap-3 text-tinta2">
            <span>{verifiedAtLabel(view.verifiedAt)}</span>
            {stale ? <span className="t-mono-rotulo border-2 border-dashed border-ferrugem px-2 py-[2px] font-semibold text-ferrugem">{AUDIT_TEXT.stale}</span> : null}
          </p>
        ) : null}
        <Button
          variant="secundario"
          loading={verifying}
          loadingText={AUDIT_TEXT.verifyingButton}
          aria-busy={verifying || undefined}
          onClick={() => {
            if (shouldStartVerify(verifying)) onVerify();
          }}
        >
          {AUDIT_TEXT.verifyAgain}
        </Button>
      </div>
    </section>
  );
}
