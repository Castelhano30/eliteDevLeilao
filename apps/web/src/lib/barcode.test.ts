import { describe, expect, it } from "vitest";
import { barcodeBars } from "./barcode";

const HASH = "9f2c1a7e44b0d3a85e6f0c91b27a4d38e1f05a6c7b9d2e4f8a1c3b5d7e9f0a2b";

describe("barcodeBars", () => {
  it("mesma entrada, mesmo desenho", () => {
    expect(barcodeBars(HASH)).toEqual(barcodeBars(HASH));
  });

  it("hashes diferentes desenham barras diferentes", () => {
    expect(barcodeBars(HASH)).not.toEqual(barcodeBars(HASH.replace(/^9f/, "a0")));
  });

  it("cada barra tem de 1 a 4 px, não se sobrepõe e cabe na largura total", () => {
    const { bars, width } = barcodeBars(HASH);
    expect(bars.length).toBeGreaterThan(20);
    let end = 0;
    for (const bar of bars) {
      expect(bar.w).toBeGreaterThanOrEqual(1);
      expect(bar.w).toBeLessThanOrEqual(4);
      expect(bar.x).toBeGreaterThanOrEqual(end);
      end = bar.x + bar.w;
    }
    expect(end).toBeLessThanOrEqual(width);
  });

  it("texto que não é hex ainda dá um desenho estável, sem estourar", () => {
    expect(() => barcodeBars("não é hash")).not.toThrow();
    expect(barcodeBars("").bars).toEqual([]);
  });
});
