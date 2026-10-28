"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AUDIT_TEXT, auditPath, brasiliaDayAndTime, formatBRL, formatBrasilia, formatLotNumber, type LotCard as LotCardDto, type MyLotCard, type MyLotsResponse, GLOBAL_TEXT } from "@lanceauto/shared";
import { CancelDialog } from "@/components/cancel-dialog";
import { BarraDePaginas } from "@/components/ui/barra-de-paginas";
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
import { paginar } from "@/lib/paginacao";
import { colunasDaGrade, encerradosVisiveis } from "@/lib/painel-grade";
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

/** Cancelados por página: o quinto vai para a segunda página, e assim por diante. */
const CANCELADOS_POR_PAGINA = 4;
/** Encerrados à mostra de início, em linhas da grade; "Carregar mais" abre mais duas linhas por vez. */
const ENCERRADOS_LINHAS = 2;
/** Largura mínima do cartão e vão da grade dos encerrados (a grade é `auto-fill`, então as colunas mudam com a tela). */
const CARTAO_MIN_PX = 330;
const GRADE_VAO_PX = 24;

const TITULO_SECAO = "mb-4 font-extrabold uppercase leading-none";
const TITULO_SECAO_ESTILO = { fontSize: "clamp(22px, 2.4vw, 30px)" } as const;

const carLabel = (lot: LotCardDto) => `${lot.brand} ${lot.model} ${lot.year}`;

function LotLink({ lot }: { lot: LotCardDto }) {
  return (
    <span className="flex items-center gap-3">
      <span className="t-mono-dado shrink-0 rounded-md bg-ocre px-2 py-1 text-sobreOcre">{formatLotNumber(lot.number)}</span>
      <Link href={`/lotes/${lot.id}`} className="inline-flex min-h-alvo items-center text-[15px] font-bold leading-[1.4]">
        {lot.title}
      </Link>
    </span>
  );
}

function SeeRoom({ lot }: { lot: LotCardDto }) {
  return (
    <Link href={`/lotes/${lot.id}`} className={`${buttonClasses("secundario", false, "compacto")} whitespace-nowrap`} aria-label={`Ver sala do lote ${formatLotNumber(lot.number)}`}>
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
          size="compacto"
          destrutivo
          aria-label={cancelButtonLabel(lot)}
          className="whitespace-nowrap"
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
      className={`${buttonClasses("secundario", false, "compacto")} whitespace-nowrap`}
      aria-label={`${AUDIT_TEXT.auditLotPanel} ${formatLotNumber(lot.number)}`}
    >
      {AUDIT_TEXT.auditLotPanel}
    </Link>
  );
}

// As cores seguem o tema (o painel escuro fixo deixava os contadores azul-marinho no claro): vermelho do selo "Ao vivo",
// azul do selo "Agendado" e a tinta do texto para os encerrados.
const COUNTER_TONE = { vivo: "text-aoVivo", agendado: "text-ocreTexto", encerrado: "text-tinta" } as const;

