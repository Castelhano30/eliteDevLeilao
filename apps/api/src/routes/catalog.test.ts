import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CATALOG_TEXT } from "@lanceauto/shared";
import { makeTestApp, tokenFor } from "../../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { deadUrl, fipeHandler, json, startFakeServer, type FakeServer } from "../../test/helpers/fake-server";
import { CACHE_TTL_MS } from "../infra/external-cache";

describe.skipIf(!testDatabaseUrl)("catálogo (integração)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let fipe: FakeServer;
  let wiki: FakeServer;
  const auctioneer = `Bearer ${tokenFor("leiloeiro-1", "AUCTIONEER")}`;
  const bidder = `Bearer ${tokenFor("licitante-1", "BIDDER")}`;

  const appWith = (fipeUrl = fipe.url, wikiUrl = wiki.url) =>
    makeTestApp(prisma, { FIPE_BASE_URL: fipeUrl, WIKIPEDIA_BASE_URL: wikiUrl });

  beforeAll(async () => {
    fipe = await startFakeServer(fipeHandler);
    wiki = await startFakeServer((_req, res) => json(res, 404, {}));
  });
  beforeEach(async () => {
    await truncateAll(prisma);
    fipe.setHandler(fipeHandler);
    fipe.hits.length = 0;
    wiki.hits.length = 0;
    wiki.setHandler((_req, res) => json(res, 404, {}));
  });
  afterEach(() => {
    process.env.RATE_LIMIT_DISABLED = "1";
  });
  afterAll(async () => {
    await Promise.all([fipe.close(), wiki.close()]);
    await prisma.$disconnect();
  });

  it("AC-2.1: leiloeiro recebe as marcas pelo nome limpo; licitante 403; sem token 401", async () => {
    const { app } = appWith();
    const ok = await request(app).get("/catalog/brands").set("Authorization", auctioneer);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({
      items: [
        { id: "23", name: "Chevrolet" },
        { id: "56", name: "Toyota" },
        { id: "59", name: "Volkswagen" },
      ],
    });
    const wrongRole = await request(app).get("/catalog/brands").set("Authorization", bidder);
    expect(wrongRole.status).toBe(403);
    expect(wrongRole.body.error).toMatchObject({ code: "ROLE_NOT_ALLOWED", message: "Só leiloeiros fazem isso." });
    expect((await request(app).get("/catalog/brands")).status).toBe(401);
  });

  it("modelos e anos; o ano Zero Km sai da lista", async () => {
    const { app } = appWith();
    const models = await request(app).get("/catalog/brands/56/models").set("Authorization", auctioneer);
    expect(models.body.items[0]).toEqual({ id: "2204", name: "Corolla XEi 2.0" });
    const years = await request(app).get("/catalog/brands/56/models/2204/years").set("Authorization", auctioneer);
    expect(years.body.items).toEqual([
      { id: "2015-5", name: "2015 Flex" },
      { id: "2014-5", name: "2014 Flex" },
    ]);
  });

  it("AC-2.2: com o cache quente, a FIPE caindo não derruba a lista (nem vencida)", async () => {
    const { app, clock } = appWith();
    await request(app).get("/catalog/brands").set("Authorization", auctioneer);
    fipe.setHandler((_req, res) => json(res, 500, {}));
    expect((await request(app).get("/catalog/brands").set("Authorization", auctioneer)).status).toBe(200);
    clock.advance(CACHE_TTL_MS + 1);
    const stale = await request(app).get("/catalog/brands").set("Authorization", auctioneer);
    expect(stale.status).toBe(200);
    expect(stale.body.items).toHaveLength(3);
  });

  it("ids malformados em modelos e anos → 400 sem chamar a FIPE", async () => {
    const { app } = appWith();
    const models = await request(app).get("/catalog/brands/%2E%2E/models").set("Authorization", auctioneer);
    expect(models.status).toBe(400);
    expect(models.body.error.details.fields).toEqual({ brandId: "Escolha marca, modelo e ano." });
    const years = await request(app).get("/catalog/brands/56/models/a%20b/years").set("Authorization", auctioneer);
    expect(years.status).toBe(400);
    expect(years.body.error.details.fields).toEqual({ modelId: "Escolha marca, modelo e ano." });
    expect(fipe.hits).toHaveLength(0);
  });

  it("AC-2.3: FIPE fora e cache vazio → 503 EXTERNAL_UNAVAILABLE {source:FIPE}", async () => {
    const { app } = appWith(await deadUrl());
    const started = performance.now();
    const res = await request(app).get("/catalog/brands").set("Authorization", auctioneer);
    expect(res.status).toBe(503);
    expect(res.body.error).toEqual({ code: "EXTERNAL_UNAVAILABLE", message: CATALOG_TEXT.fipeUnavailable, details: { source: "FIPE" } });
    expect(performance.now() - started).toBeLessThan(9_000);
  });

  it("AC-2.4: id que a FIPE não conhece → 404 NOT_FOUND, sem repetir", async () => {
    const { app } = appWith();
    const res = await request(app).get("/catalog/brands/999/models").set("Authorization", auctioneer);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(fipe.hits).toEqual(["/cars/brands/999/models"]);
  });

  it("AC-2.6: preview com a Wikipedia fora → 200, car válido, UNAVAILABLE, sem suggestedImage", async () => {
    const { app } = appWith(fipe.url, await deadUrl());
    const res = await request(app)
      .get("/catalog/preview?brandId=56&modelId=2204&yearId=2015-5")
      .set("Authorization", auctioneer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      car: {
        brand: "Toyota",
        model: "Corolla XEi 2.0",
        year: 2015,
        fuel: "Flex",
        referencePriceCents: 8_006_100,
        referenceMonth: "2026-10",
        codeFipe: "002118-8",
      },
      imageStatus: "UNAVAILABLE",
    });
  });

  it("AC-2.6: artigo inexistente → NOT_FOUND; artigo com foto → FOUND com crédito", async () => {
    const { app } = appWith();
    const path = "/catalog/preview?brandId=56&modelId=2204&yearId=2015-5";
    expect((await request(app).get(path).set("Authorization", auctioneer)).body.imageStatus).toBe("NOT_FOUND");

    wiki.setHandler((req, res) => {
      if (req.url !== "/api/rest_v1/page/summary/Toyota_Corolla") return json(res, 404, {});
      json(res, 200, {
        type: "standard",
        title: "Toyota Corolla",
        thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/C.jpg/330px-C.jpg" },
        originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/1/1a/C.jpg", width: 3000 },
        content_urls: { desktop: { page: "https://pt.wikipedia.org/wiki/Toyota_Corolla" } },
      });
    });
    const { app: fresh } = appWith();
    const found = await request(fresh).get(path).set("Authorization", auctioneer);
    expect(found.body.imageStatus).toBe("FOUND");
    expect(found.body.suggestedImage).toEqual({
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/C.jpg/1280px-C.jpg",
      credit: 'Foto: Wikipedia, artigo "Toyota Corolla" (licença Creative Commons, veja a página do artigo)',
      creditUrl: "https://pt.wikipedia.org/wiki/Toyota_Corolla",
    });
  });

  it("preview sem os três ids → 400; com a FIPE fora → 503", async () => {
    const { app } = appWith();
    const res = await request(app).get("/catalog/preview?brandId=56").set("Authorization", auctioneer);
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual({ modelId: "Escolha marca, modelo e ano.", yearId: "Escolha marca, modelo e ano." });
    const { app: down } = appWith(await deadUrl());
    expect((await request(down).get("/catalog/preview?brandId=56&modelId=2204&yearId=2015-5").set("Authorization", auctioneer)).status).toBe(503);
  });

  it("limite de 120 requisições por minuto por usuário no /catalog", async () => {
    process.env.RATE_LIMIT_DISABLED = "0";
    const { app } = appWith();
    for (let i = 0; i < 120; i += 1) await request(app).get("/catalog/brands").set("Authorization", auctioneer);
    const limited = await request(app).get("/catalog/brands").set("Authorization", auctioneer);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    const other = await request(app).get("/catalog/brands").set("Authorization", `Bearer ${tokenFor("leiloeiro-2", "AUCTIONEER")}`);
    expect(other.status).toBe(200);
  });
});
