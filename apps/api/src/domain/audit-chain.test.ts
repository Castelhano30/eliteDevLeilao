import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { entryHash, genesisHash, sealHash, verifyChain, type AuditLot, type AuditRow } from "./audit-chain";

const KEY = "0".repeat(64);
const independent = (message: string) => createHmac("sha256", KEY).update(message).digest("hex");

describe("audit-chain (genesis e selo)", () => {
  const lot = {
    id: "lot-1",
    startsAt: new Date("2026-10-25T13:00:00Z"),
    startingBidCents: 1_500_000n,
    minIncrementCents: 50_000n,
  };

  it("genesis bate com o vetor fixo, com startsAt em ISO com ms", () => {
    expect(genesisHash(KEY, lot)).toBe(independent("v1|genesis|lot-1|2026-10-25T13:00:00.000Z|1500000|50000"));
    expect(genesisHash(KEY, lot)).toBe("a1b3302dbee887c041f9950c4ad39f2fa728c8505ca231e64bd90697b223652b");
  });

  it("number e bigint dão o mesmo genesis; mudar qualquer campo muda o hash", () => {
    const asNumber = { ...lot, startingBidCents: 1_500_000, minIncrementCents: 50_000 };
    expect(genesisHash(KEY, asNumber)).toBe(genesisHash(KEY, lot));
    expect(genesisHash(KEY, { ...lot, startsAt: new Date("2026-10-25T13:00:00.001Z") })).not.toBe(genesisHash(KEY, lot));
    expect(genesisHash(KEY, { ...lot, minIncrementCents: 50_100n })).not.toBe(genesisHash(KEY, lot));
    expect(genesisHash("1".repeat(64), lot)).not.toBe(genesisHash(KEY, lot));
  });

  it("selo do lote novo: v1|seal|{lotId}|0|{genesis}", () => {
    const genesis = genesisHash(KEY, lot);
    expect(sealHash(KEY, "lot-1", 0, genesis)).toBe(independent(`v1|seal|lot-1|0|${genesis}`));
    expect(sealHash(KEY, "lot-1", 0, genesis)).toBe("a9c73d8c0b3b2e68ad0dc570fdf6473ef339a9416edbf666799ca76179baefb5");
  });
});

