import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp, testEnv, tokenFor } from "../../test/helpers/app";
import { createTestPrisma, restartLotNumbering, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { deadUrl, fipeHandler, json, startFakeServer, type FakeServer } from "../../test/helpers/fake-server";
import { runSeed, type FixtureCar } from "../seed/showcase";

const baseDir = path.resolve(__dirname, "../../prisma");
const cars = JSON.parse(readFileSync(path.join(baseDir, "fipe-fixture.json"), "utf8")) as FixtureCar[];
const DAY = 24 * 60 * 60 * 1000;

/** AC13 / R-9.9: com FIPE e Wikipedia fora, só `/catalog/*` e `POST /lots` degradam. */
describe.skipIf(!testDatabaseUrl)("resiliência com FIPE e Wikipedia fora (S09)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let dead: string;
  let fipe: FakeServer;

  beforeAll(async () => {
    dead = await deadUrl();
    fipe = await startFakeServer(fipeHandler);
  });
  afterAll(async () => {
    await fipe.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await truncateAll(prisma);
    await restartLotNumbering(prisma);
    fipe.hits.length = 0;
    fipe.setHandler(fipeHandler);
  });

  const seeded = async (app: ReturnType<typeof makeTestApp>["app"], clock: ReturnType<typeof makeTestApp>["clock"]) => {
    await runSeed({ db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY, jwtSecret: testEnv.JWT_SECRET, cars, baseDir });
    const lots = await prisma.lot.findMany({ orderBy: { number: "asc" }, include: { receipt: true, item: true } });
    const auctioneer = await prisma.user.findUniqueOrThrow({ where: { email: "leiloeiro@lanceauto.test" } });
    return { lots, auth: `Bearer ${tokenFor(auctioneer.id, "AUCTIONEER")}`, app };
  };

  it("AC-9.10: Vitrine, Sala, auditoria, comprovante e imagem respondem 200 do banco, sem chamar ninguém", async () => {
    const { app, clock } = makeTestApp(prisma, { FIPE_BASE_URL: dead, WIKIPEDIA_BASE_URL: dead });
    const { lots } = await seeded(app, clock);
    const sold = lots.find((lot) => lot.receipt)!;
    const urls = ["/lots", `/lots/${sold.id}`, `/lots/${sold.id}/audit`, `/receipts/${sold.receipt!.token}`];
    for (const url of urls) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
    }
    const live = lots.find((lot) => lot.number === 5)!;
    const room = await request(app).get(`/lots/${live.id}`);
    expect(room.body.lot.status).toBe("LIVE");
    expect(room.body.car.imageUrl).toBeNull();
    // Sem foto no fixture: a imagem do item responde 404 do banco (a Sala usa a ilustração padrão), nunca 5xx.
    expect((await request(app).get(`/items/${live.itemId}/image`)).status).toBe(404);
  });

  it("AC-9.11: FIPE fora e sem cache → 503 EXTERNAL_UNAVAILABLE {source:FIPE} com no máximo 2 tentativas; com cache vencido serve o cache", async () => {
    const { app, clock } = makeTestApp(prisma, { FIPE_BASE_URL: fipe.url, WIKIPEDIA_BASE_URL: dead });
    const { auth } = await seeded(app, clock);
    fipe.setHandler((_req, res) => json(res, 500, {}));
    const down = await request(app).get("/catalog/brands").set("Authorization", auth);
    expect(down.status).toBe(503);
    expect(down.body.error).toMatchObject({ code: "EXTERNAL_UNAVAILABLE", details: { source: "FIPE" } });
    expect(fipe.hits).toHaveLength(2);

    fipe.setHandler(fipeHandler);
    fipe.hits.length = 0;
    expect((await request(app).get("/catalog/brands").set("Authorization", auth)).status).toBe(200);
    clock.advance(DAY + 1_000);
    fipe.setHandler((_req, res) => json(res, 500, {}));
    const stale = await request(app).get("/catalog/brands").set("Authorization", auth);
    expect(stale.status).toBe(200);
    expect(stale.body.items.length).toBeGreaterThan(0);
  });

  it("AC-9.12: Wikipedia fora e FIPE ok → POST /lots sem imageUrl cria o lote sem imagem", async () => {
    const { app, clock } = makeTestApp(prisma, { FIPE_BASE_URL: fipe.url, WIKIPEDIA_BASE_URL: dead });
    const { auth } = await seeded(app, clock);
    const start = clock.now().getTime() + DAY;
    const res = await request(app)
      .post("/lots")
      .set("Authorization", auth)
      .send({
        brandId: "56",
        modelId: "2204",
        yearId: "2015-5",
        title: "Corolla 2015",
        startingBidCents: 6_000_000,
        minIncrementCents: 100_000,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(start + DAY).toISOString(),
      });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.imageStatus).toBe("NONE");
    expect(res.body.car.imageUrl).toBeNull();
    const { item } = await prisma.lot.findUniqueOrThrow({ where: { id: res.body.lot.id }, include: { item: true } });
    expect(item.imageCount).toBe(0);
  });
});
