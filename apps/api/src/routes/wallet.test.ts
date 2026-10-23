import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEPOSIT_AMOUNT_MESSAGE } from "@lanceauto/shared";
import { createTestPrisma, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { makeTestApp, registerUser, validRegister } from "../../test/helpers/app";

describe.skipIf(!testDatabaseUrl)("carteira (integração, DATABASE_URL_TEST)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  const { app, clock } = testDatabaseUrl ? makeTestApp(prisma) : ({} as ReturnType<typeof makeTestApp>);

  const deposit = (token: string, body: unknown) =>
    request(app).post("/wallet/deposits").set("Authorization", `Bearer ${token}`).send(body as object);

  beforeEach(async () => {
    await truncateAll(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("AC-1.12: depósito soma ao total e grava a linha do extrato", async () => {
    const { token, user } = await registerUser(app);
    const res = await deposit(token, { amountCents: 5_000_000 });
    expect(res.status).toBe(201);
    expect(res.body.wallet).toEqual({ totalCents: 5_000_000, committedCents: 0, availableCents: 5_000_000 });
    expect(res.body.entry).toMatchObject({
      kind: "DEPOSIT",
      amountCents: 5_000_000,
      totalAfterCents: 5_000_000,
      committedAfterCents: 0,
      lotId: null,
      lotNumber: null,
      createdAt: "2026-10-23T12:00:00.000Z",
    });
    const rows = await prisma.ledgerEntry.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("DEPOSIT");
  });

  it("AC-1.13: aceita 1_000_000_000 e recusa o resto com a mensagem do campo", async () => {
    const { token, user } = await registerUser(app);
    expect((await deposit(token, { amountCents: 1_000_000_000 })).status).toBe(201);
    for (const amountCents of [1_000_000_001, 0, -100, 10.5, "100", undefined]) {
      const res = await deposit(token, { amountCents });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
      expect(res.body.error.details.fields.amountCents).toBe(DEPOSIT_AMOUNT_MESSAGE);
    }
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.totalCents).toBe(1_000_000_000n);
    expect(await prisma.ledgerEntry.count()).toBe(1);
  });

  it("vários depósitos acumulam além de R$ 10 milhões (o limite é por depósito)", async () => {
    const { token } = await registerUser(app);
    await deposit(token, { amountCents: 1_000_000_000 });
    const res = await deposit(token, { amountCents: 1_000_000_000 });
    expect(res.status).toBe(201);
    expect(res.body.wallet.totalCents).toBe(2_000_000_000);
  });

  it("AC-1.14: leiloeiro não deposita e nada é gravado", async () => {
    const { token } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
    const res = await deposit(token, { amountCents: 10000 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_ALLOWED");
    expect(res.body.error.message).toBe("Só licitantes depositam saldo simulado.");
    expect(await prisma.ledgerEntry.count()).toBe(0);
  });

  it("AC-1.15: sem token volta UNAUTHENTICATED", async () => {
    const res = await request(app).post("/wallet/deposits").send({ amountCents: 10000 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("AC-1.16: 20 depósitos simultâneos formam a sequência 100000…2000000 sem salto", async () => {
    const { token, user } = await registerUser(app);
    const results = await Promise.all(Array.from({ length: 20 }, () => deposit(token, { amountCents: 100_000 })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.totalCents).toBe(2_000_000n);
    const rows = await prisma.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { seq: "asc" } });
    expect(rows).toHaveLength(20);
    expect(rows.map((r) => Number(r.totalAfter))).toEqual(Array.from({ length: 20 }, (_, i) => (i + 1) * 100_000));
  });

  it("AC-1.17: o banco recusa total menor que comprometido e comprometido negativo", async () => {
    const { user } = await registerUser(app);
    await expect(
      prisma.$executeRaw`UPDATE "Wallet" SET "committedCents" = 100 WHERE "userId" = ${user.id}`,
    ).rejects.toThrow(/wallet_total_gte_committed/);
    await expect(
      prisma.$executeRaw`UPDATE "Wallet" SET "committedCents" = -1 WHERE "userId" = ${user.id}`,
    ).rejects.toThrow(/wallet_committed_nonneg|wallet_total_gte_committed/);
  });

  describe("GET /wallet", () => {
    it("AC-1.18: pagina de 50 por cursor, sem repetir nem pular", async () => {
      const { token, user } = await registerUser(app);
      await prisma.ledgerEntry.createMany({
        data: Array.from({ length: 60 }, (_, i) => ({
          userId: user.id,
          kind: "DEPOSIT" as const,
          amountCents: 100n,
          totalAfter: BigInt((i + 1) * 100),
          committedAfter: 0n,
          createdAt: clock.now(),
        })),
      });
      const first = await request(app).get("/wallet").set("Authorization", `Bearer ${token}`);
      expect(first.status).toBe(200);
      expect(first.body.entries).toHaveLength(50);
      expect(first.body.nextCursor).not.toBeNull();
      expect(first.body.entries[0].totalAfterCents).toBe(6000);
      const second = await request(app)
        .get(`/wallet?cursor=${first.body.nextCursor}`)
        .set("Authorization", `Bearer ${token}`);
      expect(second.body.entries).toHaveLength(10);
      expect(second.body.nextCursor).toBeNull();
      const totals = [...first.body.entries, ...second.body.entries].map((e: { totalAfterCents: number }) => e.totalAfterCents);
      expect(totals).toEqual(Array.from({ length: 60 }, (_, i) => (60 - i) * 100));
    });

    it("exatamente 50 lançamentos não geram próxima página", async () => {
      const { token, user } = await registerUser(app);
      await prisma.ledgerEntry.createMany({
        data: Array.from({ length: 50 }, () => ({
          userId: user.id,
          kind: "DEPOSIT" as const,
          amountCents: 100n,
          totalAfter: 100n,
          committedAfter: 0n,
          createdAt: clock.now(),
        })),
      });
      const res = await request(app).get("/wallet").set("Authorization", `Bearer ${token}`);
      expect(res.body.entries).toHaveLength(50);
      expect(res.body.nextCursor).toBeNull();
    });

    it("cursor inválido volta VALIDATION", async () => {
      const { token } = await registerUser(app);
      const res = await request(app).get("/wallet?cursor=%25%25").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    });

    it("AC-1.19: leadingLots vazio e disponível = total − comprometido", async () => {
      const { token } = await registerUser(app);
      await deposit(token, { amountCents: 250_000 });
      const res = await request(app).get("/wallet").set("Authorization", `Bearer ${token}`);
      expect(res.body.leadingLots).toEqual([]);
      expect(res.body.availableCents).toBe(res.body.totalCents - res.body.committedCents);
      expect(res.body.totalCents).toBe(250_000);
    });

    it("AC-1.20: leiloeiro também tem carteira, com zeros", async () => {
      const { token } = await registerUser(app, { role: "AUCTIONEER", email: "leiloeiro@lanceauto.test" });
      const res = await request(app).get("/wallet").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ totalCents: 0, committedCents: 0, availableCents: 0, entries: [], nextCursor: null });
    });

    it("não mistura o extrato de outro usuário", async () => {
      const ana = await registerUser(app);
      const bruno = await registerUser(app, { email: "bruno@lanceauto.test", name: validRegister.name });
      await deposit(ana.token, { amountCents: 10000 });
      const res = await request(app).get("/wallet").set("Authorization", `Bearer ${bruno.token}`);
      expect(res.body.entries).toEqual([]);
    });

    it("sem token volta 401", async () => {
      expect((await request(app).get("/wallet")).status).toBe(401);
    });
  });
});
