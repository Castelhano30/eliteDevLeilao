import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AuditRowDto, AuditView } from "@lanceauto/shared";
import { AuditTable, rowAccentOf } from "./audit-table";
import { HowWeCheck } from "./how-we-check";
import { VerdictBox } from "./verdict-box";

const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

const row = (seq: number, overrides: Partial<AuditRowDto> = {}): AuditRowDto => ({
  seq,
  kind: "BID",
  pseudonym: `Licitante 00${seq}A`,
  mine: false,
  amountCents: 3_000_000 + seq * 100_000,
  at: "2026-10-25T15:04:09.000Z",
  hash: HASH,
  status: "OK",
  ...overrides,
});

function view(overrides: Partial<AuditView> = {}, verdict: Partial<AuditView["verdict"]> = {}): AuditView {
  const entries = [1, 2, 3, 4, 5].map((seq) => row(seq));
  return {
    lot: {
      id: "lot-18",
      number: 18,
      title: "Honda Civic LXS 2012",
      brand: "Honda",
      model: "Civic",
      year: 2012,
      status: "SOLD",
      startsAt: "2026-10-25T13:00:00.000Z",
      endsAt: "2026-10-25T14:00:00.000Z",
      originalEndsAt: "2026-10-25T14:00:00.000Z",
      bidCount: 5,
      imageUrl: null,
    },
    entries,
    verdict: {
      code: "OK",
      firstBad: null,
      okCount: 5,
      foundCount: 5,
      registeredCount: 5,
      sealOk: true,
      receiptChecked: true,
      receiptOk: true,
      consistencyIssue: null,
      ...verdict,
    },
    finalHash: HASH,
    receipt: { finalHash: HASH, receiptCode: "018-7Q2K" },
    verifiedAt: "2026-10-25T15:04:09.000Z",
    serverTime: "2026-10-25T15:04:09.000Z",
    ...overrides,
  };
}

const tampered = (): AuditView => {
  const v = view({}, { code: "BROKEN_AT", firstBad: { seq: 3, expectedSeq: 3, reason: "HASH" }, okCount: 2 });
  v.entries = v.entries.map((entry) => ({ ...entry, status: entry.seq < 3 ? "OK" : entry.seq === 3 ? "MISMATCH" : "BROKEN_LINK" }));
  return v;
};

describe("rowAccentOf (§9): a borda e o fundo seguem o veredito da linha", () => {
  it("OK verde sem realce; MISMATCH ferrugem sobre falha; BROKEN_LINK ferrugem sem fundo", () => {
    expect(rowAccentOf({ status: "OK" })).toEqual({ borderColor: "var(--c-verde)", background: undefined });
    expect(rowAccentOf({ status: "MISMATCH" })).toEqual({ borderColor: "var(--c-ferrugem)", background: "var(--c-falha)" });
    expect(rowAccentOf({ status: "BROKEN_LINK" })).toEqual({ borderColor: "var(--c-ferrugem)", background: undefined });
  });
});

