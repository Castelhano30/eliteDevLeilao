import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LotResultView } from "@/lib/lot-result";
import { ResultadoDoLote } from "./resultado-do-lote";

const TOKEN = "rmCOx9-zRVzAWbP8HWzNk6TAW9zgGZxC";

const arrematou: Extract<LotResultView, { kind: "arrematou" }> = {
  kind: "arrematou",
  band: { title: "Você arrematou", sub: "x" },
  sentence: "Você levou o Uno.",
  receiptToken: TOKEN,
  stamp: "arrematado",
  backToShowcase: false,
};

describe("ResultadoDoLote", () => {
  it("'Ver comprovante' abre o comprovante em outra guia, sem expor window.opener", () => {
    const html = renderToStaticMarkup(<ResultadoDoLote view={arrematou} lotNumber={3} animate={false} />);
    const link = /<a [^>]*href="\/c\/rmCOx9-zRVzAWbP8HWzNk6TAW9zgGZxC"[^>]*>/.exec(html)?.[0] ?? "";
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(html).toContain("(abre em outra guia)");
  });

  it("quem não venceu não recebe link de comprovante", () => {
    const html = renderToStaticMarkup(
      <ResultadoDoLote view={{ kind: "nao-venceu", band: { title: "Martelo batido", sub: "x" }, sentence: null, stamp: "arrematado", backToShowcase: true }} lotNumber={3} animate={false} />,
    );
    expect(html).not.toContain("/c/");
    expect(html).toContain("Voltar à vitrine");
  });
});
