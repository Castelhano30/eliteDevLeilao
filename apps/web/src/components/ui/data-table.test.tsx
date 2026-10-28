import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";

type Row = { a: string; valor: string };
const columns = [
  { key: "a", header: "Tipo", render: (row: Row) => row.a },
  { key: "b", header: "Valor", align: "right" as const, render: (row: Row) => row.valor },
];
const rows: Row[] = [{ a: "Depósito", valor: "R$ 1,00" }, { a: "Lance", valor: "R$ 2,00" }];
const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const render = (props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) =>
  renderToStaticMarkup(<DataTable caption="Extrato" captionHidden columns={columns} rows={rows} rowKey={(row) => row.a} {...props} />);

describe("DataTable (DESIGN 4.8)", () => {
  const html = render();

  it("a região rolável é o cartão: papel, fio borda, rounded-xl, nível 1, focável e com nome", () => {
    expect(html).toMatch(/^<div class="tabela-dados"><div role="region" tabindex="0" aria-label="Extrato" class="tabela-regiao relative overflow-x-auto rounded-xl border border-borda bg-papel shadow-cartao">/);
    expect(html).not.toMatch(/rounded-nenhum|border-\[3px\]|border-linha|border-dashed|border-tracejado/);
  });

  it("a legenda escondida fica dentro da região rolável (relative): ela não alarga mais a página", () => {
    expect(html).toContain('<caption class="sr-only">Extrato</caption>');
    expect(html.indexOf("relative overflow-x-auto")).toBeLessThan(html.indexOf("sr-only"));
  });

  it("cabeçalho suave com 12px/700 em caixa-alta tinta2, tracking .06em, 12px 16px e th scope=col", () => {
    expect(html).toContain('<tr role="row" class="bg-suave">');
    expect(html.match(/scope="col"/g)).toHaveLength(2);
    expect(html).toContain("px-4 py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-tinta2");
  });

  it("linhas de fio sólido de 1px com 14px 16px de respiro e sem hover (as linhas não são clicáveis)", () => {
    expect(html.match(/<tr role="row" class="border-t border-borda"/g)).toHaveLength(2);
    expect(html).toContain("px-4 py-[14px]");
    expect(html).not.toContain("hover:");
  });

  it("números à direita em tabular-nums; o texto à esquerda não", () => {
    expect(html).toMatch(/<th [^>]*text-right"/);
    expect(html).toContain("text-right tabular-nums");
    expect(html).toMatch(/<td role="cell" data-label="Tipo" class="px-4 py-\[14px\] text-left">Depósito<\/td>/);
  });

  it("min-width configurável e legenda visível quando pedida", () => {
    expect(render({ minWidth: 760 })).toContain("--tabela-min:760px");
    expect(render({ captionHidden: false })).toContain('<caption class="px-4 py-3 text-left text-[16px] font-extrabold">Extrato</caption>');
  });

  it("realce por linha: faixa de 4px à esquerda na primeira célula e fundo na linha", () => {
    const accent = render({ rowAccent: (row) => (row.a === "Lance" ? { borderColor: "var(--c-ferrugem)", background: "var(--c-falha)" } : undefined) });
    expect(accent.match(/data-acento/g)).toHaveLength(1);
    expect(accent).toContain("--acento-cor:var(--c-ferrugem)");
    expect(accent).toContain("background:var(--c-falha)");
    expect(css).toMatch(/tr\[data-acento\] > td:first-child \{ box-shadow: inset 4px 0 0 var\(--acento-cor\)/);
  });

  it("cada célula leva o rótulo da coluna e a tabela mantém os papéis de tabela (o CSS troca o display no celular)", () => {
    expect(html).toContain('data-label="Valor"');
    expect(html).toContain('<table role="table"');
    expect(html).toContain('role="rowgroup"');
    expect(html).toContain('role="columnheader"');
  });

  it("bloco estreito: as linhas viram cartões, sem rolagem lateral e sem largura mínima", () => {
    expect(css).toMatch(/\.tabela-dados \{ container-type: inline-size; \}/);
    const query = css.slice(css.indexOf("@container (max-width: 51.99rem)"));
    expect(query).toMatch(/\.tabela-regiao \{ overflow: visible;/);
    expect(query).toMatch(/\.tabela-regiao > table,[^{]*\{ display: block; min-width: 0; \}/);
    expect(query).toContain("content: attr(data-label)");
  });

  it("a tabela mais larga (780px) cabe no ponto em que o bloco deixa de virar cartão (52rem = 832px)", () => {
    expect(52 * 16).toBeGreaterThan(780);
  });
});
