import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INITIAL_ANNOUNCEMENT } from "@/lib/my-bids-events";
import { item } from "@/lib/my-bids-fixtures";
import type { MyBidsTab } from "@/lib/my-bids-tabs";
import { BidTicketList } from "./bid-ticket-list";

const ENDS = Date.parse("2026-10-25T10:00:00.000Z");
const BEFORE = ENDS - 60_000;
const AFTER = ENDS + 1_000;

const list = [
  item("OUTBID", { myRank: 2 }, { id: "a", number: 18 }),
  item("LEADING", {}, { id: "b", number: 2, title: "Uno Mille 2010" }),
  item("WON", { receiptToken: "tok-a" }, { id: "c", number: 9, status: "SOLD", title: "Fusca 1300 1975" }),
  item("WON", { receiptToken: "tok-b" }, { id: "d", number: 8, status: "SOLD", title: "Opala 1980" }),
  item("LOST", {}, { id: "e", number: 4, status: "SOLD", title: "Chevette 1982" }),
  item("CANCELLED", { refundedCents: 3_350_000 }, { id: "f", number: 10, status: "CANCELLED", title: "Brasília 1978" }),
];

function render(items = list, tab: MyBidsTab = "ALL", nowMs = BEFORE, text = "") {
  return renderToStaticMarkup(
    <BidTicketList items={items} tab={tab} onTab={() => {}} nowMs={nowMs} announcement={{ ...INITIAL_ANNOUNCEMENT, seq: 1, text }} />,
  );
}

