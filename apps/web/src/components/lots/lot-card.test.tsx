import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LotCard as LotCardDto, LotStatus, MyLotResult } from "@lanceauto/shared";
import { LotCard } from "./lot-card";

const NOW = "2026-10-23T12:00:00.000Z";
const at = (offsetMs: number) => new Date(Date.parse(NOW) + offsetMs).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

function card(status: LotStatus, overrides: Partial<LotCardDto> = {}): LotCardDto {
  return {
    id: "lote-1",
    number: 5,
    title: "Fiat Uno Mille Way 2010",
    brand: "Fiat",
    model: "Uno",
    year: 2010,
    fuel: "Flex",
    currentBidCents: null,
    startingBidCents: 1_000_000,
    minIncrementCents: 50_000,
    referencePriceCents: 2_000_000,
    bidCount: 0,
    version: 0,
    startsAt: at(-HOUR),
    endsAt: at(3 * HOUR),
    originalEndsAt: at(3 * HOUR),
    cancelledAt: null,
    imageUrl: null,
    status,
    ...overrides,
  } as LotCardDto;
}

const render = (c: LotCardDto, extra: Partial<Parameters<typeof LotCard>[0]> = {}) => renderToStaticMarkup(<LotCard card={c} serverTime={NOW} {...extra} />);
const figureOf = (html: string) => html.slice(html.indexOf("<figure"), html.indexOf("</figure>"));

describe("LotCard: anatomia e casco", () => {
  const html = render(card("LIVE"));

  it("de cima para baixo: foto, faixa da etiqueta e corpo com o título", () => {
    expect(html.indexOf("<figure")).toBeLessThan(html.indexOf(">LOTE<"));
    expect(html.indexOf(">LOTE<")).toBeLessThan(html.indexOf("<h3"));
  });

  it("casco de 16px, fio borda, nível 1, recortado, em coluna e com a altura da célula", () => {
    const shell = /^<a [^>]*>/.exec(html)?.[0] ?? "";
    for (const token of ["rounded-2xl", "border-borda", "shadow-cartao", "overflow-hidden", "flex-col", "h-full", "bg-papel"]) expect(shell).toContain(token);
    expect(shell).not.toMatch(/rounded-nenhum|border-2|border-dashed|border-linha/);
  });

  it("o cartão inteiro é o link, com o título como nome acessível", () => {
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`<h3 id="${labelledBy}"`);
    expect(html).toContain('href="/lotes/lote-1"');
  });

  it("título de 20/700 em caixa normal, meta de 13px, fio borda e rodapé empurrado para a base", () => {
    expect(html).toContain("t-titulo-cartao");
    expect(html).toContain("t-meta-cartao");
    const title = /<h3[^>]*>/.exec(html)?.[0] ?? "";
    expect(title).not.toMatch(/text-\[26px\]|uppercase/);
    expect(html).toContain("mt-auto border-t border-borda pt-4");
  });

  it("padding de 16px, 20px a partir de 640px", () => {
    expect(html).toContain("px-4 pb-4 sm:px-5 sm:pb-5");
  });

  it("a foto tem 200px e herda os cantos; nada cobre a foto", () => {
    expect(html).toContain("height:200px");
    expect(html).toContain("rounded-t-[inherit]");
    const figure = figureOf(html);
    for (const text of ["Ao vivo", "LOTE", "Arrematado", "ABRE"]) expect(figure).not.toContain(text);
  });
});

describe("LotCard: interação", () => {
  it("sobe 2px no hover (só sem movimento reduzido), vai ao nível 2, troca a borda e volta ao pressionar", () => {
    const html = render(card("LIVE"));
    for (const token of ["motion-safe:hover:-translate-y-0.5", "hover:shadow-painel", "hover:border-cartaoHover", "motion-safe:active:translate-y-0", "active:shadow-cartao", "duration-200", "hover:!text-tinta"]) {
      expect(html).toContain(token);
    }
  });

  it("a prévia é um div sem link, sem hover e sem subida", () => {
    const html = render(card("SCHEDULED"), { preview: true });
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/hover:|active:|aria-labelledby/);
    expect(html).toMatch(/^<div class="relative flex h-full flex-col/);
    expect(html).toContain(">NOVO<");
  });
});

