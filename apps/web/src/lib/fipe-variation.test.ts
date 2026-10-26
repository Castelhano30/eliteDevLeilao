import { describe, expect, it } from "vitest";
import { fipeVariation } from "./fipe-variation";

describe("fipeVariation", () => {
  it("acima da FIPE leva sinal +, vírgula e uma casa", () => {
    expect(fipeVariation(5_400_000, 5_000_000)).toBe("+8,0%");
    expect(fipeVariation(5_410_000, 5_000_000)).toBe("+8,2%");
  });

  it("abaixo da FIPE leva o sinal de menos tipográfico", () => {
    expect(fipeVariation(4_850_000, 5_000_000)).toBe("−3,0%");
  });

  it("arredonda a uma casa, meio para longe do zero, nos dois sentidos", () => {
    // 0,25% e −0,25% de 10.000.000 centavos
    expect(fipeVariation(10_025_000, 10_000_000)).toBe("+0,3%");
    expect(fipeVariation(9_975_000, 10_000_000)).toBe("−0,3%");
    expect(fipeVariation(10_024_999, 10_000_000)).toBe("+0,2%");
  });

  it("igual à FIPE, ou tão perto que arredonda para zero, não leva sinal (nunca −0,0%)", () => {
    expect(fipeVariation(5_000_000, 5_000_000)).toBe("0,0%");
    expect(fipeVariation(9_999_999, 10_000_000)).toBe("0,0%");
    expect(fipeVariation(10_000_001, 10_000_000)).toBe("0,0%");
  });

  it("valores grandes não perdem precisão", () => {
    expect(fipeVariation(1_000_000_000, 500_000_000)).toBe("+100,0%");
  });

  it("sem referência válida ou sem valor final (lote sem lances), omite", () => {
    expect(fipeVariation(null, 5_000_000)).toBeNull();
    expect(fipeVariation(5_000_000, 0)).toBeNull();
    expect(fipeVariation(5_000_000, -1)).toBeNull();
    expect(fipeVariation(5_000_000, Number.NaN)).toBeNull();
  });
});
