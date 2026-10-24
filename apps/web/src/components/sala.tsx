"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  LOT_TEXT,
  brasiliaDayAndTime,
  formatBRL,
  formatReferenceMonth,
  type LotState,
} from "@lanceauto/shared";
import { CarPhoto } from "@/components/lots/car-photo";
import { Cronometro } from "@/components/lots/cronometro";
import { PlacaLance } from "@/components/lots/placa-lance";
import { buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { LotTag } from "@/components/ui/lot-tag";
import { Stamp } from "@/components/ui/stamp";
import { apiGet } from "@/lib/api-client";
import { bidCountLabel } from "@/lib/lots";
import { useOnReach, useServerNow } from "@/lib/use-server-clock";

export const lotKey = (id: string) => ["lot", id] as const;

class LotNotFoundError extends Error {}

async function fetchLot(id: string, signal?: AbortSignal): Promise<LotState> {
  const result = await apiGet<LotState>(`/lots/${encodeURIComponent(id)}`, { signal });
  if (result.ok) return result.data;
  if (result.status === 404) throw new LotNotFoundError(LOT_TEXT.notFoundTitle);
  throw new Error("Não consegui trazer o lote.");
}

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
      <span className="font-mono">{day}</span> às <span className="font-mono">{time}</span> (Brasília)
    </>
  );
}

