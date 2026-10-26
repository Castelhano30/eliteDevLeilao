import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp, registerUser, testEnv, tokenFor } from "../../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { genesisHash, sealHash } from "../domain/audit-chain";
import { FakeClock } from "../infra/clock";
import { assertLotInvariants, makeUser } from "../../test/helpers/bids";
import { makeFixtureCatalog, seedCancelledLot, seedClosedLots, seedLiveBids, seedShowcaseLots, type FixtureCar } from "./showcase";

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

    it("pula o lote cancelado ou encerrado sem lance, com log, em vez de falhar", async () => {
      const { deps } = await setup();
      const lot = await prisma.lot.findFirstOrThrow({ where: { title: "Fiat Uno Mille Way 2010" } });
      const logs: string[] = [];
      await prisma.lot.update({ where: { id: lot.id }, data: { cancelledAt: deps.clock.now() } });
      expect(await seedLiveBids({ ...deps, log: (message) => void logs.push(message) })).toBe(0);
      expect(logs.join(" ")).toMatch(/cancelado/);

      await prisma.lot.update({ where: { id: lot.id }, data: { cancelledAt: null, endsAt: new Date(deps.clock.now().getTime() - 1000) } });
      logs.length = 0;
      expect(await seedLiveBids({ ...deps, log: (message) => void logs.push(message) })).toBe(0);
      expect(logs.join(" ")).toMatch(/encerrou/);
      expect(await prisma.bid.count()).toBe(0);
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

  describe("seedClosedLots (S05 §11)", () => {
    async function setup() {
      const { app, clock } = makeTestApp(prisma);
      const { user } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
      const ana = await makeUser(app, "Ana", { depositCents: 50_000_000 });
      const bruno = await makeUser(app, "Bruno", { depositCents: 30_000_000 });
      const logs: string[] = [];
      const deps = {
        db: prisma,
        clock,
        auditKey: testEnv.AUDIT_HMAC_KEY,
        auctioneerId: user.id,
        cars,
        baseDir,
        rivalEmail: "bruno@lanceauto.test",
        winnerEmail: "ana@lanceauto.test",
        log: (message: string) => void logs.push(message),
      };
      return { app, ana, bruno, auctioneerId: user.id, deps, logs };
    }

    it("cria o arrematado (com prorrogação) e o sem lances pelos services, com a cadeia válida", async () => {
      const { app, ana, bruno, auctioneerId, deps, logs } = await setup();
      const result = await seedClosedLots(deps);

      expect(result.created).toBe(2);
      expect(result.receiptPath).toMatch(/^\/c\/[A-Za-z0-9_-]{32}$/);
      expect(logs.join("\n")).toContain(`Comprovante de demonstração: ${result.receiptPath}`);

      const sold = await prisma.lot.findFirstOrThrow({ where: { title: "Honda Civic LXS 2012" } });
      const unsold = await prisma.lot.findFirstOrThrow({ where: { title: "Volkswagen Gol GTI 1996" } });
      const listed = await request(app).get("/lots?status=ENDED");
      expect(listed.body.lots.map((lot: { id: string; status: string }) => [lot.id, lot.status])).toEqual([
        [unsold.id, "UNSOLD"],
        [sold.id, "SOLD"],
      ]);

      // 4 lances alternados; o último, a 40 s do fim, prorrogou em +2 min (fim = início + 60 min − 40 s + 2 min).
      expect(sold).toMatchObject({ bidCount: 4, entryCount: 4, currentBidCents: 5_750_000n });
      expect(sold.endsAt.getTime() - sold.originalEndsAt.getTime()).toBe(80_000);
      expect(sold.settledAt!.getTime()).toBeGreaterThan(sold.endsAt.getTime());
      expect(sold.createdAt.getTime()).toBeLessThan(Date.parse("2026-10-23T12:00:00.000Z") - 2 * 24 * 3_600_000);
      await assertLotInvariants(prisma, sold.id);

      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { lotId: sold.id } });
      expect(result.receiptPath).toBe(`/c/${receipt.token}`);
      expect(receipt).toMatchObject({ winnerId: ana.id, amountCents: 5_750_000n, finalHash: sold.lastHash });
      const dto = (await request(app).get(`/receipts/${receipt.token}`)).body;
      expect(dto).toMatchObject({ extended: true, bidCount: 4, amountCents: 5_750_000, hammerAt: sold.endsAt.toISOString() });

      // Ana pagou, Bruno foi liberado, o leiloeiro recebeu; e os saldos do seed seguem cobrindo novos lances.
      const walletOf = (id: string) => prisma.wallet.findUniqueOrThrow({ where: { userId: id } });
      expect(await walletOf(ana.id)).toMatchObject({ totalCents: 50_000_000n - 5_750_000n, committedCents: 0n });
      expect(await walletOf(bruno.id)).toMatchObject({ totalCents: 30_000_000n, committedCents: 0n });
      expect(await walletOf(auctioneerId)).toMatchObject({ totalCents: 5_750_000n });

      // Sem lances: só settledAt.
      expect(unsold.bidCount).toBe(0);
      expect(unsold.settledAt).not.toBeNull();
      expect(await prisma.receipt.count({ where: { lotId: unsold.id } })).toBe(0);
      await assertLotInvariants(prisma, unsold.id);
    });

    it("é idempotente: a segunda rodada não cria, não liquida e devolve o mesmo comprovante", async () => {
      const { deps, logs } = await setup();
      const first = await seedClosedLots(deps);
      const before = { lots: await prisma.lot.count(), bids: await prisma.bid.count(), ledger: await prisma.ledgerEntry.count() };

      const second = await seedClosedLots(deps);
      expect(second).toEqual({ created: 0, receiptPath: first.receiptPath });
      expect(await prisma.lot.count()).toBe(before.lots);
      expect(await prisma.bid.count()).toBe(before.bids);
      expect(await prisma.ledgerEntry.count()).toBe(before.ledger);
      expect(await prisma.receipt.count()).toBe(1);
      expect(logs.filter((message) => message.includes("já existe"))).toHaveLength(2);
    });

    it("retoma lote arrematado criado sem lances e lote sem lances ainda não liquidado", async () => {
      const { deps: fresh } = await setup();
      const { makeLotService } = await import("../services/lot.service");
      const { toDate } = await import("../infra/clock");
      const fake = new FakeClock(toDate(fresh.clock.now().getTime() - 3 * 24 * 3_600_000));
      const lots = makeLotService({ db: prisma, clock: fake, auditKey: testEnv.AUDIT_HMAC_KEY, catalog: makeFixtureCatalog(cars, fake), images: { suggest: async () => ({ status: "NOT_FOUND" }) }, imageStore: { download: async () => null } });
      for (const [title, key, daysAgo, minimum, increment] of [["Honda Civic LXS 2012", "civic-2012", 3, 5_000_000, 250_000], ["Volkswagen Gol GTI 1996", "gol-gti-1996", 2, 4_000_000, 100_000]] as const) {
        const car = cars.find((item) => item.key === key)!;
        const start = fresh.clock.now().getTime() - daysAgo * 24 * 3_600_000;
        fake.set(toDate(start));
        await lots.createLot(fresh.auctioneerId, { brandId: car.brandId, modelId: car.modelId, yearId: car.yearId, title, startingBidCents: minimum, minIncrementCents: increment, startsAt: toDate(start).toISOString(), endsAt: toDate(start + 3_600_000).toISOString() }, { allowPast: true });
      }
      const soldBefore = await prisma.lot.findFirstOrThrow({ where: { title: "Honda Civic LXS 2012" } });
      const rival = await prisma.user.findUniqueOrThrow({ where: { email: fresh.rivalEmail } });
      const { makeBidService } = await import("../services/bid.service");
      fake.set(toDate(soldBefore.startsAt.getTime() + 5 * 60_000));
      await makeBidService({ db: prisma, clock: fake, auditKey: testEnv.AUDIT_HMAC_KEY }).placeBid(rival.id, "BIDDER", soldBefore.id, { amountCents: 5_000_000, expectedCurrentCents: null });
      const result = await seedClosedLots(fresh);
      expect(result).toEqual({ created: 0, receiptPath: expect.stringMatching(/^\/c\//) });
      expect(await prisma.lot.count()).toBe(2);
      expect((await prisma.lot.findFirstOrThrow({ where: { title: "Honda Civic LXS 2012" } })).bidCount).toBe(4);
      expect((await prisma.lot.findFirstOrThrow({ where: { title: "Volkswagen Gol GTI 1996" } })).settledAt).not.toBeNull();
      expect(await prisma.bid.count({ where: { lotId: soldBefore.id } })).toBe(4);
      expect(await prisma.receipt.count({ where: { lotId: soldBefore.id } })).toBe(1);
      expect(await seedClosedLots(fresh)).toEqual(result);
      expect(await prisma.bid.count({ where: { lotId: soldBefore.id } })).toBe(4);
    });

    it("falha com mensagem clara se uma das contas não existir", async () => {
      const { deps } = await setup();
      await expect(seedClosedLots({ ...deps, rivalEmail: "ninguem@lanceauto.test" })).rejects.toThrow(
        /a conta ninguem@lanceauto.test não existe/,
      );
    });

    it("falha com mensagem clara se um lance for recusado (saldo insuficiente)", async () => {
      const { app, auctioneerId } = await setup();
      const poor = await makeUser(app, "Pobre", { depositCents: 1_000_000 });
      await expect(
        seedClosedLots({
          db: prisma,
          clock: makeTestApp(prisma).clock,
          auditKey: testEnv.AUDIT_HMAC_KEY,
          auctioneerId,
          cars,
          baseDir,
          rivalEmail: poor.email,
          winnerEmail: "ana@lanceauto.test",
        }),
      ).rejects.toThrow(/lance de 5000000 centavos no lote \d+ foi recusado .*Saldo insuficiente/);
    });
  });

  describe("seedCancelledLot (S06 §11)", () => {
    async function setup() {
      const { app, clock } = makeTestApp(prisma);
      const { user } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
      const ana = await makeUser(app, "Ana", { depositCents: 50_000_000 });
      const bruno = await makeUser(app, "Bruno", { depositCents: 30_000_000 });
      const logs: string[] = [];
      const deps = {
        db: prisma,
        clock,
        auditKey: testEnv.AUDIT_HMAC_KEY,
        auctioneerId: user.id,
        cars,
        baseDir,
        firstBidderEmail: "bruno@lanceauto.test",
        leaderEmail: "ana@lanceauto.test",
        log: (message: string) => void logs.push(message),
      };
      return { app, ana, bruno, auctioneerId: user.id, deps, logs };
    }

    /** Depois de qualquer seed: o comprometido de cada carteira é a soma dos lances dos lotes AO VIVO que ela lidera. */
    async function expectBalanceInvariant() {
      const live = await prisma.lot.findMany({ where: { cancelledAt: null, settledAt: null, leaderId: { not: null } } });
      for (const wallet of await prisma.wallet.findMany()) {
        const led = live.filter((lot) => lot.leaderId === wallet.userId).reduce((sum, lot) => sum + (lot.currentBidCents ?? 0n), 0n);
        expect(wallet.committedCents).toBe(led);
      }
    }

    it("cria o lote pelos services: dois lances, cancelamento com estorno ao líder, linha CANCEL e cadeia válida", async () => {
      const { app, ana, bruno, auctioneerId, deps, logs } = await setup();
      const result = await seedCancelledLot(deps);
      expect(result).toEqual({ created: 1 });

      const lot = await prisma.lot.findFirstOrThrow({ where: { title: "Chevrolet Onix 2020" } });
      const realNow = deps.clock.now().getTime();
      const start = realNow - 2 * 3_600_000;
      expect(lot).toMatchObject({ bidCount: 2, entryCount: 3, leaderId: ana.id, currentBidCents: 2_050_000n });
      expect(lot.startsAt.getTime()).toBe(start);
      expect(lot.endsAt.getTime()).toBe(start + 10 * 24 * 3_600_000);
      expect(lot.cancelledAt?.getTime()).toBe(start + 60 * 60_000);
      const bids = await prisma.bid.findMany({ where: { lotId: lot.id }, orderBy: { seq: "asc" } });
      expect(
        bids.map((bid) => [
          bid.seq,
          bid.kind,
          bid.bidderId === bruno.id ? "Bruno" : bid.bidderId === ana.id ? "Ana" : null,
          bid.amountCents === null ? null : Number(bid.amountCents),
          bid.at.getTime() - start,
        ]),
      ).toEqual([
        [1, "BID", "Bruno", 2_000_000, 20 * 60_000],
        [2, "BID", "Ana", 2_050_000, 30 * 60_000],
        [3, "CANCEL", null, null, 60 * 60_000],
      ]);
      const ledger = await prisma.ledgerEntry.findMany({ where: { lotId: lot.id }, orderBy: { seq: "asc" } });
      expect(ledger.map((entry) => [entry.kind, entry.userId === ana.id ? "Ana" : "Bruno", Number(entry.amountCents)])).toEqual([
        ["HOLD", "Bruno", 2_000_000],
        ["RELEASE", "Bruno", 2_000_000],
        ["HOLD", "Ana", 2_050_000],
        ["REFUND", "Ana", 2_050_000],
      ]);
      await assertLotInvariants(prisma, lot.id);
      await expectBalanceInvariant();
      for (const user of [ana, bruno]) {
        expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).committedCents).toBe(0n);
      }

      // Fora da Vitrine; no Painel do leiloeiro aparece cancelado, com o estorno.
      expect((await request(app).get("/lots")).body.lots).toHaveLength(0);
      const mine = await request(app).get("/my/lots").set("Authorization", `Bearer ${tokenFor(auctioneerId, "AUCTIONEER")}`);
      expect(mine.body.lots).toHaveLength(1);
      expect(mine.body.lots[0]).toMatchObject({ status: "CANCELLED", refundedCents: 2_050_000, bidCount: 2 });
      expect(logs.join(" ")).toMatch(/cancelado/);
    });

    it("é idempotente: a segunda rodada não cria nem cancela de novo", async () => {
      const { deps, logs } = await setup();
      await seedCancelledLot(deps);
      const before = { lots: await prisma.lot.count(), bids: await prisma.bid.count(), ledger: await prisma.ledgerEntry.count() };

      expect(await seedCancelledLot(deps)).toEqual({ created: 0 });
      expect(await prisma.lot.count()).toBe(before.lots);
      expect(await prisma.bid.count()).toBe(before.bids);
      expect(await prisma.ledgerEntry.count()).toBe(before.ledger);
      expect(logs.filter((message) => message.includes("já existe"))).toHaveLength(1);
    });

    it("retoma o lote criado com um lance e ainda não cancelado", async () => {
      const { deps } = await setup();
      const { makeLotService } = await import("../services/lot.service");
      const { makeBidService } = await import("../services/bid.service");
      const { toDate } = await import("../infra/clock");
      const start = deps.clock.now().getTime() - 2 * 3_600_000;
      const fake = new FakeClock(toDate(start));
      const car = cars.find((item) => item.key === "onix-2020")!;
      const lots = makeLotService({
        db: prisma,
        clock: fake,
        auditKey: testEnv.AUDIT_HMAC_KEY,
        catalog: makeFixtureCatalog(cars, fake),
        images: { suggest: async () => ({ status: "NOT_FOUND" }) },
        imageStore: { download: async () => null },
      });
      const { response } = await lots.createLot(
        deps.auctioneerId,
        {
          brandId: car.brandId,
          modelId: car.modelId,
          yearId: car.yearId,
          title: "Chevrolet Onix 2020",
          startingBidCents: 2_000_000,
          minIncrementCents: 50_000,
          startsAt: toDate(start).toISOString(),
          endsAt: toDate(start + 10 * 24 * 3_600_000).toISOString(),
        },
        { allowPast: true },
      );
      const bruno = await prisma.user.findUniqueOrThrow({ where: { email: deps.firstBidderEmail } });
      fake.set(toDate(start + 20 * 60_000));
      await makeBidService({ db: prisma, clock: fake, auditKey: testEnv.AUDIT_HMAC_KEY }).placeBid(bruno.id, "BIDDER", response.lot.id, {
        amountCents: 2_000_000,
        expectedCurrentCents: null,
      });

      expect(await seedCancelledLot(deps)).toEqual({ created: 0 });
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: response.lot.id } });
      expect(lot).toMatchObject({ bidCount: 2, entryCount: 3 });
      expect(lot.cancelledAt).not.toBeNull();
      await assertLotInvariants(prisma, lot.id);
      await expectBalanceInvariant();
    });

    it("falha com mensagem clara se uma das contas não existir", async () => {
      const { deps } = await setup();
      await expect(seedCancelledLot({ ...deps, leaderEmail: "ninguem@lanceauto.test" })).rejects.toThrow(
        /a conta ninguem@lanceauto.test não existe/,
      );
    });

    it("falha com mensagem clara se um lance for recusado (saldo insuficiente)", async () => {
      const { app, deps } = await setup();
      const poor = await makeUser(app, "Pobre", { depositCents: 1_000_000 });
      await expect(seedCancelledLot({ ...deps, firstBidderEmail: poor.email })).rejects.toThrow(
        /lance de 2000000 centavos no lote \d+ foi recusado .*Saldo insuficiente/,
      );
    });
  });
});
