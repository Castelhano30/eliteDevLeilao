import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MenuCelular } from "./menu-celular";
import { HeaderIcon } from "./ui/header-icon";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
const header = read("./site-header.tsx");

describe("MenuCelular", () => {
  const html = renderToStaticMarkup(<MenuCelular><a href="/carteira">Carteira</a></MenuCelular>);

  it("fechado: só o botão de 44px, com nome, aria-expanded e aria-controls; o painel não existe", () => {
    const botao = /<button [^>]*>/.exec(html)?.[0] ?? "";
    expect(botao).toContain('aria-label="Abrir menu"');
    expect(botao).toContain('aria-expanded="false"');
    expect(botao).toMatch(/aria-controls="[^"]+"/);
    expect(botao).toContain("h-11 w-11");
    expect(html).toContain("<path");
    expect(html).not.toContain("Carteira");
  });

  it("fecha com Esc (devolvendo o foco ao botão), toque fora, Tab para fora e clique em link ou em [data-fecha-menu]", () => {
    const source = read("./menu-celular.tsx");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("gatilho.current?.focus()");
    expect(source).toContain('addEventListener("pointerdown"');
    expect(source).toContain("event.relatedTarget");
    expect(source).toContain('closest("a, [data-fecha-menu]")');
  });

  it("o painel cabe na tela (dvh, com rolagem própria) e fica acima do conteúdo", () => {
    const source = read("./menu-celular.tsx");
    expect(source).toContain("max-h-[80dvh] overflow-y-auto");
    expect(source).toContain("absolute inset-x-0 top-full z-50");
  });

  it("fecha sozinho quando a rota muda: o estado guarda a rota em que abriu", () => {
    const source = read("./menu-celular.tsx");
    expect(source).toContain("const aberto = abertoEm === pathname");
  });
});

describe("Cabeçalho com hambúrguer", () => {
  it("os ícones de menu e de fechar existem, decorativos", () => {
    for (const name of ["menu", "close"] as const) {
      const icon = renderToStaticMarkup(<HeaderIcon name={name} />);
      expect(icon).toContain("<path");
      expect(icon).toContain('aria-hidden="true"');
    }
  });

  it("três faixas: o hambúrguer só abaixo de 768px e a navegação sai da linha para dentro do menu", () => {
    expect(header).toContain('"(min-width: 768px)", "(min-width: 1200px)"');
    expect(header).toContain('const celular = faixa === "celular"');
    expect(header).toContain('className={celular ? "flex flex-col gap-1"');
    expect(header).toContain("<MenuCelular>");
    expect(header).toContain('faixa === "largo" ? nav : null');
    expect(header).toContain('faixa === "medio" ? nav : null');
  });

  it("no menu os links ocupam a linha e o ativo leva barra à esquerda em vez do sublinhado de largura total", () => {
    // A barra vai para a margem lateral (-left-3): o texto dos links alinha com o resto do painel.
    expect(header).toContain("w-full after:inset-y-2 after:-left-3 after:w-[3px]");
    expect(header).toContain("lista={celular}");
  });

  it("no celular o tema e o Sair moram no menu; o saldo e o Entrar/Criar conta ficam numa faixa sempre à vista", () => {
    expect(header).toContain("{celular ? null : <div key=\"theme\"");
    expect(header).toContain("data-fecha-menu");
    expect(header).toContain('<div key="account" className="site-conta-celular"><BalanceChip /></div>');
    expect(header).toContain("site-conta-celular grid grid-cols-2 gap-3");
    // O menu do perfil (avatar) só existe de 768px para cima.
    expect(header.match(/<ProfileMenu \/>/g)).toHaveLength(1);
  });
});
