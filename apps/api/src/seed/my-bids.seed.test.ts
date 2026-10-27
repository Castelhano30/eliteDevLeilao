import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MyBidItem } from "@lanceauto/shared";
import { makeTestApp, testEnv, tokenFor } from "../../test/helpers/app";
import { createTestPrisma, restartLotNumbering, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { runSeed, type FixtureCar } from "./showcase";

const baseDir = path.resolve(__dirname, "../../prisma");
const cars = JSON.parse(readFileSync(path.join(baseDir, "fipe-fixture.json"), "utf8")) as FixtureCar[];

describe.skipIf(!testDatabaseUrl)("seed final × Meus arremates (S07 §11, integração)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);

  beforeEach(async () => {
    await truncateAll(prisma);
    await restartLotNumbering(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("as duas contas do seed cobrem os cinco estados, pelos mesmos services do seed", async () => {
    const { app, clock } = makeTestApp(prisma);
    await runSeed({ db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY, jwtSecret: testEnv.JWT_SECRET, cars, baseDir });

    const listOf = async (email: string) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const res = await request(app).get("/me/bids").set("Authorization", `Bearer ${tokenFor(user.id, "BIDDER")}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return res.body.items as MyBidItem[];
    };
    const byTitle = (items: MyBidItem[]) => new Map(items.map((item) => [item.lot.title, item]));

    const anaItems = await listOf("ana@lanceauto.test");
    const brunoItems = await listOf("bruno@lanceauto.test");
    expect(anaItems.map((item) => item.state).sort()).toEqual(["CANCELLED", "OUTBID", "WON"]);
    expect(brunoItems.map((item) => item.state).sort()).toEqual(["CANCELLED", "LEADING", "LOST"]);

    const a = byTitle(anaItems);
    const b = byTitle(brunoItems);
    // Lote ao vivo (005): Bruno abre e termina na frente; a Ana é superada e pode cobrir.
    expect(a.get("Fiat Uno Mille Way 2010")).toMatchObject({ state: "OUTBID", myRank: 2, bidderCount: 2, receiptToken: null });
    expect(b.get("Fiat Uno Mille Way 2010")).toMatchObject({ state: "LEADING", myRank: 1, bidderCount: 2, receiptToken: null });
    // Encerrado (001): a Ana arremata, o Bruno perde e vê o pseudônimo dela naquele lote.
    const won = a.get("Honda Civic LXS 2012")!;
    const lost = b.get("Honda Civic LXS 2012")!;
    expect(won).toMatchObject({ state: "WON", myRank: null, myBestBidCents: 5_750_000 });
    expect(won.receiptToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(lost).toMatchObject({ state: "LOST", myRank: null, receiptToken: null });
    expect(lost.winnerPseudonym).toBe(won.myPseudonym);
    // Cancelado (003): o Bruno liderava e recebe o estorno; a Ana tinha sido superada.
    expect(b.get("Chevrolet Onix 2020")).toMatchObject({ state: "CANCELLED", refundedCents: 2_050_000, myBestBidCents: 2_050_000 });
    expect(a.get("Chevrolet Onix 2020")).toMatchObject({ state: "CANCELLED", refundedCents: null, myBestBidCents: 2_000_000 });
    // O encerrado sem lances (002) e o agendado (004) não aparecem para ninguém.
    for (const items of [anaItems, brunoItems]) {
      expect(items.some((item) => item.lot.title.includes("Gol GTI"))).toBe(false);
      expect(items.some((item) => item.lot.title.includes("Corolla"))).toBe(false);
    }
  });
});
