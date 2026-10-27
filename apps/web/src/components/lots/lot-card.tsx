"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { brasiliaDayAndTime, brasiliaWeekday, formatBRL, type LotCard as LotCardDto, type MyLotResult } from "@lanceauto/shared";
import { LotTag } from "@/components/ui/lot-tag";
import { Stamp } from "@/components/ui/stamp";
import { bidsText, endedCardLines } from "@/lib/ended-card";
import { lotCardHref, opensLabel } from "@/lib/lots";
import { CarPhoto } from "./car-photo";
import { Cronometro } from "./cronometro";

export interface LotCardProps {
  card: LotCardDto;
  serverTime?: string;
  /** Prévia do Criar lote: `div` não clicável, etiqueta "NOVO" e foto pela URL digitada. */
  preview?: boolean;
  /** Na prévia sem carro: texto em vez do rodapé. */
  emptyNote?: string;
  /** Painel do leiloeiro: resultado do lote encerrado (quem levou, valor e FIPE) no lugar do rodapé genérico. */
  resultado?: MyLotResult | null;
}

const ROTATE = { LIVE: -4, CLOSING: -4, SCHEDULED: 3, SOLD: -2, UNSOLD: -2, CANCELLED: -2 } as const;

/** Cartão do lote (§10.1). O cartão inteiro é o link; o nome acessível é o título. */
export function LotCard({ card, serverTime, preview = false, emptyNote, resultado }: LotCardProps) {
  const titleId = useId();
  const { status } = card;
  const live = status === "LIVE" || status === "CLOSING";
  const ended = status === "SOLD" || status === "UNSOLD";
  const validStart = !Number.isNaN(Date.parse(card.startsAt));
  const meta = preview && !card.year ? "— · — · FIPE —" : `${card.year} · ${card.fuel} · FIPE ${formatBRL(card.referencePriceCents)}`;

  let footer: ReactNode;
  if (emptyNote) {
    footer = <p className="t-body-nota">{emptyNote}</p>;
  } else if (live) {
    footer = (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-mono-rotulo">{card.currentBidCents === null ? "LANCE INICIAL" : "LANCE ATUAL"}</p>
          <p className="text-[20px] break-all font-extrabold">{formatBRL(card.currentBidCents ?? card.startingBidCents)}</p>
          <p className="t-mono mt-1 text-tinta2">{status === "CLOSING" ? "Apurando o resultado…" : bidsText(card.bidCount)}</p>
        </div>
        <Cronometro
          size="cartao"
          status={status}
          startsAt={card.startsAt}
          endsAt={card.endsAt}
          originalEndsAt={card.originalEndsAt}
          serverTime={serverTime}
        />
      </div>
    );
  } else if (status === "SCHEDULED") {
    const { day, time } = validStart ? brasiliaDayAndTime(card.startsAt) : { day: "—", time: "—" };
    footer = (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-mono-rotulo">LANCE INICIAL</p>
          <p className="text-[20px] break-all font-extrabold">{formatBRL(card.startingBidCents)}</p>
          <p className="t-mono mt-1 text-tinta2">incremento {formatBRL(card.minIncrementCents)}</p>
        </div>
        <div className="border-2 border-linha bg-papel px-3 py-2 text-center">
          <p className="t-mono-rotulo-pequeno">ABERTURA</p>
          <p className="text-[26px] font-extrabold leading-none">
            {validStart ? brasiliaWeekday(card.startsAt).toUpperCase() : ""} {day}
          </p>
          <p className="t-mono-dado">{time}</p>
        </div>
      </div>
    );
  } else {
    const lines = endedCardLines(resultado, card.bidCount);
    footer = (
      <div>
        <p className="t-mono-rotulo">RESULTADO</p>
        {lines?.kind === "sold" ? (
          <>
            <p className="t-mono mt-1">{lines.headline}</p>
            <p className="text-[22px] font-extrabold">{lines.value}</p>
            <p className="t-mono text-tinta2">{lines.bids}</p>
            {lines.fipe ? <p className="t-mono mt-1 text-tinta2">{lines.fipe}</p> : null}
          </>
        ) : lines ? (
          <p className="t-mono mt-1">{lines.headline}</p>
        ) : (
          <p className="t-mono mt-1">
            {status === "SOLD" && card.currentBidCents !== null
              ? `${formatBRL(card.currentBidCents)} · ${bidsText(card.bidCount)}`
              : status === "SOLD"
                ? "Arrematado"
                : "Sem lances"}
          </p>
        )}
      </div>
    );
  }

  const body = (
    <>
      {/* Faixa própria: a etiqueta fica fora da foto e o carimbo/chip de data ao lado dela, sem cobrir nada. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 px-4 pt-1">
        <LotTag number={preview ? "NOVO" : card.number} tone={ended ? "papel" : "ocre"} rotate={ROTATE[status]} size="compacto" />
        {live && status === "LIVE" ? <Stamp variant="ao-vivo" size="pequeno" className="mr-1 mt-4 bg-papel" /> : null}
        {status === "SCHEDULED" ? (
          <span className="t-mono mt-4 border-2 border-linha bg-papel px-2 py-1 text-[12px]">
            {validStart ? opensLabel(card.startsAt) : "ABRE —"}
          </span>
        ) : null}
      </div>
      <div className="relative">
        <CarPhoto imageUrl={card.imageUrl} title={card.title} size="cartao" dimmed={ended} noReferrer={preview} />
        {ended ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Stamp variant={status === "SOLD" ? "arrematado" : "sem-lances"} size="pequeno" className="max-w-[calc(100%-24px)] justify-center bg-papel" />
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <h3 id={titleId} className="text-[26px] font-bold uppercase leading-none [overflow-wrap:anywhere]">
          {card.title}
        </h3>
        <p className="mt-2 text-[13px] text-tinta2">{meta}</p>
        <div className="my-4 border-t-2 border-dashed border-tracejado" />
        {footer}
      </div>
    </>
  );

  const shell = "relative block rounded-nenhum border-2 border-linha bg-papel text-tinta no-underline shadow-cartao";
  if (preview) return <div className={shell}>{body}</div>;
  return (
    <Link href={lotCardHref(card)} aria-labelledby={titleId} className={`${shell} hover:!text-tinta`}>
      {body}
    </Link>
  );
}
