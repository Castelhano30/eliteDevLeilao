import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RODAPE_CONTEUDO } from "@/lib/rodape-conteudo";
import { SiteFooter } from "./site-footer";

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

  it("é o landmark contentinfo, na classe .rodape, com 48px acima e 32px em cima e 24px embaixo do conteúdo", () => {
    expect(html).toMatch(/^<footer class="rodape mt-12"/);
    expect(html).toContain("pb-6 pt-8");
    expect(html).toContain("min(100% - 2 * var(--gutter-lateral), 1320px)");
  });

  it("marca, três colunas num único nav 'Rodapé', avisos legais e direitos", () => {
    expect(html).toContain('aria-label="LanceAuto, vitrine"');
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html).toContain('<nav aria-label="Rodapé"');
    for (const titulo of Object.values(RODAPE_CONTEUDO.colunas)) expect(html).toContain(`>${titulo}</p>`);
    for (const politica of RODAPE_CONTEUDO.politicas) expect(html).toContain(`>${politica}</li>`);
    expect(html).toContain(RODAPE_CONTEUDO.direitos);
    expect(html).toContain(RODAPE_CONTEUDO.apresentacao.titulo);
    expect(html).toContain(RODAPE_CONTEUDO.apresentacao.texto);
  });

  it("os títulos de coluna são parágrafos, não títulos: o índice da página não muda", () => {
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html.match(/class="t-rodape-titulo text-tinta"/g)).toHaveLength(3);
  });

  it("flex das áreas: marca 2 1 280px, colunas 1 1 160px, linha 1 com gap de 32px", () => {
    expect(html).toContain("flex flex-wrap gap-6");
    expect(html).toContain("flex-[2_1_280px]");
    expect(html.match(/flex-\[1_1_160px\]/g)).toHaveLength(3);
    expect(html).toContain("max-w-[36ch]");
  });
});

