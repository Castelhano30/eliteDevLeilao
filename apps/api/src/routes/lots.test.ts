import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LOT_TEXT } from "@lanceauto/shared";
import { makeTestApp, registerUser, testEnv } from "../../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { deadUrl, fipeHandler, json, startFakeServer, type FakeServer } from "../../test/helpers/fake-server";
import { insertLot } from "../../test/helpers/lots";
import { genesisHash, sealHash } from "../domain/audit-chain";

const KEY = testEnv.AUDIT_HMAC_KEY;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(100 * 1024, 9)]);
const WIKI_CREDIT = 'Foto: Wikipedia, artigo "Toyota Corolla" (licença Creative Commons, veja a página do artigo)';

describe.skipIf(!testDatabaseUrl)("lotes (integração)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let fipe: FakeServer;
  let wiki: FakeServer;
  let img: FakeServer;
  let dead: string;

  /** App com FIPE e Wikipedia falsas e o download liberado para o servidor de imagem local. */
  const appWith = (fipeUrl = fipe.url) =>
    makeTestApp(
      prisma,
      { FIPE_BASE_URL: fipeUrl, WIKIPEDIA_BASE_URL: wiki.url },
      { timeoutMs: 300, imageStoreOptions: { allowPrivate: true, allowedPorts: [img.port] } },
    );

  const body = (overrides: Record<string, unknown> = {}) => ({
    brandId: "56",
    modelId: "2204",
    yearId: "2015-5",
    title: "Corolla 2015",
    startingBidCents: 6_000_000,
    minIncrementCents: 100_000,
    startsAt: "2026-10-25T13:00:00.000Z",
    endsAt: "2026-10-26T13:00:00.000Z",
    ...overrides,
  });

  async function auctioneer(app: Parameters<typeof request>[0], email = "leiloeiro@lanceauto.test") {
    const { token, user } = await registerUser(app, { role: "AUCTIONEER", email, name: "João Pátio" });
    return { auth: `Bearer ${token}`, id: user.id };
  }

  beforeAll(async () => {
    fipe = await startFakeServer(fipeHandler);
    wiki = await startFakeServer();
    img = await startFakeServer((req, res) => {
      const send = (type: string, data: Buffer) => {
        res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
        res.end(data);
      };
      if (req.url === "/a.png") return send("image/png", PNG);
      if (req.url === "/big.png") return send("image/png", Buffer.alloc(4 * 1024 * 1024 + 1, 1));
      if (req.url === "/page.html") return send("text/html", Buffer.from("<p>oi</p>"));
      if (req.url === "/x.svg") return send("image/svg+xml", Buffer.from("<svg/>"));
      res.writeHead(404).end();
    });
    dead = await deadUrl();
  });
  beforeEach(async () => {
    await truncateAll(prisma);
    for (const s of [fipe, wiki, img]) s.hits.length = 0;
    fipe.setHandler(fipeHandler);
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
  });
  afterAll(async () => {
    await Promise.all([fipe.close(), wiki.close(), img.close()]);
    await prisma.$disconnect();
  });

  describe("POST /lots", () => {
    it("AC-2.9: cria agendado com snapshot completo e número sequencial", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const first = await request(app).post("/lots").set("Authorization", auth).send(body());
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        serverTime: "2026-10-23T12:00:00.000Z",
        imageStatus: "NONE",
        bids: [],
        lot: {
          title: "Corolla 2015",
          status: "SCHEDULED",
          bidCount: 0,
          version: 0,
          entryCount: 0,
          currentBidCents: null,
          minimumBidCents: 6_000_000,
          bidderCount: 0,
          myPseudonym: null,
          myRank: null,
          myBestBidCents: null,
          startsAt: "2026-10-25T13:00:00.000Z",
          endsAt: "2026-10-26T13:00:00.000Z",
          originalEndsAt: "2026-10-26T13:00:00.000Z",
          cancelledAt: null,
          settledAt: null,
        },
        car: { brand: "Toyota", model: "Corolla XEi 2.0", year: 2015, fuel: "Flex", referencePriceCents: 8_006_100, referenceMonth: "2026-10", imageUrl: null },
      });
      const second = await request(app).post("/lots").set("Authorization", auth).send(body());
      expect(second.body.lot.number).toBe(first.body.lot.number + 1);

      const item = await prisma.item.findFirstOrThrow({ where: { lots: { some: { id: first.body.lot.id } } } });
      expect(item).toMatchObject({
        source: "FIPE",
        externalId: "002118-8-2015-5",
        referencePriceCents: 8_006_100n,
        referenceMonth: "2026-10",
      });
      expect(item.rawData).toMatchObject({ price: "R$ 80.061,00", codeFipe: "002118-8" });
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: first.body.lot.id } });
      expect(lot.createdAt.toISOString()).toBe("2026-10-23T12:00:00.000Z");
      expect(lot.searchText).toBe("corolla 2015 toyota corolla xei 2.0 2015");
    });

    it("AC-2.10 / 2.10b: genesis e selo batem com o recálculo a partir do banco, mesmo sem ms na entrada", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const res = await request(app).post("/lots").set("Authorization", auth).send(body({ startsAt: "2026-10-25T13:00:00Z" }));
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: res.body.lot.id } });
      expect(lot.startsAt.toISOString()).toBe("2026-10-25T13:00:00.000Z");
      const expected = createHmac("sha256", KEY)
        .update(`v1|genesis|${lot.id}|2026-10-25T13:00:00.000Z|6000000|100000`)
        .digest("hex");
      expect(lot.lastHash).toBe(expected);
      expect(lot.lastHash).toBe(genesisHash(KEY, lot));
      expect(lot.entryCount).toBe(0);
      expect(lot.seal).toBe(createHmac("sha256", KEY).update(`v1|seal|${lot.id}|0|${expected}`).digest("hex"));
      expect(lot.seal).toBe(sealHash(KEY, lot.id, 0, lot.lastHash));
    });

    it("AC-2.11: início 30 s no passado nasce LIVE; 61 s → 400 antes de chamar a FIPE", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const live = await request(app).post("/lots").set("Authorization", auth).send(body({ startsAt: "2026-10-23T11:59:30.000Z" }));
      expect(live.status).toBe(201);
      expect(live.body.lot.status).toBe("LIVE");
      fipe.hits.length = 0;
      const past = await request(app).post("/lots").set("Authorization", auth).send(body({ startsAt: "2026-10-23T11:58:59.000Z" }));
      expect(past.status).toBe(400);
      expect(past.body.error.details.fields).toEqual({ startsAt: LOT_TEXT.startsAtPast });
      expect(fipe.hits).toHaveLength(0);
    });

    it("AC-2.12 a 2.14: duração, valores e título", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const post = (overrides: Record<string, unknown>) => request(app).post("/lots").set("Authorization", auth).send(body(overrides));
      expect((await post({ endsAt: "2026-10-25T13:05:00.000Z" })).status).toBe(201);
      expect((await post({ endsAt: "2026-10-25T13:04:59.000Z" })).body.error.details.fields).toEqual({ endsAt: LOT_TEXT.endsAtTooSoon });
      for (const value of [99, 1.5, "texto"]) {
        expect((await post({ startingBidCents: value })).body.error.details.fields).toEqual({ startingBidCents: LOT_TEXT.startingBid });
        expect((await post({ minIncrementCents: value })).body.error.details.fields).toEqual({ minIncrementCents: LOT_TEXT.minIncrement });
      }
      expect((await post({ startingBidCents: 100, minIncrementCents: 100 })).status).toBe(201);
      expect((await post({ title: "   " })).body.error.details.fields).toEqual({ title: LOT_TEXT.titleRequired });
      expect((await post({ title: "a".repeat(121) })).body.error.details.fields).toEqual({ title: LOT_TEXT.titleTooLong });
    });

    it("AC-2.15: licitante 403 e visitante 401; nada é gravado", async () => {
      const { app } = appWith();
      const { token } = await registerUser(app);
      const bidder = await request(app).post("/lots").set("Authorization", `Bearer ${token}`).send(body());
      expect(bidder.status).toBe(403);
      expect(bidder.body.error).toMatchObject({ code: "ROLE_NOT_ALLOWED", message: "Só leiloeiros fazem isso." });
      expect((await request(app).post("/lots").send(body())).status).toBe(401);
      expect(await prisma.lot.count()).toBe(0);
      expect(await prisma.item.count()).toBe(0);
    });

    it("AC-2.16: FIPE fora e sem cache → 503 sem gravar; erro de data vem antes, sem chamada externa", async () => {
      const deadFipe = await startFakeServer();
      const { app } = appWith(deadFipe.url);
      await deadFipe.close();
      const { auth } = await auctioneer(app);
      const res = await request(app).post("/lots").set("Authorization", auth).send(body());
      expect(res.status).toBe(503);
      expect(res.body.error).toMatchObject({ code: "EXTERNAL_UNAVAILABLE", details: { source: "FIPE" } });
      expect(await prisma.lot.count()).toBe(0);
      expect(await prisma.item.count()).toBe(0);

      const { app: counted } = appWith();
      const { auth: other } = await auctioneer(counted, "outro@lanceauto.test");
      fipe.hits.length = 0;
      const invalid = await request(counted).post("/lots").set("Authorization", other).send(body({ startsAt: "2020-01-01T00:00:00.000Z" }));
      expect(invalid.status).toBe(400);
      expect(fipe.hits).toHaveLength(0);
    });

    it("ids da FIPE inexistentes → 404 NOT_FOUND", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const res = await request(app).post("/lots").set("Authorization", auth).send(body({ modelId: "9999" }));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("AC-2.17: imagem PNG guardada e servida com cabeçalhos imutáveis e CORP cross-origin", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const res = await request(app).post("/lots").set("Authorization", auth).send(body({ imageUrl: `${img.url}/a.png`, imageCredit: "Foto minha" }));
      expect(res.status).toBe(201);
      expect(res.body.imageStatus).toBe("STORED");
      expect(res.body.car.imageUrl).toMatch(/^\/items\/[\w-]+\/image$/);
      expect(res.body.car.imageCredit).toBe("Foto minha");
      const image = await request(app).get(res.body.car.imageUrl).buffer(true);
      expect(image.status).toBe(200);
      expect(image.headers["content-type"]).toBe("image/png");
      expect(image.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
      expect(image.headers["cross-origin-resource-policy"]).toBe("cross-origin");
      expect(image.headers["x-content-type-options"]).toBe("nosniff");
      expect(image.headers.etag).toBeTruthy();
      expect(Buffer.compare(image.body as Buffer, PNG)).toBe(0);
      const itemId = String(res.body.car.imageUrl).split("/")[2];
      expect(image.headers.etag).toBe(`"img-${itemId}"`);
      for (const header of [image.headers.etag as string, `W/${image.headers.etag}`, `"outro", ${image.headers.etag}`]) {
        const cached = await request(app).get(res.body.car.imageUrl).set("If-None-Match", header);
        expect(cached.status).toBe(304);
      }
      expect((await request(app).get(res.body.car.imageUrl).set("If-None-Match", '"outro"')).status).toBe(200);
    });

    it("AC-2.18: imagem em IP privado (produção) → lote criado com FAILED e nenhuma conexão", async () => {
      const { app } = makeTestApp(prisma, { FIPE_BASE_URL: fipe.url, WIKIPEDIA_BASE_URL: wiki.url }, { timeoutMs: 300, imageStoreOptions: { allowedPorts: [80, 443, img.port] } });
      const { auth } = await auctioneer(app);
      for (const host of ["127.0.0.1", "[::1]", "2130706433", "[::ffff:7f00:1]", "169.254.169.254"]) {
        const port = host === "169.254.169.254" ? "" : `:${img.port}`;
        const res = await request(app).post("/lots").set("Authorization", auth).send(body({ imageUrl: `http://${host}${port}/a.png` }));
        expect(res.status).toBe(201);
        expect(res.body.imageStatus).toBe("FAILED");
        expect(res.body.car.imageUrl).toBeNull();
      }
      expect(img.hits).toHaveLength(0);
    });

    it("AC-2.18b: imageCreditUrl javascript:/data: → 400", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      for (const url of ["javascript:alert(1)", "data:text/html,<b>x</b>"]) {
        const res = await request(app).post("/lots").set("Authorization", auth).send(body({ imageCreditUrl: url }));
        expect(res.status).toBe(400);
        expect(res.body.error.details.fields).toEqual({ imageCreditUrl: LOT_TEXT.urlInvalid });
      }
    });

    it("AC-2.19: imagem acima de 4 MB, HTML ou SVG → FAILED; ftp ou texto → 400", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      for (const path of ["/big.png", "/page.html", "/x.svg"]) {
        const res = await request(app).post("/lots").set("Authorization", auth).send(body({ imageUrl: `${img.url}${path}` }));
        expect(res.body.imageStatus).toBe("FAILED");
      }
      expect(await prisma.item.count({ where: { NOT: { imageData: null } } })).toBe(0);
      for (const url of ["ftp://x.com/a.png", "uma foto"]) {
        const res = await request(app).post("/lots").set("Authorization", auth).send(body({ imageUrl: url }));
        expect(res.body.error.details.fields).toEqual({ imageUrl: LOT_TEXT.urlInvalid });
      }
    });

    it("AC-2.20: sem imageUrl → NONE e LotCard.imageUrl null", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const res = await request(app).post("/lots").set("Authorization", auth).send(body());
      expect(res.body.imageStatus).toBe("NONE");
      const list = await request(app).get("/lots");
      expect(list.body.lots[0].imageUrl).toBeNull();
    });

    it("AC-2.21: dois POST simultâneos geram números distintos e crescentes", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const [a, b] = await Promise.all([1, 2].map(() => request(app).post("/lots").set("Authorization", auth).send(body())));
      const numbers = [a!.body.lot.number, b!.body.lot.number].sort((x, y) => x - y);
      expect(numbers[1]).toBe(numbers[0] + 1);
    });

    it("crédito da Wikipedia com imagem trocada é limpo; com a sugerida, mantido", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const swapped = await request(app)
        .post("/lots")
        .set("Authorization", auth)
        .send(body({ imageUrl: `${img.url}/a.png`, imageCredit: WIKI_CREDIT, imageCreditUrl: "https://pt.wikipedia.org/wiki/Toyota_Corolla" }));
      expect(swapped.body.imageStatus).toBe("STORED");
      expect(swapped.body.car.imageCredit).toBeNull();
      expect(swapped.body.car.imageCreditUrl).toBeNull();

      // A URL sugerida é externa; o teste troca a sugestão para apontar ao servidor local.
      wiki.setHandler((req, res) => {
        if (req.url !== "/api/rest_v1/page/summary/Toyota_Corolla") return json(res, 404, {});
        json(res, 200, {
          type: "standard",
          title: "Toyota Corolla",
          originalimage: { source: `${img.url}/a.png`, width: 800 },
          content_urls: { desktop: { page: "https://pt.wikipedia.org/wiki/Toyota_Corolla" } },
        });
      });
      const { app: fresh } = appWith();
      const { auth: other } = await auctioneer(fresh, "outro@lanceauto.test");
      const kept = await request(fresh)
        .post("/lots")
        .set("Authorization", other)
        .send(body({ imageUrl: `${img.url}/a.png`, imageCredit: `${WIKI_CREDIT} e mais nada`, imageCreditUrl: "https://golpe.example/x" }));
      // Grava o crédito e o link da sugestão, não os do corpo.
      expect(kept.body.car.imageCredit).toBe(WIKI_CREDIT);
      expect(kept.body.car.imageCreditUrl).toBe("https://pt.wikipedia.org/wiki/Toyota_Corolla");
    });
  });

  describe("GET /lots, /lots/:id, /my/lots", () => {
    // Relógio do teste: 2026-10-23T12:00:00Z.
    async function scenario(app: Parameters<typeof request>[0]) {
      const a = await auctioneer(app);
      const lots = {
        liveLate: await insertLot(prisma, { auctioneerId: a.id, title: "Hilux 2017", model: "Hilux SRV 2.8", startsAt: "2026-10-23T10:00:00.000Z", endsAt: "2026-10-23T18:00:00.000Z" }),
        liveSoon: await insertLot(prisma, { auctioneerId: a.id, title: "Opala Comodoro", brand: "Chevrolet", model: "Opala 4.1", year: 1988, startsAt: "2026-10-23T10:00:00.000Z", endsAt: "2026-10-23T13:00:00.000Z" }),
        closing: await insertLot(prisma, { auctioneerId: a.id, title: "Civic 2012", brand: "Honda", model: "Civic LXS", startsAt: "2026-10-23T08:00:00.000Z", endsAt: "2026-10-23T11:00:00.000Z" }),
        scheduledLate: await insertLot(prisma, { auctioneerId: a.id, title: "Corolla 2015", startsAt: "2026-10-26T10:00:00.000Z", endsAt: "2026-10-27T10:00:00.000Z" }),
        scheduledSoon: await insertLot(prisma, { auctioneerId: a.id, title: "Gol GTI", brand: "Volkswagen", model: "Gol GTI 2.0", year: 1996, startsAt: "2026-10-24T10:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z" }),
        endedOld: await insertLot(prisma, { auctioneerId: a.id, title: "Uno 2010", brand: "Fiat", model: "Uno Mille Way", startsAt: "2026-10-20T10:00:00.000Z", endsAt: "2026-10-21T10:00:00.000Z", settledAt: "2026-10-21T10:00:05.000Z" }),
        endedNew: await insertLot(prisma, { auctioneerId: a.id, title: "Hilux vendida", model: "Hilux SRV 2.8", startsAt: "2026-10-21T10:00:00.000Z", endsAt: "2026-10-22T10:00:00.000Z", settledAt: "2026-10-22T10:00:05.000Z", bidCount: 3 }),
        cancelled: await insertLot(prisma, { auctioneerId: a.id, title: "Kombi cancelada", brand: "Volkswagen", model: "Kombi", startsAt: "2026-10-24T10:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z", cancelledAt: "2026-10-23T11:00:00.000Z" }),
      };
      return { a, lots };
    }

    it("AC-2.23: sem cancelados, na ordem dos grupos, e counts independentes dos filtros", async () => {
      const { app } = appWith();
      const { lots } = await scenario(app);
      const res = await request(app).get("/lots");
      expect(res.status).toBe(200);
      expect(res.body.lots.map((l: { id: string }) => l.id)).toEqual([
        lots.closing.id,
        lots.liveSoon.id,
        lots.liveLate.id,
        lots.scheduledSoon.id,
        lots.scheduledLate.id,
        lots.endedNew.id,
        lots.endedOld.id,
      ]);
      expect(res.body.lots.map((l: { status: string }) => l.status)).toEqual(["CLOSING", "LIVE", "LIVE", "SCHEDULED", "SCHEDULED", "SOLD", "UNSOLD"]);
      expect(res.body.counts).toEqual({ live: 3, scheduled: 2, ended: 2 });
      expect(res.body.serverTime).toBe("2026-10-23T12:00:00.000Z");
      for (const query of ["?status=SCHEDULED", "?q=opala", "?brand=Fiat"]) {
        expect((await request(app).get(`/lots${query}`)).body.counts).toEqual({ live: 3, scheduled: 2, ended: 2 });
      }
    });

    it("AC-2.24: busca sem caixa nem acento, todos os termos; zzz vazio", async () => {
      const { app } = appWith();
      const { lots } = await scenario(app);
      for (const q of ["opala", "OPALA", "ópála", "comodoro opala", "chevrolet 1988"]) {
        const res = await request(app).get(`/lots?q=${encodeURIComponent(q)}`);
        expect(res.body.lots.map((l: { id: string }) => l.id)).toEqual([lots.liveSoon.id]);
      }
      const none = await request(app).get("/lots?q=zzz");
      expect(none.status).toBe(200);
      expect(none.body.lots).toEqual([]);
    });

    it("AC-2.18d: curingas do LIKE não casam tudo", async () => {
      const { app } = appWith();
      await scenario(app);
      // O curinga é procurado literalmente: nenhum lote tem "%", "_" ou "\" no texto.
      for (const q of ["%", "_", "\\", "%25"]) {
        const res = await request(app).get(`/lots?q=${encodeURIComponent(q)}`);
        expect(res.status).toBe(200);
        expect(res.body.lots).toEqual([]);
      }
      expect((await request(app).get(`/lots?q=${encodeURIComponent("op%la")}`)).body.lots).toEqual([]);
      expect((await request(app).get(`/lots?q=${encodeURIComponent("o_ala")}`)).body.lots).toEqual([]);
    });

    it("AC-2.25: filtro de marca; brands continua com todas as marcas sem os cancelados", async () => {
      const { app } = appWith();
      await scenario(app);
      const res = await request(app).get("/lots?brand=toyota");
      expect(res.body.lots.every((l: { brand: string }) => l.brand === "Toyota")).toBe(true);
      expect(res.body.lots).toHaveLength(3);
      expect(res.body.brands).toEqual(["Chevrolet", "Fiat", "Honda", "Toyota", "Volkswagen"]);
      expect((await request(app).get("/lots?brand=Lada")).body.lots).toEqual([]);
    });

    it("AC-2.26: status inválido → 400; LIVE inclui CLOSING; ENDED = SOLD + UNSOLD", async () => {
      const { app } = appWith();
      const { lots } = await scenario(app);
      const bad = await request(app).get("/lots?status=XYZ");
      expect(bad.status).toBe(400);
      expect(bad.body.error.details.fields.status).toBe(LOT_TEXT.statusInvalid);
      const live = await request(app).get("/lots?status=LIVE");
      expect(live.body.lots.map((l: { id: string }) => l.id)).toEqual([lots.closing.id, lots.liveSoon.id, lots.liveLate.id]);
      const ended = await request(app).get("/lots?status=ENDED");
      expect(ended.body.lots.map((l: { status: string }) => l.status)).toEqual(["SOLD", "UNSOLD"]);
    });

    it("AC-2.27: GET /lots/:id de agendado e cancelado; inexistente ou malformado → 404", async () => {
      const { app } = appWith();
      const { lots } = await scenario(app);
      const scheduled = await request(app).get(`/lots/${lots.scheduledSoon.id}`);
      expect(scheduled.status).toBe(200);
      expect(scheduled.body.lot.status).toBe("SCHEDULED");
      expect(scheduled.body.serverTime).toBe("2026-10-23T12:00:00.000Z");
      const cancelled = await request(app).get(`/lots/${lots.cancelled.id}`);
      expect(cancelled.body.lot).toMatchObject({ status: "CANCELLED", cancelledAt: "2026-10-23T11:00:00.000Z" });
      for (const id of ["abc", "00000000-0000-0000-0000-000000000000"]) {
        const res = await request(app).get(`/lots/${id}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toEqual({ code: "NOT_FOUND", message: LOT_TEXT.notFoundTitle });
      }
      // token inválido é ignorado (optionalAuth)
      expect((await request(app).get(`/lots/${lots.liveSoon.id}`).set("Authorization", "Bearer lixo")).status).toBe(200);
    });

    it("AC-2.28: com FIPE e Wikipedia fora, as leituras respondem sem chamada externa", async () => {
      const { app } = makeTestApp(prisma, { FIPE_BASE_URL: dead, WIKIPEDIA_BASE_URL: dead });
      const { a, lots } = await scenario(app);
      const withImage = await insertLot(prisma, { auctioneerId: a.id, title: "Com foto", startsAt: "2026-10-24T10:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z", image: { data: PNG, mime: "image/png" } });
      expect((await request(app).get("/lots")).status).toBe(200);
      expect((await request(app).get(`/lots/${lots.liveSoon.id}`)).status).toBe(200);
      expect((await request(app).get(`/items/${withImage.itemId}/image`)).status).toBe(200);
      expect((await request(app).get("/my/lots").set("Authorization", a.auth)).status).toBe(200);
      expect((await request(app).get(`/items/${lots.liveSoon.itemId}/image`)).status).toBe(404);
      expect(fipe.hits.length + wiki.hits.length).toBe(0);
    });

    it("AC-2.29: GET /my/lots traz só os do chamador, com cancelados no fim", async () => {
      const { app } = appWith();
      const { a, lots } = await scenario(app);
      const b = await auctioneer(app, "outro@lanceauto.test");
      const own = await insertLot(prisma, { auctioneerId: b.id, startsAt: "2026-10-24T10:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z" });
      const mine = await request(app).get("/my/lots").set("Authorization", a.auth);
      expect(mine.status).toBe(200);
      expect(mine.body.totalReceivedCents).toBe(0);
      const ids = mine.body.lots.map((l: { id: string }) => l.id);
      // Ao vivo (endsAt ↑), agendados (startsAt ↑), encerrados (endsAt ↓), cancelados no fim.
      expect(ids).toEqual([
        lots.closing.id,
        lots.liveSoon.id,
        lots.liveLate.id,
        lots.scheduledSoon.id,
        lots.scheduledLate.id,
        lots.endedNew.id,
        lots.endedOld.id,
        lots.cancelled.id,
      ]);
      expect(ids).not.toContain(own.id);
      const theirs = await request(app).get("/my/lots").set("Authorization", b.auth);
      expect(theirs.body.lots.map((l: { id: string }) => l.id)).toEqual([own.id]);
      const { token } = await registerUser(app);
      expect((await request(app).get("/my/lots").set("Authorization", `Bearer ${token}`)).status).toBe(403);
      expect((await request(app).get("/my/lots")).status).toBe(401);
    });

    it("AC-2.7b: 'Volkswagen' do fixture e 'VW - VolksWagen' da FIPE viram uma marca só", async () => {
      const { app } = appWith();
      const a = await auctioneer(app);
      await insertLot(prisma, { auctioneerId: a.id, title: "Gol GTI", brand: "Volkswagen", model: "Gol GTI", startsAt: "2026-10-24T10:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z" });
      const created = await request(app).post("/lots").set("Authorization", a.auth).send(body({ brandId: "59", title: "Gol 2015" }));
      expect(created.body.car.brand).toBe("Volkswagen");
      const res = await request(app).get("/lots?brand=volkswagen");
      expect(res.body.brands).toEqual(["Volkswagen"]);
      expect(res.body.lots).toHaveLength(2);
    });

    it("AC-2.18c: listas e estado não leem Item.imageData; imageUrl ⇔ imageMime", async () => {
      const logged = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } }, log: [{ emit: "event", level: "query" }] });
      const queries: string[] = [];
      logged.$on("query", (event) => queries.push(event.query));
      try {
        const { app } = makeTestApp(logged, { FIPE_BASE_URL: fipe.url, WIKIPEDIA_BASE_URL: wiki.url });
        const a = await auctioneer(app);
        const lot = await insertLot(logged, { auctioneerId: a.id, startsAt: "2026-10-24T10:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z", image: { data: PNG, mime: "image/png" } });
        await insertLot(logged, { auctioneerId: a.id, startsAt: "2026-10-24T10:00:00.000Z", endsAt: "2026-10-25T10:00:00.000Z" });
        queries.length = 0;
        const list = await request(app).get("/lots");
        await request(app).get(`/lots/${lot.id}`);
        await request(app).get("/my/lots").set("Authorization", a.auth);
        expect(queries.length).toBeGreaterThan(0);
        expect(queries.filter((q) => q.includes("imageData"))).toEqual([]);
        const images = list.body.lots.map((l: { imageUrl: string | null }) => l.imageUrl);
        expect(images.filter(Boolean)).toEqual([`/items/${lot.itemId}/image`]);
        expect(images.filter((url: string | null) => url === null)).toHaveLength(1);
      } finally {
        await logged.$disconnect();
      }
    });
  });
});
