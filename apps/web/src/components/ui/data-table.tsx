import type { ReactNode } from "react";

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
 * Cabeçalho `suave` com 12px/700 em caixa-alta, linhas de fio de 1px com 14px 16px de respiro e `th scope="col"`.
 * `relative` prende o `sr-only` da legenda dentro da região: sem ele a legenda escapava do recorte e alargava a página.
 */
export function DataTable<Row>({ caption, captionHidden = false, columns, rows, rowKey, minWidth = 560, rowAccent }: DataTableProps<Row>) {
  return (
    <div role="region" tabIndex={0} aria-label={caption} className="relative overflow-x-auto rounded-xl border border-borda bg-papel shadow-cartao">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <caption className={captionHidden ? "sr-only" : "px-4 py-3 text-left text-[16px] font-extrabold"}>{caption}</caption>
        <thead>
          <tr className="bg-suave">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-tinta2 ${column.align === "right" ? "text-right" : "text-left"}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const accent = rowAccent?.(row);
            return (
              <tr key={rowKey(row)} className="border-t border-borda" style={accent ? { background: accent.background } : undefined}>
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={`px-4 py-[14px] ${column.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                    // A faixa esquerda de 4px é uma sombra interna: a borda de <tr> não é confiável com border-collapse.
                    style={accent && index === 0 ? { boxShadow: `inset 4px 0 0 ${accent.borderColor}` } : undefined}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
