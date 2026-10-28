import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");
const tailwind = readFileSync(path.resolve(__dirname, "../../tailwind.config.mjs"), "utf8");
const rule = (selector: string) => {
  const start = css.indexOf(`\n${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};

describe("base global", () => {
  it("o foco é um anel de 3px do token foco, afastado 2px e sem sombra de papel", () => {
    const focus = css.slice(css.indexOf(":focus-visible,"), css.indexOf("}", css.indexOf(":focus-visible,")));
    expect(focus).toMatch(/outline:\s*3px solid var\(--c-foco\)/);
    expect(focus).toMatch(/outline-offset:\s*2px/);
    expect(focus).not.toMatch(/box-shadow/);
  });

  it("o conteúdo recorta o que sai pelos lados: o carimbo animado não alarga a página no celular", () => {
    expect(rule("main")).toMatch(/overflow-x:\s*clip/);
  });

  it("o título de tela começa em 32px: \"COMPROVANTE\" cabe inteiro em 320px sem partir a palavra", () => {
    expect(css).toMatch(/\.t-display-titulo \{ font-size: clamp\(32px, 6vw, 80px\)/);
  });

  it("o hover de link não vira vermelho de erro", () => {
    expect(css).not.toMatch(/a:hover\s*\{[^}]*ferrugem/);
  });

  it("link em texto corrido (parágrafo, lista, legenda) é azul e sublinhado; o hover vai ao azul interativo ou, no noite, à tinta", () => {
    const text = rule(":where(p, li, figcaption) > a:not([class])");
    expect(text).toMatch(/color:\s*var\(--c-ocre-texto\)/);
    expect(text).toMatch(/text-decoration:\s*underline/);
    expect(rule(":where(p, li, figcaption) > a:not([class]):hover")).toMatch(/var\(--c-ocre-hover\)/);
    expect(rule('[data-theme="noite"] :where(p, li, figcaption) > a:not([class]):hover')).toMatch(/var\(--c-tinta\)/);
  });

  it("o body é uma coluna de pelo menos a altura da janela", () => {
    const body = rule("body");
    expect(body).toMatch(/min-height:\s*100vh/);
    expect(body).toMatch(/min-height:\s*100dvh/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-direction:\s*column/);
  });

  it("a sombra do rodapé existe nos três blocos de tema e no Tailwind", () => {
    expect(css.match(/--sh-rodape:/g)).toHaveLength(3);
    expect(css).toMatch(/--sh-rodape:\s*0 -6px 18px -10px rgba\(0, 30, 99, 0\.35\)/);
    expect(tailwind).toMatch(/rodape:\s*"var\(--sh-rodape\)"/);
  });
});

describe("tipografia da Rev. 05", () => {
  it("botões em caixa normal: 16/600 no primário e 15/600 no padrão", () => {
    expect(rule(".t-botao-primario")).toMatch(/font-size:\s*16px;\s*font-weight:\s*600/);
    expect(rule(".t-botao")).toMatch(/font-size:\s*15px;\s*font-weight:\s*600/);
    expect(rule(".t-botao-primario")).not.toMatch(/uppercase/);
    expect(rule(".t-botao")).not.toMatch(/uppercase/);
  });

  it.each([
    [".t-rotulo-campo", "13px", "600"],
    [".t-filtro", "14px", "600"],
    [".t-titulo-cartao", "20px", "700"],
    [".t-meta-cartao", "13px", "500"],
    [".t-rotulo-cartao", "12px", "700"],
    [".t-lance-cartao", "28px", "800"],
    [".t-rodape-titulo", "12px", "700"],
    [".t-rodape-link", "14px", "500"],
    [".t-rodape-legal", "13px", "400"],
  ])("%s tem %s e peso %s", (selector, size, weight) => {
    const body = rule(selector);
    expect(body).toContain(`font-size: ${size}`);
    expect(body).toContain(`font-weight: ${weight}`);
  });

  it("o lance do cartão usa algarismos tabulares", () => {
    expect(rule(".t-lance-cartao")).toMatch(/tabular-nums/);
  });

  it("rótulo de campo e de cartão ficam em tinta2; o rótulo de campo não vai em caixa-alta", () => {
    expect(rule(".t-rotulo-campo")).toMatch(/color:\s*var\(--c-tinta2\)/);
    expect(rule(".t-rotulo-campo")).not.toMatch(/uppercase/);
    expect(rule(".t-rotulo-cartao")).toMatch(/uppercase/);
  });
});
