import { describe, expect, it } from "vitest";
import { pseudonymFor } from "./pseudonym";
import { rankFrom } from "./rank";

const KEY = "0".repeat(64);

describe("pseudonymFor", () => {
  it("é 'Licitante ' + 4 hex maiúsculos, estável no mesmo lote", () => {
    const name = pseudonymFor(KEY, "user-1", "lot-1");
    expect(name).toMatch(/^Licitante [0-9A-F]{4}$/);
    expect(pseudonymFor(KEY, "user-1", "lot-1")).toBe(name);
  });

  it("muda de lote para lote, de usuário para usuário e de chave para chave", () => {
    const names = new Set([
      pseudonymFor(KEY, "user-1", "lot-1"),
      pseudonymFor(KEY, "user-1", "lot-2"),
      pseudonymFor(KEY, "user-2", "lot-1"),
      pseudonymFor("1".repeat(64), "user-1", "lot-1"),
    ]);
    expect(names.size).toBe(4);
  });
});

describe("rankFrom", () => {
  const best = new Map([
    ["ana", 3_300_000],
    ["bruno", 3_100_000],
    ["carla", 3_200_000],
  ]);

  it("conta cada licitante uma vez, pelo maior lance", () => {
    expect(rankFrom(best, "ana")).toEqual({ rank: 1, myBestBidCents: 3_300_000 });
    expect(rankFrom(best, "carla")).toEqual({ rank: 2, myBestBidCents: 3_200_000 });
    expect(rankFrom(best, "bruno")).toEqual({ rank: 3, myBestBidCents: 3_100_000 });
  });

  it("sem lance meu, null (nunca '0º')", () => {
    expect(rankFrom(best, "joao")).toBeNull();
    expect(rankFrom(new Map(), "ana")).toBeNull();
  });
});
