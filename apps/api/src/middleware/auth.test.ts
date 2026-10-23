import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signToken } from "../auth/token";
import { errorHandler } from "../errors";
import { createLogger } from "../infra/logger";
import { makeAuth } from "./auth";
import { requestContext } from "./request-context";

const SECRET = "s".repeat(32);
const auth = makeAuth(SECRET);

function buildApp() {
  const app = express();
  app.use(requestContext(createLogger("silent")));
  app.get("/publica", auth.optionalAuth, (req, res) => res.json({ user: req.user ?? null }));
  app.get("/privada", auth.requireAuth, (req, res) => res.json({ user: req.user }));
  app.get("/licitante", auth.requireAuth, auth.requireRole("BIDDER"), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("optionalAuth (AC-1.40)", () => {
  const app = buildApp();

  it("sem token, com token expirado e com token forjado responde 200 como visitante", async () => {
    const expired = jwt.sign({ role: "BIDDER" }, SECRET, { algorithm: "HS256", subject: "u1", expiresIn: -10 });
    const forged = jwt.sign({ role: "BIDDER" }, "x".repeat(32), { algorithm: "HS256", subject: "u1" });
    for (const header of [undefined, `Bearer ${expired}`, `Bearer ${forged}`, "Bearer lixo", "Basic abc"]) {
      const req = request(app).get("/publica");
      const res = await (header ? req.set("Authorization", header) : req);
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    }
  });

  it("com token válido preenche req.user", async () => {
    const token = signToken(SECRET, { id: "u1", role: "AUCTIONEER" });
    const res = await request(app).get("/publica").set("Authorization", `Bearer ${token}`);
    expect(res.body.user).toEqual({ id: "u1", role: "AUCTIONEER" });
  });
});

describe("requireAuth e requireRole", () => {
  const app = buildApp();

  it("sem token, 401 no envelope", async () => {
    const res = await request(app).get("/privada");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("papel errado, 403 ROLE_NOT_ALLOWED", async () => {
    const token = signToken(SECRET, { id: "u1", role: "AUCTIONEER" });
    const res = await request(app).get("/licitante").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_ALLOWED");
  });

  it("papel certo passa", async () => {
    const token = signToken(SECRET, { id: "u1", role: "BIDDER" });
    expect((await request(app).get("/licitante").set("Authorization", `Bearer ${token}`)).status).toBe(200);
  });

  it("token com papel desconhecido é recusado", async () => {
    const token = jwt.sign({ role: "ADMIN" }, SECRET, { algorithm: "HS256", subject: "u1" });
    expect((await request(app).get("/privada").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });
});
