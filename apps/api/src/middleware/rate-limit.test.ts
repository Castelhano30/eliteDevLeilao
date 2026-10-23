import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../errors";
import { createLogger } from "../infra/logger";
import { makeRateLimiter } from "./rate-limit";
import { requestContext } from "./request-context";

function buildApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(requestContext(createLogger("silent")));
  app.get("/x", limiter, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("makeRateLimiter (AC-0.17)", () => {
  beforeEach(() => {
    delete process.env.RATE_LIMIT_DISABLED;
  });
  afterEach(() => {
    process.env.RATE_LIMIT_DISABLED = "1";
  });

  it("a 3ª requisição da mesma chave recebe 429 no envelope RATE_LIMITED", async () => {
    const app = buildApp(makeRateLimiter({ windowMs: 60000, max: 2 }));
    expect((await request(app).get("/x")).status).toBe(200);
    expect((await request(app).get("/x")).status).toBe(200);
    const res = await request(app).get("/x");
    expect(res.status).toBe(429);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(res.body.error.message).toBe("Calma, uma coisa de cada vez. Tente de novo em instantes.");
  });

  it("RATE_LIMIT_DISABLED=1 não limita ninguém", async () => {
    process.env.RATE_LIMIT_DISABLED = "1";
    const app = buildApp(makeRateLimiter({ windowMs: 60000, max: 1 }));
    for (let i = 0; i < 4; i++) expect((await request(app).get("/x")).status).toBe(200);
  });

  it("keyGenerator separa a contagem por chave", async () => {
    const app = buildApp(
      makeRateLimiter({ windowMs: 60000, max: 1, keyGenerator: (req) => String(req.headers["x-chave"]) }),
    );
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "b")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(429);
  });

  it("skip dispensa requisições escolhidas", async () => {
    const app = buildApp(makeRateLimiter({ windowMs: 60000, max: 1, skip: () => true }));
    for (let i = 0; i < 3; i++) expect((await request(app).get("/x")).status).toBe(200);
  });
});
