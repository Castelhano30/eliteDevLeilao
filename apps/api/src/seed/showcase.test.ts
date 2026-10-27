import { readFileSync } from "node:fs";
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterAll, describe, expect, it } from "vitest";
import { FakeClock } from "../infra/clock";
import { makeFixtureCatalog, readFixtureImage, type FixtureCar } from "./showcase";

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

describe("readFixtureImage", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lanceauto-seed-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const car = (image: string | null): FixtureCar => ({ ...cars[0]!, image });

  it("lê o arquivo local e devolve os bytes com o tipo pela extensão", async () => {
    writeFileSync(path.join(dir, "foto.PNG"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
    const image = await readFixtureImage(dir, car("foto.PNG"));
    expect(image?.mime).toBe("image/png");
    expect([...image!.data]).toEqual([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  });

  it("sem imagem ou com extensão desconhecida devolve null (ilustração padrão)", async () => {
    expect(await readFixtureImage(dir, car(null))).toBeNull();
    writeFileSync(path.join(dir, "arquivo.svg"), "<svg/>");
    expect(await readFixtureImage(dir, car("arquivo.svg"))).toBeNull();
  });

  it("arquivo apontado e ausente falha em voz alta", async () => {
    await expect(readFixtureImage(dir, car("nao-existe.jpg"))).rejects.toThrow();
  });
});
