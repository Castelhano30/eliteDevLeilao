import http from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LOT_IMAGE_MAX_BYTES, LOT_TEXT } from "@lanceauto/shared";
import { makeTestApp, registerUser } from "../../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { fipeHandler, startFakeServer, type FakeServer } from "../../test/helpers/fake-server";

/** JPEG "de verdade" só nos primeiros bytes (a API confere a assinatura, não decodifica). */
const jpeg = (seed: number, size = 2048) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, seed)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(512, 3)]);
const webp = () => Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 "), Buffer.alloc(256, 5)]);

describe.skipIf(!testDatabaseUrl)("POST /lots com fotos do aparelho (integração)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let fipe: FakeServer;

  const payload = (overrides: Record<string, unknown> = {}) => ({
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

  const appWith = (fipeUrl = fipe.url) => makeTestApp(prisma, { FIPE_BASE_URL: fipeUrl });

  async function auctioneer(app: Parameters<typeof request>[0]) {
    const { token, user } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test", name: "João Pátio" });
    return { auth: `Bearer ${token}`, id: user.id };
  }

  type Part = { data: Buffer; filename?: string; contentType?: string };
  const send = (app: Parameters<typeof request>[0], auth: string, parts: Part[], json: unknown = payload()) => {
    let req = request(app).post("/lots").set("Authorization", auth);
    /* json === null: parte `payload` ausente */
    if (json !== null) req = req.field("payload", typeof json === "string" ? json : JSON.stringify(json));
    for (const [index, part] of parts.entries()) {
      req = req.attach("images", part.data, { filename: part.filename ?? `foto-${index}.jpg`, contentType: part.contentType ?? "image/jpeg" });
    }
    return req;
  };

  const nothingStored = async () => {
    expect(await prisma.lot.count()).toBe(0);
    expect(await prisma.item.count()).toBe(0);
    expect(await prisma.itemImage.count()).toBe(0);
  };

  beforeAll(async () => {
    fipe = await startFakeServer(fipeHandler);
  });
  beforeEach(async () => {
    await truncateAll(prisma);
    fipe.hits.length = 0;
    fipe.setHandler(fipeHandler);
  });
  afterAll(async () => {
    await fipe.close();
    await prisma.$disconnect();
  });

  it("1 a 5 fotos válidas: 201 STORED, posições na ordem enviada, crédito null e capa igual à posição 0", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const files = [jpeg(1), png(), webp(), jpeg(4), jpeg(5)];
    const mimes = ["image/jpeg", "image/png", "image/webp", "image/jpeg", "image/jpeg"];
    for (const count of [1, 3, 5]) {
      const parts = files.slice(0, count).map((data) => ({ data }));
      const res = await send(app, auth, parts, payload({ imageCredit: "Foto: ninguém", imageCreditUrl: "https://x.example/y" }));
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.imageStatus).toBe("STORED");
      expect(res.body.car.imageUrl).toMatch(/^\/items\/[\w-]+\/image$/);
      expect(res.body.car.gallery).toHaveLength(count);
      expect(res.body.car.gallery[0]).toBe(res.body.car.imageUrl);
      expect(res.body.car.gallery.slice(1)).toEqual(
        Array.from({ length: count - 1 }, (_, i) => `${String(res.body.car.imageUrl).replace(/\/image$/, "")}/images/${i + 1}`),
      );
      expect(res.body.car.imageCredit).toBeNull();
      expect(res.body.car.imageCreditUrl).toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/userId|auctioneerId|@lanceauto/);

      const itemId = String(res.body.car.imageUrl).split("/")[2]!;
      const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
      expect(item).toMatchObject({ imageCount: count, imageCredit: null, imageCreditUrl: null });
      const rows = await prisma.itemImage.findMany({ where: { itemId }, orderBy: { position: "asc" } });
      expect(rows.map((row) => row.position)).toEqual([...Array(count).keys()]);
      expect(rows.map((row) => row.mime)).toEqual(mimes.slice(0, count));

      for (const [position, path] of (res.body.car.gallery as string[]).entries()) {
        const image = await request(app).get(path).buffer(true);
        expect(image.status).toBe(200);
        expect(image.headers["content-type"]).toBe(rows[position]!.mime);
        expect(image.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
        expect(image.headers["cross-origin-resource-policy"]).toBe("cross-origin");
        expect(image.headers["x-content-type-options"]).toBe("nosniff");
        expect(Buffer.compare(image.body as Buffer, files[position]!)).toBe(0);
      }
      const cover = await request(app).get(res.body.car.imageUrl).buffer(true);
      expect(Buffer.compare(cover.body as Buffer, files[0]!)).toBe(0);
      expect(cover.headers.etag).toBe(`"img-${itemId}"`);
    }
  });

  it("o lote com fotos aparece no GET /lots e /lots/:id com a capa e a galeria, sem userId, nome ou e-mail", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const created = await send(app, auth, [{ data: jpeg(1) }, { data: png() }]);
    const list = await request(app).get("/lots");
    expect(list.body.lots[0].imageUrl).toBe(created.body.car.imageUrl);
    const state = await request(app).get(`/lots/${created.body.lot.id}`);
    expect(state.body.car.gallery).toEqual(created.body.car.gallery);
    expect(JSON.stringify(state.body) + JSON.stringify(list.body)).not.toMatch(/userId|João Pátio|leiloeiro@lanceauto/);
  });

  it("nome hostil e tipo falso na parte são ignorados: vale o que os bytes dizem, e o nome não é gravado", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const res = await send(app, auth, [{ data: jpeg(1), filename: "../../x.exe", contentType: "application/octet-stream" }]);
    expect(res.status).toBe(201);
    const image = await request(app).get(res.body.car.imageUrl).buffer(true);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'ItemImage'`;
    expect(columns.map((c) => c.column_name).sort()).toEqual(["data", "itemId", "mime", "position"]);
  });

  it("URL e fotos juntas: 400 em fields.images e nada gravado", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const res = await send(app, auth, [{ data: jpeg(1) }], payload({ imageUrl: "https://exemplo.test/a.png" }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual({ images: LOT_TEXT.imagesBoth });
    await nothingStored();
  });

  it("6 fotos: 400 imagesTooMany", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const res = await send(app, auth, Array.from({ length: 6 }, (_, i) => ({ data: jpeg(i) })));
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual({ images: LOT_TEXT.imagesTooMany });
    await nothingStored();
  });

  it("foto acima de 4 MiB: 400 imageTooBig; no limite exato passa", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const big = Buffer.concat([jpeg(1, 0), Buffer.alloc(LOT_IMAGE_MAX_BYTES - 4 + 1, 1)]);
    expect(big.length).toBe(LOT_IMAGE_MAX_BYTES + 1);
    const res = await send(app, auth, [{ data: big }]);
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual({ images: LOT_TEXT.imageTooBig });
    await nothingStored();
    const exact = await send(app, auth, [{ data: Buffer.concat([jpeg(1, 0), Buffer.alloc(LOT_IMAGE_MAX_BYTES - 4, 1)]) }]);
    expect(exact.status, JSON.stringify(exact.body)).toBe(201);
  });

  it("corpo acima de 20 MB no total: 413 PAYLOAD_TOO_LARGE com a mensagem do upload, antes de ler tudo", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    // Corpo montado à mão, com Content-Length: o servidor recusa pelo cabeçalho, sem interpretar as partes.
    const boundary = "----lanceauto";
    const filler = Buffer.concat([jpeg(1, 0), Buffer.alloc(LOT_IMAGE_MAX_BYTES - 4, 1)]);
    const crlf = String.fromCharCode(13, 10);
    const head = `--${boundary}${crlf}Content-Disposition: form-data; name="images"; filename="a.jpg"${crlf}Content-Type: image/jpeg${crlf}${crlf}`;
    const part = Buffer.concat([Buffer.from(head), filler, Buffer.from(crlf)]);
    const bodyBytes = Buffer.concat([...Array.from({ length: 6 }, () => part), Buffer.from(`--${boundary}--${crlf}`)]);
    // O superagent perde a resposta (ECONNRESET) quando o servidor responde antes do fim do envio; o cliente cru não.
    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const { port } = server.address() as AddressInfo;
      const res = await new Promise<{ status: number; body: { error: { code: string; message: string } } }>((resolve, reject) => {
        const req = http.request(
          {
            port,
            host: "127.0.0.1",
            method: "POST",
            path: "/lots",
            headers: { Authorization: auth, "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": bodyBytes.length },
          },
          (response) => {
            let text = "";
            response.on("data", (chunk: Buffer) => (text += chunk.toString()));
            response.on("end", () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(text) }));
          },
        );
        req.on("error", reject);
        req.end(bodyBytes);
      });
      expect(res.status).toBe(413);
      expect(res.body.error).toMatchObject({ code: "PAYLOAD_TOO_LARGE", message: LOT_TEXT.uploadTooLarge });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    await nothingStored();
  });

  it("SVG, GIF e HTML com tipo ou nome de JPEG: 400 pelos bytes; parte vazia também", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const fakes = [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
      Buffer.from("GIF89a....", "latin1"),
      Buffer.from("<!doctype html><script>alert(1)</script>"),
      Buffer.alloc(0),
    ];
    for (const data of fakes) {
      const res = await send(app, auth, [{ data, filename: "foto.jpg", contentType: "image/jpeg" }]);
      expect(res.status, data.toString("latin1").slice(0, 12)).toBe(400);
      expect(res.body.error.details.fields).toEqual({ images: LOT_TEXT.imageType });
    }
    // Uma boa e uma ruim: nada entra.
    const mixed = await send(app, auth, [{ data: jpeg(1) }, { data: fakes[0]! }]);
    expect(mixed.status).toBe(400);
    await nothingStored();
  });

  it("payload ausente, quebrado, que não é objeto ou acima de 64 KiB: 400 com a mensagem do envelope", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const cases: (string | null)[] = [null, "{quebrado", "[1,2]", "null", JSON.stringify(payload({ title: "a".repeat(70 * 1024) }))];
    for (const json of cases) {
      const res = await send(app, auth, [{ data: jpeg(1) }], json);
      expect(res.status, String(json?.slice(0, 20))).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION", message: LOT_TEXT.payloadMissing });
    }
    await nothingStored();
  });

  it("licitante e visitante são recusados antes de ler o corpo (nem a validação do payload aparece)", async () => {
    const { app } = appWith();
    const { token } = await registerUser(app, { role: "BIDDER", email: "licitante@lanceauto.test" });
    const bidder = await send(app, `Bearer ${token}`, [{ data: jpeg(1) }], "{quebrado");
    expect(bidder.status).toBe(403);
    expect(bidder.body.error.code).toBe("ROLE_NOT_ALLOWED");
    const visitor = await request(app).post("/lots").attach("images", jpeg(1), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(visitor.status).toBe(401);
    await nothingStored();
  });

  it("carro ou datas inválidos com fotos válidas: 400 com fields e nenhuma imagem gravada", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const res = await send(app, auth, [{ data: jpeg(1) }], payload({ title: "", startsAt: "2020-01-01T10:00:00.000Z" }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fields).sort()).toEqual(["startsAt", "title"]);
    await nothingStored();
  });

  it("FIPE fora do ar com fotos válidas: 503 e nenhuma imagem gravada", async () => {
    const dead = await startFakeServer();
    const { app } = appWith(dead.url);
    await dead.close();
    const { auth } = await auctioneer(app);
    const res = await send(app, auth, [{ data: jpeg(1) }, { data: png() }]);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("EXTERNAL_UNAVAILABLE");
    await nothingStored();
  });

  it("leiloeiro apagado com token ainda válido: 401 e nenhuma imagem órfã", async () => {
    const { app } = appWith();
    const { auth, id } = await auctioneer(app);
    await prisma.wallet.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    const res = await send(app, auth, [{ data: jpeg(1) }]);
    expect(res.status).toBe(401);
    await nothingStored();
  });

  it("o corpo JSON de sempre continua valendo (com e sem imageUrl)", async () => {
    const { app } = appWith();
    const { auth } = await auctioneer(app);
    const res = await request(app).post("/lots").set("Authorization", auth).send(payload());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ imageStatus: "NONE", car: { imageUrl: null, gallery: [] } });
  });

  describe("GET /items/:id/images/:position", () => {
    it("404 para posição não inteira, fora de 0..4 ou inexistente, e para item sem foto", async () => {
      const { app } = appWith();
      const { auth } = await auctioneer(app);
      const created = await send(app, auth, [{ data: jpeg(1) }, { data: jpeg(2) }]);
      const itemId = String(created.body.car.imageUrl).split("/")[2]!;
      for (const position of ["2", "5", "-1", "1.5", "abc", "1e0", "01x", "99999", "00", "01", "001"]) {
        const res = await request(app).get(`/items/${itemId}/images/${position}`);
        expect(res.status, position).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
      }
      expect((await request(app).get("/items/nao-existe/images/0")).status).toBe(404);
      expect((await request(app).get("/items/nao-existe/image")).status).toBe(404);
      expect((await request(app).get(`/items/${itemId}/images/1`)).status).toBe(200);
    });

    it("304 com ETag por posição, sem ler o blob", async () => {
      const logged = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } }, log: [{ emit: "event", level: "query" }] });
      try {
        const { app } = makeTestApp(logged, { FIPE_BASE_URL: fipe.url });
        const { auth } = await auctioneer(app);
        const created = await send(app, auth, [{ data: jpeg(1) }, { data: jpeg(2) }]);
        const path = created.body.car.gallery[1] as string;
        const first = await request(app).get(path);
        expect(first.headers.etag).toMatch(/^"img-[\w-]+-1"$/);
        expect(first.headers.etag).not.toBe((await request(app).get(created.body.car.gallery[0])).headers.etag);
        const queries: string[] = [];
        logged.$on("query", (event) => queries.push(event.query));
        const cached = await request(app).get(path).set("If-None-Match", first.headers.etag as string);
        expect(cached.status).toBe(304);
        expect(queries.length).toBeGreaterThan(0);
        expect(queries.filter((query) => query.includes('"data"'))).toEqual([]);
      } finally {
        await logged.$disconnect();
      }
    });
  });
});
