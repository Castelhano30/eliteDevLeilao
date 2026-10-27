import { describe, expect, it } from "vitest";
import { seededShuffle } from "./seeded-random";

describe("seededShuffle", () => {
  it("a mesma semente dá a mesma ordem, e é uma permutação", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
    expect([...seededShuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
    expect(seededShuffle(items, 1)).not.toEqual(seededShuffle(items, 2));
  });
});