function Counter({ label, value, tone }: { label: string; value: number; tone: keyof typeof COUNTER_TONE }) {
  return (
    <div className="flex min-w-[130px] flex-1 flex-col justify-between rounded-xl border border-borda bg-papel px-4 py-3 shadow-cartao">
      <p className="t-mono-rotulo-pequeno text-tinta2">{label}</p>
      <p className={`mt-2 text-[30px] font-semibold leading-none tabular-nums ${COUNTER_TONE[tone]}`}>{String(value).padStart(2, "0")}</p>
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

  // Encerrados: duas linhas da grade, e "Carregar mais" abre mais duas. A quantidade por linha muda com a largura da grade.
  const [endedRows, setEndedRows] = useState(ENCERRADOS_LINHAS);
  const [endedGrid, setEndedGrid] = useState<HTMLDivElement | null>(null);
  const [endedColumns, setEndedColumns] = useState(3);
  useEffect(() => {
    if (!endedGrid) return;
    const measure = () => setEndedColumns(colunasDaGrade(endedGrid.clientWidth, CARTAO_MIN_PX, GRADE_VAO_PX));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(endedGrid);
    return () => observer.disconnect();
  }, [endedGrid]);
  const endedShown = encerradosVisiveis(ended.length, endedColumns, endedRows);

  // Cancelados: quatro por página; um cancelamento novo volta à primeira.
  const [cancelledPage, setCancelledPage] = useState(0);
  const [seenCancelled, setSeenCancelled] = useState(cancelled.length);
  if (cancelled.length !== seenCancelled) {
    setSeenCancelled(cancelled.length);
    setCancelledPage(0);
  }
  const cancelledView = paginar(cancelled, cancelledPage, CANCELADOS_POR_PAGINA);
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
          <h1 className="font-extrabold uppercase [overflow-wrap:anywhere]" style={{ fontSize: "clamp(30px, 3.6vw, 48px)", lineHeight: 1 }}>
            Painel do pátio
          </h1>
          <p className="t-body-lead mt-2">Seus lotes, quem está brigando por eles e quanto já entrou.</p>
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
          <section aria-label="Resumo" className="mt-6 flex flex-wrap gap-4">
            <div className="min-w-0 basis-[260px] flex-[2] rounded-2xl border border-borda bg-papel p-5 shadow-cartao">
              <p className="t-mono-rotulo">{receivedLabel(sold)}</p>
              <p className="mt-2 text-[24px] break-all font-extrabold">{formatBRL(data.totalReceivedCents)}</p>
              <p className="t-body-nota mt-2">Saldo simulado. O pátio agradece mesmo assim.</p>
            </div>
            <div className="flex flex-[3] flex-wrap gap-4">
              <Counter label="AO VIVO" value={live.length} tone="vivo" />
              <Counter label="AGENDADOS" value={scheduled.length} tone="agendado" />
              <Counter label="ENCERRADOS" value={ended.length} tone="encerrado" />
            </div>
          </section>

          <section aria-labelledby="painel-ao-vivo" className="mt-10">
            <h2 id="painel-ao-vivo" tabIndex={-1} className={TITULO_SECAO} style={TITULO_SECAO_ESTILO}>
              Ao vivo
            </h2>
            {live.length ? (
              <DataTable caption="Lotes ao vivo" captionHidden columns={liveColumns} rows={live} rowKey={(l) => l.id} minWidth={760} />
            ) : (
              <FeedbackState variant="vazio">Nada ao vivo por aqui.</FeedbackState>
            )}
          </section>

          <section aria-labelledby="painel-agendados" className="mt-10">
            <h2 id="painel-agendados" tabIndex={-1} className={TITULO_SECAO} style={TITULO_SECAO_ESTILO}>
              Agendados
            </h2>
            {scheduled.length ? (
              <DataTable caption="Lotes agendados" captionHidden columns={scheduledColumns} rows={scheduled} rowKey={(l) => l.id} minWidth={760} />
            ) : (
              <FeedbackState variant="vazio">Nada agendado ainda.</FeedbackState>
            )}
          </section>

          <section aria-labelledby="painel-encerrados" className="mt-10">
            <h2 id="painel-encerrados" tabIndex={-1} className={TITULO_SECAO} style={TITULO_SECAO_ESTILO}>
              Encerrados
            </h2>
            {ended.length ? (
              <>
                <div
                  ref={setEndedGrid}
                  className="grid gap-x-6 gap-y-8 pt-2"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${CARTAO_MIN_PX}px), 1fr))` }}
                >
                  {ended.slice(0, endedShown).map((lot) => (
                    <div key={lot.id} className="flex flex-col gap-3">
                      <LotCard card={lot} serverTime={data.serverTime} resultado={lot.resultado} />
                      <span className="flex flex-wrap gap-2">
                        <AuditLink lot={lot} />
                      </span>
                    </div>
                  ))}
                </div>
                {endedShown < ended.length ? (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="t-mono-dado" aria-live="polite">
                      Mostrando {endedShown} de {ended.length} encerrados
                    </p>
                    <Button onClick={() => setEndedRows((rows) => rows + ENCERRADOS_LINHAS)}>Carregar mais</Button>
                  </div>
                ) : null}
              </>
            ) : (
              <FeedbackState variant="vazio">Nenhum lote encerrado.</FeedbackState>
            )}
          </section>

          {/* Só aparece se houver cancelado: nenhuma caixa vazia (S06 §9.1). */}
          {cancelled.length ? (
            <section aria-labelledby="painel-cancelados" className="mt-10">
              <h2 id="painel-cancelados" ref={cancelledHeading} tabIndex={-1} className={TITULO_SECAO} style={TITULO_SECAO_ESTILO}>
                Cancelados
              </h2>
              <DataTable caption="Lotes cancelados" captionHidden columns={cancelledTableColumns} rows={cancelledView.items} rowKey={(l) => l.id} minWidth={760} />
              <BarraDePaginas label="Páginas dos cancelados" atual={cancelledView.atual} paginas={cancelledView.paginas} onChange={setCancelledPage} className="mt-4" />
            </section>
          ) : null}
        </>
      )}
      <CancelDialog open={cancel.open} lot={cancel.lot} state={cancel.dialog} onConfirm={() => void cancel.confirm()} onClose={cancel.close} />
    </PageShell>
  );
}
