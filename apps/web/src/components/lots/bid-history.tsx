"use client";

import { useState } from "react";
import { BID_TEXT, formatBRL, type BidDTO } from "@lanceauto/shared";
import { buttonClasses } from "@/components/ui/button";
import { clockTime } from "@/lib/format";
import { bidCountLabel } from "@/lib/lots";
import { ChipLicitante } from "./chip-licitante";

/** Lances por página: o resto fica nas páginas seguintes, para o painel não crescer sem fim. */
export const BIDS_PER_PAGE = 5;

export interface BidHistoryProps {
  bids: BidDTO[];
  /** Meu pseudônimo neste lote, para marcar VOCÊ. `null` para visitante e leiloeiro. */
  myPseudonym: string | null;
}

/**
 * Histórico de lances (§9.5): mais novo primeiro, cinco por página. Não é região live: o placar anuncia a mudança de situação.
 * A linha que chega depois da primeira pintura entra com `la-entra` e o flash `la-marca`.
 */
export function BidHistory({ bids, myPseudonym }: BidHistoryProps) {
  // Só a linha que aparece depois da primeira pintura anima; a carga inicial entra parada.
  const [baseline] = useState(() => bids[0]?.seq ?? 0);
  // Um lance novo entra no topo da página 1 e empurra os demais; quem está em outra página fica nela.
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(bids.length / BIDS_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const visible = bids.slice(current * BIDS_PER_PAGE, (current + 1) * BIDS_PER_PAGE);
  return (
    <section aria-labelledby="historico-lances">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="historico-lances" className="text-[20px] font-extrabold leading-tight">
          Histórico de lances
        </h2>
        <span className="t-mono-dado">{bidCountLabel(bids.length)}</span>
      </div>
      {bids.length === 0 ? (
        <p className="t-body-nota">{BID_TEXT.noBidsYet}</p>
      ) : (
        <ol>
          {visible.map((bid) => (
            <li
              key={bid.seq}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-borda py-3"
              style={bid.seq > baseline ? { animation: "la-entra 0.4s both, la-marca 1.7s both" } : undefined}
            >
              <span className="t-mono-dado w-12 shrink-0">Nº {bid.seq}</span>
              <ChipLicitante name={bid.pseudonym} mine={myPseudonym !== null && bid.pseudonym === myPseudonym} />
              <span className="ml-auto text-[16px] font-bold leading-[1.3] tabular-nums">{formatBRL(bid.amountCents)}</span>
              <time dateTime={bid.at} className="t-mono-dado font-normal text-tinta2">
                {clockTime(bid.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {pages > 1 ? (
        <nav aria-label="Páginas do histórico" className="mt-3 flex items-center justify-between gap-3 border-t border-borda pt-3">
          <button type="button" className={buttonClasses("secundario", false, "compacto")} disabled={current === 0} onClick={() => setPage(current - 1)}>
            Anterior
          </button>
          <span className="t-mono-dado">
            Página {current + 1} de {pages}
          </span>
          <button type="button" className={buttonClasses("secundario", false, "compacto")} disabled={current === pages - 1} onClick={() => setPage(current + 1)}>
            Próxima
          </button>
        </nav>
      ) : null}
    </section>
  );
}