describe("BidTicketList — ingressos (S07 §9)", () => {
  it("um <li> por lote, com id da âncora e tabindex -1", () => {
    const html = render();
    for (const number of ["018", "002", "009", "008", "004", "010"]) expect(html).toContain(`<li id="lote-${number}" tabindex="-1"`);
    expect(html.match(/<li /g)).toHaveLength(6);
  });

  it("o título é link para a sala do lote e dá nome ao cartão", () => {
    const html = render();
    expect(html).toContain('href="/lotes/b"');
    expect(html).toContain("Uno Mille 2010");
  });

  it("só 'Cobrir lance' é ocre, e uma vez por ingresso OUTBID", () => {
    const html = render();
    // Só o preenchimento de repouso conta: `hover:bg-ocreHover` e `active:bg-ocreAtivo` não são outro botão primário.
    expect(html.match(/(?<=["\s])bg-ocre(?=["\s])/g)?.length).toBe(1);
    expect(html.match(/Cobrir lance<\/a>/g)).toHaveLength(1);
    // O chip do pseudônimo não leva a marca VOCÊ em ocre (AC-7.21).
    expect(html).not.toContain(">VOCÊ<");
  });

  it("dois OUTBID: dois 'Cobrir lance', cada um com o nome acessível do próprio lote", () => {
    const html = render([item("OUTBID", { myRank: 2 }, { id: "a", number: 18 }), item("OUTBID", { myRank: 2 }, { id: "z", number: 5, title: "Passat 1990" })]);
    expect(html).toContain('aria-label="Cobrir lance no lote 018, Gol GTI 2.0 1996"');
    expect(html).toContain('aria-label="Cobrir lance no lote 005, Passat 1990"');
  });

  it("apurando: selo neutro e a frase do martelo, sem 'Cobrir lance' e sem posição (AC-7.8)", () => {
    const html = render([item("OUTBID", { myRank: 2 }, { id: "a", number: 18 })], "ALL", AFTER);
    expect(html).toContain("APURANDO");
    expect(html).toContain("Martelo batido. Apurando o resultado…");
    expect(html).toContain("Ir para a sala");
    expect(html).not.toContain("Cobrir lance");
    // O preenchimento de repouso: o segmento do filtro carrega `aria-pressed:bg-ocre` em todos os botões.
    expect(html).not.toMatch(/(?<=["\s])bg-ocre(?=["\s])/);
    expect(html).not.toMatch(/SUPERADO|GANHANDO|º de/);
  });

  it("'Ver comprovante' abre em outra guia, sem window.opener, e cada um leva ao PRÓPRIO token (AC-7.17)", () => {
    const html = render();
    expect(html).toContain('href="/c/tok-a"');
    expect(html).toContain('href="/c/tok-b"');
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Ver comprovante do lote 009, Fusca 1300 1975 (abre em outra guia)"');
    expect(html).toContain('aria-label="Ver comprovante do lote 008, Opala 1980 (abre em outra guia)"');
  });

  it("'Copiar link' tem nome acessível único por lote", () => {
    const html = render();
    expect(html).toContain('aria-label="Copiar link do comprovante do lote 009, Fusca 1300 1975"');
    expect(html).toContain('aria-label="Copiar link do comprovante do lote 008, Opala 1980"');
  });

  it("nenhum nome acessível se repete na lista inteira", () => {
    const names = [...render().matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("Perdido e Cancelado: carimbo, frase e só \"Conferir na auditoria\", com o nome acessível do lote", () => {
    const html = render([list[4]!, list[5]!]);
    expect(html).toContain("Perdido");
    expect(html).toContain("Cancelado");
    expect(html).toContain("Licitante 7F3A levou por R$ 33.500,00. Seu maior lance foi R$ 33.000,00.");
    expect(html).toContain("O saldo que estava travado voltou para você.");
    expect(html.match(/Conferir na auditoria<\/a>/g)).toHaveLength(2);
    expect(html).toMatch(/href="\/lotes\/[^"]+\/auditoria"/);
    expect(html).toMatch(/aria-label="Conferir na auditoria do lote \d{3}, [^"]+"/);
    expect(html).not.toContain("<a href=\"/c/");
  });

  it("valores em reais inteiros, sem centavos soltos (INV-2)", () => {
    const html = render();
    expect(html).toContain("R$ 33.000,00");
    expect(html).not.toMatch(/\d{7,}/);
  });

  it("a página não vaza userId, nome, e-mail nem leaderId", () => {
    expect(render()).not.toMatch(/userId|leaderId|e-mail/i);
  });
});

describe("BidTicketList — abas e vazios", () => {
  it("contadores de dois dígitos que batem com as listas", () => {
    const html = render();
    expect(html).toContain(">Todos<span");
    expect(html).toMatch(/Todos<span[^>]*>06</);
    expect(html).toMatch(/Em disputa<span[^>]*>02</);
    expect(html).toMatch(/Arrematados<span[^>]*>02</);
    expect(html).toMatch(/Perdidos<span[^>]*>01</);
  });

  it("aba 'Em disputa' mostra só os dois ativos e nenhum cancelado", () => {
    const html = render(list, "ACTIVE");
    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html).not.toContain("Brasília 1978");
  });

  it("aba sem itens: a frase da aba e as abas continuam lá", () => {
    const html = render([item("LEADING")], "LOST");
    expect(html).toContain("Nenhum lote nesta aba. Troque de aba para ver o resto.");
    expect(html).toContain("Arrematados");
    expect(html).not.toContain("<li ");
  });

  it("vazio total: frase da §8 e 'Ver a vitrine' secundário, sem abas nem ocre (AC-7.18)", () => {
    const html = render([]);
    expect(html).toContain("Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora.");
    expect(html).toContain('href="/"');
    expect(html).toContain("Ver a vitrine");
    expect(html).not.toContain("bg-ocre");
    expect(html).not.toContain("aria-pressed");
  });

  it("região viva sempre montada; o anúncio entra como nó novo", () => {
    expect(render()).toContain('role="status" aria-live="polite" class="sr-only"');
    expect(render(list, "ALL", BEFORE, "Lote 018: você foi superado.")).toContain("<p>Lote 018: você foi superado.</p>");
    expect(render()).not.toContain("<p></p>");
  });
});
