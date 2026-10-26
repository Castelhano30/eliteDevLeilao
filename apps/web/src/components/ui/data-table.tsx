import type { ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  /** Valores numéricos e de dinheiro ficam à direita. */
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
}

function edge(index: number, total: number): string {
  if (index === 0) return "pl-5 pr-2";
  if (index === total - 1) return "pl-2 pr-5";
  return "px-2";
}

/** Tabela com legenda e `th scope="col"`; a rolagem horizontal fica só dentro do contêiner. */
export function DataTable<Row>({ caption, captionHidden = false, columns, rows, rowKey, minWidth = 560 }: DataTableProps<Row>) {
  return (
    <div role="region" tabIndex={0} aria-label={caption} className="overflow-x-auto pb-2 pr-2">
      <table
        className="w-full border-collapse rounded-nenhum border-[3px] border-linha bg-papel shadow-cartao"
        style={{ minWidth }}
      >
        <caption className={captionHidden ? "sr-only" : "t-cartaz-subtitulo mb-3 text-left"}>{caption}</caption>
        <thead>
          <tr className="border-b-[3px] border-linha">
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                className={`py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-tinta2 ${
                  column.align === "right" ? "text-right" : "text-left"
                } ${edge(index, columns.length)}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t-2 border-dashed border-tracejado first:border-t-0">
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  className={`py-[14px] ${column.align === "right" ? "text-right" : "text-left"} ${edge(index, columns.length)}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
