import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { SystemClock } from "../src/infra/clock";
import { runSeed, runSeedDemo, type FixtureCar } from "../src/seed/showcase";

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

/**
 * `npm run seed`: contas de teste e os lotes 001 a 005, pelos services da aplicação e sem rede. Se já existem
 * usuários, não faz nada e sai com código 0 (seguro a cada deploy). `--demo` (`npm run seed:demo`) cria um lote ao
 * vivo novo. A lógica mora em `src/seed/showcase.ts`, onde os testes a exercitam.
 */
async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  const auditKey = process.env.AUDIT_HMAC_KEY;
  if (!jwtSecret) throw new Error("JWT_SECRET ausente: o seed usa os mesmos services da API.");
  if (!auditKey) throw new Error("AUDIT_HMAC_KEY ausente: os lotes nascem com genesis e selo.");

  const db = new PrismaClient();
  try {
    const cars = JSON.parse(readFileSync(path.join(__dirname, "fipe-fixture.json"), "utf8")) as FixtureCar[];
    const deps = { db, clock: new SystemClock(), auditKey, jwtSecret, cars, baseDir: __dirname, log: (message: string) => console.log(message) };
    if (process.argv.includes("--demo")) {
      const lot = await runSeedDemo(deps);
      console.log(`Abra: ${process.env.WEB_ORIGIN?.replace(/\/+$/, "") ?? ""}/lotes/${lot.id}`);
    } else {
      await runSeed(deps);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
