import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BidDTO, LotState } from "@lanceauto/shared";
import { BidHistory } from "./bid-history";
import { BidPanel } from "./bid-panel";
import { ChipLicitante } from "./chip-licitante";
import { FaixaStatus } from "./faixa-status";
import { PlacaLance } from "./placa-lance";
import { PlacarPosicao } from "./placar-posicao";

const NOW = "2026-10-23T12:00:00.000Z";
const at = (offsetMs: number) => new Date(Date.parse(NOW) + offsetMs).toISOString();
const HOUR = 3_600_000;

function state(overrides: Partial<LotState["lot"]> = {}, bids: BidDTO[] = []): LotState {
  return {
    serverTime: NOW,
    lot: {
      id: "lote-1", number: 5, title: "Fiat Uno", status: "LIVE", startingBidCents: 1_000_000, minIncrementCents: 50_000, currentBidCents: 1_950_000,
      minimumBidCents: 2_000_000, bidCount: 6, bidderCount: 2, version: 6, entryCount: 6, startsAt: at(-HOUR), endsAt: at(3 * HOUR), originalEndsAt: at(3 * HOUR),
      cancelledAt: null, settledAt: null, myPseudonym: null, myRank: null, myBestBidCents: null, result: null, myReceiptToken: null, ...overrides,
    },
    car: { brand: "Fiat", model: "Uno", year: 2010, fuel: "Flex", referencePriceCents: 1_980_000, referenceMonth: "2026-10", imageUrl: null, gallery: [], imageCredit: null, imageCreditUrl: null },
    bids,
  };
}
const panel = (s: LotState) => renderToStaticMarkup(<BidPanel id="lote-1" state={s} viewer={null} authLoading={false} blockReason={null} />);

describe("Faixa de posição", () => {
  it("rounded-xl com 14px 16px, ícone e título de 18 a 22px/800 em caixa-alta", () => {
    const html = renderToStaticMarkup(<PlacarPosicao tone="verde" title="VOCÊ ESTÁ GANHANDO" sub="1º de 3" />);
    expect(html).toContain("flex items-start gap-3 rounded-xl border px-4 py-[14px]");
    expect(html).toContain("font-extrabold uppercase");
    expect(html).toContain("font-size:clamp(18px, 3.2vw, 22px)");
    expect(html).toContain(">VOCÊ ESTÁ GANHANDO<");
    expect(html).toContain(">1º de 3<");
  });

  it("ganhando e arrematou: verde com sobreCor e ícone de check; superado: ferrugem com seta para baixo", () => {
    const ganhando = renderToStaticMarkup(<PlacarPosicao tone="verde" title="X" />);
    expect(ganhando).toContain("border-verde bg-verde text-sobreCor");
    expect(ganhando).toContain('d="m5 12.5 4.5 4.5L19 7"');
    expect(renderToStaticMarkup(<FaixaStatus tone="verde" title="Você arrematou" />)).toContain("border-verde bg-verde text-sobreCor");
    const superado = renderToStaticMarkup(<PlacarPosicao tone="ferrugem" title="X" />);
    expect(superado).toContain("border-ferrugem bg-ferrugem text-sobreCor");
    expect(superado).toContain('d="M12 5v14m0 0-6-6m6 6 6-6"');
  });

  it("neutra: suave com fio borda, texto tinta e sem ícone; o ícone é decorativo nos outros", () => {
    const html = renderToStaticMarkup(<FaixaStatus title="Você está assistindo" sub="Sem conta você vê tudo." />);
    expect(html).toContain("border-borda bg-suave text-tinta");
    expect(html).not.toContain("<svg");
    expect(html).not.toMatch(/rounded-nenhum|border-\[3px\]|border-tinta|bg-tinta/);
    expect(renderToStaticMarkup(<PlacarPosicao tone="verde" title="X" />)).toContain('<svg aria-hidden="true"');
  });
});

describe("Chip do licitante", () => {
  it("pílula de fio com o pseudônimo", () => {
    const html = renderToStaticMarkup(<ChipLicitante name="Licitante E727" />);
    expect(html).toContain("rounded-full border px-3");
    expect(html).toContain("border-linha font-medium text-tinta");
    expect(html).not.toContain("VOCÊ");
    expect(html).not.toContain("t-mono");
    expect(html).not.toMatch(/rounded-nenhum|border-2/);
  });

  it("o meu: selecionado, ocreTexto e peso 700, e a palavra VOCÊ junto (nunca só cor)", () => {
    const html = renderToStaticMarkup(<ChipLicitante name="Licitante 38DF" mine />);
    expect(html).toContain("border-ocreTexto bg-selecionado font-bold text-ocreTexto");
    expect(html).not.toContain("t-mono");
    expect(html).toContain(">VOCÊ<");
    expect(html).toContain(">Licitante 38DF<");
  });
});

