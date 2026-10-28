"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  AUDIT_TEXT,
  LOT_TEXT,
  auditPath,
  brasiliaDayAndTime,
  cancelledAtLabel,
  formatBRL,
  type LotState,
  GLOBAL_TEXT,
} from "@lanceauto/shared";
import { useAuth } from "@/components/auth-provider";
import { ConnectionBanner } from "@/components/connection-banner";
import { BidHistory } from "@/components/lots/bid-history";
import { BidPanel } from "@/components/lots/bid-panel";
import { SalaFoto } from "@/components/lots/sala-foto";
import { Cronometro } from "@/components/lots/cronometro";
import { FaixaStatus } from "@/components/lots/faixa-status";
import { FichaCarro } from "@/components/lots/ficha-carro";
import { buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { LotTag } from "@/components/ui/lot-tag";
import { Stamp } from "@/components/ui/stamp";
import { fetchLot, lotKey, LotNotFoundError } from "@/lib/lot-query";
import { INITIAL_OPENING_CHECKS } from "@/lib/lot-state";
import { bidBlockReason, useConnectionBanner, useConnectionStatus } from "@/lib/realtime/connection-status";
import { mergeSnapshot } from "@/lib/realtime/lot-reducer";
import { lotRefetchInterval } from "@/lib/realtime/panel-decisions";
import { useLotRoom } from "@/lib/realtime/use-lot-room";
import { serverNow } from "@/lib/server-clock";
import { useOnReach, useServerNow } from "@/lib/use-server-clock";

function BackToShowcase() {
  return (
    <Link href="/" className={buttonClasses("secundario")}>
      Voltar à vitrine
    </Link>
  );
}

/** "25/10 às 10:00 (Brasília)". */
function when(iso: string) {
  const { day, time } = brasiliaDayAndTime(iso);
  return (
    <>
      <span>{day}</span> às <span>{time}</span> (Brasília)
    </>
  );
}

/**
 * Sala do lote (§9.2): ficha do carro à esquerda; à direita, o painel de lance quando o lote está ao vivo ou apurando.
 * O servidor decide o estado: o relógio local só pede um novo GET ao cruzar o início ou o fim.
 */
export function Sala({ id, initial, notFound = false }: { id: string; initial?: LotState; notFound?: boolean }) {
  const { user, status: authStatus } = useAuth();
  const queryClient = useQueryClient();
  const openingChecks = useRef(INITIAL_OPENING_CHECKS);
  const query = useQuery({
    queryKey: lotKey(id),
    // O snapshot do GET não passa por cima de um cache que um evento já levou além dele (R-4.8).
    queryFn: async ({ signal }) => {
      const snapshot = await fetchLot(id, signal);
      return mergeSnapshot(queryClient.getQueryData<LotState>(lotKey(id)), snapshot);
    },
    initialData: initial,
    enabled: !notFound,
    retry: (count, error) => !(error instanceof LotNotFoundError) && count < 1,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      const step = lotRefetchInterval(data.lot, serverNow(), openingChecks.current, q.state.dataUpdatedAt);
      openingChecks.current = step.checks;
      return step.interval;
    },
  });
  // Sala ao vivo: entra em lot:{id} (no mount e a cada connect), aplica os eventos e reconcilia pelo GET.
  const room = useLotRoom(id, { enabled: !notFound });
  const connection = useConnectionStatus();
  const banner = useConnectionBanner(connection);
  const blockReason = bidBlockReason({ status: connection.status, phase: connection.phase, stale: room.syncing });
  const state = query.data;
  const now = useServerNow(state?.serverTime);
  const lot = state?.lot;
  // O carimbo do cancelado só "bate" (e o aviso só é anunciado) se esta sessão viu o lote ainda ativo (estado derivado).
  const [sawActive, setSawActive] = useState(false);
  if (lot && !sawActive && lot.status !== "CANCELLED") setSawActive(true);
  // Cruzou o início ou o fim: pede o estado ao servidor (o relógio do aparelho não decide nada).
  const boundary = lot ? (lot.status === "SCHEDULED" ? Date.parse(lot.startsAt) : lot.status === "LIVE" ? Date.parse(lot.endsAt) : null) : null;
  useOnReach(boundary === null ? null : boundary + 500, now, () => void query.refetch());

  const shell = (children: ReactNode) => (
    <div className="mx-auto py-6 md:py-8" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
      {children}
    </div>
  );

  if (notFound || query.error instanceof LotNotFoundError) {
    return shell(
      <div className="max-w-[640px] space-y-4">
        <h1 className="t-display-titulo">{LOT_TEXT.notFoundTitle}</h1>
        <FeedbackState variant="vazio">{LOT_TEXT.notFoundBody}</FeedbackState>
        <BackToShowcase />
      </div>,
    );
  }
  if (!state || !lot) {
    return shell(
      query.isError ? (
        <FeedbackState variant="erro" onRetry={() => void query.refetch()}>
          {GLOBAL_TEXT.loadError}
        </FeedbackState>
      ) : (
        <FeedbackState variant="carregando" />
      ),
    );
  }

  const { car } = state;
  const status = lot.status;
  const ended = status === "SOLD" || status === "UNSOLD";

  const relogio = <Cronometro size="sala" status={status} startsAt={lot.startsAt} endsAt={lot.endsAt} originalEndsAt={lot.originalEndsAt} serverTime={state.serverTime} />;

  let panel: ReactNode;
  if (status === "CANCELLED") {
    // Sem formulário nem CTA de lance para ninguém; o histórico fica (lê só o banco) e a linha CANCEL é da Auditoria (S08).
    panel = (
      <div className="space-y-5">
        {relogio}
        <div>
          <Stamp variant="cancelado" size="carimbo" animate={sawActive} />
        </div>
        <FaixaStatus title="Lote cancelado" />
        <p className="t-body-lead">{LOT_TEXT.cancelledBody}</p>
        {lot.cancelledAt ? <p className="t-mono">{cancelledAtLabel(lot.cancelledAt)}</p> : null}
        <BackToShowcase />
        <BidHistory bids={state.bids} myPseudonym={lot.myPseudonym} />
      </div>
    );
  } else if (status === "SCHEDULED") {
    const closes = brasiliaDayAndTime(lot.endsAt);
    panel = (
      <div className="space-y-5">
        <p className="t-body-lead">Este lote abre em {when(lot.startsAt)}.</p>
        {relogio}
        <p className="t-mono">
          Lance inicial {formatBRL(lot.startingBidCents)} · Incremento {formatBRL(lot.minIncrementCents)} · Fecha {closes.day} às {closes.time} (Brasília)
        </p>
      </div>
    );
  } else {
    // O mesmo painel segue montado do ao vivo ao resultado: a região viva da faixa anuncia a mudança (§9.1).
    panel = (
      <BidPanel
        id={id}
        state={state}
        viewer={user ? { role: user.role } : null}
        authLoading={authStatus === "loading" || authStatus === "error"}
        blockReason={blockReason}
      />
    );
  }

  return shell(
    <>
      <ConnectionBanner view={banner} lastSyncedAt={connection.lastSyncedAt} />
      {/* Região viva sempre montada: o cancelamento visto ao vivo é anunciado, a Sala aberta já cancelada não repete. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === "CANCELLED" && sawActive ? LOT_TEXT.cancelledBody : ""}
      </p>
      {query.isError ? (
        <FeedbackState variant="erro" onRetry={() => void query.refetch()} className="mb-6">
          {GLOBAL_TEXT.staleError}
        </FeedbackState>
      ) : null}
      <div className="flex flex-wrap justify-center gap-x-12 gap-y-6">
        <section aria-label="Ficha do carro" className="min-w-0" style={{ flex: "1 1 400px", maxWidth: 560 }}>
          <SalaFoto car={car} title={lot.title} dimmed={ended} />
          {/* O título e o par selo + etiqueta correm na mesma linha; o par é um bloco só e desce junto se não couber. */}
          <div className="mt-6">
            <h1 className="inline font-bold uppercase [overflow-wrap:anywhere]" style={{ fontSize: "clamp(34px, 4vw, 56px)", lineHeight: 1 }}>
              {lot.title}
            </h1>
            <span className="ml-3 inline-flex items-center gap-2 align-middle">
              {status === "LIVE" ? <Stamp variant="ao-vivo" /> : null}
              <LotTag number={lot.number} tone={ended || status === "CANCELLED" ? "papel" : "ocre"} size="linha" />
            </span>
          </div>
          <FichaCarro car={car} />
          <Link href={auditPath(id)} className={`${buttonClasses("secundario")} mt-6 w-full !min-h-alvo`}>
            {AUDIT_TEXT.auditThisLot}
          </Link>
        </section>

        <section aria-label="Painel do lote" className="min-w-0" style={{ flex: "1 1 440px", maxWidth: 560 }}>
          {panel}
        </section>
      </div>
    </>,
  );
}
