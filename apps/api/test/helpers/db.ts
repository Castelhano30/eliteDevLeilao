import { PrismaClient } from "@prisma/client";

export const testDatabaseUrl = process.env.DATABASE_URL_TEST;

export function createTestPrisma(): PrismaClient {
  if (!testDatabaseUrl) throw new Error("DATABASE_URL_TEST ausente");
  return new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
}

/** Esvazia todas as tabelas do schema public (menos o controle do Prisma) entre os testes. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

/** Recomeça a numeração dos lotes em 001 (TRUNCATE não reinicia a sequência): para testes que conferem os números do seed. */
export async function restartLotNumbering(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE ${"\"Lot_number_seq\""} RESTART WITH 1`);
}
