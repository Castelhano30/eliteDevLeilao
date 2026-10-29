import type { PrismaClient } from "@prisma/client";
import { runSeed, withSeedLock, type SeedDeps, type SeedResult } from "./showcase";

export const RESET_CONFIRM_FLAG = "--confirmo";

/** O reset apaga o banco inteiro: só segue com a flag exata, nunca por engano. */
export function isResetConfirmed(argv: readonly string[]): boolean {
  return argv.includes(RESET_CONFIRM_FLAG);
}

/** Host, porta e banco para o operador conferir o alvo; usuário, senha e parâmetros nunca aparecem. */
export function maskDatabaseHost(url: string | undefined): string {
  if (!url) return "(DATABASE_URL ausente)";
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "(URL do banco ilegível)";
  }
}

/** Esvazia todas as tabelas do schema `public` (menos o controle de migrações) e reinicia a numeração dos lotes. */
async function truncateEverything(db: PrismaClient): Promise<number> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return 0;
  const list = tables.map((table) => `"public"."${table.tablename}"`).join(", ");
  // Um só TRUNCATE é atômico: ou apaga tudo ou nada.
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  return tables.length;
}

/**
 * `npm run seed:reset`: apaga TUDO e semeia de novo, para entregar o ambiente limpo ao avaliador. Usuário não pode ser
 * apagado um a um (o trigger append-only de `Bid` rejeita o `SET NULL`), então o caminho é o TRUNCATE, que o trigger
 * não intercepta de propósito. O TRUNCATE roda segurando o advisory lock do seed e, ao soltá-lo, o `runSeed` o toma de novo: se outro
 * seed entrar no intervalo, o `runSeed` só pula e o resultado é o mesmo.
 */
export async function resetAndSeed(deps: SeedDeps): Promise<SeedResult> {
  const { db, log = () => undefined } = deps;
  const count = await withSeedLock(db, () => truncateEverything(db));
  log(`Banco esvaziado (${count} tabelas).`);
  try {
    return await runSeed(deps);
  } catch (err) {
    // O seed grava pelos services, fora da transação do lock: uma falha no meio deixaria contas sem todos os lotes, e o
    // seed do próximo start da API pularia ("já existem usuários"). Melhor um banco vazio e o erro à vista.
    await withSeedLock(db, () => truncateEverything(db)).catch(() => log("Não consegui limpar o seed parcial: rode o reset de novo."));
    throw err;
  }
}
