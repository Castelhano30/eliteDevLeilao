import { existsSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMO_FUNCIONA } from "@/lib/como-funciona-conteudo";
import ComoFuncionaPage, { metadata } from "../app/(site)/como-funciona/page";
import { ComoFunciona } from "./como-funciona";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const state = vi.hoisted(() => ({ pathname: "/como-funciona", auth: { user: null as { role: string; name: string } | null, status: "ready" as string, logout: () => {} } }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("./auth-provider", () => ({ useAuth: () => state.auth }));
vi.mock("./balance-chip", () => ({ BalanceChip: () => null, BalanceEyeButton: () => null }));
vi.mock("./profile-menu", () => ({ ProfileMenu: () => null }));

beforeEach(() => {
  state.pathname = "/como-funciona";
  state.auth = { user: null, status: "ready", logout: () => {} };
});

const page = () => renderToStaticMarkup(<ComoFuncionaPage />);
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)</g)].map((m) => ({ href: m[1], text: m[2] }));

describe("página Como Funciona", () => {
  it("a rota existe dentro de (site), que já traz cabeçalho e rodapé, e o título da aba é 'Como Funciona'", () => {
    expect(existsSync(path.resolve(__dirname, "../app/(site)/como-funciona/page.tsx"))).toBe(true);
    expect(metadata.title).toBe("Como Funciona · LanceAuto");
  });

  it("tem o título 'Como Funciona' como h1 único", () => {
    const html = page();
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Como Funciona<\/h1>/);
  });

  it("explica o leilão em exatamente três passos: leilão, lances e arremate com comprovante", () => {
    const html = page();
    expect(COMO_FUNCIONA.passos).toHaveLength(3);
    // A lista dos passos é a única `<ol>`; cada passo é um `<li>` direto dela com o seu `<h2>`.
    expect(html.match(/<ol[ >]/g)).toHaveLength(1);
    const lista = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));
    expect(lista.match(/<h2[ >]/g)).toHaveLength(3);
    expect(COMO_FUNCIONA.passos.map((passo) => passo.titulo)).toEqual(["O leilão", "Os lances", "Arremate e comprovante"]);
    for (const passo of COMO_FUNCIONA.passos) {
      expect(lista).toContain(passo.titulo);
      expect(lista).toContain(passo.resumo);
    }
  });

  it("descreve só regras da SPEC: incremento, prorrogação de 2 minutos, ganhando ou superado, apuração e comprovante sem login", () => {
    const html = page();
    expect(html).toContain("incremento");
    expect(html).toContain("últimos 2 minutos");
    expect(html).toContain("ganhando ou foi superado");
    expect(html).toContain("apurado uma única vez");
    expect(html).toContain("sem login e sem mostrar nome ou e-mail");
  });

  it("cada passo ilustra com um print do próprio site: arquivo existente, texto alternativo e legenda", () => {
    const html = page();
    expect(html.match(/<figure[ >]/g)).toHaveLength(3);
    for (const { imagem } of COMO_FUNCIONA.passos) {
      expect(existsSync(path.resolve(__dirname, "../../public", imagem.src.slice(1))), imagem.src).toBe(true);
      expect(imagem.alt.length).toBeGreaterThan(40);
      expect(html).toContain(`src="${imagem.src}"`);
      expect(html).toContain(`width="${imagem.largura}" height="${imagem.altura}"`);
      expect(html).toContain(imagem.legenda);
    }
  });

  it("termina com a chamada que leva à vitrine de lotes", () => {
    const links = hrefs(page());
    expect(links).toContainEqual({ href: "/", text: "Ver os lotes" });
  });

  it("soa como casa de leilões de verdade: nenhum termo de simulação, teste ou demonstração", () => {
    // Texto visível mais alt e legenda das imagens (o `alt` fica dentro da tag).
    const texto = `${renderToStaticMarkup(<ComoFunciona />).replace(/<[^>]+>/g, " ")} ${JSON.stringify(COMO_FUNCIONA)}`.toLowerCase();
    for (const proibido of ["dinheiro falso", "fictíci", "simula", "teste", "demonstra", "de mentira", "provisóri", "protótipo", "fake", "mock"]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });
});

describe("Como Funciona na navegação", () => {
  const nav = () => renderToStaticMarkup(<SiteHeader />);

  it.each([
    ["visitante", null],
    ["licitante", { role: "BIDDER", name: "Ana" }],
    ["leiloeiro", { role: "AUCTIONEER", name: "João" }],
  ])("o cabeçalho de %s tem o link 'Como Funciona' logo depois da Vitrine", (_papel, user) => {
    state.auth = { user, status: "ready", logout: () => {} };
    const links = hrefs(nav());
    const vitrine = links.findIndex((link) => link.href === "/" && link.text === "Vitrine");
    expect(vitrine).toBeGreaterThan(-1);
    expect(links[vitrine + 1]).toEqual({ href: "/como-funciona", text: "Como Funciona" });
  });

  it("na própria página o link do cabeçalho marca a página atual", () => {
    const html = nav();
    expect(html).toMatch(/<a [^>]*href="\/como-funciona"[^>]*aria-current="page"|<a [^>]*aria-current="page"[^>]*href="\/como-funciona"/);
  });

  it("o rodapé também leva à página, na coluna Navegue", () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(hrefs(html)).toContainEqual({ href: "/como-funciona", text: "Como Funciona" });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
