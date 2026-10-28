import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LedgerEntryDto } from "@lanceauto/shared";
import { ExtratoCarteira } from "./extrato-carteira";

const entry = (n: number): LedgerEntryDto => ({
  id: `e${n}`,
  kind: "DEPOSIT",
  amountCents: n * 100_000,
  lotId: null,
  lotNumber: null,
  totalAfterCents: n * 100_000,
  committedAfterCents: 0,
  createdAt: "2026-10-28T15:00:00.000Z",
});
const many = (n: number) => Array.from({ length: n }, (_, i) => entry(n - i));
const render = (entries: LedgerEntryDto[]) => renderToStaticMarkup(<ExtratoCarteira entries={entries} />);
/** Linhas do corpo da tabela, sem o cabeçalho. */
const bodyRows = (html: string) => (html.split("<tbody")[1]?.match(/<tr /g) ?? []).length;

describe("ExtratoCarteira", () => {
  it("mais de dez movimentos: dez linhas, contagem total e a barra de páginas", () => {
    const html = render(many(23));
    expect(bodyRows(html)).toBe(10);
    expect(html).toContain("23 movimentações");
    expect(html).toContain("Página 1 de 3");
    // `disabled=""` é o atributo; as classes `disabled:…` do botão não contam.
    expect(html).toMatch(/<button[^>]* disabled=""[^>]*>Anterior/);
    expect(html).not.toMatch(/<button[^>]* disabled=""[^>]*>Próxima/);
  });

  it("até dez movimentos: sem barra de páginas", () => {
    const html = render(many(10));
    expect(bodyRows(html)).toBe(10);
    expect(html).not.toContain("Páginas do extrato");
    expect(render(many(1))).toContain("1 movimentação<");
  });

  it("os campos De e Até são datas e não há 'Limpar filtro' sem filtro", () => {
    const html = render(many(3));
    expect(html.match(/type="date"/g)).toHaveLength(2);
    expect(html).not.toContain("Limpar filtro");
  });
});
