import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp } from "../../test/helpers/app";
import { makeUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";

/**
 * Limite de `POST /lots` (S09, deferred-work da S02): 10 por minuto por leiloeiro. O limitador lê o env a cada
 * requisição, então o desligador dos demais testes é removido só durante este arquivo.
 */
describe.skipIf(!testDatabaseUrl)("rate limit de POST /lots", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let saved: string | undefined;

  beforeAll(() => {
    saved = process.env.RATE_LIMIT_DISABLED;
    delete process.env.RATE_LIMIT_DISABLED;
  });
  afterAll(async () => {
    if (saved === undefined) delete process.env.RATE_LIMIT_DISABLED;
    else process.env.RATE_LIMIT_DISABLED = saved;
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await truncateAll(prisma);
  });
  afterEach(() => {
    expect(process.env.RATE_LIMIT_DISABLED).toBeUndefined();
  });

  const create = (app: Parameters<typeof request>[0], auth: string) => request(app).post("/lots").set("Authorization", auth).send({});

  it("as 10 primeiras criações dão 400 de validação, a 11ª dá 429 RATE_LIMITED no envelope, e outro leiloeiro não é afetado", async () => {
    const { app } = makeTestApp(prisma);
    const joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
    const maria = await makeUser(app, "Maria", { role: "AUCTIONEER" });
    for (let i = 1; i <= 10; i++) expect((await create(app, joao.auth)).status, `chamada ${i}`).toBe(400);
    const blocked = await create(app, joao.auth);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect((await create(app, maria.auth)).status).toBe(400);
  });

  it("licitante continua recebendo 403 e visitante 401, antes de contar no limite", async () => {
    const { app } = makeTestApp(prisma);
    const ana = await makeUser(app, "Ana", { depositCents: 100 });
    for (let i = 0; i < 12; i++) expect((await create(app, ana.auth)).status).toBe(403);
    expect((await request(app).post("/lots").send({})).status).toBe(401);
  });
});
