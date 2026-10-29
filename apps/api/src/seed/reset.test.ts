import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { assertLotInvariants } from "../../test/helpers/bids";
import { makeTestApp, testEnv } from "../../test/helpers/app";
import { createTestPrisma, restartLotNumbering, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { makeAuthService } from "../services/auth.service";
import { makeWalletService } from "../services/wallet.service";
import { RESET_CONFIRM_FLAG, isResetConfirmed, maskDatabaseHost, resetAndSeed } from "./reset";
import { runSeed, type FixtureCar, type SeedDeps } from "./showcase";

const baseDir = path.resolve(__dirname, "../../prisma");
const cars = JSON.parse(readFileSync(path.join(baseDir, "fipe-fixture.json"), "utf8")) as FixtureCar[];

describe("isResetConfirmed", () => {
  it("só confirma com a flag exata", () => {
    expect(RESET_CONFIRM_FLAG).toBe("--confirmo");
    expect(isResetConfirmed(["--reset", "--confirmo"])).toBe(true);
  });

  it("recusa sem a flag ou com variações dela", () => {
    expect(isResetConfirmed(["--reset"])).toBe(false);
    expect(isResetConfirmed(["--reset", "--confirmo=nao"])).toBe(false);
    expect(isResetConfirmed(["--reset", "confirmo"])).toBe(false);
    expect(isResetConfirmed([])).toBe(false);
  });
});

describe("maskDatabaseHost", () => {
  it("mostra só host, porta e banco, sem usuário nem senha", () => {
    expect(maskDatabaseHost("postgresql://lanceauto:segredo@postgres.railway.internal:5432/railway")).toBe("postgres.railway.internal:5432/railway");
    expect(maskDatabaseHost("postgresql://u:p@localhost/lanceauto?sslmode=require")).toBe("localhost/lanceauto");
  });

  it("não vaza a URL quando ela é inválida", () => {
    expect(maskDatabaseHost("isto não é uma url com segredo")).toBe("(URL do banco ilegível)");
    expect(maskDatabaseHost(undefined)).toBe("(DATABASE_URL ausente)");
  });
});

describe.skipIf(!testDatabaseUrl)("reset do banco para o avaliador (integração, sem rede)", () => {
  const prisma = testDatabaseUrl ? createTestPrisma() : (undefined as never);

  beforeEach(async () => {
    await truncateAll(prisma);
    await restartLotNumbering(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  function setup() {
    const { app, clock } = makeTestApp(prisma);
    const deps: SeedDeps = { db: prisma, clock, auditKey: testEnv.AUDIT_HMAC_KEY, jwtSecret: testEnv.JWT_SECRET, cars, baseDir };
    return { app, clock, deps };
  }

  /** Deixa o banco "sujo" como depois dos testes internos: uma conta a mais, com saldo, além do seed. */
  async function dirty(deps: SeedDeps) {
    await runSeed(deps);
    const { user } = await makeAuthService({ db: prisma, clock: deps.clock, jwtSecret: deps.jwtSecret }).register({
      name: "Visitante",
      email: "visitante@exemplo.test",
      password: "senha-do-visitante",
      role: "BIDDER",
    });
    await makeWalletService({ db: prisma, clock: deps.clock }).deposit(user.id, 1_000_000);
  }

  it("apaga contas e lotes extras e devolve só as 3 contas e os lotes 001–005 do seed", async () => {
    const { deps } = setup();
    await dirty(deps);
    expect(await prisma.user.count()).toBe(4);

    const result = await resetAndSeed(deps);

    expect(result.skipped).toBe(false);
    const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
    expect(users.map((u) => u.email)).toEqual(["ana@lanceauto.test", "bruno@lanceauto.test", "leiloeiro@lanceauto.test"]);
    expect((await prisma.lot.findMany({ orderBy: { number: "asc" } })).map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
    const deposits = await prisma.ledgerEntry.findMany({ where: { kind: "DEPOSIT" } });
    expect(deposits.map((d) => Number(d.amountCents)).sort()).toEqual([30_000_000, 50_000_000]);
  });

  it("deixa a auditoria de cada lote íntegra", async () => {
    const { app, deps } = setup();
    await dirty(deps);
    await resetAndSeed(deps);
    for (const lot of await prisma.lot.findMany({ orderBy: { number: "asc" } })) {
      const res = await request(app).get(`/lots/${lot.id}/audit`);
      expect(res.body.verdict.code, `lote ${lot.number}`).toBe("OK");
      await assertLotInvariants(prisma, lot.id);
    }
  });

  it("repetido dá o mesmo resultado, sem duplicar nada", async () => {
    const { deps } = setup();
    await dirty(deps);
    await resetAndSeed(deps);
    await resetAndSeed(deps);
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.lot.count()).toBe(5);
    expect(await prisma.receipt.count()).toBe(1);
    expect((await prisma.lot.findMany({ orderBy: { number: "asc" } })).map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("se o seed falha no meio, o erro sobe e não sobram dados parciais", async () => {
    const { deps } = setup();
    await dirty(deps);
    const withoutLiveCar = { ...deps, cars: cars.filter((car) => car.key !== "uno-2010") };
    await expect(resetAndSeed(withoutLiveCar)).rejects.toThrow("uno-2010");
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.lot.count()).toBe(0);

    await resetAndSeed(deps);
    expect(await prisma.user.count()).toBe(3);
  });

  it("um banco já vazio também termina semeado", async () => {
    const { deps } = setup();
    const result = await resetAndSeed(deps);
    expect(result.skipped).toBe(false);
    expect(await prisma.user.count()).toBe(3);
  });

  it("mantém o controle de migrações do Prisma", async () => {
    const { deps } = setup();
    const before = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations"`;
    await resetAndSeed(deps);
    const after = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations"`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });
});
