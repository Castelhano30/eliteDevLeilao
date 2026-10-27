import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MyBidItem } from "@lanceauto/shared";
import { makeTestApp, registerUser, testEnv } from "../../test/helpers/app";
import { makeUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { seedCancelledLot, seedClosedLots, seedLiveBids, seedShowcaseLots, type FixtureCar } from "./showcase";

const baseDir = path.resolve(__dirname, "../../prisma");
const cars = JSON.parse(readFileSync(path.join(baseDir, "fipe-fixture.json"), "utf8")) as FixtureCar[];

describe.skipIf(!testDatabaseUrl)("seed × Meus arremates (S07 §11, integração)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);

  beforeEach(async () => {
    await truncateAll(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("as duas contas do seed cobrem os cinco estados, pelos mesmos services do seed", async () => {
    const { app, clock } = makeTestApp(prisma);
    const { user: auctioneer } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
    const ana = await makeUser(app, "Ana", { depositCents: 50_000_000 });
    const bruno = await makeUser(app, "Bruno", { depositCents: 30_000_000 });
    const base = { db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY };

    await seedShowcaseLots({ ...base, auctioneerId: auctioneer.id, cars, baseDir });
    await seedLiveBids({ ...base, bidderEmails: ["bruno@lanceauto.test", "ana@lanceauto.test"] });
    await seedClosedLots({
      ...base,
      auctioneerId: auctioneer.id,
      cars,
      baseDir,
      rivalEmail: "bruno@lanceauto.test",
      winnerEmail: "ana@lanceauto.test",
    });
    await seedCancelledLot({
      ...base,
      auctioneerId: auctioneer.id,
      cars,
      baseDir,
      firstBidderEmail: "bruno@lanceauto.test",
      leaderEmail: "ana@lanceauto.test",
    });

    const listOf = async (user: typeof ana) => {
      const res = await request(app).get("/me/bids").set("Authorization", user.auth);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return res.body.items as MyBidItem[];
    };
    const byTitle = (items: MyBidItem[]) => new Map(items.map((item) => [item.lot.title, item]));

    const anaItems = await listOf(ana);
    const brunoItems = await listOf(bruno);
    expect(anaItems.map((item) => item.state).sort()).toEqual(["CANCELLED", "OUTBID", "WON"]);
    expect(brunoItems.map((item) => item.state).sort()).toEqual(["CANCELLED", "LEADING", "LOST"]);

    const a = byTitle(anaItems);
    const b = byTitle(brunoItems);
    // Lote ao vivo: Bruno termina na frente, Ana é superada.
    expect(a.get("Fiat Uno Mille Way 2010")).toMatchObject({ state: "OUTBID", myRank: 2, bidderCount: 2, receiptToken: null });
    expect(b.get("Fiat Uno Mille Way 2010")).toMatchObject({ state: "LEADING", myRank: 1, bidderCount: 2, receiptToken: null });
    // Encerrado: Ana arremata, Bruno perde e vê o pseudônimo de Ana naquele lote.
    const won = a.get("Honda Civic LXS 2012")!;
    const lost = b.get("Honda Civic LXS 2012")!;
    expect(won).toMatchObject({ state: "WON", myRank: null, myBestBidCents: 5_750_000 });
    expect(won.receiptToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(lost).toMatchObject({ state: "LOST", myRank: null, receiptToken: null });
    expect(lost.winnerPseudonym).toBe(won.myPseudonym);
    // Cancelado: Ana liderava e recebe o estorno; Bruno tinha sido superado.
    expect(a.get("Chevrolet Onix 2020")).toMatchObject({ state: "CANCELLED", refundedCents: 2_050_000, myBestBidCents: 2_050_000 });
    expect(b.get("Chevrolet Onix 2020")).toMatchObject({ state: "CANCELLED", refundedCents: null, myBestBidCents: 2_000_000 });
    // O lote encerrado sem lances (Gol) e o agendado não aparecem para ninguém.
    expect(anaItems.some((item) => item.lot.title.includes("Gol GTI"))).toBe(false);
    expect(brunoItems.some((item) => item.lot.title.includes("Gol GTI"))).toBe(false);
  });
});
