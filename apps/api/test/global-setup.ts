import { execSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";

/** Aplica as migrações no banco de testes antes de qualquer teste (R-0.13). */
export default function setup() {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    console.warn("DATABASE_URL_TEST ausente: testes de integração com banco serão pulados.");
    return;
  }
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "inherit",
  });
}
