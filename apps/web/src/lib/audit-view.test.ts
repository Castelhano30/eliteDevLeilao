import { describe, expect, it } from "vitest";
import type { AuditRowDto, AuditView } from "@lanceauto/shared";
import {
  MIN_VERIFYING_MS,
  auditScreenState,
  auditTitle,
  bidderCell,
  counterView,
  hashToggle,
  lineNumber,
  lotMetaLine,
  rowStatusView,
  rowTimeLabel,
  shouldStartVerify,
  verifiedAtLabel,
} from "./audit-view";

const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

const verdict = (overrides: Partial<AuditView["verdict"]> = {}): AuditView["verdict"] => ({
  code: "OK",
  firstBad: null,
  okCount: 5,
  foundCount: 5,
  registeredCount: 5,
  sealOk: true,
  receiptChecked: true,
  receiptOk: true,
  consistencyIssue: null,
  ...overrides,
});

const row = (overrides: Partial<AuditRowDto> = {}): AuditRowDto => ({
  seq: 9,
  kind: "BID",
  pseudonym: "Licitante 7F3A",
  mine: false,
  amountCents: 3_100_000,
  at: "2026-10-25T13:05:00.000Z",
  hash: HASH,
  status: "OK",
  ...overrides,
});

describe("rowStatusView (§8 e §9): texto + ícone, nunca só cor", () => {
  it("CONFERE, NÃO CONFERE e ELO QUEBRADO", () => {
    expect(rowStatusView("OK")).toMatchObject({ label: "CONFERE", icon: "check", tone: "verde", border: "verde", highlight: false, faded: false });
    expect(rowStatusView("MISMATCH")).toMatchObject({ label: "NÃO CONFERE", icon: "x", tone: "ferrugem", border: "ferrugem", highlight: true, faded: false });
    expect(rowStatusView("BROKEN_LINK")).toMatchObject({ label: "ELO QUEBRADO", icon: "broken", tone: "ferrugem", border: "ferrugem", highlight: false, faded: true });
  });

  it("só a linha que não confere ganha o fundo de falha; só o elo quebrado fica esmaecido", () => {
    const all = (["OK", "MISMATCH", "BROKEN_LINK"] as const).map(rowStatusView);
    expect(all.filter((s) => s.highlight)).toHaveLength(1);
    expect(all.filter((s) => s.faded)).toHaveLength(1);
  });
});

describe("lineNumber, lotMetaLine, auditTitle, verifiedAtLabel", () => {
  it("o número da linha tem 2 dígitos", () => {
    expect(lineNumber(9)).toBe("09");
    expect(lineNumber(12)).toBe("12");
  });

  it("a meta diz ano, lances e o status em texto (cancelado não conta a linha CANCEL)", () => {
    expect(lotMetaLine({ year: 2015, bidCount: 5, status: "SOLD" })).toBe("2015 · LANCES: 5 · ARREMATADO");
    expect(lotMetaLine({ year: 2020, bidCount: 3, status: "CANCELLED" })).toBe("2020 · LANCES: 3 · CANCELADO");
    expect(lotMetaLine({ year: 2012, bidCount: 0, status: "UNSOLD" })).toBe("2012 · LANCES: 0 · SEM LANCES");
    expect(lotMetaLine({ year: 2012, bidCount: 2, status: "CLOSING" })).toBe("2012 · LANCES: 2 · EM APURAÇÃO");
    expect(lotMetaLine({ year: 2012, bidCount: 2, status: "LIVE" })).toBe("2012 · LANCES: 2 · AO VIVO");
    expect(lotMetaLine({ year: 2012, bidCount: 0, status: "SCHEDULED" })).toBe("2012 · LANCES: 0 · AGENDADO");
  });

  it("o horário da linha é dd/mm HH:mm:ss em Brasília", () => {
    expect(rowTimeLabel("2026-10-25T15:04:09.000Z")).toBe("25/10 12:04:09");
    expect(rowTimeLabel("2026-10-26T02:30:00.000Z")).toBe("25/10 23:30:00");
  });

  it("o título da aba leva o número do lote com 3 dígitos", () => {
    expect(auditTitle(18)).toBe("Auditoria do lote 018 · LanceAuto");
  });

  it("verificado em usa Brasília com segundos", () => {
    expect(verifiedAtLabel("2026-10-25T15:04:09.000Z")).toBe("Verificado em 25/10/2026 12:04:09 (Brasília)");
  });
});

