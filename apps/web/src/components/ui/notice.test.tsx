import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConnectionBanner } from "../connection-banner";
import { Dialog } from "./dialog";
import { FeedbackState, LOADING_TEXT } from "./feedback-state";
import { Notice, type NoticeKind } from "./notice";
import { RefusalMessage } from "./refusal-message";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const NO_OLD_STYLE = /rounded-nenhum|border-dashed|border-tracejado|border-\[3px\]|border-2/;

describe("Notice: os quatro tipos de aviso (DESIGN 4.9)", () => {
  it.each([
    ["info", "border-ocre bg-selecionado", "text-ocreTexto", "status"],
    ["sucesso", "border-verde bg-verdeSuave", "text-verde", "status"],
    ["alerta", "border-alerta bg-alertaSuave", "text-alerta", "status"],
    ["erro", "border-ferrugem bg-falha", "text-ferrugem", "alert"],
  ] as [NoticeKind, string, string, string][])("%s: fundo tintado, borda 1px, ícone na cor forte e papel %s", (kind, box, icon, role) => {
    const html = render(<Notice kind={kind}>Texto do aviso.</Notice>);
    expect(html).toContain("flex items-start gap-3 rounded-xl border px-4 py-3 text-tinta");
    expect(html).toContain(box);
    expect(html).toContain(icon);
    expect(html).toContain(`role="${role}"`);
    expect(html).toContain('<svg aria-hidden="true" width="20" height="20"');
    expect(html).toContain("Texto do aviso.");
    expect(html).not.toMatch(NO_OLD_STYLE);
  });

  it("cada tipo tem um desenho próprio (nunca só cor)", () => {
    const paths = (kind: NoticeKind) => /<svg[\s\S]*<\/svg>/.exec(render(<Notice kind={kind}>x</Notice>))?.[0];
    expect(new Set((["info", "sucesso", "alerta", "erro"] as const).map(paths)).size).toBe(4);
  });

  it("o texto fica em tinta, nunca na cor forte", () => {
    const html = render(<Notice kind="erro">Falhou.</Notice>);
    expect(html).not.toMatch(/!text-ferrugem|class="[^"]*text-ferrugem[^"]*">Falhou/);
  });

  it("role='none' tira o papel (o pai já tem a região viva) e o rodapé vai dentro do bloco", () => {
    const html = render(<Notice kind="info" role="none" footer={<button>Ok</button>}>Aviso</Notice>);
    expect(html).not.toContain("role=");
    expect(html).toContain('<div class="mt-3"><button>Ok</button></div>');
  });
});