describe("AuditTable (S08 §9)", () => {
  it("região rolável rotulada, colunas na ordem da fatia e uma linha por registro", () => {
    const html = renderToStaticMarkup(<AuditTable view={view()} verifying={false} />);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Histórico de lances do lote 018"');
    expect(html).toContain("min-width:780px");
    const headers = [...html.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
    expect(headers).toEqual(["Nº", "Licitante", "Valor", "Horário", "Hash", "Situação"]);
    expect(html.match(/<tbody>/g)).toHaveLength(1);
    expect(html.split("<tbody>")[1]!.match(/<tr/g)).toHaveLength(5);
  });

  it("número com 2 dígitos, horário de Brasília com segundos e <time> com o ISO", () => {
    const html = renderToStaticMarkup(<AuditTable view={view()} verifying={false} />);
    expect(html).toContain(">01<");
    expect(html).toContain('dateTime="2026-10-25T15:04:09.000Z"');
    expect(html).toContain(">25/10 12:04:09<");
    expect(html).toContain("R$ 31.000,00");
  });

  it("hash abreviado 6…4, botão 'ver inteiro' com aria-expanded=false, aria-controls e nome único por linha", () => {
    const html = renderToStaticMarkup(<AuditTable view={view()} verifying={false} />);
    expect(html).toContain('id="hash-3"');
    expect(html).toContain(">a1b2c3…8f90<");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="hash-3"');
    expect(html).toContain('aria-label="ver hash inteiro da linha 03"');
    expect(html).not.toContain(HASH);
    const labels = [...html.matchAll(/aria-label="(ver hash inteiro [^"]+)"/g)].map((m) => m[1]);
    expect(new Set(labels).size).toBe(5);
  });

  it("íntegro: cinco CONFERE, cada um com ícone aria-hidden", () => {
    const html = renderToStaticMarkup(<AuditTable view={view()} verifying={false} />);
    expect(html.match(/CONFERE/g)).toHaveLength(5);
    expect(html).not.toContain("NÃO CONFERE");
    expect(html).not.toContain("ELO QUEBRADO");
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)?.length).toBe(5);
  });

  it("adulterado na 03: NÃO CONFERE sobre falha; 04 e 05 ELO QUEBRADO esmaecidos; nenhum valor 'original'", () => {
    const html = renderToStaticMarkup(<AuditTable view={tampered()} verifying={false} />);
    expect(html.match(/NÃO CONFERE/g)).toHaveLength(1);
    expect(html.match(/ELO QUEBRADO/g)).toHaveLength(2);
    expect(html.match(/var\(--c-falha\)/g)).toHaveLength(1);
    // Elo quebrado esmaece os 5 campos de dados (2 linhas × 5), nunca a Situação: o contraste do rótulo fica em 4,5:1.
    expect(html.match(/opacity:0\.85/g)).toHaveLength(10);
    const brokenStatus = [...html.matchAll(/<td[^>]*>((?:(?!<\/td>).)*ELO QUEBRADO(?:(?!<\/td>).)*)<\/td>/g)].map((m) => m[1]);
    expect(brokenStatus).toHaveLength(2);
    for (const cell of brokenStatus) expect(cell).not.toContain("opacity");
    expect(html).toContain("inset 6px 0 0 var(--c-ferrugem)");
    expect(html).toContain("inset 6px 0 0 var(--c-verde)");
    expect(html).not.toMatch(/original|esperado|corresponde/i);
  });

  it("verificando de novo: a coluna Situação mostra reticências em vez do veredito antigo", () => {
    const html = renderToStaticMarkup(<AuditTable view={tampered()} verifying />);
    expect(html).not.toContain("CONFERE");
    expect(html).not.toContain("ELO QUEBRADO");
    expect(html.match(/>…</g)).toHaveLength(5);
  });

  it("linha própria ganha a marca VOCÊ; as outras não", () => {
    const v = view();
    v.entries[1] = row(2, { mine: true });
    const html = renderToStaticMarkup(<AuditTable view={v} verifying={false} />);
    expect(html.match(/VOCÊ/g)).toHaveLength(1);
  });

  it("linha CANCEL: 'Cancelado pelo leiloeiro', valor em traço, nota do estorno só se havia lance", () => {
    const withBids = view();
    withBids.entries = [row(1), row(2), row(3, { kind: "CANCEL", pseudonym: null, amountCents: null })];
    const html = renderToStaticMarkup(<AuditTable view={withBids} verifying={false} />);
    expect(html).toContain("Cancelado pelo leiloeiro");
    expect(html).toContain("Saldo comprometido do líder estornado");
    expect(html).toContain(">—<");

    const noBids = view({ lot: { ...view().lot, bidCount: 0 } });
    noBids.entries = [row(1, { kind: "CANCEL", pseudonym: null, amountCents: null })];
    expect(renderToStaticMarkup(<AuditTable view={noBids} verifying={false} />)).not.toContain("estornado");
  });
});