describe("bidderCell", () => {
  it("BID: pseudônimo e a marca VOCÊ só se mine", () => {
    expect(bidderCell(row())).toEqual({ kind: "bid", pseudonym: "Licitante 7F3A", mine: false, note: null });
    expect(bidderCell(row({ mine: true }))).toMatchObject({ kind: "bid", mine: true });
  });

  it("CANCEL: 'Cancelado pelo leiloeiro' e, com lance, a nota do estorno", () => {
    const cancel = row({ kind: "CANCEL", pseudonym: null, amountCents: null });
    expect(bidderCell(cancel, true)).toEqual({ kind: "cancel", label: "Cancelado pelo leiloeiro", note: "Saldo comprometido do líder estornado" });
    expect(bidderCell(cancel, false)).toEqual({ kind: "cancel", label: "Cancelado pelo leiloeiro", note: null });
  });
});

describe("counterView (§9)", () => {
  it("íntegro: nenhum contador em alerta", () => {
    expect(counterView(verdict(), { hasReceipt: true })).toEqual({ inChain: 5, inSeal: 5, chainAlert: false, sealAlert: false, receiptShown: true, receiptAlert: false });
  });

  it("selo fora: NA CORRENTE e NO SELO em ferrugem, comprovante não", () => {
    const v = verdict({ code: "SEAL_MISMATCH", foundCount: 3, registeredCount: 5, sealOk: false });
    expect(counterView(v, { hasReceipt: false })).toEqual({ inChain: 3, inSeal: 5, chainAlert: true, sealAlert: true, receiptShown: false, receiptAlert: false });
  });

  it("comprovante fora: só o HASH DO COMPROVANTE em ferrugem", () => {
    const v = verdict({ code: "RECEIPT_MISMATCH", receiptOk: false });
    expect(counterView(v, { hasReceipt: true })).toMatchObject({ chainAlert: false, sealAlert: false, receiptShown: true, receiptAlert: true });
  });

  it("linha quebrada com o hash final igual ao do comprovante: nenhum contador em alerta", () => {
    const v = verdict({ code: "BROKEN_AT", receiptOk: true, firstBad: { seq: 3, expectedSeq: 3, reason: "HASH" } });
    expect(counterView(v, { hasReceipt: true })).toMatchObject({ chainAlert: false, sealAlert: false, receiptAlert: false });
  });

  it("linha quebrada com o hash final diferente do comprovante: o comprovante vai a ferrugem", () => {
    const v = verdict({ code: "BROKEN_AT", receiptOk: false, firstBad: { seq: 3, expectedSeq: 3, reason: "HASH" } });
    expect(counterView(v, { hasReceipt: true }).receiptAlert).toBe(true);
  });
});

describe("hashToggle: nome acessível único e alvo controlado", () => {
  it("recolhido → 'ver inteiro'; aberto → 'recolher'", () => {
    expect(hashToggle("hash-9", "da linha 09", false)).toEqual({
      text: "ver inteiro",
      ariaLabel: "ver hash inteiro da linha 09",
      controls: "hash-9",
      expanded: false,
    });
    expect(hashToggle("hash-9", "da linha 09", true)).toEqual({
      text: "recolher",
      ariaLabel: "recolher hash da linha 09",
      controls: "hash-9",
      expanded: true,
    });
  });
});

describe("auditScreenState e shouldStartVerify (R-8.14, AC-8.24)", () => {
  const base = { hasData: false, isFetching: false, isError: false, notFound: false };

  it("primeira carga: verificando; erro sem dado: erro; 404: não encontrado", () => {
    expect(auditScreenState({ ...base, isFetching: true })).toBe("verifying");
    expect(auditScreenState({ ...base, isError: true })).toBe("error");
    expect(auditScreenState({ ...base, isError: true, notFound: true })).toBe("notfound");
  });

  it("com resultado: mostra; verificando de novo esconde o veredito; erro mantém o resultado como DESATUALIZADO", () => {
    expect(auditScreenState({ ...base, hasData: true })).toBe("result");
    expect(auditScreenState({ ...base, hasData: true, isFetching: true })).toBe("verifying");
    expect(auditScreenState({ ...base, hasData: true, isError: true })).toBe("stale");
  });

  it("clique em 'Verificar de novo' durante a verificação é ignorado", () => {
    expect(shouldStartVerify(false)).toBe(true);
    expect(shouldStartVerify(true)).toBe(false);
  });

  it("o 'Verificando' dura no mínimo 400 ms", () => {
    expect(MIN_VERIFYING_MS).toBe(400);
  });
});
