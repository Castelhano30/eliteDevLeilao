"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { brasiliaDayAndTime, brasiliaWeekday, formatBRL, type LotCard as LotCardDto, type MyLotResult } from "@lanceauto/shared";
import { LotTag } from "@/components/ui/lot-tag";
import { Stamp, type StampVariant } from "@/components/ui/stamp";
import { bidsText, endedCardLines } from "@/lib/ended-card";
import { countdownState, lotCardHref } from "@/lib/lots";
import { useServerNow } from "@/lib/use-server-clock";
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

// Classes literais, para o Tailwind gerá-las. Casco: 16px de raio, fio `borda`, nível 1. O cartão clicável sobe 2px no hover (só sem
// `prefers-reduced-motion`), vai ao nível 2 e troca a borda; pressionado volta à posição. A prévia (`div`) não reage a nada.
const SHELL = "relative flex h-full flex-col overflow-hidden rounded-2xl border border-borda bg-papel text-tinta no-underline shadow-cartao";
const INTERACTIVE =
  "transition-[transform,box-shadow,border-color] duration-200 ease-out motion-safe:hover:-translate-y-0.5 hover:border-cartaoHover hover:shadow-painel hover:!text-tinta motion-safe:active:translate-y-0 active:shadow-cartao";

/** Relógio de 14px do "Apurando o resultado…": o aviso não vai só por cor. */
function ClockGlyph() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Rótulo, lance em destaque (28px/800) e a linha de apoio: o bloco da esquerda do rodapé. */
function BidBlock({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="t-rotulo-cartao">{label}</p>
      <p className="t-lance-cartao mt-1 break-all">{value}</p>
      {children}
    </div>
  );
}

/** Cartão do lote (§10.1, DESIGN 4.6). O cartão inteiro é o link; o nome acessível é o título. Foto (com etiqueta e selo por cima) e corpo, de cima para baixo. */
export function LotCard({ card, serverTime, preview = false, emptyNote, resultado }: LotCardProps) {
  const titleId = useId();
  const now = useServerNow(serverTime);
  const { status } = card;
  const live = status === "LIVE" || status === "CLOSING";
  const ended = status === "SOLD" || status === "UNSOLD";
  const validStart = !Number.isNaN(Date.parse(card.startsAt));
  const meta = preview && !card.year ? "— · — · FIPE —" : `${card.year} · ${card.fuel} · FIPE ${formatBRL(card.referencePriceCents)}`;

  // O selo acompanha o relógio: nos últimos 2 min ou prorrogado ele fica âmbar, com o mesmo texto "Ao vivo" (só leitura, sem regra nova).
  const clock = countdownState({ status, startsAt: card.startsAt, endsAt: card.endsAt, originalEndsAt: card.originalEndsAt }, now);
  const closing = status === "LIVE" && now > 0 && clock.variant !== "encerrado" && (clock.variant === "ultimos" || clock.extended);

  let seal: ReactNode = null;
  // Agendado não tem selo: a data de abertura já está na caixa ABERTURA do rodapé.
  if (status === "LIVE") seal = <Stamp variant={closing ? "encerrando" : "ao-vivo"} size="pequeno" />;
  else if (status === "SOLD" || status === "UNSOLD" || status === "CANCELLED") {
    const variant: StampVariant = status === "SOLD" ? "arrematado" : status === "UNSOLD" ? "sem-lances" : "cancelado";
    seal = <Stamp variant={variant} size="pequeno" />;
  }

  let footer: ReactNode;
  if (emptyNote) {
    footer = <p className="t-body-nota">{emptyNote}</p>;
  } else if (live) {
    footer = (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <BidBlock label={card.currentBidCents === null ? "LANCE INICIAL" : "LANCE ATUAL"} value={formatBRL(card.currentBidCents ?? card.startingBidCents)}>
          {status === "CLOSING" ? (
            <p className="t-meta-cartao mt-1 inline-flex items-center gap-1 !text-alerta">
              <ClockGlyph />
              Apurando o resultado…
            </p>
          ) : (
            <p className="t-meta-cartao mt-1">{bidsText(card.bidCount)}</p>
          )}
        </BidBlock>
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
        <BidBlock label="LANCE INICIAL" value={formatBRL(card.startingBidCents)}>
          <p className="t-meta-cartao mt-1">incremento {formatBRL(card.minIncrementCents)}</p>
        </BidBlock>
        <div className="rounded-xl border border-borda bg-suave px-3 py-2 text-center">
          <p className="t-rotulo-cartao">ABERTURA</p>
          <p className="mt-1 text-[22px] font-extrabold leading-none">
            {validStart ? brasiliaWeekday(card.startsAt).toUpperCase() : ""} {day}
          </p>
          <p className="mt-1 text-[14px] font-medium leading-none">{time}</p>
        </div>
      </div>
    );
  } else {
    const lines = endedCardLines(resultado, card.bidCount);
    footer = (
      <div>
        <p className="t-rotulo-cartao">RESULTADO</p>
        {lines?.kind === "sold" ? (
          <>
            <p className="t-mono mt-1">{lines.headline}</p>
            <p className="text-[24px] font-extrabold leading-tight tabular-nums">{lines.value}</p>
            <p className="t-meta-cartao">{lines.bids}</p>
            {lines.fipe ? <p className="t-meta-cartao mt-1">{lines.fipe}</p> : null}
          </>
        ) : lines ? (
          <p className="t-mono mt-1">{lines.headline}</p>
        ) : (
          <p className="t-mono mt-1">
            {status === "SOLD" && card.currentBidCents !== null
              ? `${formatBRL(card.currentBidCents)} · ${bidsText(card.bidCount)}`
              : status === "SOLD"
                ? "Arrematado"
                : status === "CANCELLED"
                  ? "Lote cancelado"
                  : "Sem lances"}
          </p>
        )}
      </div>
    );
  }

  const body = (
    <>
      {/* Foto no topo: herda os cantos do cartão. A etiqueta do lote (canto superior esquerdo) e o selo de status (canto superior direito)
          ficam por cima dela, depois da `figure` no DOM; cada um tem fundo sólido próprio, então a leitura não depende da foto. */}
      <div className="relative rounded-t-[inherit]">
        <CarPhoto imageUrl={card.imageUrl} title={card.title} size="cartao" dimmed={ended || status === "CANCELLED"} noReferrer={preview} />
        <span className="absolute left-2 top-1 z-10">
          <LotTag number={preview ? "NOVO" : card.number} tone={ended || status === "CANCELLED" ? "papel" : "ocre"} rotate={ROTATE[status]} size="compacto" />
        </span>
        {seal ? <span className="absolute right-3 top-3 z-10 max-w-[calc(100%-7rem)] drop-shadow-md">{seal}</span> : null}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <h3 id={titleId} className="t-titulo-cartao [overflow-wrap:anywhere]">
          {card.title}
        </h3>
        <p className="t-meta-cartao mb-4 mt-1">{meta}</p>
        <div className="mt-auto border-t border-borda pt-4">{footer}</div>
      </div>
    </>
  );

  if (preview) return <div className={SHELL}>{body}</div>;
  return (
    <Link href={lotCardHref(card)} aria-labelledby={titleId} className={`${SHELL} ${INTERACTIVE}`}>
      {body}
    </Link>
  );
}
