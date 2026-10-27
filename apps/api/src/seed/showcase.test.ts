import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FakeClock } from "../infra/clock";
import { makeFixtureCatalog, type FixtureCar } from "./showcase";

const baseDir = path.resolve(__dirname, "../../prisma");
const cars = JSON.parse(readFileSync(path.join(baseDir, "fipe-fixture.json"), "utf8")) as FixtureCar[];

describe("fipe-fixture.json", () => {
  it("tem os carros do seed com marca canônica e nenhum preço quebrado", async () => {
    const catalog = makeFixtureCatalog(cars, new FakeClock());
    expect(cars.length).toBeGreaterThanOrEqual(7);
    const brands = (await catalog.brands()).map((b) => b.name);
    expect(brands).toContain("Volkswagen");
    expect(brands).not.toContain("VW - VolksWagen");
    for (const car of cars) expect(Number.isInteger(car.priceCents) && car.priceCents > 0).toBe(true);
  });
});