describe("audit-chain (entrada BID, vetor da §4.5)", () => {
  const entry = {
    lotId: "lot-1",
    seq: 1,
    kind: "BID" as const,
    pseudonym: "Licitante 7F3A",
    amountCents: 3_000_000,
    at: new Date("2026-10-22T14:00:00.123Z"),
    prevHash: "genesis-x",
  };

  it("bate com uma implementação independente (createHmac) e com o hex fixo", () => {
    expect(entryHash(KEY, entry)).toBe(
      independent("v1|entry|lot-1|1|BID|Licitante 7F3A|3000000|2026-10-22T14:00:00.123Z|genesis-x"),
    );
    expect(entryHash(KEY, entry)).toBe("1ad6ba89263e0a72c5b73089659634db4b0cd736279a9a1820aae7e94deec696");
  });

  it("a data entra com milissegundos e Z; bigint e number dão o mesmo hash", () => {
    expect(entryHash(KEY, { ...entry, at: new Date("2026-10-22T14:00:00.000Z") })).toBe(
      independent("v1|entry|lot-1|1|BID|Licitante 7F3A|3000000|2026-10-22T14:00:00.000Z|genesis-x"),
    );
    expect(entryHash(KEY, { ...entry, amountCents: 3_000_000n })).toBe(entryHash(KEY, entry));
  });

  it("nulos viram texto vazio (linha CANCEL)", () => {
    const cancel = { ...entry, kind: "CANCEL" as const, pseudonym: null, amountCents: null };
    expect(entryHash(KEY, cancel)).toBe(independent("v1|entry|lot-1|1|CANCEL|||2026-10-22T14:00:00.123Z|genesis-x"));
  });

  describe("linha CANCEL (S06 §5)", () => {
    const cancel = {
      lotId: "lot-1",
      seq: 3,
      kind: "CANCEL" as const,
      pseudonym: null,
      amountCents: null,
      at: new Date("2026-10-22T14:00:00.123Z"),
      prevHash: "hash-do-lance-2",
    };

    it("string canônica exata: v1|entry|{lotId}|{seq}|CANCEL|||{at}|{prevHash}", () => {
      expect(entryHash(KEY, cancel)).toBe(independent("v1|entry|lot-1|3|CANCEL|||2026-10-22T14:00:00.123Z|hash-do-lance-2"));
    });

    it("mudar seq, at ou prevHash muda o hash", () => {
      const base = entryHash(KEY, cancel);
      expect(entryHash(KEY, { ...cancel, seq: 4 })).not.toBe(base);
      expect(entryHash(KEY, { ...cancel, at: new Date("2026-10-22T14:00:00.124Z") })).not.toBe(base);
      expect(entryHash(KEY, { ...cancel, prevHash: "outro" })).not.toBe(base);
    });

    it("o selo depois do cancelamento conta a linha CANCEL no entryCount", () => {
      const hash = entryHash(KEY, cancel);
      expect(sealHash(KEY, "lot-1", 3, hash)).toBe(independent(`v1|seal|lot-1|3|${hash}`));
      expect(sealHash(KEY, "lot-1", 3, hash)).not.toBe(sealHash(KEY, "lot-1", 2, hash));
    });
  });

  it("qualquer campo, ou a chave, muda o hash", () => {
    const base = entryHash(KEY, entry);
    const changes = [
      { seq: 2 },
      { pseudonym: "Licitante 7F3B" },
      { amountCents: 3_000_001 },
      { prevHash: "genesis-y" },
      { lotId: "lot-2" },
      { at: new Date("2026-10-22T14:00:00.124Z") },
    ];
    for (const change of changes) expect(entryHash(KEY, { ...entry, ...change })).not.toBe(base);
    expect(entryHash("1".repeat(64), entry)).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyChain (S08, R-8.4 a R-8.16)", () => {
  const LOT_ID = "lot-1";
  const startsAt = new Date("2026-10-25T13:00:00.000Z");
  const baseLot = { id: LOT_ID, startsAt, startingBidCents: 1_000_000, minIncrementCents: 10_000 };

  interface Built {
    lot: AuditLot;
    rows: AuditRow[];
    receipt: { finalHash: string; amountCents: number } | null;
  }

  /** Cadeia real com `n` lances (e a linha CANCEL no fim, se pedida), como as S03 e S06 a gravam. */
  function build(n: number, { cancel = false, settled = false } = {}): Built {
    const rows: AuditRow[] = [];
    let prev = genesisHash(KEY, baseLot);
    const push = (kind: "BID" | "CANCEL", pseudonym: string | null, amountCents: number | null) => {
      const seq = rows.length + 1;
      const at = new Date(startsAt.getTime() + seq * 60_000);
      const hash = entryHash(KEY, { lotId: LOT_ID, seq, kind, pseudonym, amountCents, at, prevHash: prev });
      rows.push({ seq, kind, pseudonym, amountCents, at, prevHash: prev, hash });
      prev = hash;
    };
    for (let i = 1; i <= n; i++) push("BID", i % 2 ? "Licitante AAAA" : "Licitante BBBB", 1_000_000 + i * 10_000);
    if (cancel) push("CANCEL", null, null);
    const lot: AuditLot = {
      ...baseLot,
      entryCount: rows.length,
      lastHash: prev,
      seal: sealHash(KEY, LOT_ID, rows.length, prev),
      bidCount: n,
      settledAt: settled ? new Date(startsAt.getTime() + 3_600_000) : null,
      cancelledAt: cancel ? rows[rows.length - 1]!.at : null,
    };
    const lastBid = [...rows].reverse().find((r) => r.kind === "BID");
    const receipt = settled && lastBid ? { finalHash: prev, amountCents: lastBid.amountCents! } : null;
    return { lot, rows, receipt };
  }
  const run = ({ lot, rows, receipt }: Built, key = KEY) => verifyChain(key, lot, rows, receipt);
  const HEX = "ab".repeat(32);

  describe("cadeias válidas", () => {
    it.each([0, 1, 5])("%i linha(s) → OK, todas OK", (n) => {
      const result = run(build(n));
      expect(result.verdict).toBe("OK");
      expect(result.rowStatus).toEqual(Array(n).fill("OK"));
      expect(result).toMatchObject({ firstBad: null, foundCount: n, registeredCount: n, sealOk: true, receiptOk: null, consistencyIssue: null });
    });

    it("arrematado com comprovante: receiptOk true", () => {
      expect(run(build(5, { settled: true }))).toMatchObject({ verdict: "OK", receiptOk: true, consistencyIssue: null });
    });

    it("cancelado com a linha CANCEL no fim, com e sem lances, é válido", () => {
      expect(run(build(3, { cancel: true })).verdict).toBe("OK");
      expect(run(build(0, { cancel: true })).verdict).toBe("OK");
    });

    it("lote sem lances encerrado (settledAt, sem Receipt) é OK", () => {
      expect(run(build(0, { settled: true })).verdict).toBe("OK");
    });

    it("linha CANCEL com pseudônimo e valor nulos hasheia como texto vazio e verifica (§14.7)", () => {
      const built = build(2, { cancel: true });
      const cancel = built.rows[2]!;
      expect(cancel.pseudonym).toBeNull();
      expect(cancel.amountCents).toBeNull();
      expect(cancel.hash).toBe(independent(`v1|entry|${LOT_ID}|3|CANCEL|||${cancel.at.toISOString()}|${cancel.prevHash}`));
      expect(run(built).rowStatus).toEqual(["OK", "OK", "OK"]);
    });
  });

  describe("adulteração de cada campo de cada linha (BROKEN_AT na linha certa)", () => {
    const fields: Record<string, (row: AuditRow) => void> = {
      seq: (row) => void (row.seq += 10),
      kind: (row) => void (row.kind = row.kind === "BID" ? "CANCEL" : "BID"),
      pseudonym: (row) => void (row.pseudonym = "Licitante ZZZZ"),
      amountCents: (row) => void (row.amountCents = (row.amountCents ?? 0) + 100),
      at: (row) => void (row.at = new Date(row.at.getTime() + 1)),
      prevHash: (row) => void (row.prevHash = HEX),
      hash: (row) => void (row.hash = HEX),
    };
    const cases = Object.keys(fields).flatMap((field) => [1, 2, 3, 4, 5].map((seq) => [field, seq] as const));

    it.each(cases)("alterar %s da linha %i", (field, seq) => {
      const built = build(5);
      fields[field]!(built.rows[seq - 1]!);
      const result = run(built);
      expect(result.verdict).toBe("BROKEN_AT");
      expect(result.firstBad?.expectedSeq).toBe(seq);
      expect(result.rowStatus).toEqual(
        Array.from({ length: 5 }, (_, i) => (i + 1 < seq ? "OK" : i + 1 === seq ? "MISMATCH" : "BROKEN_LINK")),
      );
    });

    it("o motivo: HASH para conteúdo, PREV_LINK para o elo, SEQ_GAP para a sequência", () => {
      const reasonOf = (field: string) => {
        const built = build(5);
        fields[field]!(built.rows[2]!);
        return run(built).firstBad?.reason;
      };
      expect(reasonOf("amountCents")).toBe("HASH");
      expect(reasonOf("pseudonym")).toBe("HASH");
      expect(reasonOf("at")).toBe("HASH");
      expect(reasonOf("hash")).toBe("HASH");
      expect(reasonOf("prevHash")).toBe("PREV_LINK");
      expect(reasonOf("seq")).toBe("SEQ_GAP");
    });

    it("hash gravado em maiúsculas ou com tamanho errado não confere (HASH)", () => {
      const upper = build(3);
      upper.rows[1]!.hash = upper.rows[1]!.hash.toUpperCase();
      expect(run(upper).firstBad).toMatchObject({ seq: 2, reason: "HASH" });
      const short = build(3);
      short.rows[1]!.hash = short.rows[1]!.hash.slice(0, 63);
      expect(run(short).firstBad).toMatchObject({ seq: 2, reason: "HASH" });
    });

    it("o firstBad leva a seq da linha adulterada e a esperada", () => {
      const built = build(5);
      built.rows[2]!.seq = 7;
      expect(run(built).firstBad).toEqual({ seq: 7, expectedSeq: 3, reason: "SEQ_GAP" });
    });
  });

  describe("remoção, inserção e selo", () => {
    it("remover uma linha do meio: a seguinte acusa SEQ_GAP e vira a primeira ruim", () => {
      const built = build(5);
      built.rows.splice(2, 1);
      const result = run(built);
      expect(result.verdict).toBe("BROKEN_AT");
      expect(result.firstBad).toEqual({ seq: 4, expectedSeq: 3, reason: "SEQ_GAP" });
      expect(result.rowStatus).toEqual(["OK", "OK", "MISMATCH", "BROKEN_LINK"]);
    });

    it("remover as últimas: SEAL_MISMATCH com found < registered e nenhuma linha ruim", () => {
      const built = build(5);
      built.rows.splice(3, 2);
      const result = run(built);
      expect(result).toMatchObject({ verdict: "SEAL_MISMATCH", firstBad: null, foundCount: 3, registeredCount: 5, sealOk: false });
      expect(result.rowStatus).toEqual(["OK", "OK", "OK"]);
    });

    it("inserir uma linha forjada no fim (hash sem a chave) acusa HASH nela", () => {
      const built = build(3);
      built.rows.push({
        seq: 4,
        kind: "BID",
        pseudonym: "Licitante AAAA",
        amountCents: 9_999_999,
        at: new Date(startsAt.getTime() + 999),
        prevHash: built.lot.lastHash,
        hash: HEX,
      });
      expect(run(built).firstBad).toMatchObject({ seq: 4, reason: "HASH" });
    });

    it("trocar lot.seal, lot.lastHash ou lot.entryCount → SEAL_MISMATCH", () => {
      const seal = build(5);
      seal.lot.seal = HEX;
      expect(run(seal)).toMatchObject({ verdict: "SEAL_MISMATCH", sealOk: false, firstBad: null });
      const last = build(5);
      last.lot.lastHash = HEX;
      expect(run(last).verdict).toBe("SEAL_MISMATCH");
      const count = build(5);
      count.lot.entryCount = 4;
      expect(run(count)).toMatchObject({ verdict: "SEAL_MISMATCH", foundCount: 5, registeredCount: 4 });
    });

    it("o atacante reduz entryCount e lastHash sem recalcular o selo → SEAL_MISMATCH; trocar o selo por hex qualquer também", () => {
      const built = build(5);
      built.rows.splice(3, 2);
      built.lot.entryCount = 3;
      built.lot.lastHash = built.rows[2]!.hash;
      expect(run(built).verdict).toBe("SEAL_MISMATCH");
      built.lot.seal = HEX;
      expect(run(built).verdict).toBe("SEAL_MISMATCH");
    });

    it("lote sem linhas: lastHash diferente do genesis ou parâmetros do lote alterados → SEAL_MISMATCH", () => {
      const forged = build(0);
      forged.lot.lastHash = HEX;
      expect(run(forged).verdict).toBe("SEAL_MISMATCH");
      const moved = build(0);
      moved.lot.startingBidCents = 2_000_000;
      expect(run(moved).verdict).toBe("SEAL_MISMATCH");
    });

    it("alterar o lance inicial com linhas: a linha 1 acusa PREV_LINK", () => {
      const built = build(3);
      built.lot.startingBidCents = 2_000_000;
      expect(run(built).firstBad).toEqual({ seq: 1, expectedSeq: 1, reason: "PREV_LINK" });
    });
  });

  describe("comprovante e consistência fora da cadeia (R-8.11, R-8.16)", () => {
    it("receipt.finalHash diferente → RECEIPT_MISMATCH, linhas OK, receiptOk false", () => {
      const built = build(5, { settled: true });
      built.receipt!.finalHash = HEX;
      const result = run(built);
      expect(result).toMatchObject({ verdict: "RECEIPT_MISMATCH", receiptOk: false, consistencyIssue: null });
      expect(result.rowStatus).toEqual(Array(5).fill("OK"));
    });

    it("sem comprovante: receiptOk null", () => {
      expect(run(build(5)).receiptOk).toBeNull();
    });

    it("vendido sem Receipt → RECEIPT_MISSING", () => {
      const built = build(5, { settled: true });
      built.receipt = null;
      expect(run(built)).toMatchObject({ verdict: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_MISSING", receiptOk: null });
    });

    it("amountCents do Receipt diferente do último lance → RECEIPT_AMOUNT", () => {
      const built = build(5, { settled: true });
      built.receipt!.amountCents += 100;
      expect(run(built)).toMatchObject({ verdict: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_AMOUNT" });
    });

    it("Receipt em lote que fechou sem lances → RECEIPT_UNEXPECTED", () => {
      const built = build(0, { settled: true });
      built.receipt = { finalHash: built.lot.lastHash, amountCents: 1 };
      expect(run(built)).toMatchObject({ verdict: "RECEIPT_MISMATCH", consistencyIssue: "RECEIPT_UNEXPECTED" });
    });

    it("cancelledAt sem linha CANCEL e linha CANCEL sem cancelledAt → CANCEL_FLAG (SEAL_MISMATCH)", () => {
      const flagOnly = build(3);
      flagOnly.lot.cancelledAt = new Date("2026-10-25T14:00:00.000Z");
      expect(run(flagOnly)).toMatchObject({ verdict: "SEAL_MISMATCH", consistencyIssue: "CANCEL_FLAG", sealOk: true });
      const rowOnly = build(3, { cancel: true });
      rowOnly.lot.cancelledAt = null;
      expect(run(rowOnly)).toMatchObject({ verdict: "SEAL_MISMATCH", consistencyIssue: "CANCEL_FLAG" });
    });

    it("CANCEL fora da última posição → CANCEL_FLAG", () => {
      // Assinaturas todas legítimas, mas com um CANCEL no meio: só a regra de posição pega.
      const rows: AuditRow[] = [];
      let prev = genesisHash(KEY, baseLot);
      (["CANCEL", "BID"] as const).forEach((kind, i) => {
        const seq = i + 1;
        const at = new Date(startsAt.getTime() + seq * 1_000);
        const pseudonym = kind === "BID" ? "Licitante AAAA" : null;
        const amountCents = kind === "BID" ? 1_000_000 : null;
        const hash = entryHash(KEY, { lotId: LOT_ID, seq, kind, pseudonym, amountCents, at, prevHash: prev });
        rows.push({ seq, kind, pseudonym, amountCents, at, prevHash: prev, hash });
        prev = hash;
      });
      const lot: AuditLot = {
        ...baseLot,
        entryCount: 2,
        lastHash: prev,
        seal: sealHash(KEY, LOT_ID, 2, prev),
        bidCount: 1,
        settledAt: null,
        cancelledAt: rows[1]!.at,
      };
      expect(verifyChain(KEY, lot, rows, null)).toMatchObject({ verdict: "SEAL_MISMATCH", consistencyIssue: "CANCEL_FLAG" });
    });
  });

  describe("precedência e chave", () => {
    it("linha ruim + selo ruim + comprovante ruim → BROKEN_AT, com sealOk e receiptOk calculados mesmo assim", () => {
      const built = build(5, { settled: true });
      built.rows[1]!.amountCents = 1;
      built.lot.seal = HEX;
      built.receipt!.finalHash = HEX;
      expect(run(built)).toMatchObject({ verdict: "BROKEN_AT", sealOk: false, receiptOk: false });
    });

    it("selo ruim + comprovante ruim → SEAL_MISMATCH vence RECEIPT_MISMATCH", () => {
      const built = build(5, { settled: true });
      built.lot.seal = HEX;
      built.receipt!.finalHash = HEX;
      expect(run(built).verdict).toBe("SEAL_MISMATCH");
    });

    it("BROKEN_AT vence um consistencyIssue de comprovante", () => {
      const built = build(5, { settled: true });
      built.rows[0]!.amountCents = 5;
      built.receipt = null;
      const result = run(built);
      expect(result.verdict).toBe("BROKEN_AT");
      expect(result.consistencyIssue).toBe("RECEIPT_MISSING");
    });

    it("cadeia inteira gravada com a chave errada → BROKEN_AT na linha 1", () => {
      expect(run(build(5), "1".repeat(64))).toMatchObject({ verdict: "BROKEN_AT", firstBad: { seq: 1, reason: "PREV_LINK" } });
    });

    it("adulterar o conteúdo sem mexer no hash gravado mantém o hash final igual ao do comprovante (R-8.12)", () => {
      const built = build(5, { settled: true });
      built.rows[4]!.amountCents = 42;
      expect(run(built)).toMatchObject({ verdict: "BROKEN_AT", receiptOk: true, sealOk: true });
    });
  });
});