describe("RefusalMessage", () => {
  it("é o aviso de erro, em role=alert, com o link de ação em ocreTexto sublinhado", () => {
    const html = render(<RefusalMessage action={{ href: "/carteira", label: "Depositar na carteira →" }}>Sem saldo.</RefusalMessage>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("border-ferrugem bg-falha");
    expect(html).toContain("rounded-xl");
    expect(html).toContain("!text-ocreTexto underline underline-offset-[3px]");
    expect(html).toContain("Depositar na carteira →");
    expect(html).not.toMatch(NO_OLD_STYLE);
  });
});

describe("FeedbackState", () => {
  it("carregando e vazio: bloco centrado de fio sólido borda, rounded-xl e fundo suave (o tracejado saiu)", () => {
    for (const variant of ["carregando", "vazio"] as const) {
      const html = render(<FeedbackState variant={variant}>Algo.</FeedbackState>);
      expect(html).toContain('role="status"');
      expect(html).toContain("rounded-xl border border-borda bg-suave p-6 text-center text-tinta2");
      expect(html).not.toMatch(NO_OLD_STYLE);
    }
    expect(render(<FeedbackState variant="carregando" />)).toContain(`>${LOADING_TEXT}<`);
  });

  it("erro: é o aviso de erro, com 'Tentar novamente' secundário dentro do bloco", () => {
    const html = render(<FeedbackState variant="erro" onRetry={() => undefined}>Não deu.</FeedbackState>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("border-ferrugem bg-falha");
    expect(html).toContain("Tentar novamente");
    expect(html).toContain("Não deu.");
    expect(render(<FeedbackState variant="erro">Não deu.</FeedbackState>)).not.toContain("Tentar novamente");
  });
});

describe("ConnectionBanner", () => {
  it("o contêiner segue como região viva e o conteúdo vai nos avisos novos, sem papel duplicado", () => {
    const off = render(<ConnectionBanner view="offline" lastSyncedAt={null} />);
    expect(off.match(/role="status"/g)).toHaveLength(1);
    expect(off).toContain('aria-live="polite"');
    expect(off).toContain("border-alerta bg-alertaSuave");
    expect(off).toContain("Sem sinal com o pátio. Tentando reconectar.");
    const back = render(<ConnectionBanner view="back" lastSyncedAt={null} />);
    expect(back).toContain("border-ocre bg-selecionado");
    expect(back).toContain("De volta ao pátio. Estado do lote atualizado.");
    expect(render(<ConnectionBanner view="hidden" lastSyncedAt={null} />)).not.toContain("<svg");
    for (const html of [off, back]) expect(html).not.toMatch(NO_OLD_STYLE);
  });

  it("offline com a última atualização mostra a hora", () => {
    expect(render(<ConnectionBanner view="offline" lastSyncedAt={Date.parse("2026-10-23T15:00:00.000Z")} />)).toMatch(/Última atualização às \d{2}:\d{2}:\d{2}/);
  });
});

describe("Dialog (DESIGN 4.10)", () => {
  const html = render(<Dialog open onClose={() => undefined} title="Cancelar o lote?" confirm={{ label: "Cancelar lote", onConfirm: () => undefined }}>Corpo.</Dialog>);

  it("papel, fio borda, rounded-2xl, nível 3, padding de 24px e margem lateral de 16px", () => {
    expect(html).toContain("m-auto w-[min(560px,calc(100%-32px))] rounded-2xl border border-borda bg-papel p-6 text-tinta shadow-modal");
    expect(html).not.toMatch(NO_OLD_STYLE);
  });

  it("título de 20px/800 e corpo de 16px", () => {
    expect(html).toMatch(/<h2 [^>]*class="mb-4 text-\[20px\] font-extrabold leading-tight"[^>]*>Cancelar o lote\?<\/h2>/);
    expect(html).toContain('<div class="t-body">Corpo.</div>');
  });

  it("ações à direita e empilhadas no celular, com a principal por último e sem os 52px soltos", () => {
    expect(html).toContain("mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end");
    expect(html).not.toContain("min-h-[52px]");
    expect(html.indexOf(">Voltar<")).toBeLessThan(html.indexOf(">Cancelar lote<"));
    expect(html.match(/w-full sm:w-auto/g)).toHaveLength(2);
  });

  it("mantém o foco inicial no título e o nome acessível", () => {
    expect(html).toContain('tabindex="-1"');
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toContain('aria-modal="true"');
  });

  it("o fundo do diálogo é rgba(5, 12, 32, 0.6), sem blur", () => {
    expect(css).toMatch(/dialog::backdrop\s*\{\s*background:\s*rgba\(5, 12, 32, 0\.6\);\s*\}/);
  });
});

describe("Menu do perfil e sombra provisória", () => {
  it("o cabeçalho não redefine mais a sombra de nível 1 como sombra dura", () => {
    expect(css).not.toMatch(/--sh-cartao:\s*3px 3px 0/);
  });

  it("o menu é um popover de rounded-xl com nível 2 e itens de 44px com hover suave", () => {
    const source = readFileSync(path.resolve(__dirname, "../profile-menu.tsx"), "utf8");
    expect(source).toContain("rounded-xl border border-borda bg-papel p-2 shadow-painel");
    expect(source).toContain("min-h-alvo w-full items-center rounded-lg px-2 text-left hover:bg-suave");
    expect(source).not.toMatch(/border-tracejado|shadow-cartao/);
  });
});
