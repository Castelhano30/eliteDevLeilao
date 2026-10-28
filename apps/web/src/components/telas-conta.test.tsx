import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReceiptDTO } from "@lanceauto/shared";
import { INITIAL_ANNOUNCEMENT } from "@/lib/my-bids-events";
import { item } from "@/lib/my-bids-fixtures";
import { HowWeCheck } from "./audit/how-we-check";
import { Recibo } from "./comprovante/recibo";
import { BidTicketList } from "./my-bids/bid-ticket-list";
import { RoleTickets } from "./role-tickets";

const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
const css = read("../app/globals.css");

const RECEIPT: ReceiptDTO = {
  lotNumber: 9, receiptCode: "CMP-0009", lotId: "lote-9", car: { title: "Fusca 1300 1975", year: 1975, fuel: "Gasolina", referencePriceCents: 4_000_000, referenceMonth: "2026-10", imageUrl: null, imageCredit: null } as ReceiptDTO["car"],
  amountCents: 4_150_000, bidCount: 12, extended: true, hammerAt: "2026-10-24T17:02:18.000Z", settledAt: "2026-10-24T17:02:20.000Z", winnerPseudonym: "Licitante 38DF",
  finalHash: "f384d8a1b2c3d4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e", auditUrl: "/lotes/lote-9/auditoria",
};

describe("Acesso: bilhetes de perfil", () => {
  const html = renderToStaticMarkup(<RoleTickets value="BIDDER" onChange={() => undefined} />);

  it("cartões rounded-xl: o selecionado com borda ocre, fundo selecionado e check; o outro papel com fio", () => {
    expect(html.match(/rounded-xl border/g)).toHaveLength(2);
    expect(html).toContain("border-ocre bg-selecionado");
    expect(html).toContain("border-borda bg-papel");
    expect(html.match(/<svg aria-hidden="true"/g)).toHaveLength(1);
    expect(html).not.toMatch(/rounded-nenhum|border-\[3px\]|bg-ocre text-sobreOcre|shadow-botao/);
  });

  it("continuam dois radios acessíveis com os mesmos textos", () => {
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain("checked");
    for (const text of ["LICITANTE", "LEILOEIRO", "Dá lances e guarda saldo.", "Monta lotes e recebe as vendas.", "Eu sou"]) expect(html).toContain(text);
  });
});

describe("Meus arremates: o canhoto", () => {
  const html = renderToStaticMarkup(
    <BidTicketList items={[item("WON", { receiptToken: "tok-a" }, { id: "c", number: 9, status: "SOLD", title: "Fusca 1300 1975" })]} tab="ALL" onTab={() => {}} nowMs={0} announcement={{ ...INITIAL_ANNOUNCEMENT, seq: 1, text: "" }} />,
  );

  it("rounded-xl com fio e nível 1, recortado, sem a borda de 3px nem a sombra dura", () => {
    expect(html).toContain("@container relative overflow-hidden rounded-xl border border-borda bg-papel p-4 shadow-cartao");
    expect(html).not.toMatch(/rounded-nenhum|border-\[3px\]/);
  });

  it("o picote é o único tracejado: vertical no cartão largo e horizontal no estreito, cada um com dois recortes na cor da página", () => {
    expect(html.match(/border-dashed/g)).toHaveLength(2);
    expect(html).toContain("left-[160px] hidden border-l-2 border-dashed border-tracejado @[44rem]:block");
    expect(html).toContain("relative -mx-4 border-t-2 border-dashed border-tracejado @[44rem]:hidden");
    expect(html.match(/rounded-full border border-borda bg-fundo/g)).toHaveLength(4);
  });

  it("os outros separadores são fio sólido de 1px e os valores usam tabular-nums", () => {
    expect(html).toContain("border-t border-borda pt-3 @[44rem]:border-t-0 @[44rem]:pt-0");
    // As ações ficam na coluna da direita, depois do picote: a linha tracejada não atravessa os botões.
    expect(html).toContain("@[44rem]:flex-col @[44rem]:items-stretch");
    expect(html).toContain("break-all text-[18px] font-semibold tabular-nums");
  });

  it("o picote é decorativo (aria-hidden) e o título segue sendo o nome do cartão", () => {
    expect(html.match(/aria-hidden="true"[^>]*border-dashed/g)?.length).toBe(2);
    expect(html).toMatch(/<article aria-labelledby="ingresso-c"/);
    expect(html).toContain("Fusca 1300 1975");
  });
});

