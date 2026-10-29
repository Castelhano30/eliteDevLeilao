import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { assertLotInvariants } from "../../test/helpers/bids";
import { makeTestApp, testEnv } from "../../test/helpers/app";
import { createTestPrisma, restartLotNumbering, testDatabaseUrl, truncateAll } from "../../test/helpers/db";
import { makeAuthService } from "../services/auth.service";
import { makeWalletService } from "../services/wallet.service";
import { RESET_CONFIRM_FLAG, isResetConfirmed, maskDatabaseHost, resetAndSeed, resetArgsProblem } from "./reset";
import { runSeed, runSeedDemo, type FixtureCar, type SeedDeps } from "./showcase";

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

  it("devolve null, sem vazar nada, quando a URL falta ou é inválida", () => {
    expect(maskDatabaseHost("isto não é uma url com segredo")).toBeNull();
    expect(maskDatabaseHost(undefined)).toBeNull();
    expect(maskDatabaseHost("")).toBeNull();
  });

  it("acha o host mesmo com @ solto na senha", () => {
    expect(maskDatabaseHost("postgresql://u:p@ss@h.internal:5432/db")).toBe("h.internal:5432/db");
  });
});

describe("resetArgsProblem", () => {
  const url = "postgresql://u:p@localhost:5433/lanceauto";

  it("deixa passar o seed comum e o reset confirmado", () => {
    expect(resetArgsProblem([], url)).toBeNull();
    expect(resetArgsProblem(["--demo"], url)).toBeNull();
    expect(resetArgsProblem(["--reset", "--confirmo"], url)).toBeNull();
  });

  it("recusa o reset sem confirmação, dizendo que nada foi alterado", () => {
    expect(resetArgsProblem(["--reset"], url)).toMatch(/Nada foi alterado.*--confirmo/);
  });

  it("recusa --confirmo solto e --reset junto com --demo", () => {
    expect(resetArgsProblem(["--confirmo"], url)).toMatch(/só vale junto com --reset/);
    expect(resetArgsProblem(["--reset", "--demo", "--confirmo"], url)).toMatch(/não combinam/);
  });

  it("recusa quando o host do banco não pode ser conferido, mesmo confirmado", () => {
    expect(resetArgsProblem(["--reset", "--confirmo"], undefined)).toMatch(/host de DATABASE_URL/);
    expect(resetArgsProblem(["--reset", "--confirmo"], "lixo")).toMatch(/host de DATABASE_URL/);
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

  /** Deixa o banco "sujo" como depois dos testes internos: um lote 006 com lances e uma conta a mais, com saldo, além do seed. */
  async function dirty(deps: SeedDeps) {
    await runSeed(deps);
    await runSeedDemo(deps);
    expect(await prisma.lot.count()).toBe(6);
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
    expect(before[0]!.n).toBeGreaterThan(0n);
    await resetAndSeed(deps);
    const after = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations"`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  describe("CLI (prisma/seed.ts como processo)", () => {
    function runCli(...args: string[]) {
      return spawnSync(process.execPath, ["--import", "tsx", path.join(baseDir, "seed.ts"), ...args], {
        cwd: path.resolve(baseDir, ".."),
        encoding: "utf8",
        timeout: 120_000,
        env: { ...process.env, DATABASE_URL: testDatabaseUrl, JWT_SECRET: testEnv.JWT_SECRET, AUDIT_HMAC_KEY: testEnv.AUDIT_HMAC_KEY },
      });
    }

    it("sem --confirmo recusa, sai com código 1 e não altera o banco", async () => {
      const { deps } = setup();
      await dirty(deps);

      const cli = runCli("--reset");

      expect(cli.status).toBe(1);
      expect(cli.stderr).toContain("Nada foi alterado");
      expect(cli.stdout).toContain("Alvo:");
      expect(cli.stdout + cli.stderr).not.toMatch(/:\/\/|lanceauto:lanceauto/);
      expect(await prisma.user.count()).toBe(4);
      expect(await prisma.lot.count()).toBe(6);
    });

    it("--reset com --demo recusa e não altera o banco", async () => {
      const { deps } = setup();
      await dirty(deps);
      const cli = runCli("--reset", "--demo", "--confirmo");
      expect(cli.status).toBe(1);
      expect(await prisma.lot.count()).toBe(6);
    });

    it("com --confirmo apaga o que havia e deixa só o seed, numerado de 001", async () => {
      const { deps } = setup();
      await dirty(deps);

      const cli = runCli("--reset", "--confirmo");

      expect(cli.status, cli.stderr).toBe(0);
      expect(await prisma.user.count()).toBe(3);
      expect((await prisma.lot.findMany({ orderBy: { number: "asc" } })).map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
