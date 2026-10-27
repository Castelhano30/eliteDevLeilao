import type { ReactNode } from "react";
import { AUDIT_TEXT, formatBRL, formatLotNumber, type AuditRowDto, type AuditView } from "@lanceauto/shared";
import { DataTable, type DataTableColumn, type RowAccent } from "@/components/ui/data-table";
import { bidderCell, lineNumber, rowStatusView, rowTimeLabel } from "@/lib/audit-view";
import { HashCell } from "./hash-cell";
import { RowStatusBadge } from "./row-status";

/** Borda esquerda de 6 px na cor do veredito da linha; fundo `falha` só na que não confere. */
export function rowAccentOf(row: Pick<AuditRowDto, "status">): RowAccent {
  const view = rowStatusView(row.status);
  return {
    borderColor: view.border === "verde" ? "var(--c-verde)" : "var(--c-ferrugem)",
    background: view.highlight ? "var(--c-falha)" : undefined,
  };
}

/**
 * Elo quebrado esmaece os dados da linha a 85%. A coluna Situação não esmaece: `ferrugem` a 85% cai para 4,3:1 no
 * claro e 3,8:1 na noite, abaixo do piso de 4,5:1 (S08 §9).
 */
function Fade({ row, children }: { row: AuditRowDto; children: ReactNode }) {
  return rowStatusView(row.status).faded ? (
    <span className="block" style={{ opacity: 0.85 }}>
      {children}
    </span>
  ) : (
    <>{children}</>
  );
}

/** A corrente do lote, linha a linha (S08 §9). `verifying`: a coluna Situação mostra "…" até o novo veredito. */
export function AuditTable({ view, verifying }: { view: AuditView; verifying: boolean }) {
  const hadBids = view.lot.bidCount > 0;
  const columns: DataTableColumn<AuditRowDto>[] = [
    { key: "seq", header: AUDIT_TEXT.columns.seq, render: (row) => <Fade row={row}><span className="t-mono-dado">{lineNumber(row.seq)}</span></Fade> },
    {
      key: "bidder",
      header: AUDIT_TEXT.columns.bidder,
      render: (row) => {
        const cell = bidderCell(row, hadBids);
        if (cell.kind === "cancel") {
          return (
            <Fade row={row}>
              <span className="block">
                <span className="text-[15px] font-extrabold uppercase">{cell.label}</span>
                {cell.note ? <span className="t-body-nota mt-1 block">{cell.note}</span> : null}
              </span>
            </Fade>
          );
        }
        return (
          <Fade row={row}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="t-mono-dado">{cell.pseudonym}</span>
              {cell.mine ? <span className="border-2 border-linha bg-ocre px-2 text-[12px] font-semibold text-sobreOcre">{AUDIT_TEXT.mine}</span> : null}
            </span>
          </Fade>
        );
      },
    },
    {
      key: "amount",
      header: AUDIT_TEXT.columns.amount,
      align: "right",
      render: (row) => (
        <Fade row={row}>{row.kind === "BID" && row.amountCents !== null ? <span className="t-mono-dado whitespace-nowrap font-semibold">{formatBRL(row.amountCents)}</span> : "—"}</Fade>
      ),
    },
    {
      key: "at",
      header: AUDIT_TEXT.columns.at,
      render: (row) => (
        <Fade row={row}>
          <time className="t-mono-dado whitespace-nowrap" dateTime={row.at} title={row.at}>
            {rowTimeLabel(row.at)}
          </time>
        </Fade>
      ),
    },
    {
      key: "hash",
      header: AUDIT_TEXT.columns.hash,
      render: (row) => (
        <Fade row={row}>
          <HashCell id={`hash-${row.seq}`} hash={row.hash} what={`da linha ${lineNumber(row.seq)}`} />
        </Fade>
      ),
    },
    {
      key: "status",
      header: AUDIT_TEXT.columns.status,
      render: (row) => (verifying ? <span className="t-mono-dado text-tinta2">…</span> : <RowStatusBadge status={row.status} />),
    },
  ];
  return (
    <DataTable
      caption={`Histórico de lances do lote ${formatLotNumber(view.lot.number)}`}
      captionHidden
      columns={columns}
      rows={view.entries}
      rowKey={(row) => String(row.seq)}
      minWidth={780}
      rowAccent={rowAccentOf}
    />
  );
}
