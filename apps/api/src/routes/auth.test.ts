import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AUTH_TEXT } from "@lanceauto/shared";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { TEST_JWT_SECRET, makeTestApp, registerUser, validRegister } from "../../test/helpers/app";

describe.skipIf(!testDatabaseUrl)("auth (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  const { app } = testDatabaseUrl ? makeTestApp(prisma) : ({} as ReturnType<typeof makeTestApp>);

  beforeEach(async () => {
    await truncateAll(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /auth/register", () => {
    it("AC-1.1: normaliza o e-mail, devolve token e cria a carteira zerada", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validRegister, email: " ANA@Lanceauto.test " });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ name: "Ana Souza", email: "ana@lanceauto.test", role: "BIDDER" });
      const payload = jwt.verify(res.body.token, TEST_JWT_SECRET) as jwt.JwtPayload;
      expect(payload.sub).toBe(res.body.user.id);
      expect(await prisma.user.count()).toBe(1);
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: res.body.user.id } });
      expect([wallet.totalCents, wallet.committedCents]).toEqual([0n, 0n]);
    });

    it("AC-1.2: e-mail repetido, mesmo com outra caixa, volta EMAIL_TAKEN", async () => {
      await registerUser(app);
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validRegister, email: "ANA@lanceauto.test" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_TAKEN");
      expect(res.body.error.details.fields.email).toBe(AUTH_TEXT.emailTaken);
      expect(await prisma.user.count()).toBe(1);
      expect(await prisma.wallet.count()).toBe(1);
    });

    it("AC-1.3: dois cadastros simultâneos do mesmo e-mail, um 201 e um 409, sem usuário órfão", async () => {
      const [a, b] = await Promise.all([
        request(app).post("/auth/register").send(validRegister),
        request(app).post("/auth/register").send(validRegister),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await prisma.user.count()).toBe(1);
      expect(await prisma.wallet.count()).toBe(1);
    });

    it("AC-1.4: senha curta volta erro por campo", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validRegister, password: "1234567" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
      expect(res.body.error.details.fields.password).toBe("A senha precisa de pelo menos 8 caracteres.");
    });

    it("AC-1.5: papel ausente ou inválido", async () => {
      for (const role of [undefined, "ADMIN"]) {
        const res = await request(app)
          .post("/auth/register")
          .send({ ...validRegister, role });
        expect(res.status).toBe(400);
        expect(res.body.error.details.fields.role).toBe(AUTH_TEXT.roleRequired);
      }
    });

    it("AC-1.6: nome vazio e e-mail inválido juntos", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validRegister, name: "   ", email: "x" });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.details.fields).sort()).toEqual(["email", "name"]);
    });

    it("corpo ausente também é VALIDATION com todos os campos", async () => {
      const res = await request(app).post("/auth/register");
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.details.fields).sort()).toEqual(["email", "name", "password", "role"]);
    });

    it("AC-1.39: senha de 72 bytes passa; de 73 bytes ou multibyte acima de 72 não", async () => {
      const ok = await request(app)
        .post("/auth/register")
        .send({ ...validRegister, password: "a".repeat(72) });
      expect(ok.status).toBe(201);
      for (const [i, password] of ["a".repeat(73), "é".repeat(37)].entries()) {
        const res = await request(app)
          .post("/auth/register")
          .send({ ...validRegister, email: `longa${i}@lanceauto.test`, password });
        expect(res.status).toBe(400);
        expect(res.body.error.details.fields.password).toBe(AUTH_TEXT.passwordTooLong);
      }
    });

    it("AC-1.11: guarda só o hash e nunca devolve passwordHash", async () => {
      const res = await request(app).post("/auth/register").send(validRegister);
      expect(JSON.stringify(res.body)).not.toContain("passwordHash");
      const user = await prisma.user.findUniqueOrThrow({ where: { email: validRegister.email } });
      expect(user.passwordHash).not.toBe(validRegister.password);
      expect(await bcrypt.compare(validRegister.password, user.passwordHash)).toBe(true);
      const me = await request(app).get("/me").set("Authorization", `Bearer ${res.body.token}`);
      expect(JSON.stringify(me.body)).not.toContain("passwordHash");
    });

    it("grava createdAt com o relógio injetado", async () => {
      const res = await request(app).post("/auth/register").send(validRegister);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
      expect(user.createdAt.toISOString()).toBe("2026-10-23T12:00:00.000Z");
    });
  });

  describe("POST /auth/login", () => {
    it("AC-1.7: devolve token de 7 dias com sub e role", async () => {
      const { user } = await registerUser(app);
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "ANA@lanceauto.test", password: "lance1234" });
      expect(res.status).toBe(200);
      const payload = jwt.verify(res.body.token, TEST_JWT_SECRET) as jwt.JwtPayload;
      expect(payload.exp! - payload.iat!).toBe(7 * 24 * 60 * 60);
      expect(payload.sub).toBe(user.id);
      expect(payload.role).toBe("BIDDER");
    });

    it("AC-1.8: senha errada e e-mail inexistente respondem igual", async () => {
      await registerUser(app);
      const wrong = await request(app).post("/auth/login").send({ email: validRegister.email, password: "outra-senha" });
      const unknown = await request(app).post("/auth/login").send({ email: "ninguem@lanceauto.test", password: "lance1234" });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(wrong.body.error.message).toBe(AUTH_TEXT.invalidCredentials);
    });

    it("campos vazios voltam VALIDATION por campo", async () => {
      const res = await request(app).post("/auth/login").send({ email: "", password: "" });
      expect(res.status).toBe(400);
      expect(res.body.error.details.fields).toEqual({
        email: AUTH_TEXT.emailRequired,
        password: AUTH_TEXT.passwordRequiredLogin,
      });
    });
  });

  describe("GET /me", () => {
    it("devolve usuário e carteira", async () => {
      const { token, user } = await registerUser(app);
      const res = await request(app).get("/me").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: { id: user.id, name: "Ana Souza", email: "ana@lanceauto.test", role: "BIDDER" },
        wallet: { totalCents: 0, committedCents: 0, availableCents: 0 },
      });
    });

    it("AC-1.10: token ausente, forjado ou expirado volta UNAUTHENTICATED", async () => {
      const { user } = await registerUser(app);
      const expired = jwt.sign({ role: "BIDDER" }, TEST_JWT_SECRET, {
        algorithm: "HS256",
        subject: user.id,
        expiresIn: -10,
      });
      const forged = jwt.sign({ role: "BIDDER" }, "outro-segredo-qualquer-0123456789abcdef", { subject: user.id });
      const cases: (string | undefined)[] = [undefined, "lixo", forged, expired];
      for (const token of cases) {
        const req = request(app).get("/me");
        const res = await (token ? req.set("Authorization", `Bearer ${token}`) : req);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("AC-1.38: alg none e HS512 são recusados", async () => {
      const { user } = await registerUser(app);
      const none = jwt.sign({ role: "BIDDER" }, "", { algorithm: "none", subject: user.id });
      const hs512 = jwt.sign({ role: "BIDDER" }, TEST_JWT_SECRET, { algorithm: "HS512", subject: user.id });
      for (const token of [none, hs512]) {
        const res = await request(app).get("/me").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(401);
      }
    });

    it("AC-1.37: sub que não existe mais volta 401, nunca 500", async () => {
      const { token, user } = await registerUser(app);
      await prisma.wallet.delete({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      const me = await request(app).get("/me").set("Authorization", `Bearer ${token}`);
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe("UNAUTHENTICATED");
      const deposit = await request(app)
        .post("/wallet/deposits")
        .set("Authorization", `Bearer ${token}`)
        .send({ amountCents: 10000 });
      expect(deposit.status).toBe(401);
    });
  });

  describe("rate limit de /auth/*", () => {
    it("AC-1.9: a 31ª chamada do mesmo IP recebe 429 no envelope; outro IP segue livre", async () => {
      delete process.env.RATE_LIMIT_DISABLED;
      try {
        const { app: limited } = makeTestApp(prisma, { NODE_ENV: "production" as never });
        const login = (ip: string) =>
          request(limited).post("/auth/login").set("X-Forwarded-For", ip).send({ email: "a@b.co", password: "x" });
        for (let i = 0; i < 30; i++) expect((await login("203.0.113.7")).status).toBe(401);
        const blocked = await login("203.0.113.7");
        expect(blocked.status).toBe(429);
        expect(blocked.body.error.code).toBe("RATE_LIMITED");
        expect((await login("203.0.113.8")).status).toBe(401);
      } finally {
        process.env.RATE_LIMIT_DISABLED = "1";
      }
    });
  });

  it("CORS segue liberando só a WEB_ORIGIN nas rotas novas", async () => {
    const res = await request(app).post("/auth/login").set("Origin", "http://localhost:3000").send({});
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
