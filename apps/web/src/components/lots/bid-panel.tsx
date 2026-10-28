"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBRL, type LotState } from "@lanceauto/shared";
import { Cronometro } from "@/components/lots/cronometro";
import { PlacaLance } from "@/components/lots/placa-lance";
import { Button, buttonClasses } from "@/components/ui/button";
import { clockTime } from "@/lib/format";
import { decideLotResult } from "@/lib/lot-result";
import { situationText, type Viewer } from "@/lib/lot-state";
import type { BidBlockReason } from "@/lib/realtime/connection-status";
import { isHammered, panelSituation } from "@/lib/realtime/panel-decisions";
import { bidCountLabel } from "@/lib/lots";
import { useServerNow } from "@/lib/use-server-clock";
import { BidForm } from "./bid-form";
import { BidHistory } from "./bid-history";
import { FaixaStatus } from "./faixa-status";
import { PlacarPosicao } from "./placar-posicao";
import { ResultadoDoLote } from "./resultado-do-lote";

export interface BidPanelProps {
  id: string;
  state: LotState;
  /** `null` = visitante. */
  viewer: Viewer;
  /** A sessão ainda está sendo lida: não decide entre formulário e convite. */
  authLoading: boolean;
  /** Sem conexão ou com o estado desatualizado: o botão de lance fica inerte. */
  blockReason: BidBlockReason | null;
}

/**
 * Painel de lance da Sala (§9.1): cronômetro, placa, faixa de situação (única região `aria-live`), formulário
 * ou convite, e histórico. Só o `status` do servidor decide: o relógio local em 00:00 apenas bloqueia o envio
 * enquanto a Sala confere o resultado. Depois do martelo o mesmo painel segue montado e mostra o resultado
 * (S05 §9.1): a região viva é a mesma, então a mudança de situação é anunciada.
 */
export function BidPanel({ id, state, viewer, authLoading, blockReason }: BidPanelProps) {
  const { lot } = state;
  const now = useServerNow(state.serverTime);
  const hammered = isHammered(lot, now);
  const situation = panelSituation(lot, viewer, now);
  const result = decideLotResult(lot, viewer);
  const finished = result !== null && result.kind !== "apurando";
  const hasBid = lot.currentBidCents !== null;
  const extended = lot.status === "LIVE" && Date.parse(lot.endsAt) > Date.parse(lot.originalEndsAt);

  // O carimbo só "bate" se esta sessão viu o lote ainda sem resultado (estado derivado no render, sem efeito).
  const [sawOpen, setSawOpen] = useState(false);
  if (!sawOpen && !finished && lot.status !== "CANCELLED") setSawOpen(true);

  let band = null;
  if (finished) {
    band = <FaixaStatus tone={result.kind === "arrematou" ? "verde" : "neutra"} title={result.band.title} sub={result.band.sub} />;
  } else if (situation) {
    const text = situationText(situation);
    band =
      situation.kind === "winning" || situation.kind === "outbid" ? (
        <PlacarPosicao tone={situation.kind === "winning" ? "verde" : "ferrugem"} title={text.title} sub={text.sub} />
      ) : (
        <FaixaStatus title={text.title} sub={text.sub || undefined} />
      );
  }

  let action = null;
  if (hammered || finished) {
    action = <Button variant="desabilitado" size="sala">Lote fechado</Button>;
  } else if (authLoading) {
    action = <p className="t-body-nota min-h-[120px]">Carregando…</p>;
  } else if (situation?.kind === "visitor") {
    action = (
      <div className="space-y-3">
        <Link href={`/entrar?next=/lotes/${id}`} className={buttonClasses("primario", false, "sala")}>
          Entre para dar lances
        </Link>
        <p className="t-body-nota">
          Assistir é de graça e sem cadastro. Para disputar, crie uma conta e deposite saldo simulado. Mínimo aceito agora:{" "}
          {formatBRL(situation.minimumCents)}.
        </p>
      </div>
    );
  } else if (situation && (situation.kind === "winning" || situation.kind === "outbid" || situation.kind === "none")) {
    action = <BidForm id={id} lot={lot} situation={situation} blockReason={blockReason} />;
  }

  return (
    <div className="space-y-6 rounded-2xl border border-borda bg-papel p-6 shadow-cartao">
      <div>
        <Cronometro
          size="sala"
          status={lot.status}
          startsAt={lot.startsAt}
          endsAt={lot.endsAt}
          originalEndsAt={lot.originalEndsAt}
          serverTime={state.serverTime}
        />
        {extended ? (
          <p className="t-body-nota mt-3">
            Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às <span>{clockTime(lot.endsAt)}</span>. Ninguém leva
            no susto.
          </p>
        ) : null}
        {/* Só esta região anuncia a prorrogação (a cada novo fim); o parágrafo acima é para quem enxerga. */}
        <p className="sr-only" aria-live="polite">
          {extended ? `Prorrogado. Novo fim às ${clockTime(lot.endsAt)}.` : ""}
        </p>
      </div>
      <div className="space-y-2">
        <PlacaLance cents={lot.currentBidCents ?? lot.startingBidCents} label={finished && hasBid ? "LANCE FINAL" : hasBid ? "LANCE ATUAL" : "LANCE INICIAL"} />
        <p className="t-mono-dado">{bidCountLabel(lot.bidCount)}</p>
      </div>
      <div aria-live="polite">{band}</div>
      {finished ? <ResultadoDoLote view={result} lotNumber={lot.number} animate={sawOpen} /> : null}
      {action}
      <BidHistory bids={state.bids} myPseudonym={lot.myPseudonym} />
    </div>
  );
}
