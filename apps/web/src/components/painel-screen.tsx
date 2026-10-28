"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AUDIT_TEXT, auditPath, brasiliaDayAndTime, formatBRL, formatBrasilia, formatLotNumber, type LotCard as LotCardDto, type MyLotCard, type MyLotsResponse, GLOBAL_TEXT } from "@lanceauto/shared";
import { CancelDialog } from "@/components/cancel-dialog";
import { Cronometro } from "@/components/lots/cronometro";
import { LotCard } from "@/components/lots/lot-card";
import { ConnectionBanner } from "@/components/connection-banner";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FeedbackState } from "@/components/ui/feedback-state";
import { Notice } from "@/components/ui/notice";
import { PageShell } from "@/components/ui/page-shell";
import { apiGet } from "@/lib/api-client";
import { receivedLabel } from "@/lib/ended-card";
import { MY_LOTS_KEY } from "@/lib/lot-query";
import { canCancel, cancelButtonLabel, cancelledColumns, splitMyLots } from "@/lib/panel-sections";
import { useConnectionBanner, useConnectionStatus } from "@/lib/realtime/connection-status";
import { useShowcaseLive } from "@/lib/realtime/use-showcase-live";
import { cancelButtonId, useCancelFlow } from "@/lib/use-cancel-flow";
import { useOnReach, useServerNow } from "@/lib/use-server-clock";

async function fetchMyLots(signal?: AbortSignal): Promise<MyLotsResponse> {
  const result = await apiGet<MyLotsResponse>("/my/lots", { signal });
  if (!result.ok) throw new Error("Não consegui trazer seus lotes.");
  return result.data;
}

/**
 * Mostrada uma vez depois de criar: "Lote 025 agendado. Abre sozinho em 25/10 às 10:00 (Brasília)." ou, se o lote
 * nasceu ao vivo (início dentro da tolerância de 60 s), "Lote 025 no ar.". `criado` que não seja inteiro é ignorado.
 */
function useCreatedNotice(lots: LotCardDto[] | undefined) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const raw = params.get("criado");
  const created = raw !== null && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  const imageFailed = params.get("imagem") === "falhou";

  // Guarda a mensagem quando os dados chegam (estado derivado no render); o efeito só limpa a URL.
  if (created !== null && lots && notice === null) {
    const lot = lots.find((l) => l.number === created);
    const label = `Lote ${formatLotNumber(created)}`;
    let base = `${label} criado.`;
    if (lot?.status === "SCHEDULED") {
      const opens = brasiliaDayAndTime(lot.startsAt);
      base = `${label} agendado. Abre sozinho em ${opens.day} às ${opens.time} (Brasília).`;
    } else if (lot?.status === "LIVE" || lot?.status === "CLOSING") {
      base = `${label} no ar.`;
    }
    setNotice(imageFailed ? `${base} A imagem não pôde ser baixada; o lote usa a ilustração padrão.` : base);
  }

  useEffect(() => {
    if (raw !== null && (notice !== null || created === null)) router.replace(pathname);
  }, [raw, created, notice, pathname, router]);

  return notice;
}

const carLabel = (lot: LotCardDto) => `${lot.brand} ${lot.model} ${lot.year}`;

function LotLink({ lot }: { lot: LotCardDto }) {
  return (
    <span className="flex items-center gap-3">
      <span className="t-mono-dado shrink-0 rounded-md bg-ocre px-2 py-1 text-sobreOcre">{formatLotNumber(lot.number)}</span>
      <Link href={`/lotes/${lot.id}`} className="text-[16px] font-bold leading-[1.45]">
        {lot.title}
      </Link>
    </span>
  );
}

function SeeRoom({ lot }: { lot: LotCardDto }) {
  return (
    <Link href={`/lotes/${lot.id}`} className={`${buttonClasses("secundario")} !min-h-alvo whitespace-nowrap !px-3 !py-1 text-[16px]`} aria-label={`Ver sala do lote ${formatLotNumber(lot.number)}`}>
      Ver sala
    </Link>
  );
}

/** "Ver sala" e "Cancelar" (S06 §9.1): o cancelamento vale para qualquer linha ao vivo ou agendada, com ou sem lances. */
function RowActions({ lot, onCancel }: { lot: MyLotCard; onCancel: (lot: MyLotCard) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <SeeRoom lot={lot} />
      {canCancel(lot) ? (
        <Button
          id={cancelButtonId(lot.id)}
          variant="secundario"
          destrutivo
          aria-label={cancelButtonLabel(lot)}
          className="!min-h-alvo whitespace-nowrap !px-3 !py-1 text-[16px]"
          onClick={() => onCancel(lot)}
        >
          Cancelar
        </Button>
      ) : null}
    </span>
  );
}

