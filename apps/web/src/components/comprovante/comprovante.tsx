"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AUDIT_TEXT, RECEIPT_TEXT, type ReceiptDTO } from "@lanceauto/shared";
import { BotaoCopiarLink } from "@/components/botao-copiar-link";
import { CarPhoto } from "@/components/lots/car-photo";
import { buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";
import { apiGet } from "@/lib/api-client";
import { ComprovanteNaoEncontrado } from "./comprovante-nao-encontrado";
import { Recibo } from "./recibo";

class ReceiptNotFoundError extends Error {}

async function fetchReceipt(token: string, signal?: AbortSignal): Promise<ReceiptDTO> {
  const result = await apiGet<ReceiptDTO>(`/receipts/${encodeURIComponent(token)}`, { signal });
  if (result.ok) return result.data;
  if (result.status === 404) throw new ReceiptNotFoundError();
  throw new Error(RECEIPT_TEXT.networkError);
}

/** Esqueleto da página enquanto o cliente busca o comprovante (SSR sem dados: API dormindo, timeout, rede). */
function Esqueleto() {
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-8">
      <div className="min-h-[420px] min-w-0 rounded-xl border border-borda bg-papel" style={{ flex: "1 1 480px" }} />
      <div className="min-h-[260px] min-w-0 rounded-xl border border-borda bg-suave" style={{ flex: "1 1 360px" }} />
    </div>
  );
}

/**
 * Comprovante (§9.2). Com dados do SSR mostra o recibo direto; sem eles busca no navegador e, se falhar, mostra o
 * erro de rede com "Tentar novamente". Só um 404 da API vira "não encontrado". O recibo nunca muda: sem refetch.
 */
export function Comprovante({ token, initial }: { token: string; initial?: ReceiptDTO }) {
  const query = useQuery({
    queryKey: ["receipt", token],
    queryFn: ({ signal }) => fetchReceipt(token, signal),
    initialData: initial,
    staleTime: Infinity,
    retry: (count, error) => !(error instanceof ReceiptNotFoundError) && count < 1,
  });

  if (query.error instanceof ReceiptNotFoundError) return <ComprovanteNaoEncontrado />;
  const receipt = query.data;

  return (
    <PageShell width="comprovante">
      <h1 className="t-display-titulo mb-8">Comprovante de arremate</h1>
      {!receipt ? (
        <div className="space-y-6">
          {query.isError ? (
            <FeedbackState variant="erro" onRetry={() => void query.refetch()}>
              {RECEIPT_TEXT.networkError}
            </FeedbackState>
          ) : (
            <FeedbackState variant="carregando" />
          )}
          <Esqueleto />
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-10 gap-y-10">
          <div className="min-w-0" style={{ flex: "1 1 480px" }}>
            <Recibo receipt={receipt} />
          </div>
          <div className="min-w-0 space-y-6" style={{ flex: "1 1 360px" }}>
            <div>
              <CarPhoto
                imageUrl={receipt.car.imageUrl}
                title={receipt.car.title}
                size="sala"
                showCaption={receipt.car.imageUrl !== null}
                credit={receipt.car.imageCredit}
              />
              {receipt.car.imageUrl === null ? <p className="t-body-legenda mt-2 text-tinta2">Imagem ilustrativa</p> : null}
            </div>
            <BotaoCopiarLink token={token} lotNumber={receipt.lotNumber} />
            <Link href={receipt.auditUrl} className={`${buttonClasses("secundario")} !min-h-alvo`}>
              {AUDIT_TEXT.auditLot}
            </Link>
            <p className="t-body-nota">{RECEIPT_TEXT.privacyNote}</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
