import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp, registerUser, testEnv } from "../../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { genesisHash, sealHash } from "../domain/audit-chain";
import { FakeClock } from "../infra/clock";
import { makeFixtureCatalog, seedShowcaseLots, type FixtureCar } from "./showcase";

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

describe.skipIf(!testDatabaseUrl)("seed dos lotes (integração, sem rede)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);

  beforeEach(async () => {
    await truncateAll(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria o ao vivo (30 dias) e o agendado, com genesis e selo válidos, e não repete", async () => {
    const { app, clock } = makeTestApp(prisma);
    const { user } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
    const deps = { db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY, auctioneerId: user.id, cars, baseDir };
    const numbers = await seedShowcaseLots(deps);
    expect(numbers).toHaveLength(2);
    expect(await seedShowcaseLots(deps)).toEqual([]);

    const list = await request(app).get("/lots");
    expect(list.body.counts).toEqual({ live: 1, scheduled: 1, ended: 0 });
    const [live, scheduled] = list.body.lots;
    expect(live).toMatchObject({ title: "Fiat Uno Mille Way 2010", status: "LIVE", startingBidCents: 1_500_000, minIncrementCents: 50_000, imageUrl: null });
    expect(live.startsAt).toBe("2026-10-23T11:00:00.000Z");
    expect(live.endsAt).toBe("2026-11-22T12:00:00.000Z");
    expect(scheduled).toMatchObject({ title: "Toyota Corolla XEi 2015", status: "SCHEDULED", startsAt: "2026-10-25T12:00:00.000Z" });

    for (const lot of await prisma.lot.findMany()) {
      expect(lot.lastHash).toBe(genesisHash(testEnv.AUDIT_HMAC_KEY, lot));
      expect(lot.seal).toBe(sealHash(testEnv.AUDIT_HMAC_KEY, lot.id, 0, lot.lastHash));
    }

    // seed:demo cria mais um ao vivo mesmo com lotes existentes
    expect(await seedShowcaseLots(deps, { demo: true })).toHaveLength(1);
    expect(await prisma.lot.count()).toBe(3);
  });
});
