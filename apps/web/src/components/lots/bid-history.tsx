"use client";

import { useState } from "react";
import { BID_TEXT, formatBRL, type BidDTO } from "@lanceauto/shared";
import { clockTime } from "@/lib/format";
import { bidCountLabel } from "@/lib/lots";
import { ChipLicitante } from "./chip-licitante";

export interface BidHistoryProps {
  bids: BidDTO[];
  /** Meu pseudônimo neste lote, para marcar VOCÊ. `null` para visitante e leiloeiro. */
  myPseudonym: string | null;
}

/**
 * Histórico de lances (§9.5): mais novo primeiro. Não é região live: o placar anuncia a mudança de situação.
 * A linha que chega depois da primeira pintura entra com `la-entra` e o flash `la-marca`.
 */
export function BidHistory({ bids, myPseudonym }: BidHistoryProps) {
  // Só a linha que aparece depois da primeira pintura anima; a carga inicial entra parada.
  const [baseline] = useState(() => bids[0]?.seq ?? 0);
  return (
    <section aria-labelledby="historico-lances">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="historico-lances" className="t-cartaz-subtitulo">
          Histórico de lances
        </h2>
        <span className="t-mono-dado">{bidCountLabel(bids.length)}</span>
      </div>
      {bids.length === 0 ? (
        <p className="t-body-nota">{BID_TEXT.noBidsYet}</p>
      ) : (
        <ol className="space-y-2">
          {bids.map((bid) => (
            <li
              key={bid.seq}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-dashed border-tracejado pt-2"
              style={bid.seq > baseline ? { animation: "la-entra 0.4s both, la-marca 1.7s both" } : undefined}
            >
              <span className="t-mono-dado w-12 shrink-0">Nº {bid.seq}</span>
              <ChipLicitante name={bid.pseudonym} mine={myPseudonym !== null && bid.pseudonym === myPseudonym} />
              <span className="ml-auto text-[16px] font-bold leading-[1.3]">{formatBRL(bid.amountCents)}</span>
              <time dateTime={bid.at} className="t-mono-dado font-normal text-tinta2">
                {clockTime(bid.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
