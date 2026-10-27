import { describe, expect, it } from "vitest";
import {
  AUDIT_TEXT,
  abbreviateHash,
  auditPath,
  auditRowDtoSchema,
  auditViewSchema,
  problemBanner,
  verdictAnnouncement,
  verdictSentence,
  type AuditRowDto,
  type AuditView,
} from "./audit";

const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

function row(seq: number, overrides: Partial<AuditRowDto> = {}): AuditRowDto {
  return {
    seq,
    kind: "BID",
    pseudonym: "Licitante 7F3A",
    mine: false,
    amountCents: 3_100_000 + seq * 100,
    at: "2026-10-25T13:05:00.000Z",
    hash: HASH,
    status: "OK",
    ...overrides,
  };
}

/** Auditoria íntegra de um lote arrematado com `n` lances; os testes sobrescrevem o que muda. */
function view(n: number, overrides: Partial<AuditView["verdict"]> = {}, extra: Partial<AuditView> = {}): AuditView {
  const entries = Array.from({ length: n }, (_, i) => row(i + 1));
  return {
    lot: {
      id: "lot-1",
      number: 18,
      title: "Toyota Corolla XEi 2015",
      brand: "Toyota",
      model: "Corolla",
      year: 2015,
      status: "SOLD",
      startsAt: "2026-10-25T13:00:00.000Z",
      endsAt: "2026-10-25T14:00:00.000Z",
      originalEndsAt: "2026-10-25T14:00:00.000Z",
      bidCount: n,
      imageUrl: null,
    },
    entries,
    verdict: {
      code: "OK",
      firstBad: null,
      okCount: n,
      foundCount: n,
      registeredCount: n,
      sealOk: true,
      receiptChecked: true,
      receiptOk: true,
      consistencyIssue: null,
      ...overrides,
    },
    finalHash: HASH,
    receipt: { finalHash: HASH, receiptCode: "018-7Q2K" },
    verifiedAt: "2026-10-25T15:00:00.000Z",
    serverTime: "2026-10-25T15:00:00.000Z",
    ...extra,
  };
}

describe("abbreviateHash (§10)", () => {
  it("6 primeiros, reticências e 4 últimos", () => {
    expect(abbreviateHash(HASH)).toBe("a1b2c3…8f90");
    expect(abbreviateHash(HASH)).toHaveLength(11);
  });

  it("hash curto demais não é abreviado (nada de repetir caracteres)", () => {
    expect(abbreviateHash("abc123")).toBe("abc123");
    expect(abbreviateHash("")).toBe("");
  });
});

describe("auditPath", () => {
  it("monta a rota da auditoria do lote", () => {
    expect(auditPath("abc")).toBe("/lotes/abc/auditoria");
  });
});

describe("verdictSentence, OK (§8)", () => {
  it("com comprovante", () => {
    expect(verdictSentence(view(5))).toBe(
      "5 de 5 lances conferem e o hash final é o mesmo do comprovante. Ninguém mexeu em nada depois do martelo.",
    );
  });

  it("plural: 1 lance confere", () => {
    expect(verdictSentence(view(1))).toBe(
      "1 de 1 lance confere e o hash final é o mesmo do comprovante. Ninguém mexeu em nada depois do martelo.",
    );
  });

  it("sem comprovante (ao vivo, em apuração)", () => {
    const live = view(3, { receiptChecked: false, receiptOk: null }, { receipt: null, lot: { ...view(3).lot, status: "LIVE" } });
    expect(verdictSentence(live)).toBe(
      "3 de 3 lances conferem e o hash final bate com o selo do lote. O lote ainda não fechou: a conta vale para este instante.",
    );
  });

  it("com linha CANCEL: 'registros'", () => {
    const cancelled = view(4, { receiptChecked: false, receiptOk: null }, { receipt: null });
    cancelled.entries[3] = row(4, { kind: "CANCEL", pseudonym: null, amountCents: null });
    cancelled.lot.status = "CANCELLED";
    expect(verdictSentence(cancelled)).toBe(
      "4 de 4 registros conferem e o hash final bate com o selo do lote. O lote foi cancelado e o cancelamento está na corrente.",
    );
  });

  it("sem lances", () => {
    const empty = view(0, { receiptChecked: false, receiptOk: null }, { receipt: null });
    empty.lot.status = "UNSOLD";
    expect(verdictSentence(empty)).toBe("Sem lances, sem corrente para conferir. O estado inicial do lote e o selo conferem.");
    empty.lot.status = "SCHEDULED";
    expect(verdictSentence(empty)).toBe("Sem lances, sem corrente para conferir. O estado inicial do lote e o selo conferem.");
  });

  it("sem lances e cancelado", () => {
    const empty = view(0, { receiptChecked: false, receiptOk: null }, { receipt: null });
    empty.lot.status = "CANCELLED";
    expect(verdictSentence(empty)).toBe("Sem lances, sem corrente para conferir. O lote foi cancelado antes do primeiro lance.");
  });
});

