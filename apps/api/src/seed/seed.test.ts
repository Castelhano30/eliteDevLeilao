import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORBIDDEN_KEYS, assertLotInvariants, collectKeys } from "../../test/helpers/bids";
import { makeTestApp, testEnv } from "../../test/helpers/app";
import { createTestPrisma, restartLotNumbering, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { DEMO_BASE_CENTS, SEED_ACCOUNTS, SEED_SKIPPED_MESSAGE, liveLotTerms, runSeed, runSeedDemo, type FixtureCar, type SeedDeps } from "./showcase";

const baseDir = path.resolve(__dirname, "../../prisma");
const cars = JSON.parse(readFileSync(path.join(baseDir, "fipe-fixture.json"), "utf8")) as FixtureCar[];
const DAY = 24 * 60 * 60 * 1000;

describe("liveLotTerms", () => {
  it("lance inicial ≈ 60% da referência, em múltiplos de R$ 500, e incremento de R$ 500 ou R$ 1.000", () => {
    expect(liveLotTerms(1_980_000)).toEqual({ startingBidCents: 1_200_000, minIncrementCents: 50_000 });
    expect(liveLotTerms(7_630_000)).toEqual({ startingBidCents: 4_600_000, minIncrementCents: 100_000 });
  });
});

describe.skipIf(!testDatabaseUrl)("seed final (S09, integração, sem rede)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);
  let logs: string[] = [];

  beforeEach(async () => {
    await truncateAll(prisma);
    await restartLotNumbering(prisma);
    logs = [];
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  function setup(db = prisma) {
    const { app, clock } = makeTestApp(db);
    const deps: SeedDeps = {
      db,
      clock,
      auditKey: testEnv.AUDIT_HMAC_KEY,
      jwtSecret: testEnv.JWT_SECRET,
      cars,
      baseDir,
      log: (message) => logs.push(message),
    };
    return { app, clock, deps };
  }

  const lotByNumber = async (number: number) => prisma.lot.findFirstOrThrow({ where: { number } });

  it("AC-9.1: cria 1 leiloeiro, 2 licitantes com carteira e depósito e os cinco lotes 001–005 nos estados da §11", async () => {
    const { app, clock, deps } = setup();
    const result = await runSeed(deps);
    expect(result.skipped).toBe(false);
    expect(result.receiptPath).toMatch(/^\/c\/[\w-]{32}$/);

    const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
    expect(users.map((u) => [u.email, u.role])).toEqual([
      ["ana@lanceauto.test", "BIDDER"],
      ["bruno@lanceauto.test", "BIDDER"],
      ["leiloeiro@lanceauto.test", "AUCTIONEER"],
    ]);
    const deposits = await prisma.ledgerEntry.findMany({ where: { kind: "DEPOSIT" } });
    expect(deposits.map((d) => Number(d.amountCents)).sort()).toEqual([30_000_000, 50_000_000]);

    const lots = await prisma.lot.findMany({ orderBy: { number: "asc" } });
    expect(lots.map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
    const list = await request(app).get("/lots");
    expect(list.body.counts).toEqual({ live: 1, scheduled: 1, ended: 2 });
    const titles = (list.body.lots as { number: number; status: string }[]).map((l) => [l.number, l.status]);
    expect(titles).toEqual(expect.arrayContaining([[5, "LIVE"], [4, "SCHEDULED"], [1, "SOLD"], [2, "UNSOLD"]]));
    expect(titles.some(([number]) => number === 3)).toBe(false); // cancelado nunca aparece na Vitrine

    const [sold, unsold, cancelled, scheduled, live] = lots;
    const ana = users.find((u) => u.email === "ana@lanceauto.test")!;
    const bruno = users.find((u) => u.email === "bruno@lanceauto.test")!;
    // 001: 4 lances alternados, o último dentro dos 2 min finais (prorrogou), vencedora Ana, um comprovante.
    expect(sold).toMatchObject({ bidCount: 4, leaderId: ana.id });
    expect(sold!.endsAt.getTime()).toBeGreaterThan(sold!.originalEndsAt.getTime());
    expect(sold!.settledAt).not.toBeNull();
    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { lotId: sold!.id } });
    expect(receipt.winnerId).toBe(ana.id);
    // 002: encerrado sem lances.
    expect(unsold).toMatchObject({ bidCount: 0 });
    expect(unsold!.settledAt).not.toBeNull();
    expect(await prisma.receipt.count({ where: { lotId: unsold!.id } })).toBe(0);
    // 003: cancelado com 2 lances; a linha CANCEL fecha a cadeia.
    expect(cancelled!.cancelledAt).not.toBeNull();
    expect(cancelled!.bidCount).toBe(2);
    expect(cancelled!.entryCount).toBe(3);
    // 004 e 005: agendado em +2 dias; ao vivo por 30 dias com 5 lances e Bruno na frente.
    expect(scheduled!.startsAt.getTime() - clock.now().getTime()).toBe(2 * DAY);
    expect(live!.bidCount).toBe(5);
    expect(live!.leaderId).toBe(bruno.id);
    expect(live!.endsAt.getTime() - clock.now().getTime()).toBe(30 * DAY);
    expect(live!.startsAt.getTime()).toBe(clock.now().getTime());
  });

  it("AC-9.2: a auditoria de cada lote responde OK", async () => {
    const { app, deps } = setup();
    await runSeed(deps);
    for (const lot of await prisma.lot.findMany({ orderBy: { number: "asc" } })) {
      const res = await request(app).get(`/lots/${lot.id}/audit`);
      expect(res.status).toBe(200);
      expect(res.body.verdict.code, `lote ${lot.number}`).toBe("OK");
      await assertLotInvariants(prisma, lot.id);
    }
  });

  it("AC-9.3: nenhuma requisição de rede, e nenhuma resposta pública do banco semeado vaza userId, nome ou e-mail", async () => {
    const { app, deps } = setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const httpSpy = vi.spyOn(http, "request");
    const httpsSpy = vi.spyOn(https, "request");
    await runSeed(deps);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(httpSpy).not.toHaveBeenCalled();
    expect(httpsSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    const keys = new Set<string>();
    const showcase = await request(app).get("/lots");
    collectKeys(showcase.body, keys);
    for (const lot of await prisma.lot.findMany()) {
      for (const url of [`/lots/${lot.id}`, `/lots/${lot.id}/audit`]) collectKeys((await request(app).get(url)).body, keys);
    }
    const receipt = await prisma.receipt.findFirstOrThrow();
    collectKeys((await request(app).get(`/receipts/${receipt.token}`)).body, keys);
    for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden), forbidden).toBe(false);
  });

  it("AC-9.4: saldos coerentes, lote 001 liquidado uma vez e lote 003 estornado ao Bruno", async () => {
    const { deps } = setup();
    await runSeed(deps);
    const users = await prisma.user.findMany({ include: { wallet: true } });
    for (const user of users) {
      const wallet = user.wallet!;
      const entries = await prisma.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { seq: "asc" } });
      let total = 0n;
      for (const e of entries) {
        if (e.kind === "DEPOSIT" || e.kind === "SALE_CREDIT") total += e.amountCents;
        if (e.kind === "SALE_DEBIT") total -= e.amountCents;
        expect(e.totalAfter).toBe(total);
      }
      expect(wallet.totalCents).toBe(total);
      const last = entries[entries.length - 1];
      if (last) expect(wallet.committedCents).toBe(last.committedAfter);
      expect(wallet.committedCents).toBeLessThanOrEqual(wallet.totalCents);
      // Comprometido = lance atual dos lotes ao vivo que ela lidera.
      const led = await prisma.lot.findMany({ where: { leaderId: user.id, settledAt: null, cancelledAt: null } });
      expect(wallet.committedCents).toBe(led.reduce((sum, lot) => sum + (lot.currentBidCents ?? 0n), 0n));
    }
    const ana = users.find((u) => u.email === "ana@lanceauto.test")!;
    const bruno = users.find((u) => u.email === "bruno@lanceauto.test")!;
    const auctioneer = users.find((u) => u.email === "leiloeiro@lanceauto.test")!;
    const sold = await lotByNumber(1);
    const receipts = await prisma.receipt.findMany({ where: { lotId: sold.id } });
    expect(receipts).toHaveLength(1);
    const debits = await prisma.ledgerEntry.findMany({ where: { lotId: sold.id, kind: "SALE_DEBIT" } });
    const credits = await prisma.ledgerEntry.findMany({ where: { lotId: sold.id, kind: "SALE_CREDIT" } });
    expect(debits.map((d) => [d.userId, d.amountCents])).toEqual([[ana.id, receipts[0]!.amountCents]]);
    expect(credits.map((c) => [c.userId, c.amountCents])).toEqual([[auctioneer.id, receipts[0]!.amountCents]]);
    const cancelled = await lotByNumber(3);
    const refunds = await prisma.ledgerEntry.findMany({ where: { lotId: cancelled.id, kind: "REFUND" } });
    expect(refunds.map((r) => r.userId)).toEqual([bruno.id]);
    expect(cancelled.leaderId === bruno.id || cancelled.leaderId === null).toBe(true);
  });

  it("AC-9.5: rodar de novo não muda nada e avisa que o seed foi ignorado", async () => {
    const { deps } = setup();
    await runSeed(deps);
    const before = [await prisma.user.count(), await prisma.lot.count(), await prisma.bid.count(), await prisma.ledgerEntry.count()];
    logs = [];
    const second = await runSeed(deps);
    expect(second).toEqual({ skipped: true, receiptPath: null });
    expect(logs).toEqual([SEED_SKIPPED_MESSAGE]);
    expect([await prisma.user.count(), await prisma.lot.count(), await prisma.bid.count(), await prisma.ledgerEntry.count()]).toEqual(before);
  });

  it("AC-9.6: seed:demo cria o lote 006 ao vivo por 30 dias sem mexer nos demais, e de novo cria o 007", async () => {
    const { app, clock, deps } = setup();
    await runSeed(deps);
    const before = await prisma.lot.findMany({ where: { number: { lte: 5 } }, orderBy: { number: "asc" } });

    const first = await runSeedDemo(deps);
    expect(first.number).toBe(6);
    const second = await runSeedDemo(deps);
    expect(second.number).toBe(7);

    const lot6 = await lotByNumber(6);
    expect(lot6.endsAt.getTime() - clock.now().getTime()).toBe(30 * DAY);
    expect(lot6.bidCount).toBe(5);
    expect(lot6.cancelledAt).toBeNull();
    for (const id of [first.id, second.id]) {
      const res = await request(app).get(`/lots/${id}/audit`);
      expect(res.body.verdict.code).toBe("OK");
    }
    const after = await prisma.lot.findMany({ where: { number: { lte: 5 } }, orderBy: { number: "asc" } });
    expect(after).toEqual(before);
  });

  it("AC-9.7: com a Ana em R$ 20.000,00 disponíveis, o seed:demo deposita R$ 80.000,00 antes dos lances", async () => {
    const { deps } = setup();
    await runSeed(deps);
    const ana = await prisma.user.findUniqueOrThrow({ where: { email: SEED_ACCOUNTS.ana.email }, include: { wallet: true } });
    // Deixa a Ana com R$ 20.000,00 disponíveis: o resto do total sai do saldo (ajuste direto só na preparação do teste).
    await prisma.$executeRaw`UPDATE "Wallet" SET "totalCents" = "committedCents" + 2000000 WHERE "userId" = ${ana.id}`;
    const entriesBefore = await prisma.ledgerEntry.count({ where: { userId: ana.id } });

    await runSeedDemo(deps);

    const entries = await prisma.ledgerEntry.findMany({ where: { userId: ana.id }, orderBy: { seq: "asc" } });
    const newEntries = entries.slice(entriesBefore);
    expect(newEntries[0]).toMatchObject({ kind: "DEPOSIT", amountCents: BigInt(DEMO_BASE_CENTS - 2_000_000) });
    expect(newEntries.slice(1).every((e) => e.kind !== "DEPOSIT")).toBe(true);
  });

  it("seed:demo sem as contas do seed falha com a instrução clara", async () => {
    const { deps } = setup();
    await expect(runSeedDemo(deps)).rejects.toThrow("rode `npm run seed` antes do seed:demo");
  });

  it("AC-9.8: dois seeds ao mesmo tempo, com conexões distintas, deixam 3 usuários e 5 lotes e o segundo sai com o aviso", async () => {
    const other = createTestPrisma();
    try {
      const a = setup(prisma);
      const b = setup(other);
      const [first, second] = await Promise.all([runSeed(a.deps), runSeed(b.deps)]);
      expect([first.skipped, second.skipped].sort()).toEqual([false, true]);
      expect(await prisma.user.count()).toBe(3);
      expect(await prisma.lot.count()).toBe(5);
      expect(logs.filter((line) => line === SEED_SKIPPED_MESSAGE)).toHaveLength(1);
    } finally {
      await other.$disconnect();
    }
  });
});
