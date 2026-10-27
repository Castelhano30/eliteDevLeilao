import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHeader } from "./public-header";
import { HeaderIcon } from "./ui/header-icon";

describe("cabeçalho escuro nos dois temas", () => {
  const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
  const bar = /\n\.cabecalho\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  // A barra redefine os tokens dentro de `.cabecalho`: tema, saldo, perfil e botões herdam a paleta escura
  // sem depender de `data-theme`, então o claro e o noite ficam iguais.
  it("redefine fundo, texto e linha escuros na própria barra, fora de qualquer seletor de tema", () => {
    expect(bar).toMatch(/--c-fundo:\s*#0f1216/);
    expect(bar).toMatch(/--c-tinta:\s*#f3f5f8/);
    expect(bar).toMatch(/--c-tinta2:\s*#9ba7b8/);
    expect(bar).toMatch(/--c-linha:\s*#5a6678/);
    expect(bar).toMatch(/color-scheme:\s*dark/);
    expect(bar).toMatch(/border-bottom:\s*2px solid var\(--h-azul\)/);
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