describe("verdictSentence, BROKEN_AT", () => {
  const broken = (receiptOk: boolean | null) => {
    const v = view(5, { code: "BROKEN_AT", firstBad: { seq: 3, expectedSeq: 3, reason: "HASH" }, okCount: 2, receiptOk });
    return v;
  };

  it("com o hash final também fora do comprovante", () => {
    expect(verdictSentence(broken(false))).toBe(
      "2 de 5 lances conferem. A corrente quebra na linha 03. O hash final também não bate com o comprovante.",
    );
  });

  it("com o hash final igual ao do comprovante (R-8.12)", () => {
    expect(verdictSentence(broken(true))).toBe(
      "2 de 5 lances conferem. A corrente quebra na linha 03. O hash final continua igual ao do comprovante, mas a linha 03 não gera o hash guardado para ela.",
    );
  });

  it("sem comprovante: só a quebra", () => {
    expect(verdictSentence(broken(null))).toBe("2 de 5 lances conferem. A corrente quebra na linha 03.");
  });

  it("registros quando há CANCEL; N de 1 usa o singular", () => {
    const cancel = broken(null);
    cancel.entries[4] = row(5, { kind: "CANCEL", pseudonym: null, amountCents: null });
    expect(verdictSentence(cancel)).toBe("2 de 5 registros conferem. A corrente quebra na linha 03.");
    const one = view(1, { code: "BROKEN_AT", firstBad: { seq: 1, expectedSeq: 1, reason: "HASH" }, okCount: 0, receiptOk: null });
    expect(verdictSentence(one)).toBe("0 de 1 lance confere. A corrente quebra na linha 01.");
  });
});

