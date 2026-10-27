import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonClasses, type ButtonVariant } from "./button";

describe("buttonClasses", () => {
  it("primário: azul sólido, texto sobre o primário, 44px e 12px de raio, sem o visual antigo", () => {
    const cls = buttonClasses("primario");
    expect(cls).toContain("bg-ocre");
    expect(cls).toContain("!text-sobreOcre");
    expect(cls).toContain("min-h-botao");
    expect(cls).toContain("rounded-xl");
    expect(cls).toContain("t-botao-primario");
    expect(cls).not.toMatch(/rounded-nenhum|border-2|border-dashed/);
  });

  it("primário: hover no azul interativo, pressionado no tom escuro e sem sombra; nada disso com o botão inerte", () => {
    const cls = buttonClasses("primario");
    expect(cls).toContain("not-disabled:not-aria-busy:hover:bg-ocreHover");
    expect(cls).toContain("not-disabled:not-aria-busy:active:bg-ocreAtivo");
    expect(cls).toContain("not-disabled:not-aria-busy:active:shadow-botao-ativo");
    expect(cls).toContain("not-disabled:not-aria-busy:active:translate-y-px");
  });

  it("secundário: transparente com fio de 1px; destrutivo troca para ferrugem", () => {
    const cls = buttonClasses("secundario");
    expect(cls).toContain("bg-transparent");
    expect(cls).toContain("border-botaoBorda");
    expect(cls).toContain("not-disabled:not-aria-busy:hover:bg-suave");
    const perigo = buttonClasses("secundario", true);
    expect(perigo).toContain("border-ferrugem");
    expect(perigo).toContain("!text-ferrugem");
    expect(perigo).toContain("hover:bg-falha");
    expect(perigo).not.toContain("border-botaoBorda");
  });

  it("fantasma: sem borda, texto azul e hover em selecionado", () => {
    const cls = buttonClasses("fantasma");
    expect(cls).toContain("border-transparent");
    expect(cls).toContain("!text-ocreTexto");
    expect(cls).toContain("hover:bg-selecionado");
  });

  it("perigo sólido: ferrugem com texto sobre cor e hover a 90%", () => {
    const cls = buttonClasses("perigo");
    expect(cls).toContain("bg-ferrugem");
    expect(cls).toContain("!text-sobreCor");
    expect(cls).toContain("hover:bg-ferrugem/90");
  });

  it("desabilitado: suave, fio borda, texto tinta2, sem sombra e cursor not-allowed", () => {
    const cls = buttonClasses("desabilitado");
    for (const token of ["bg-suave", "border-borda", "!text-tinta2", "shadow-none", "cursor-not-allowed"]) expect(cls).toContain(token);
    expect(cls).not.toContain("hover:");
  });

  it("toda variante de ação ganha o visual inerte no atributo disabled", () => {
    for (const variant of ["primario", "secundario", "fantasma", "perigo", "atalho", "icone"] as ButtonVariant[]) {
      expect(buttonClasses(variant)).toContain("disabled:cursor-not-allowed");
      expect(buttonClasses(variant)).toContain("disabled:bg-suave");
    }
  });

  it("tamanhos: compacto de 40px e 8px (44px com ponteiro grosso) e sala de 56px em largura total", () => {
    const compacto = buttonClasses("primario", false, "compacto");
    expect(compacto).toContain("min-h-10");
    expect(compacto).toContain("pointer-coarse:min-h-11");
    expect(compacto).toContain("rounded-lg");
    expect(compacto).toContain("text-[14px]");
    expect(compacto).not.toContain("t-botao-primario");
    const sala = buttonClasses("primario", false, "sala");
    expect(sala).toContain("min-h-14");
    expect(sala).toContain("w-full");
    expect(sala).toContain("rounded-xl");
    expect(sala).toContain("text-[18px]");
  });

  it("atalho é uma pílula de 44px com algarismos tabulares e estado selecionado por aria-pressed", () => {
    const cls = buttonClasses("atalho");
    expect(cls).toContain("rounded-full");
    expect(cls).toContain("min-h-alvo");
    expect(cls).toContain("tabular-nums");
    expect(cls).toContain("border-linha");
    expect(cls).toContain("aria-pressed:bg-selecionado");
    expect(cls).toContain("aria-pressed:border-botaoBordaHover");
  });

  it("ícone é um círculo de 44px com fio linha e fundo papel", () => {
    const cls = buttonClasses("icone");
    for (const token of ["h-11", "w-11", "rounded-full", "border-linha", "bg-papel", "hover:bg-suave"]) expect(cls).toContain(token);
  });
});

describe("Button", () => {
  it("em repouso não anuncia ocupado nem inerte", () => {
    const html = renderToStaticMarkup(<Button variant="primario">Depositar</Button>);
    expect(html).toContain(">Depositar<");
    expect(html).not.toContain("aria-busy=");
    expect(html).not.toContain("aria-disabled=");
    expect(html).not.toContain("<svg");
  });

  it("carregando: mantém a variante, anuncia aria-busy e aria-disabled e mostra o spinner antes do texto de carregamento", () => {
    const html = renderToStaticMarkup(
      <Button variant="primario" loading loadingText="Depositando…">
        Depositar
      </Button>,
    );
    expect(html).toContain("bg-ocre");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*width="16"[^>]*height="16"/);
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("Depositando…"));
  });

  it("carregando: o rótulo de repouso fica invisível na mesma célula, para a largura não encolher", () => {
    const html = renderToStaticMarkup(
      <Button loading loadingText="Enviando…">
        Dar lance
      </Button>,
    );
    expect(html).toMatch(/class="invisible[^"]*"[^>]*>Dar lance</);
    expect(html).toContain("inline-grid");
  });

  it("carregando sem texto próprio segue só com o conteúdo, mas inerte", () => {
    const html = renderToStaticMarkup(<Button loading>Salvar</Button>);
    expect(html).toContain(">Salvar<");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<svg");
  });

  it("a variante desabilitada leva o atributo disabled", () => {
    expect(renderToStaticMarkup(<Button variant="desabilitado">Lote fechado</Button>)).toContain("disabled");
  });

  it("repassa o tamanho ao visual", () => {
    expect(renderToStaticMarkup(<Button variant="primario" size="sala">Dar lance</Button>)).toContain("min-h-14");
  });
});