describe("Histórico de lances", () => {
  const bids: BidDTO[] = [
    { seq: 2, kind: "BID", pseudonym: "Licitante 38DF", amountCents: 1_950_000, at: at(-60_000) },
    { seq: 1, kind: "BID", pseudonym: "Licitante E727", amountCents: 1_400_000, at: at(-120_000) },
  ];
  const html = renderToStaticMarkup(<BidHistory bids={bids} myPseudonym="Licitante 38DF" />);

  it("linhas de fio sólido (o tracejado saiu), valor em tabular-nums e a ordem do servidor", () => {
    expect(html).toContain("border-t border-borda py-3");
    expect(html).not.toMatch(/border-dashed|border-tracejado|space-y-2/);
    expect(html.match(/leading-\[1\.3\] tabular-nums/g)).toHaveLength(2);
    expect(html.indexOf("R$ 19.500,00")).toBeLessThan(html.indexOf("R$ 14.000,00"));
  });

  it("marca só a minha linha com VOCÊ e mantém o título, a contagem e as horas", () => {
    expect(html.match(/>VOCÊ</g)).toHaveLength(1);
    expect(html).toContain(">Histórico de lances<");
    expect(html).toContain("<time ");
    expect(html).toContain(">Nº 2<");
  });

  it("sem lances mostra o texto de sempre", () => {
    expect(renderToStaticMarkup(<BidHistory bids={[]} myPseudonym={null} />)).toContain("Nenhum lance ainda");
  });

  const muitos = (n: number): BidDTO[] =>
    Array.from({ length: n }, (_, i) => ({ seq: n - i, kind: "BID", pseudonym: "Licitante 38DF", amountCents: 1_000_000 + (n - i) * 50_000, at: at(-(i + 1) * 60_000) }));

  it("mostra só os cinco mais novos, com a contagem total e a paginação para os demais", () => {
    const paginado = renderToStaticMarkup(<BidHistory bids={muitos(13)} myPseudonym={null} />);
    expect(paginado.match(/<li /g)).toHaveLength(5);
    expect(paginado).toContain(">Nº 13<");
    expect(paginado).not.toContain(">Nº 8<");
    expect(paginado).toContain("13 LANCES");
    expect(paginado).toContain(`<nav aria-label="Páginas do histórico"`);
    expect(paginado).toMatch(/Página 1 de 3/);
    expect(paginado).toMatch(/<button[^>]*disabled=""[^>]*>Anterior<\/button>/);
    expect(paginado).not.toMatch(/<button[^>]*disabled=""[^>]*>Próxima<\/button>/);
  });

  it("até cinco lances não tem paginação", () => {
    const html = renderToStaticMarkup(<BidHistory bids={muitos(5)} myPseudonym={null} />);
    expect(html.match(/<li /g)).toHaveLength(5);
    expect(html).not.toContain("<nav");
    expect(renderToStaticMarkup(<BidHistory bids={muitos(6)} myPseudonym={null} />)).toContain("<nav");
  });
});

describe("Painel de lance", () => {
  it("papel, fio borda, rounded-2xl, nível 1 e padding de 24px", () => {
    const html = panel(state());
    expect(html).toMatch(/^<div class="space-y-6 rounded-2xl border border-borda bg-papel p-6 shadow-cartao">/);
    expect(html).not.toMatch(/rounded-nenhum|border-\[3px\]|shadow-painel/);
  });

  it("as placas do lance saem idênticas às do componente isolado: o contador não muda", () => {
    const html = panel(state());
    expect(html).toContain(renderToStaticMarkup(<PlacaLance cents={1_950_000} label="LANCE ATUAL" />));
    const final = panel(state({ status: "SOLD", result: { outcome: "SOLD", finalBidCents: 1_950_000, winnerPseudonym: "Licitante 38DF", hammerAt: at(-HOUR), settledAt: at(-HOUR) } }));
    expect(final).toContain(renderToStaticMarkup(<PlacaLance cents={1_950_000} label="LANCE FINAL" />));
    expect(html).toContain("bg-painel");
    expect(html).toContain("var(--f-digito-placa)");
  });

  it("visitante: 'Entre para dar lances' é o botão de Sala de 56px, sem os tamanhos soltos de antes", () => {
    const html = panel(state());
    const link = /<a [^>]*href="\/entrar\?next=\/lotes\/lote-1"[^>]*>/.exec(html)?.[0] ?? "";
    expect(link).toContain("min-h-14 w-full rounded-xl");
    expect(link).not.toMatch(/min-h-\[64px\]|text-\[30px\]/);
    expect(html).toContain("Entre para dar lances");
  });

  it("lote fechado: botão de Sala desabilitado, com o texto de sempre", () => {
    const html = panel(state({ status: "SOLD", result: { outcome: "UNSOLD", finalBidCents: null, winnerPseudonym: null, hammerAt: at(-HOUR), settledAt: at(-HOUR) } }));
    const botao = /<button [^>]*>/.exec(html)?.[0] ?? "";
    expect(botao).toContain("min-h-14");
    expect(botao).not.toMatch(/min-h-\[64px\]|text-\[30px\]/);
    expect(html).toContain("Lote fechado");
  });

  it("a faixa de situação segue numa região aria-live, com a faixa nova", () => {
    const html = panel(state());
    expect(html).toContain('<div aria-live="polite"><div class="flex items-start gap-3 rounded-xl border');
  });
});