/** "Auditoria do lote" (S08): nome acessível único por linha, com o número do lote. */
function AuditLink({ lot }: { lot: LotCardDto }) {
  return (
    <Link
      href={auditPath(lot.id)}
      className={`${buttonClasses("secundario")} !min-h-alvo whitespace-nowrap !px-3 !py-1 text-[16px]`}
      aria-label={`${AUDIT_TEXT.auditLotPanel} ${formatLotNumber(lot.number)}`}
    >
      {AUDIT_TEXT.auditLotPanel}
    </Link>
  );
}

function Counter({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col justify-between rounded-xl border border-linha bg-painel px-4 py-3">
      <p className="t-mono-rotulo-pequeno" style={{ color: "var(--f-rotulo-relogio)" }}>
        {label}
      </p>
      <p className="mt-3 text-[36px] font-semibold leading-none" style={{ color: alert ? "var(--c-led-alerta)" : "var(--c-led)" }}>
        {String(value).padStart(2, "0")}
      </p>
    </div>
  );
}

/** Painel do pátio (§9.4): resumo, placares, tabelas Ao vivo e Agendados, Encerrados. */
export function PainelScreen() {
  const query = useQuery({ queryKey: MY_LOTS_KEY, queryFn: ({ signal }) => fetchMyLots(signal), retry: 1 });
  const data = query.data;
  const notice = useCreatedNotice(data?.lots);
  const now = useServerNow(data?.serverTime);
  // Lance e prorrogação nos lotes do leiloeiro chegam sozinhos; lote que fecha ou cancela refaz o GET (§9.3).
  useShowcaseLive(MY_LOTS_KEY);
  const connection = useConnectionStatus();
  const banner = useConnectionBanner(connection);

  const { live, scheduled, ended, cancelled, soldCount: sold } = splitMyLots(data?.lots ?? []);
  const cancel = useCancelFlow(query);
  const cancelledHeading = useRef<HTMLHeadingElement>(null);
  // Cancelou: o foco vai ao título de "Cancelados" assim que a seção existir (a linha só chega lá com o servidor).
  const { focusCancelled, clearFocusCancelled } = cancel;
  useEffect(() => {
    if (focusCancelled && cancelledHeading.current) {
      cancelledHeading.current.focus();
      clearFocusCancelled();
    }
  }, [focusCancelled, cancelled.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Um GET quando o primeiro cronômetro do painel chega a zero.
  const targets = [...live.filter((l) => l.status === "LIVE").map((l) => Date.parse(l.endsAt)), ...scheduled.map((l) => Date.parse(l.startsAt))].filter((t) => t + 1_000 > now);
  useOnReach(targets.length ? Math.min(...targets) + 1_000 : null, now, () => void query.refetch());

  const liveColumns: DataTableColumn<MyLotCard>[] = [
    { key: "lote", header: "Lote", render: (lot) => <LotLink lot={lot} /> },
    { key: "carro", header: "Carro", render: carLabel },
    { key: "lance", header: "Lance atual", align: "right", render: (lot) => formatBRL(lot.currentBidCents ?? lot.startingBidCents) },
    { key: "lances", header: "Lances", align: "right", render: (lot) => String(lot.bidCount) },
    {
      key: "restam",
      header: "Restam",
      render: (lot) => (
        <>
          <Cronometro size="cartao" status={lot.status} startsAt={lot.startsAt} endsAt={lot.endsAt} originalEndsAt={lot.originalEndsAt} serverTime={data?.serverTime} />
          {lot.status === "CLOSING" ? <span className="t-mono mt-1 block text-tinta2">Apurando o resultado…</span> : null}
        </>
      ),
    },
    { key: "acao", header: "Ação", render: (lot) => <RowActions lot={lot} onCancel={cancel.begin} /> },
  ];
  const scheduledColumns: DataTableColumn<MyLotCard>[] = [
    { key: "lote", header: "Lote", render: (lot) => <LotLink lot={lot} /> },
    { key: "carro", header: "Carro", render: carLabel },
    { key: "inicial", header: "Lance inicial", align: "right", render: (lot) => formatBRL(lot.startingBidCents) },
    { key: "lances", header: "Lances", align: "right", render: (lot) => String(lot.bidCount) },
    { key: "abre", header: "Abre", render: (lot) => formatBrasilia(lot.startsAt) },
    { key: "fecha", header: "Fecha", render: (lot) => formatBrasilia(lot.endsAt) },
    { key: "acao", header: "Ação", render: (lot) => <RowActions lot={lot} onCancel={cancel.begin} /> },
  ];
  const cancelledTableColumns: DataTableColumn<MyLotCard>[] = [
    { key: "lote", header: "Lote", render: (lot) => <LotLink lot={lot} /> },
    { key: "carro", header: "Carro", render: (lot) => cancelledColumns(lot).car },
    { key: "lances", header: "Lances", align: "right", render: (lot) => cancelledColumns(lot).bids },
    { key: "ultimo", header: "Último lance", align: "right", render: (lot) => cancelledColumns(lot).lastBid },
    { key: "estorno", header: "Estorno", align: "right", render: (lot) => cancelledColumns(lot).refund },
    { key: "em", header: "Cancelado em", render: (lot) => cancelledColumns(lot).cancelledAt },
    { key: "auditoria", header: "Auditoria", render: (lot) => <AuditLink lot={lot} /> },
  ];

  return (
    <PageShell>
      <ConnectionBanner view={banner} lastSyncedAt={connection.lastSyncedAt} />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="t-display-titulo">Painel do pátio</h1>
          <p className="t-body-lead mt-3">Seus lotes, quem está brigando por eles e quanto já entrou.</p>
        </div>
        <Link href="/painel/criar-lote" className={buttonClasses("primario")}>
          Criar lote
        </Link>
      </div>

      {notice ? (
        <Notice kind="info" className="mt-8">
          {notice}
        </Notice>
      ) : null}
      {/* Região viva sempre presente: o aviso do cancelamento é anunciado quando o texto entra (S06 §9.1). */}
      <div role="status" aria-live="polite" className="empty:hidden">
        {cancel.announce ? (
          <Notice kind="info" role="none" className="mt-8">
            {cancel.announce}
          </Notice>
        ) : null}
      </div>
      {cancel.notice ? (
        <FeedbackState variant="erro" className="mt-8">
          {cancel.notice}
        </FeedbackState>
      ) : null}

      {!data ? (
        <div className="mt-8">
          {query.isError ? (
            <FeedbackState variant="erro" onRetry={() => void query.refetch()}>
              {GLOBAL_TEXT.loadError}
            </FeedbackState>
          ) : (
            <FeedbackState variant="carregando" />
          )}
        </div>
      ) : (
        <>
          {query.isError ? (
            <FeedbackState variant="erro" onRetry={() => void query.refetch()} className="mt-8">
              {GLOBAL_TEXT.staleError}
            </FeedbackState>
          ) : null}
          <section aria-label="Resumo" className="mt-8 flex flex-wrap gap-6">
            <div className="min-w-0 basis-[260px] flex-[2] rounded-2xl border border-borda bg-papel p-5 shadow-cartao">
              <p className="t-mono-rotulo">{receivedLabel(sold)}</p>
              <p className="mt-2 text-[28px] break-all font-extrabold">{formatBRL(data.totalReceivedCents)}</p>
              <p className="t-body-nota mt-2">Saldo simulado. O pátio agradece mesmo assim.</p>
            </div>
            <div className="flex flex-[3] flex-wrap gap-4">
              <Counter label="AO VIVO" value={live.length} alert />
              <Counter label="AGENDADOS" value={scheduled.length} />
              <Counter label="ENCERRADOS" value={ended.length} />
            </div>
          </section>

          <section aria-labelledby="painel-ao-vivo" className="mt-8">
            <h2 id="painel-ao-vivo" tabIndex={-1} className="t-display-secao mb-6">
              Ao vivo
            </h2>
            {live.length ? (
              <DataTable caption="Lotes ao vivo" captionHidden columns={liveColumns} rows={live} rowKey={(l) => l.id} minWidth={760} />
            ) : (
              <FeedbackState variant="vazio">Nada ao vivo por aqui.</FeedbackState>
            )}
          </section>

          <section aria-labelledby="painel-agendados" className="mt-8">
            <h2 id="painel-agendados" tabIndex={-1} className="t-display-secao mb-6">
              Agendados
            </h2>
            {scheduled.length ? (
              <DataTable caption="Lotes agendados" captionHidden columns={scheduledColumns} rows={scheduled} rowKey={(l) => l.id} minWidth={760} />
            ) : (
              <FeedbackState variant="vazio">Nada agendado ainda.</FeedbackState>
            )}
          </section>

          <section aria-labelledby="painel-encerrados" className="mt-8">
            <h2 id="painel-encerrados" tabIndex={-1} className="t-display-secao mb-6">
              Encerrados
            </h2>
            {ended.length ? (
              <div className="grid gap-x-6 gap-y-10 pt-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 330px), 1fr))" }}>
                {ended.map((lot) => (
                  <div key={lot.id} className="flex flex-col gap-4">
                    <LotCard card={lot} serverTime={data.serverTime} resultado={lot.resultado} />
                    <span className="flex flex-wrap gap-2">
                      <AuditLink lot={lot} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <FeedbackState variant="vazio">Nenhum lote encerrado.</FeedbackState>
            )}
          </section>

          {/* Só aparece se houver cancelado: nenhuma caixa vazia (S06 §9.1). */}
          {cancelled.length ? (
            <section aria-labelledby="painel-cancelados" className="mt-8">
              <h2 id="painel-cancelados" ref={cancelledHeading} tabIndex={-1} className="t-display-secao mb-6">
                Cancelados
              </h2>
              <DataTable caption="Lotes cancelados" captionHidden columns={cancelledTableColumns} rows={cancelled} rowKey={(l) => l.id} minWidth={760} />
            </section>
          ) : null}
        </>
      )}
      <CancelDialog open={cancel.open} lot={cancel.lot} state={cancel.dialog} onConfirm={() => void cancel.confirm()} onClose={cancel.close} />
    </PageShell>
  );
}