/** Sala do lote, só leitura nesta fatia (§9.2). A S03 insere o painel de lance abaixo do cronômetro. */
export function Sala({ id, initial, notFound = false }: { id: string; initial?: LotState; notFound?: boolean }) {
  const query = useQuery({
    queryKey: lotKey(id),
    queryFn: ({ signal }) => fetchLot(id, signal),
    initialData: initial,
    enabled: !notFound,
    retry: (count, error) => !(error instanceof LotNotFoundError) && count < 1,
    // Apurando: olha de novo a cada 3 s até o servidor fechar o resultado.
    refetchInterval: (q) => (q.state.data?.lot.status === "CLOSING" ? 3_000 : false),
  });
  const state = query.data;
  const now = useServerNow(state?.serverTime);
  const lot = state?.lot;
  // Cruzou o início ou o fim: pede o estado ao servidor (o relógio do aparelho não decide nada).
  const boundary = lot ? (lot.status === "SCHEDULED" ? Date.parse(lot.startsAt) : lot.status === "LIVE" ? Date.parse(lot.endsAt) : null) : null;
  useOnReach(boundary === null ? null : boundary + 500, now, () => void query.refetch());

  const shell = (children: ReactNode) => (
    <div className="mx-auto py-12" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
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
          Não consegui trazer o lote.
        </FeedbackState>
      ) : (
        <FeedbackState variant="carregando" />
      ),
    );
  }

  const { car } = state;
  const status = lot.status;
  const ended = status === "SOLD" || status === "UNSOLD";

  let panel: ReactNode;
  if (status === "CANCELLED") {
    panel = (
      <div className="space-y-5">
        <Stamp variant="cancelado" />
        <p className="t-body-lead">{LOT_TEXT.cancelledBody}</p>
        <BackToShowcase />
      </div>
    );
  } else if (status === "SCHEDULED") {
    const closes = brasiliaDayAndTime(lot.endsAt);
    panel = (
      <div className="space-y-5">
        <p className="t-body-lead">Este lote abre em {when(lot.startsAt)}.</p>
        <Cronometro size="sala" status={status} startsAt={lot.startsAt} endsAt={lot.endsAt} originalEndsAt={lot.originalEndsAt} serverTime={state.serverTime} />
        <p className="t-mono">
          Lance inicial {formatBRL(lot.startingBidCents)} · Incremento {formatBRL(lot.minIncrementCents)} · Fecha {closes.day} às {closes.time} (Brasília)
        </p>
      </div>
    );
  } else {
    const hasBid = lot.currentBidCents !== null;
    panel = (
      <div className="space-y-6">
        <PlacaLance cents={lot.currentBidCents ?? lot.startingBidCents} label={hasBid ? "LANCE ATUAL" : "LANCE INICIAL"} />
        <p className="t-mono-dado">{bidCountLabel(lot.bidCount)}</p>
        <Cronometro size="sala" status={status} startsAt={lot.startsAt} endsAt={lot.endsAt} originalEndsAt={lot.originalEndsAt} serverTime={state.serverTime} />
        {status === "CLOSING" ? <p className="t-body-lead">Martelo batido. Apurando o resultado…</p> : null}
        {status === "LIVE" ? (
          <p className="t-body">
            {hasBid ? null : "Nenhum lance ainda. O mínimo é o lance inicial."}
            <span className="t-mono mt-1 block">
              Mínimo aceito {formatBRL(lot.minimumNextCents)} · incremento {formatBRL(lot.minIncrementCents)}
            </span>
          </p>
        ) : null}
        {ended ? <Stamp variant={status === "SOLD" ? "arrematado" : "sem-lances"} /> : null}
        {ended && lot.currentBidCents !== null ? <p className="t-mono-dado">Lance final {formatBRL(lot.currentBidCents)}</p> : null}
        {status === "LIVE" || status === "CLOSING" ? (
          <section aria-label="Histórico de lances" className="border-[3px] border-dashed border-tracejado bg-papel p-4">
            <p className="t-mono-rotulo">HISTÓRICO</p>
            <p className="t-body-nota mt-2">{lot.bidCount === 0 ? "Nenhum lance por aqui ainda." : "O histórico chega com os lances."}</p>
          </section>
        ) : null}
      </div>
    );
  }

  return shell(
    <>
      {query.isError ? (
        <FeedbackState variant="erro" onRetry={() => void query.refetch()} className="mb-6">
          Não consegui atualizar o lote. Os dados abaixo estão desatualizados.
        </FeedbackState>
      ) : null}
      <div className="flex flex-wrap gap-9">
        <section aria-label="Ficha do carro" className="min-w-0" style={{ flex: "1 1 520px" }}>
          <CarPhoto imageUrl={car.imageUrl} title={lot.title} size="sala" showCaption credit={car.imageCredit} creditUrl={car.imageCreditUrl} dimmed={ended} />
          <dl className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
            {[
              ["Marca", car.brand],
              ["Modelo", car.model],
              ["Ano", String(car.year)],
              ["Combustível", car.fuel || "—"],
            ].map(([label, value]) => (
              <div key={label} className="border-t-2 border-dashed border-tracejado pt-2">
                <dt className="t-mono-rotulo">{label}</dt>
                <dd className="t-body mt-1">{value}</dd>
              </div>
            ))}
            <div className="border-t-2 border-dashed border-tracejado pt-2">
              <dt className="t-mono-rotulo">Preço de referência</dt>
              <dd className="t-mono-dado mt-1 text-[18px]">{formatBRL(car.referencePriceCents)}</dd>
            </div>
          </dl>
          <p className="t-mono-rotulo mt-6">FONTE: TABELA FIPE · {formatReferenceMonth(car.referenceMonth)}</p>
        </section>

        <section aria-label="Painel do lote" className="min-w-0" style={{ flex: "1 1 440px", maxWidth: 560 }}>
          <div className="flex flex-wrap items-center gap-4 pt-6">
            <LotTag number={lot.number} tone={ended || status === "CANCELLED" ? "papel" : "ocre"} />
            {status === "LIVE" ? <Stamp variant="ao-vivo" /> : null}
          </div>
          <h1 className="font-display mt-6 font-black uppercase" style={{ fontSize: "clamp(48px, 7vw, 104px)", lineHeight: 0.84 }}>
            {lot.title}
          </h1>
          <div className="mt-8">{panel}</div>
        </section>
      </div>
    </>,
  );
}
