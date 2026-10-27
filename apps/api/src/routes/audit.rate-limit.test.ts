import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp } from "../../test/helpers/app";
import { makeUser } from "../../test/helpers/bids";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { insertLot } from "../../test/helpers/lots";

const NOW_MS = Date.parse("2026-10-23T12:00:00.000Z");
const HOUR = 3_600_000;

/**
 * AC-8.40: o limiter ligado, num arquivo só dele. Os demais testes da auditoria rodam com `RATE_LIMIT_DISABLED=1`
 * (o `setup.ts` o liga); aqui ele é removido durante o arquivo e restaurado no fim, porque o limitador lê o env a
 * cada requisição.
 */
describe.skipIf(!testDatabaseUrl)("rate limit da auditoria (AC-8.40, R-8.17)", () => {
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

  async function lotId(app: ReturnType<typeof makeTestApp>["app"]) {
    const joao = await makeUser(app, "Joao", { role: "AUCTIONEER" });
    const lot = await insertLot(prisma, {
      auctioneerId: joao.id,
      startsAt: new Date(NOW_MS - 2 * HOUR).toISOString(),
      endsAt: new Date(NOW_MS + HOUR).toISOString(),
    });
    return lot.id;
  }

  it("as 60 primeiras chamadas do mesmo IP dão 200 e a 61ª dá 429 RATE_LIMITED no envelope", async () => {
    const { app } = makeTestApp(prisma);
    const id = await lotId(app);
    for (let i = 1; i <= 60; i++) {
      const res = await request(app).get(`/lots/${id}/audit`);
      expect(res.status, `chamada ${i}`).toBe(200);
    }
    const blocked = await request(app).get(`/lots/${id}/audit`);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(typeof blocked.body.error.message).toBe("string");
    expect(Object.keys(blocked.body)).toEqual(["error"]);
  });

  it("a contagem é da auditoria: não derruba as outras rotas do mesmo IP", async () => {
    const { app } = makeTestApp(prisma);
    const id = await lotId(app);
    for (let i = 0; i < 61; i++) await request(app).get(`/lots/${id}/audit`);
    expect((await request(app).get(`/lots/${id}/audit`)).status).toBe(429);
    expect((await request(app).get(`/lots/${id}`)).status).toBe(200);
  });
});