describe("SiteFooter: conteúdo e links", () => {
  const html = render();

  it("a coluna Navegue só tem a Vitrine: não há item provisório nem texto entre colchetes", () => {
    expect(RODAPE_CONTEUDO).not.toHaveProperty("navegueProvisorios");
    expect(html).not.toContain("Sobre o LanceAuto");
    expect(html).not.toMatch(/>\[[^<]*\]</);
  });

  it("direitos e frase de apresentação definitivos, sem colchetes", () => {
    expect(RODAPE_CONTEUDO.direitos).toBe("© 2026 LanceAuto. Todos os direitos reservados.");
    expect(RODAPE_CONTEUDO.apresentacao.titulo).toBe("Sua próxima conquista começa com um lance.");
    expect(html).not.toMatch(/\[ano\]|\[Frase|\[Texto de direitos/);
  });

  it("contato: e-mail e telefone são links, o horário é texto", () => {
    expect(html).toContain('<a href="mailto:suporte@lanceauto.com"');
    expect(html).toContain(">E-mail: suporte@lanceauto.com</a>");
    expect(html).toContain('<a href="tel:9999999999"');
    expect(html).toContain(">Telefone: (99) 9999-9999</a>");
    expect(html).toMatch(/<span class="[^"]*text-tinta2">Atendimento: 08:00 às 22:00<\/span>/);
  });

  it("termos e políticas são texto, sem <a>: ainda não têm página", () => {
    expect(RODAPE_CONTEUDO.politicas).toEqual(["Termos de uso", "Política de privacidade", "Regras dos leilões", "Política da carteira"]);
    expect(html).not.toMatch(/(?:Termos de uso|Política[^<]*|Regras dos leilões)<\/a>/);
  });

  it("só tem <a> para rota que existe, e-mail e telefone", () => {
    expect(hrefs(html)).toEqual(["/", "/", "/entrar?aba=entrar", "/entrar", "mailto:suporte@lanceauto.com", "tel:9999999999"]);
    expect(html).not.toMatch(/href="(?!\/|mailto:|tel:)/);
  });

  it("não inventa CNPJ nem endereço", () => {
    expect(html).not.toMatch(/CNPJ|\d{2}\.\d{3}\.\d{3}\/|Rua |Av\./);
  });

  it("três círculos de 44px para as redes, com role img, sem href", () => {
    const redes = html.match(/<span role="img" aria-label="Rede social \[provisória\]"[^>]*>/g) ?? [];
    expect(redes).toHaveLength(3);
    for (const rede of redes) expect(rede).toContain("h-9 w-9 cursor-default");
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
    expect(hrefs(html)).toEqual(["/", "/", "mailto:suporte@lanceauto.com", "tel:9999999999"]);
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

  it("na Vitrine, só 'Vitrine' marca; os links de entrada nunca marcam", () => {
    const html = render();
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    state.pathname = "/entrar";
    expect(render()).not.toContain("aria-current");
  });
});

describe("SiteFooter: versão mínima", () => {
  const html = render({ variant: "minimo" });

  it("só as políticas e os direitos: sem logo, sem colunas, sem links", () => {
    for (const politica of RODAPE_CONTEUDO.politicas) expect(html).toContain(politica);
    expect(html).toContain(RODAPE_CONTEUDO.direitos);
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("logo-placa");
    expect(html).not.toContain("Sua conta");
  });

  it("some na impressão só quando pedido (Comprovante)", () => {
    expect(html).not.toContain("print:hidden");
    expect(render({ variant: "minimo", hideOnPrint: true })).toMatch(/^<footer class="rodape mt-12 print:hidden"/);
  });
});

/** Todo arquivo de rota de `app/` (página, 404, erro) com o caminho relativo a `app/`. */
function rotas(dir = path.resolve(__dirname, "../app"), base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const relativo = base ? `${base}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) return rotas(path.join(dir, entrada.name), relativo);
    return /^(page|not-found|error|global-error)\.tsx$/.test(entrada.name) ? [relativo] : [];
  });
}
/** O rodapé de uma rota vem do arquivo dela ou do `layout.tsx` mais próximo acima (o layout raiz não tem rodapé). */
function temRodape(rota: string): boolean {
  const app = path.resolve(__dirname, "../app");
  const partes = rota.split("/");
  const proprio = readFileSync(path.join(app, rota), "utf8");
  if (/<SiteFooter\b/.test(proprio)) return true;
  for (let n = partes.length - 1; n >= 1; n -= 1) {
    const layout = path.join(app, ...partes.slice(0, n), "layout.tsx");
    if (existsSync(layout)) return /<SiteFooter\b/.test(readFileSync(layout, "utf8"));
  }
  return false;
}

describe("Rodapé em todas as telas", () => {
  const todas = rotas();

  it("a varredura enxerga as rotas conhecidas, inclusive a Sala, o 404 e a tela de erro", () => {
    for (const esperada of ["(site)/lotes/[id]/page.tsx", "(site)/page.tsx", "(auditoria)/lotes/[id]/auditoria/page.tsx", "(publico)/c/[token]/page.tsx", "not-found.tsx", "error.tsx"]) {
      expect(todas).toContain(esperada);
    }
  });

  it.each(rotas())("%s tem rodapé", (rota) => {
    expect(temRodape(rota)).toBe(true);
  });

  it("a Sala de lances mostra o rodapé completo: nada esconde o rodapé por rota", () => {
    expect(source).not.toMatch(/ocultaRodape|SiteFooterGate/);
    state.pathname = "/lotes/4913f6b8-4037-44cb-af7d-ed6d6c01b8ec";
    expect(render()).toContain("<footer");
  });
});

describe("Layouts e CSS", () => {
  it("o grupo (site) usa o rodapé completo, inclusive na Sala; o Comprovante e a Auditoria usam o mínimo (só o Comprovante some na impressão)", () => {
    expect(layoutSource("(site)")).toContain("<SiteFooter />");
    expect(readFileSync(path.resolve(__dirname, "../app/not-found.tsx"), "utf8")).toContain("<SiteFooter />");
    expect(readFileSync(path.resolve(__dirname, "../app/error.tsx"), "utf8")).toContain('<SiteFooter variant="minimo" />');
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
