import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp, registerUser, testEnv } from "../../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { genesisHash, sealHash } from "../domain/audit-chain";
import { FakeClock } from "../infra/clock";
import { assertLotInvariants, makeUser } from "../../test/helpers/bids";
import { makeFixtureCatalog, seedLiveBids, seedShowcaseLots, type FixtureCar } from "./showcase";

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

  describe("seedLiveBids", () => {
    const EMAILS = ["bruno@lanceauto.test", "ana@lanceauto.test"] as const;

    async function setup(brunoDeposit = 30_000_000) {
      const { app, clock } = makeTestApp(prisma);
      const { user } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
      const ana = await makeUser(app, "Ana", { depositCents: 50_000_000 });
      const bruno = await makeUser(app, "Bruno", { depositCents: brunoDeposit });
      await seedShowcaseLots({ db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY, auctioneerId: user.id, cars, baseDir });
      const deps = { db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY, bidderEmails: EMAILS };
      return { ana, bruno, deps };
    }

    it("dá 5 lances alternados pelo placeBid, o segundo licitante termina na frente e a cadeia fecha", async () => {
      const { ana, bruno, deps } = await setup();
      expect(await seedLiveBids(deps)).toBe(5);

      const lot = await prisma.lot.findFirstOrThrow({ where: { title: "Fiat Uno Mille Way 2010" } });
      const bids = await prisma.bid.findMany({ where: { lotId: lot.id }, orderBy: { seq: "asc" } });
      expect(bids.map((bid) => [bid.seq, bid.bidderId === bruno.id ? "Bruno" : "Ana", Number(bid.amountCents)])).toEqual([
        [1, "Bruno", 1_500_000],
        [2, "Ana", 1_550_000],
        [3, "Bruno", 1_600_000],
        [4, "Ana", 1_650_000],
        [5, "Bruno", 1_700_000],
      ]);
      expect(lot).toMatchObject({ bidCount: 5, entryCount: 5, leaderId: bruno.id, currentBidCents: 1_700_000n });
      const walletOf = (id: string) => prisma.wallet.findUniqueOrThrow({ where: { userId: id } });
      expect((await walletOf(bruno.id)).committedCents).toBe(1_700_000n);
      expect((await walletOf(ana.id)).committedCents).toBe(0n);
      await assertLotInvariants(prisma, lot.id);
    });

    it("é idempotente: a segunda rodada não dá lance nenhum", async () => {
      const { deps } = await setup();
      expect(await seedLiveBids(deps)).toBe(5);
      expect(await seedLiveBids(deps)).toBe(0);
      expect(await prisma.bid.count()).toBe(5);
    });

    it("sem o lote, não faz nada", async () => {
      const { clock } = makeTestApp(prisma);
      expect(await seedLiveBids({ db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY, bidderEmails: EMAILS })).toBe(0);
    });

    it("falha com mensagem clara se um lance for recusado (saldo insuficiente)", async () => {
      const { deps } = await setup(1_000_000);
      await expect(seedLiveBids(deps)).rejects.toThrow(/bruno@lanceauto.test deu 1500000 centavos no lote \d+ e foi recusado .*Saldo insuficiente/);
    });

    it("falha se uma das contas não existir", async () => {
      const { deps } = await setup();
      await expect(seedLiveBids({ ...deps, bidderEmails: ["ninguem@lanceauto.test", "ana@lanceauto.test"] })).rejects.toThrow(
        /a conta ninguem@lanceauto.test não existe/,
      );
    });
  });
});