describe("LotCard: ao vivo, encerrando e apurando", () => {
  it("ao vivo sem lances: selo azul, LANCE INICIAL em 28px, 'Nenhum lance' e o cronômetro RESTAM", () => {
    const html = render(card("LIVE"));
    expect(html).toContain("Ao vivo");
    expect(html).toContain("bg-ocre");
    expect(html).toContain("LANCE INICIAL");
    expect(html).toMatch(/t-lance-cartao[^>]*>R\$ 10\.000,00</);
    expect(html).toContain("Nenhum lance");
    expect(html).toContain("RESTAM");
    expect(html.indexOf("Ao vivo")).toBeGreaterThan(html.indexOf("</figure>"));
  });

  it("ao vivo com lances: LANCE ATUAL com o valor e a contagem", () => {
    const html = render(card("LIVE", { currentBidCents: 4_150_000, bidCount: 12 }));
    expect(html).toContain("LANCE ATUAL");
    expect(html).toMatch(/t-lance-cartao[^>]*>R\$ 41\.500,00</);
    expect(html).toContain("12 lances");
  });

  it("o valor não é azul: o azul de um cartão clicável lê como link", () => {
    const html = render(card("LIVE", { currentBidCents: 4_150_000, bidCount: 1 }));
    expect(html).not.toMatch(/t-lance-cartao[^"]*(text-ocre|text-ocreTexto)/);
  });

  it("nos últimos 2 minutos o selo fica âmbar, com o mesmo texto 'Ao vivo' e o cronômetro em alerta", () => {
    const html = render(card("LIVE", { endsAt: at(90_000), originalEndsAt: at(90_000) }));
    expect(html).toContain("Ao vivo");
    expect(html).toContain("bg-alertaSuave");
    expect(html).toContain("border-alerta/40");
    expect(html).not.toContain("Encerrando");
    expect(html).toContain("ÚLTIMOS 2 MIN");
  });

  it("prorrogado também fica âmbar, com o +2 MIN na linha dos dígitos", () => {
    const html = render(card("LIVE", { endsAt: at(30 * MIN), originalEndsAt: at(10 * MIN) }));
    expect(html).toContain("bg-alertaSuave");
    expect(html).toContain("+2 MIN");
  });

  it("antes dos últimos 2 minutos o selo é o azul", () => {
    const html = render(card("LIVE"));
    expect(html).not.toContain("bg-alertaSuave");
  });

  it("apurando: sem selo, 'Apurando o resultado…' em alerta com relógio e o cronômetro APURANDO…", () => {
    const html = render(card("CLOSING", { endsAt: at(-10_000), originalEndsAt: at(-10_000), currentBidCents: 2_000_000, bidCount: 3 }));
    expect(html).toContain("Apurando o resultado…");
    expect(html).toContain("!text-alerta");
    expect(html).toContain("APURANDO…");
    expect(html).not.toMatch(/>Ao vivo</);
    expect(html).not.toContain("3 lances");
  });
});

describe("LotCard: agendado", () => {
  const html = render(card("SCHEDULED", { startsAt: at(2 * HOUR), endsAt: at(5 * HOUR), originalEndsAt: at(5 * HOUR) }));

  it("selo informativo com a data de abertura na faixa da etiqueta", () => {
    expect(html).toContain("bg-selecionado");
    expect(html).toMatch(/ABRE (DOM|SEG|TER|QUA|QUI|SEX|SÁB|SAB)/);
    expect(html.indexOf("ABRE ")).toBeGreaterThan(html.indexOf("</figure>"));
    expect(html.indexOf("ABRE ")).toBeLessThan(html.indexOf("<h3"));
  });

  it("rodapé: LANCE INICIAL em 28px, incremento e a caixa ABERTURA de 12px, sem relógio", () => {
    expect(html).toContain("LANCE INICIAL");
    expect(html).toMatch(/t-lance-cartao[^>]*>R\$ 10\.000,00</);
    expect(html).toContain("incremento R$ 500,00");
    expect(html).toContain("ABERTURA");
    expect(html).toContain("rounded-xl border border-borda bg-suave");
    expect(html).not.toContain('role="timer"');
  });

  it("a etiqueta agendada segue azul", () => {
    expect(html).toContain("var(--c-etiqueta-contorno)");
  });
});

describe("LotCard: encerrado e cancelado", () => {
  it.each([
    ["SOLD", "Arrematado", "bg-tinta"],
    ["UNSOLD", "Sem lances", "border-dashed"],
  ] as const)("%s: o selo vai na faixa da etiqueta, não sobre a foto; foto com véu e etiqueta neutra", (status, text, tone) => {
    const html = render(card(status, { endsAt: at(-HOUR), originalEndsAt: at(-HOUR), currentBidCents: status === "SOLD" ? 3_000_000 : null, bidCount: status === "SOLD" ? 4 : 0 }));
    expect(html.indexOf(text)).toBeGreaterThan(html.indexOf("</figure>"));
    expect(figureOf(html)).not.toContain(text);
    expect(html).toContain(tone);
    expect(html).toContain("bg-painel/25");
    expect(html).toContain("var(--c-linha)");
    expect(html).not.toContain("var(--c-etiqueta-contorno)");
    expect(html).toContain("RESULTADO");
    expect(html).not.toContain('role="timer"');
    expect(html).toContain("h-7");
    expect(html).toContain("whitespace-nowrap");
  });

  it("arrematado sem o resultado do painel: valor e contagem", () => {
    const html = render(card("SOLD", { currentBidCents: 3_000_000, bidCount: 4 }));
    expect(html).toContain("R$ 30.000,00 · 4 lances");
  });

  it("painel do leiloeiro: quem levou, valor de 24px/800, lances e a FIPE", () => {
    const resultado: MyLotResult = { outcome: "SOLD", finalBidCents: 3_000_000, winnerPseudonym: "Licitante 3B81", referencePriceCents: 2_000_000, settledAt: at(-HOUR) };
    const html = render(card("SOLD", { bidCount: 4 }), { resultado });
    expect(html).toContain("Licitante 3B81 levou");
    expect(html).toContain("text-[24px] font-extrabold");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("4 lances");
    expect(html).toContain("FIPE R$ 20.000,00");
  });

  it("cancelado: selo Cancelado na faixa, foto com véu e etiqueta neutra", () => {
    const html = render(card("CANCELLED", { cancelledAt: at(-HOUR) }));
    expect(html).toContain("Cancelado");
    expect(html.indexOf("Cancelado")).toBeGreaterThan(html.indexOf("</figure>"));
    expect(html).toContain("border-ferrugem/35");
    expect(html).toContain("bg-painel/25");
    expect(html).toContain("var(--c-linha)");
    // Sem valor em destaque e sem dizer "Sem lances" de um lote que pode ter tido lances.
    expect(html).toContain("RESULTADO");
    expect(html).toContain("Lote cancelado");
    expect(html).not.toContain("Sem lances");
    expect(html).not.toContain("text-[24px]");
  });
});

describe("LotCard: prévia do Criar lote", () => {
  it("sem carro escolhido: a nota no lugar do rodapé", () => {
    const html = render(card("SCHEDULED", { year: 0, fuel: "" }), { preview: true, emptyNote: "Sem carro escolhido." });
    expect(html).toContain("Sem carro escolhido.");
    expect(html).toContain("— · — · FIPE —");
    expect(html).not.toContain("LANCE INICIAL");
  });
});
