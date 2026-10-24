import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { genesisHash, sealHash } from "./audit-chain";

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