describe("Comprovante: o recibo", () => {
  const html = renderToStaticMarkup(<Recibo receipt={RECEIPT} />);

  it("papel, rounded-xl, fio e nível 2, recortado, sem rotação e sem drop-shadow duro", () => {
    expect(html).toContain("mx-auto w-full max-w-[760px] overflow-hidden rounded-xl border border-borda bg-papel shadow-painel");
    // Só o recibo: a etiqueta do lote lá dentro mantém a própria inclinação.
    const article = /<article [^>]*>/.exec(html)?.[0] ?? "";
    expect(article).not.toMatch(/rotate|drop-shadow|c-sombra|border-2|style=/);
    expect(html).not.toMatch(/drop-shadow|c-sombra/);
  });

  it("dois picotes, hash em 14px com quebra livre e valores em tabular-nums", () => {
    expect(html.match(/border-dashed border-tracejado/g)).toHaveLength(2);
    expect(html).toContain("select-all text-[14px] leading-[1.5] tabular-nums [overflow-wrap:anywhere]");
    expect(html).toContain(RECEIPT.finalHash);
    expect(html).toContain("m-0 min-w-0 flex-1 tabular-nums [overflow-wrap:anywhere]");
  });

  it("o conteúdo continua o mesmo", () => {
    for (const text of ["Fusca 1300 1975", "Licitante 38DF", "CMP-0009", "PRORROGADO", "Arrematado"]) expect(html).toContain(text);
    expect(html).toContain('aria-label="Recibo CMP-0009"');
  });
});

describe("Auditoria: o aviso 'Como conferimos'", () => {
  const html = renderToStaticMarkup(<HowWeCheck />);

  it("é o aviso informativo com os três passos numerados em tabular-nums", () => {
    expect(html).toContain("border-ocre bg-selecionado");
    expect(html).not.toContain('role="status"');
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain('aria-labelledby="como-confere"');
    expect(html).not.toMatch(/border-\[3px\]|rounded-nenhum|t-cartaz/);
  });
});

describe("Carteira: o cartão Disponível", () => {
  it("claro: fundo ocre e texto sobreOcre; noite (também pelo sistema): selecionado com fio destaque", () => {
    expect(css).toMatch(/\.cartao-disponivel \{[^}]*background: var\(--c-ocre\)[^}]*color: var\(--c-sobre-ocre\)/);
    expect(css).toMatch(/\[data-theme="noite"\] \.cartao-disponivel \{[^}]*background: var\(--c-selecionado\)[^}]*border-color: var\(--c-destaque\)/);
    expect(css).toMatch(/:root:not\(\[data-theme="claro"\]\) \.cartao-disponivel \{[^}]*background: var\(--c-selecionado\)/);
  });

  it("a tela usa o cartão com 40px/800 tabular-nums e os outros cartões em rounded-2xl", () => {
    const source = read("./wallet-screen.tsx");
    expect(source).toContain("cartao-disponivel");
    expect(source).toContain("text-[40px] break-all font-extrabold leading-[1.1] tabular-nums");
    expect(source).toContain("rounded-2xl border border-borda bg-papel p-5 shadow-cartao");
  });
});

describe("Telas de conta e consulta: nada do estilo antigo", () => {
  const FILES = [
    "access-screen.tsx", "role-tickets.tsx", "wallet-screen.tsx", "criar-lote-form.tsx",
    "my-bids/bid-ticket.tsx", "my-bids/my-bids-screen.tsx", "my-bids/status-seal.tsx",
    "comprovante/comprovante.tsx", "comprovante/recibo.tsx",
    "audit/audit-screen.tsx", "audit/audit-table.tsx", "audit/how-we-check.tsx", "audit/verdict-box.tsx",
  ];
  it.each(FILES)("%s: sem canto reto, borda de 2 ou 3px, sombra dura nem título de 26px em caixa-alta", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/rounded-nenhum|border-\[3px\]|border-\[4px\]|drop-shadow\(|boxShadow:\s*"\d+px \d+px 0|t-cartaz-subtitulo/);
    expect(source).not.toMatch(/border-2 (?!border-dashed)/);
  });

  it("o tracejado só sobra no picote do canhoto e do recibo", () => {
    const comTracejado = FILES.filter((file) => /border-dashed/.test(read(file)));
    expect(comTracejado.sort()).toEqual(["my-bids/bid-ticket.tsx"]);
    expect(read("ui/perforation.tsx")).toContain("border-dashed");
  });
});
