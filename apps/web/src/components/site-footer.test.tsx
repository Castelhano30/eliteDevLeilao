import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RODAPE_CONTEUDO } from "@/lib/rodape-conteudo";
import { SiteFooter, SiteFooterGate, ocultaRodape } from "./site-footer";

const state = vi.hoisted(() => ({ pathname: "/", auth: { user: null as { role: string } | null, status: "ready" as string } }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("./auth-provider", () => ({ useAuth: () => state.auth }));

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const source = readFileSync(path.resolve(__dirname, "./site-footer.tsx"), "utf8");
const layoutSource = (name: string) => readFileSync(path.resolve(__dirname, `../app/${name}/layout.tsx`), "utf8");
const render = (props: Parameters<typeof SiteFooter>[0] = {}) => renderToStaticMarkup(<SiteFooter {...props} />);
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);

beforeEach(() => {
  state.pathname = "/";
  state.auth = { user: null, status: "ready" };
});

describe("SiteFooter: estrutura e landmarks", () => {
  const html = render();

  it("é o landmark contentinfo, na classe .rodape, com 64px acima e 48px em cima e 32px embaixo do conteúdo", () => {
    expect(html).toMatch(/^<footer class="rodape mt-16"/);
    expect(html).toContain("pb-8 pt-12");
    expect(html).toContain("min(100% - 2 * var(--gutter-lateral), 1320px)");
  });

  it("marca, três colunas num único nav 'Rodapé', avisos legais e direitos", () => {
    expect(html).toContain('aria-label="LanceAuto, vitrine"');
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html).toContain('<nav aria-label="Rodapé"');
    for (const titulo of Object.values(RODAPE_CONTEUDO.colunas)) expect(html).toContain(`>${titulo}</p>`);
    expect(html).toContain(RODAPE_CONTEUDO.avisosLegais);
    expect(html).toContain(RODAPE_CONTEUDO.direitos);
    expect(html).toContain(RODAPE_CONTEUDO.apresentacao);
  });

  it("os títulos de coluna são parágrafos, não títulos: o índice da página não muda", () => {
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html.match(/class="t-rodape-titulo text-tinta"/g)).toHaveLength(3);
  });

  it("flex das áreas: marca 2 1 280px, colunas 1 1 160px, linha 1 com gap de 32px", () => {
    expect(html).toContain("flex flex-wrap gap-8");
    expect(html).toContain("flex-[2_1_280px]");
    expect(html.match(/flex-\[1_1_160px\]/g)).toHaveLength(3);
    expect(html).toContain("max-w-[36ch]");
    expect(html).toContain("max-w-[80ch]");
  });
});

describe("SiteFooter: conteúdo provisório e links", () => {
  const html = render();

  it("todo texto provisório vem entre colchetes e sem href", () => {
    for (const texto of [...RODAPE_CONTEUDO.navegueProvisorios, ...RODAPE_CONTEUDO.contatoProvisorios, RODAPE_CONTEUDO.apresentacao, RODAPE_CONTEUDO.avisosLegais]) {
      expect(texto).toMatch(/^\[.*\]\.?$/);
      expect(html).toContain(texto);
    }
    expect(RODAPE_CONTEUDO.direitos).toContain("[ano]");
    for (const texto of RODAPE_CONTEUDO.navegueProvisorios) expect(html).toMatch(new RegExp(`<span class="[^"]*text-tinta2">${texto.replace(/[[\]]/g, "\\$&")}</span>`));
  });

  it("só tem <a> para rota que existe: nada de Sobre, Termos ou Privacidade", () => {
    const links = hrefs(html);
    expect(links).toEqual(["/", "/", "/#como-funciona", "/entrar?aba=entrar", "/entrar"]);
    expect(html).not.toMatch(/href="(?!\/)/);
    expect(html).not.toMatch(/Sobre o LanceAuto<\/a>|Termos de uso<\/a>|Privacidade<\/a>/);
  });

  it("não inventa CNPJ, endereço nem telefone", () => {
    expect(html).not.toMatch(/CNPJ|\d{2}\.\d{3}\.\d{3}\/|\(\d{2}\)\s?\d{4,5}-\d{4}|Rua |Av\./);
  });

  it("três círculos de 44px para as redes, com role img, sem href", () => {
    const redes = html.match(/<span role="img" aria-label="Rede social \[provisória\]"[^>]*>/g) ?? [];
    expect(redes).toHaveLength(3);
    for (const rede of redes) expect(rede).toContain("h-11 w-11 cursor-default");
    expect(html.match(/rounded-full border border-borda bg-suave text-tinta2/g)).toHaveLength(3);
  });

  it("links com 44px de altura mínima, tinta2, hover em tinta com sublinhado de 3px e sem sublinhado em repouso", () => {
    expect(html).toContain("min-h-alvo");
    expect(html).toContain("no-underline hover:underline hover:underline-offset-[3px] !text-tinta2 hover:!text-tinta");
    expect(html).toContain("t-rodape-link");
  });
});

describe("SiteFooter: Sua conta por papel", () => {
  it("visitante: Entrar e Criar conta", () => {
    expect(hrefs(render())).toEqual(expect.arrayContaining(["/entrar?aba=entrar", "/entrar"]));
  });

  it("licitante: Meus arremates e Carteira", () => {
    state.auth = { user: { role: "BIDDER" }, status: "ready" };
    const links = hrefs(render());
    expect(links).toEqual(expect.arrayContaining(["/arremates", "/carteira"]));
    expect(links).not.toContain("/entrar");
  });

  it("leiloeiro: Meus lotes e Criar lote", () => {
    state.auth = { user: { role: "AUCTIONEER" }, status: "ready" };
    const links = hrefs(render());
    expect(links).toEqual(expect.arrayContaining(["/painel", "/painel/criar-lote"]));
    expect(links).not.toContain("/arremates");
  });

  it.each(["loading", "error"])("com a sessão em %s a lista fica vazia e com a altura reservada (sem salto)", (status) => {
    state.auth = { user: null, status };
    const html = render();
    expect(html).toContain("min-h-[88px]");
    expect(hrefs(html)).toEqual(["/", "/", "/#como-funciona"]);
    expect(html).toContain(">Sua conta</p>");
  });
});

describe("SiteFooter: página atual", () => {
  it("só a rota exata ganha aria-current e a cor ocreTexto", () => {
    state.pathname = "/carteira";
    state.auth = { user: { role: "BIDDER" }, status: "ready" };
    const html = render();
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/carteira"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/carteira"/);
    const atual = /<a [^>]*aria-current="page"[^>]*>/.exec(html)?.[0] ?? "";
    expect(atual).toContain("!text-ocreTexto");
    expect(atual).not.toContain("!text-tinta2");
    expect(html.match(/!text-ocreTexto/g)).toHaveLength(2);
  });

  it("na Vitrine, só 'Vitrine' marca; 'Como funciona' (com #) e os links de entrada nunca marcam", () => {
    const html = render();
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    state.pathname = "/entrar";
    expect(render()).not.toContain("aria-current");
  });
});

