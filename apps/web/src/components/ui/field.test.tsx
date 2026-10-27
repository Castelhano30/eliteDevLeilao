import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./field";

const render = (props: Partial<Parameters<typeof Field>[0]> = {}) => renderToStaticMarkup(<Field id="x" label="E-mail" {...props} />);

describe("Field: caixa", () => {
  it("48px, 12px de raio, fundo papel e fio linha de 1px nos dois temas", () => {
    const html = render();
    for (const token of ["min-h-12", "rounded-xl", "bg-papel", "border-linha", "hover:border-tinta2", "text-[16px]"]) expect(html).toContain(token);
    expect(html).not.toMatch(/rounded-nenhum|border-2|bg-fundo/);
  });

  it("rótulo em 13/600 caixa normal, a 6px do campo", () => {
    const html = render();
    expect(html).toContain('class="t-rotulo-campo mb-[6px] block"');
    expect(html).not.toContain("t-mono-rotulo");
  });

  it("o anel de foco vai na caixa e o input interno não desenha outro", () => {
    const html = render();
    expect(html).toContain("has-[:focus-visible]:border-foco");
    expect(html).toContain("has-[:focus-visible]:outline-3");
    expect(html).toContain("has-[:focus-visible]:outline-foco");
    expect(html).toContain("!outline-none");
  });
});

describe("Field: estados", () => {
  it("erro: borda ferrugem de 2px visuais, ícone escondido e texto ligado por aria-describedby", () => {
    const html = render({ error: "Informe um e-mail válido." });
    expect(html).toContain("border-ferrugem");
    expect(html).toContain("shadow-[0_0_0_1px_var(--c-ferrugem)]");
    expect(html).toMatch(/<p id="x-erro"[^>]*>\s*<svg[^>]*aria-hidden="true"/);
    expect(html).toContain("Informe um e-mail válido.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="x-erro"');
  });

  it("inválido sem mensagem própria pinta a borda mas não cria ícone nem parágrafo de erro", () => {
    const html = render({ invalid: true });
    expect(html).toContain("border-ferrugem");
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toContain("x-erro");
    expect(html).not.toContain("<svg");
  });

  it("desabilitado: fundo suave, fio borda, texto tinta2, sem hover e cursor not-allowed", () => {
    const html = render({ disabled: true });
    for (const token of ["bg-suave", "border-borda", "text-tinta2", "cursor-not-allowed", "disabled"]) expect(html).toContain(token);
    expect(html).not.toContain("hover:border-tinta2");
  });
});

describe("Field: campo de valor", () => {
  it("prefixo e sufixo em tinta2 e valor em algarismos tabulares de 24px", () => {
    const html = render({ prefix: "R$", suffix: ",00" });
    expect(html).toMatch(/<span class="[^"]*text-tinta2[^"]*">R\$<\/span>/);
    expect(html).toContain("tabular-nums");
    expect(html).toContain("text-[24px]");
    expect(html).toContain("min-h-12");
  });

  it("o campo de lance da Sala tem 56px e valor de 28px", () => {
    const html = render({ prefix: "R$", suffix: ",00", tamanho: "lance" });
    expect(html).toContain("min-h-14");
    expect(html).toContain("text-[28px]");
    expect(html).not.toContain("min-h-12");
  });
});