describe("verdictSentence, SEAL_MISMATCH e RECEIPT_MISMATCH", () => {
  it("faltam no fim da corrente (M > N)", () => {
    const v = view(3, { code: "SEAL_MISMATCH", sealOk: false, registeredCount: 5, receiptOk: true });
    expect(verdictSentence(v)).toBe(
      "As 3 linhas encontradas conferem entre si, mas o selo do lote registra 5. Faltam 2 no fim da corrente.",
    );
    const one = view(4, { code: "SEAL_MISMATCH", sealOk: false, registeredCount: 5 });
    expect(verdictSentence(one)).toBe(
      "As 4 linhas encontradas conferem entre si, mas o selo do lote registra 5. Falta 1 no fim da corrente.",
    );
  });

  it("sobram linhas (M < N)", () => {
    const v = view(5, { code: "SEAL_MISMATCH", sealOk: false, registeredCount: 3 });
    expect(verdictSentence(v)).toBe(
      "As 5 linhas encontradas conferem entre si, mas o selo do lote registra 3. Há 2 linhas além do que o selo registra.",
    );
    const one = view(4, { code: "SEAL_MISMATCH", sealOk: false, registeredCount: 3 });
    expect(verdictSentence(one)).toContain("Há 1 linha além do que o selo registra.");
  });

  it("contagem igual", () => {
    const v = view(5, { code: "SEAL_MISMATCH", sealOk: false });
    expect(verdictSentence(v)).toBe(
      "As 5 linhas conferem entre si, mas o selo do lote não bate com a contagem e o hash final gravados.",
    );
  });

  it("sem linhas e selo fora (estado inicial alterado)", () => {
    const v = view(0, { code: "SEAL_MISMATCH", sealOk: false, receiptChecked: false, receiptOk: null });
    expect(verdictSentence(v)).toBe("Não há linhas na corrente, mas o selo do lote não bate com o estado inicial gravado.");
    const missing = view(0, { code: "SEAL_MISMATCH", sealOk: false, registeredCount: 2 });
    expect(verdictSentence(missing)).toBe(
      "Não há linhas na corrente, mas o selo do lote registra 2. Faltam 2 no fim da corrente.",
    );
  });

  it("CANCEL_FLAG", () => {
    const v = view(3, { code: "SEAL_MISMATCH", consistencyIssue: "CANCEL_FLAG" });
    expect(verdictSentence(v)).toBe(
      "As 3 linhas conferem entre si, mas o cancelamento do lote e a corrente não concordam.",
    );
  });

  it("RECEIPT_MISMATCH, uma frase por motivo", () => {
    expect(verdictSentence(view(5, { code: "RECEIPT_MISMATCH", receiptOk: false }))).toBe(
      "A corrente e o selo conferem, mas o hash final do comprovante é outro. O comprovante foi alterado ou não pertence a este lote.",
    );
    expect(verdictSentence(view(5, { code: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_MISSING", receiptOk: null }))).toBe(
      "A corrente e o selo conferem, mas este lote consta como arrematado e o comprovante não existe.",
    );
    expect(verdictSentence(view(5, { code: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_AMOUNT" }))).toBe(
      "A corrente e o selo conferem, mas o valor do comprovante não é o do último lance.",
    );
    expect(verdictSentence(view(0, { code: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_UNEXPECTED" }))).toBe(
      "A corrente e o selo conferem, mas existe um comprovante para um lote que fechou sem lances.",
    );
  });
});

describe("problemBanner (§8)", () => {
  const brokenBy = (reason: "HASH" | "SEQ_GAP" | "PREV_LINK", expectedSeq = 3) => {
    const v = view(5, { code: "BROKEN_AT", firstBad: { seq: 4, expectedSeq, reason }, okCount: 3 });
    v.entries[3] = row(4, { status: "MISMATCH" });
    return v;
  };

  it("OK não tem banner", () => {
    expect(problemBanner(view(5))).toBeNull();
  });

  it("BROKEN_AT por HASH, por SEQ_GAP e por PREV_LINK", () => {
    expect(problemBanner(brokenBy("HASH"))).toBe("Linha 04: o lance gravado não gera o hash guardado para ele.");
    expect(problemBanner(brokenBy("SEQ_GAP"))).toBe("Linha 04: a sequência pulou. Era esperada a linha 03.");
    expect(problemBanner(brokenBy("PREV_LINK"))).toBe("Linha 04: o elo com a linha anterior não fecha.");
  });

  it("HASH em linha CANCEL fala em 'registro'", () => {
    const v = brokenBy("HASH");
    v.entries[3] = row(4, { kind: "CANCEL", pseudonym: null, amountCents: null, status: "MISMATCH" });
    expect(problemBanner(v)).toBe("Linha 04: o registro gravado não gera o hash guardado para ele.");
  });

  it("selo, comprovante e motivos de consistência", () => {
    expect(problemBanner(view(3, { code: "SEAL_MISMATCH", sealOk: false, registeredCount: 5 }))).toBe(
      "O selo do lote não fecha com a corrente. Nenhuma linha existente está errada, mas faltam ou sobram registros.",
    );
    expect(problemBanner(view(5, { code: "RECEIPT_MISMATCH", receiptOk: false }))).toBe(
      "O hash do comprovante não é o hash final deste lote.",
    );
    expect(problemBanner(view(5, { code: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_MISSING", receiptOk: null }))).toBe(
      "A corrente e o selo conferem, mas este lote consta como arrematado e o comprovante não existe.",
    );
    expect(problemBanner(view(3, { code: "SEAL_MISMATCH", consistencyIssue: "CANCEL_FLAG" }))).toBe(
      "As 3 linhas conferem entre si, mas o cancelamento do lote e a corrente não concordam.",
    );
  });
});

describe("verdictAnnouncement (região viva)", () => {
  it("íntegro e adulterado", () => {
    expect(verdictAnnouncement(view(5))).toBe("Veredito: íntegro. 5 de 5 lances conferem.");
    expect(verdictAnnouncement(view(1))).toBe("Veredito: íntegro. 1 de 1 lance confere.");
    expect(verdictAnnouncement(view(0))).toBe("Veredito: íntegro. Sem lances, sem corrente para conferir.");
    const broken = view(5, { code: "BROKEN_AT", firstBad: { seq: 3, expectedSeq: 3, reason: "HASH" }, okCount: 2, receiptOk: null });
    expect(verdictAnnouncement(broken)).toBe(
      "Veredito: adulterado. 2 de 5 lances conferem. A corrente quebra na linha 03.",
    );
  });
});

describe("textos fixos", () => {
  it("os que vêm do design/EXPERIENCE ficam exatos", () => {
    expect(AUDIT_TEXT.verifying).toBe("Refazendo a conta, elo por elo…");
    expect(AUDIT_TEXT.legend).toBe("AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN");
    expect(AUDIT_TEXT.rowStatus).toEqual({ OK: "CONFERE", MISMATCH: "NÃO CONFERE", BROKEN_LINK: "ELO QUEBRADO" });
    expect(AUDIT_TEXT.emptyChain).toBe("Sem lances, sem corrente para conferir.");
  });

  it("a meta do lote diz o status em texto", () => {
    expect(AUDIT_TEXT.statusMeta).toEqual({
      LIVE: "AO VIVO",
      SCHEDULED: "AGENDADO",
      CLOSING: "EM APURAÇÃO",
      SOLD: "ARREMATADO",
      UNSOLD: "SEM LANCES",
      CANCELLED: "CANCELADO",
    });
  });
});

describe("contrato zod", () => {
  it("aceita a view e a linha, e recusa status de linha desconhecido", () => {
    expect(auditViewSchema.safeParse(view(3)).success).toBe(true);
    expect(auditRowDtoSchema.safeParse(row(1)).success).toBe(true);
    expect(auditRowDtoSchema.safeParse({ ...row(1), status: "OUTRO" }).success).toBe(false);
  });

  it("a linha CANCEL leva pseudônimo e valor nulos", () => {
    expect(auditRowDtoSchema.safeParse(row(2, { kind: "CANCEL", pseudonym: null, amountCents: null })).success).toBe(true);
  });

  it("o schema não tem lugar para token, userId nem hash esperado: chaves extras são removidas", () => {
    const parsed = auditViewSchema.parse({ ...view(1), token: "segredo", receipt: { finalHash: HASH, receiptCode: "001-ABCD", token: "segredo" } });
    expect(JSON.stringify(parsed)).not.toContain("segredo");
  });
});
