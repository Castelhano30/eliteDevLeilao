import type { CSSProperties, ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  /** Valores numéricos e de dinheiro ficam à direita, em `tabular-nums`. */
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  /** Obrigatório: nomeia a região rolável e a tabela. */
  caption: string;
  /** Esconde a legenda quando o título já está na tela. */
  captionHidden?: boolean;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** `min-width` da tabela, em px (560 a 780). */
  minWidth?: number;
  /** Realce por linha: faixa de 4px à esquerda e fundo (a Auditoria usa para o veredito de cada linha). */
  rowAccent?: (row: Row) => RowAccent | undefined;
}

export interface RowAccent {
  /** Cor da faixa esquerda, como valor CSS (`var(--c-verde)`). */
  borderColor: string;
  background?: string;
}

/**
 * Tabela (DESIGN 4.8): a região rolável é o próprio cartão (`papel`, fio `borda`, `rounded-xl`, nível 1), focável e com nome.
 * Em bloco estreito (menos de 52rem, ver `.tabela-dados` em globals.css) as linhas viram cartões empilhados, cada célula com o
 * rótulo da coluna (`data-label`): no celular ninguém precisa descobrir uma rolagem lateral para achar o valor e as ações.
 * Os papéis ARIA explícitos mantêm a semântica de tabela quando o CSS troca o `display`.
 * Cabeçalho `suave` com 12px/700 em caixa-alta, linhas de fio de 1px com 14px 16px de respiro e `th scope="col"`.
 * `relative` prende o `sr-only` da legenda dentro da região: sem ele a legenda escapava do recorte e alargava a página.
 */
export function DataTable<Row>({ caption, captionHidden = false, columns, rows, rowKey, minWidth = 560, rowAccent }: DataTableProps<Row>) {
  return (
    <div className="tabela-dados">
      <div role="region" tabIndex={0} aria-label={caption} className="tabela-regiao relative overflow-x-auto rounded-xl border border-borda bg-papel shadow-cartao">
        <table role="table" className="w-full min-w-[var(--tabela-min)] border-collapse" style={{ "--tabela-min": `${minWidth}px` } as CSSProperties}>
          <caption className={captionHidden ? "sr-only" : "px-4 py-3 text-left text-[16px] font-extrabold"}>{caption}</caption>
          <thead>
            <tr role="row" className="bg-suave">
              {columns.map((column) => (
                <th
                  key={column.key}
                  role="columnheader"
                  scope="col"
                  className={`px-4 py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-tinta2 ${column.align === "right" ? "text-right" : "text-left"}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((row) => {
              const accent = rowAccent?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  role="row"
                  className="border-t border-borda"
                  // A faixa esquerda de 4px sai do CSS (`tr[data-acento]`): na tabela fica na primeira célula, no cartão, na borda esquerda dele.
                  data-acento={accent ? "" : undefined}
                  style={accent ? ({ background: accent.background, "--acento-cor": accent.borderColor } as CSSProperties) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} role="cell" data-label={column.header} className={`px-4 py-[14px] ${column.align === "right" ? "text-right tabular-nums" : "text-left"}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
