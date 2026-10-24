import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { entryHash, genesisHash, sealHash } from "./audit-chain";

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