describe("SiteFooter: versão mínima", () => {
  const html = render({ variant: "minimo" });

  it("só os avisos e os direitos: sem logo, sem colunas, sem links", () => {
    expect(html).toContain(RODAPE_CONTEUDO.avisosLegais);
    expect(html).toContain(RODAPE_CONTEUDO.direitos);
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("logo-placa");
    expect(html).not.toContain("Sua conta");
  });

  it("some na impressão só quando pedido (Comprovante)", () => {
    expect(html).not.toContain("print:hidden");
    expect(render({ variant: "minimo", hideOnPrint: true })).toMatch(/^<footer class="rodape mt-16 print:hidden"/);
  });
});

describe("Rodapé na Sala de lances", () => {
  it.each(["/lotes/4913f6b8-4037-44cb-af7d-ed6d6c01b8ec", "/lotes/abc", "/lotes/abc/"])("%s não tem rodapé", (pathname) => {
    expect(ocultaRodape(pathname)).toBe(true);
    state.pathname = pathname;
    expect(renderToStaticMarkup(<SiteFooterGate />)).toBe("");
  });

  it.each(["/", "/entrar", "/carteira", "/arremates", "/painel", "/painel/criar-lote", "/lotes/abc/auditoria", "/lotes", "/c/token"])("%s tem rodapé", (pathname) => {
    expect(ocultaRodape(pathname)).toBe(false);
    state.pathname = pathname;
    expect(renderToStaticMarkup(<SiteFooterGate />)).toContain("<footer");
  });
});

describe("Layouts e CSS", () => {
  it("o grupo (site) usa o rodapé com o invólucro da Sala; o Comprovante e a Auditoria usam o mínimo (só o Comprovante some na impressão)", () => {
    expect(layoutSource("(site)")).toContain("<SiteFooterGate />");
    expect(layoutSource("(publico)")).toContain('<SiteFooter variant="minimo" hideOnPrint />');
    expect(layoutSource("(auditoria)")).toContain('<SiteFooter variant="minimo" />');
  });

  it(".rodape: papel, fio de 1px borda e a sombra do cabeçalho invertida no claro; linha de 2px destaque no noite (também pelo sistema)", () => {
    expect(css).toMatch(/\n\.rodape \{[^}]*background:\s*var\(--c-papel\)[^}]*border-top:\s*1px solid var\(--c-borda\)[^}]*box-shadow:\s*var\(--sh-rodape\)/);
    expect(css).toMatch(/\[data-theme="noite"\] \.rodape \{ border-top: 2px solid var\(--c-destaque\); \}/);
    expect(css).toMatch(/:root:not\(\[data-theme="claro"\]\) \.rodape \{ border-top: 2px solid var\(--c-destaque\); \}/);
  });

  it("o texto do componente não monta classes por concatenação de pedaços soltos", () => {
    expect(source).not.toMatch(/`[^`]*(?:text|bg|border|h|w)-\$\{/);
  });
});
