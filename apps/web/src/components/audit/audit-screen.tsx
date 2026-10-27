"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { AUDIT_TEXT, problemBanner, receiptPath, verdictAnnouncement } from "@lanceauto/shared";
import { useAuth } from "@/components/auth-provider";
import { buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { LotTag } from "@/components/ui/lot-tag";
import { PageShell } from "@/components/ui/page-shell";
import { AuditNotFoundError, AuditRequestError, auditKey, fetchAudit } from "@/lib/audit-query";
import { auditScreenState, auditTitle, lotMetaLine } from "@/lib/audit-view";
import { fetchLot } from "@/lib/lot-query";
import { AuditTable } from "./audit-table";
import { HowWeCheck } from "./how-we-check";
import { VerdictBox } from "./verdict-box";

function NotFound() {
  return (
    <div className="max-w-[640px] space-y-4">
      <h1 className="t-display-titulo">{AUDIT_TEXT.notFoundTitle}</h1>
      <FeedbackState variant="vazio">{AUDIT_TEXT.notFoundBody}</FeedbackState>
      <Link href="/" className={buttonClasses("secundario")}>
        {AUDIT_TEXT.backToShowcase}
      </Link>
    </div>
  );
}

/**
 * Auditoria pública do lote (S08 §9): um retrato verificado pelo servidor, sem tempo real (R-8.14). Refaz a conta ao
 * abrir e a cada "Verificar de novo"; nada é guardado (`gcTime: 0`), então cada visita é uma verificação nova.
 */
export function AuditScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: auditKey(id),
    queryFn: ({ signal }) => fetchAudit(id, signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const view = query.data;
  const notFound = query.error instanceof AuditNotFoundError;
  const state = auditScreenState({ hasData: view !== undefined, isFetching: query.isFetching, isError: query.isError, notFound });

  // O link do comprovante só existe para o vencedor logado: a auditoria pública não leva o token (T9).
  const own = useQuery({
    queryKey: ["audit-own-receipt", id],
    queryFn: ({ signal }) => fetchLot(id, signal),
    enabled: user?.role === "BIDDER" && view !== undefined,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const receiptToken = own.data?.lot.myReceiptToken ?? null;

  const number = view?.lot.number;
  useEffect(() => {
    if (number !== undefined) document.title = auditTitle(number);
  }, [number]);

  const verify = () => void query.refetch();
  const verifying = state === "verifying";
  const banner = view && !verifying ? problemBanner(view) : null;
  const announcement = verifying ? AUDIT_TEXT.verifyingLive : view ? verdictAnnouncement(view) : "";
  const requestError = query.error instanceof AuditRequestError ? query.error : null;
  const errorText = requestError?.rateLimited ? requestError.message : AUDIT_TEXT.networkError;

  if (state === "notfound") {
    return (
      <PageShell>
        <NotFound />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Região viva sempre montada: "Verificando." e depois o veredito, uma vez cada. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {view ? (
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-5 pt-6">
            <LotTag number={view.lot.number} tone={view.lot.status === "LIVE" || view.lot.status === "SCHEDULED" || view.lot.status === "CLOSING" ? "ocre" : "papel"} />
            <h1 className="t-display-titulo min-w-0 flex-1">{view.lot.title}</h1>
          </div>
          <p className="t-mono mt-4">{lotMetaLine(view.lot)}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/lotes/${view.lot.id}`} className={`${buttonClasses("secundario")} !min-h-alvo`}>
              {AUDIT_TEXT.viewRoom}
            </Link>
            {receiptToken ? (
              <Link href={receiptPath(receiptToken)} target="_blank" rel="noopener noreferrer" className={`${buttonClasses("secundario")} !min-h-alvo`}>
                {AUDIT_TEXT.viewReceipt}
                <span className="sr-only"> (abre em outra guia)</span>
              </Link>
            ) : null}
          </div>
        </header>
      ) : (
        <h1 className="t-display-titulo mb-8">Auditoria do lote</h1>
      )}

      {state === "error" ? (
        <FeedbackState variant="erro" onRetry={verify}>
          {errorText}
        </FeedbackState>
      ) : (
        <div className="space-y-6">
          {state === "stale" ? (
            <FeedbackState variant="erro" onRetry={verify}>
              {errorText}
            </FeedbackState>
          ) : null}

          <VerdictBox view={view} verifying={verifying} stale={state === "stale"} onVerify={verify} />

          {banner ? (
            <div role="alert" className="border-[3px] border-ferrugem bg-papel p-4 text-ferrugem">
              <p className="t-body font-semibold">{banner}</p>
            </div>
          ) : null}

          {view ? (
            <div className="flex flex-wrap items-start gap-8">
              <div className="min-w-0" style={{ flex: "3 1 600px" }}>
                {view.entries.length > 0 ? (
                  <AuditTable view={view} verifying={verifying} />
                ) : (
                  <FeedbackState variant="vazio">{AUDIT_TEXT.emptyChain}</FeedbackState>
                )}
              </div>
              <HowWeCheck />
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
