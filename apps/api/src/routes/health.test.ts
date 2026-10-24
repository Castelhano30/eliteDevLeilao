import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { createLogger } from "../infra/logger";
import { testEnv } from "../../test/helpers/app";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";

const env = { ...testEnv, JWT_SECRET: "j".repeat(32) };
const logger = createLogger("silent");

describe("GET /health", () => {
  it("AC-0.2: com o banco fora do ar responde 503 {ok:false, db:false}", async () => {
    const db = { $queryRaw: vi.fn().mockRejectedValue(new Error("sem banco")), $disconnect: vi.fn() };
    const res = await request(createApp({ env, db: db as never, logger })).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: false });
  });
});

describe.skipIf(!testDatabaseUrl)("GET /health (integração, DATABASE_URL_TEST)", () => {
  // O corpo do describe roda mesmo quando ele é pulado, então só cria o cliente com a URL definida.
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);

  beforeEach(async () => {
    await truncateAll(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("AC-0.1: com o banco no ar responde 200 {ok:true, db:true}", async () => {
    const res = await request(createApp({ env, db: prisma, logger })).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
  });

  it("libera CORS só para a WEB_ORIGIN", async () => {
    const app = createApp({ env, db: prisma, logger });
    const ok = await request(app).get("/health").set("Origin", "http://localhost:3000");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const other = await request(app).get("/health").set("Origin", "http://evil.test");
    // A origem liberada é sempre a configurada: o navegador recusa quem não bate com ela.
    expect(other.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
