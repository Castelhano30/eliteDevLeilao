import { describe, expect, it } from "vitest";
import { FakeClock } from "./clock";

describe("FakeClock", () => {
  it("AC-0.7: devolve o instante fixado e avança em milissegundos", () => {
    const clock = new FakeClock();
    clock.set(new Date("2026-10-22T14:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-10-22T14:00:00.000Z");
    clock.advance(120000);
    expect(clock.now().toISOString()).toBe("2026-10-22T14:02:00.000Z");
  });

  it("não deixa quem chama mexer no relógio por fora", () => {
    const clock = new FakeClock("2026-10-22T14:00:00.000Z");
    clock.now().setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe("2026-10-22T14:00:00.000Z");
  });
});