describe("VerdictBox (S08 §9)", () => {
  const render = (v: AuditView | undefined, verifying = false, stale = false) =>
    renderToStaticMarkup(<VerdictBox view={v} verifying={verifying} stale={stale} onVerify={() => {}} />);

  it("íntegro com comprovante: carimbo, frase, hora, contadores e os dois hashes", () => {
    const html = render(view());
    expect(html).toContain("Íntegro");
    expect(html).toContain("5 de 5 lances conferem e o hash final é o mesmo do comprovante.");
    expect(html).toContain("Verificado em 25/10/2026 12:04:09 (Brasília)");
    expect(html).toContain("LINHAS NA CORRENTE");
    expect(html).toContain("REGISTRADAS NO SELO");
    expect(html).toContain("HASH FINAL");
    expect(html).toContain("HASH DO COMPROVANTE");
    expect(html).toContain('aria-controls="hash-final"');
    expect(html).toContain('aria-controls="hash-comprovante"');
    expect(html).not.toContain("DESATUALIZADO");
  });

  it("sem comprovante (ao vivo): sem 'HASH DO COMPROVANTE'", () => {
    const html = render(view({ receipt: null }, { receiptChecked: false, receiptOk: null }));
    expect(html).not.toContain("HASH DO COMPROVANTE");
    expect(html).toContain("O lote ainda não fechou");
  });

  it("adulterado: carimbo Adulterado e a frase com a linha; selo fora deixa os contadores em ferrugem", () => {
    const html = render(tampered());
    expect(html).toContain("Adulterado");
    expect(html).toContain("2 de 5 lances conferem. A corrente quebra na linha 03.");

    const seal = view({}, { code: "SEAL_MISMATCH", foundCount: 3, registeredCount: 5, sealOk: false });
    const sealHtml = render(seal);
    expect(sealHtml).toContain("Faltam 2 no fim da corrente.");
    expect(sealHtml.match(/text-ferrugem/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("a hora e o 'Verificar de novo' vêm antes dos contadores (ordem de leitura e de Tab)", () => {
    const html = render(view());
    expect(html.indexOf("Verificar de novo")).toBeGreaterThan(-1);
    expect(html.indexOf("Verificar de novo")).toBeLessThan(html.indexOf("LINHAS NA CORRENTE"));
  });

  it("verificando: sem carimbo nem frase, com 'Refazendo a conta…' e botão inerte 'Verificando…'", () => {
    const html = render(view(), true);
    expect(html).toContain("Refazendo a conta, elo por elo…");
    expect(html).not.toContain("Íntegro");
    expect(html).not.toContain("conferem");
    expect(html).not.toContain("LINHAS NA CORRENTE");
    expect(html).toContain("Verificando…");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-busy="true"');
  });

  it("primeira carga (sem resultado): só o indicador e o botão", () => {
    const html = render(undefined, true);
    expect(html).toContain("Refazendo a conta, elo por elo…");
    expect(html).not.toContain("Verificado em");
  });

  it("repouso: botão 'Verificar de novo' ativo, sem aria-disabled", () => {
    const html = render(view());
    expect(html).toContain("Verificar de novo");
    expect(html).not.toContain("aria-disabled");
  });

  it("resultado antigo após falha: selo DESATUALIZADO junto da hora", () => {
    expect(render(view(), false, true)).toContain("DESATUALIZADO");
  });
});

describe("HowWeCheck", () => {
  it("três passos numerados, sem prometer verificação no navegador", () => {
    const html = renderToStaticMarkup(<HowWeCheck />);
    expect(html).toContain("Como a gente confere");
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain("HMAC-SHA256");
    expect(html).toContain("Quem confere é o servidor, não o seu navegador.");
    expect(html).not.toMatch(/calculadora/i);
  });
});
