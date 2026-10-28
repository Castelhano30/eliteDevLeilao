"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBRL, type LedgerEntryDto } from "@lanceauto/shared";
import { BarraDePaginas } from "@/components/ui/barra-de-paginas";
import { buttonClasses } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FeedbackState } from "@/components/ui/feedback-state";
import { EXTRATO_POR_PAGINA, filtrarPorPeriodo } from "@/lib/extrato";
import { paginar } from "@/lib/paginacao";
import { describeMovement, formatWhen, lotNumberLabel } from "@/lib/format";
import { FiltrarExtrato } from "./filtrar-extrato";

const COLUMNS: DataTableColumn<LedgerEntryDto>[] = [
  { key: "quando", header: "Quando", render: (row) => formatWhen(row.createdAt) },
  {
    key: "movimento",
    header: "Movimento",
    render: (row) => {
      const { label, note } = describeMovement(row);
      return (
        <>
          <span className="block text-[15px] font-bold leading-[1.3]">{label}</span>
          {note ? <span className="t-mono-rotulo-pequeno block">{note}</span> : null}
        </>
      );
    },
  },
  {
    key: "lote",
    header: "Lote",
    render: (row) =>
      row.lotId ? (
        <Link href={`/lotes/${row.lotId}`} className="inline-flex min-h-alvo min-w-alvo items-center">
          {row.lotNumber === null ? "Lote" : `Lote ${lotNumberLabel(row.lotNumber)}`}
        </Link>
      ) : (
        "—"
      ),
  },
  { key: "valor", header: "Valor", align: "right", render: (row) => describeMovement(row).value },
  {
    key: "disponivel",
    header: "Disponível após",
    align: "right",
    render: (row) => formatBRL(row.totalAfterCents - row.committedAfterCents),
  },
];

const movimentos = (n: number) => `${n} ${n === 1 ? "movimentação" : "movimentações"}`;

/**
 * Extrato da carteira: filtro por período (botão Filtrar; dias em horário de Brasília) e dez movimentos por página.
 * Recebe o extrato inteiro, do mais novo para o mais antigo; quem filtra e fatia é a tela.
 */
export function ExtratoCarteira({ entries }: { entries: readonly LedgerEntryDto[] }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [page, setPage] = useState(0);

  // Movimento novo no topo (um depósito, por exemplo): volta à primeira página, onde ele aparece.
  const newest = entries[0]?.id ?? null;
  const [seenNewest, setSeenNewest] = useState(newest);
  if (newest !== seenNewest) {
    setSeenNewest(newest);
    setPage(0);
  }

  const filtrado = filtrarPorPeriodo(entries, de, ate);
  const { items, atual, paginas } = paginar(filtrado, page, EXTRATO_POR_PAGINA);
  const filtrando = de !== "" || ate !== "";

  const clear = () => {
    setDe("");
    setAte("");
    setPage(0);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <FiltrarExtrato
          de={de}
          ate={ate}
          onApply={(novoDe, novoAte) => {
            setDe(novoDe);
            setAte(novoAte);
            setPage(0);
          }}
          onClear={clear}
        />
        <p className="t-mono-dado" aria-live="polite">
          {movimentos(filtrado.length)}
        </p>
      </div>

      {filtrado.length === 0 ? (
        <FeedbackState variant="vazio">
          Nenhuma movimentação neste período.
          {filtrando ? (
            <span className="mt-4 block">
              <button type="button" className={buttonClasses("secundario")} onClick={clear}>
                Limpar filtro
              </button>
            </span>
          ) : null}
        </FeedbackState>
      ) : (
        <>
          <DataTable caption="Extrato da carteira" captionHidden columns={COLUMNS} rows={items} rowKey={(row) => row.id} minWidth={560} />
          <BarraDePaginas label="Páginas do extrato" atual={atual} paginas={paginas} onChange={setPage} className="mt-4" />
        </>
      )}
    </>
  );
}
