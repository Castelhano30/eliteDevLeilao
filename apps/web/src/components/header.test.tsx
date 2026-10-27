import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHeader } from "./public-header";
import { HeaderIcon } from "./ui/header-icon";

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};

describe("paleta azul", () => {
  it("define os quatro azuis como literais fixos, iguais nos dois temas", () => {
    const root = block(":root");
    expect(css).toMatch(/--f-azul:\s*#0033a0/);
    expect(css).toMatch(/--f-azul-interativo:\s*#174bc2/);
    expect(css).toMatch(/--f-azul-profundo:\s*#001e63/);
    expect(css).toMatch(/--f-azul-suave:\s*#e8efff/);
    expect(root).not.toBe("");
  });
});

describe("cabeçalho: claro por padrão, escuro no tema noite", () => {
  const light = block("\n.cabecalho");
  const dark = block('\n[data-theme="noite"] .cabecalho');
  const system = css.slice(css.indexOf(":root:not([data-theme=\"claro\"]) .cabecalho"));

  it("a barra clara usa fundo claro, texto escuro e o azul principal", () => {
    expect(light).toMatch(/--c-fundo:\s*#f7f9ff/);
    expect(light).toMatch(/--c-tinta:\s*#0f1b33/);
    expect(light).toMatch(/--c-suave:\s*var\(--f-azul-suave\)/);
    expect(light).toMatch(/--h-cta:\s*var\(--f-azul\)/);
    expect(light).toMatch(/--h-cta-hover:\s*var\(--f-azul-interativo\)/);
    expect(light).toMatch(/color-scheme:\s*light/);
  });

  it("o logo inverte com a barra: placa escura na clara, placa clara na escura", () => {
    expect(light).toMatch(/--f-logo-papel:\s*#14181f/);
    expect(light).toMatch(/--f-logo-tinta:\s*#f5f7fb/);
    for (const scope of [dark, system]) {
      expect(scope).toMatch(/--f-logo-papel:\s*#f5eedf/);
      expect(scope).toMatch(/--f-logo-tinta:\s*#1e1c19/);
    }
  });

  it("o tema noite redefine a barra escura, também quando o noite vem do sistema", () => {
    for (const scope of [dark, system]) {
      expect(scope).toMatch(/--c-fundo:\s*#0f1216/);
      expect(scope).toMatch(/--c-tinta:\s*#f3f5f8/);
      expect(scope).toMatch(/--c-suave:\s*var\(--f-azul-profundo\)/);
      expect(scope).toMatch(/--h-cta:\s*var\(--f-azul-interativo\)/);
      expect(scope).toMatch(/color-scheme:\s*dark/);
      expect(scope).toMatch(/border-bottom:\s*2px solid var\(--h-azul\)/);
    }
  });

  it("o escuro do sistema não vale quando o Felipe escolheu o claro", () => {
    expect(css).toContain(':root:not([data-theme="claro"]) .cabecalho');
  });

  it("os divisores só aparecem de 768 px para cima", () => {
    expect(css).toMatch(/\.cabecalho-divisor\s*\{\s*display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{\s*\.cabecalho-divisor\s*\{\s*display:\s*block/);
  });

  it("o cabeçalho público usa a mesma barra e a legenda em texto secundário", () => {
    const html = renderToStaticMarkup(<PublicHeader legend="PÁGINA PÚBLICA" />);
    expect(html).toContain('<header class="cabecalho"');
    expect(html).toContain("PÁGINA PÚBLICA");
    expect(html).toContain("text-tinta2");
    expect(html).toContain("logo-placa");
  });
});

describe("HeaderIcon", () => {
  it("desenha a carteira no tamanho pedido e continua decorativo", () => {
    const html = renderToStaticMarkup(<HeaderIcon name="wallet" size={24} />);
    expect(html).toContain('width="24"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<path");
  });

  it("o tamanho padrão segue em 18 px", () => {
    expect(renderToStaticMarkup(<HeaderIcon name="eye" />)).toContain('width="18"');
  });
});
