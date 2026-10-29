import type { PrismaClient } from "@prisma/client";
import { runSeed, withSeedLock, type SeedDeps, type SeedResult } from "./showcase";

export const RESET_CONFIRM_FLAG = "--confirmo";

/** O reset apaga o banco inteiro: só segue com a flag exata, nunca por engano. */
export function isResetConfirmed(argv: readonly string[]): boolean {
  return argv.includes(RESET_CONFIRM_FLAG);
}

/** Host, porta e banco para o operador conferir o alvo; usuário, senha e parâmetros nunca aparecem. `null` se não der para ler. */
export function maskDatabaseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.host ? `${parsed.host}${parsed.pathname}` : null;
  } catch {
    return null;
  }
}

/**
 * Valida os argumentos do CLI antes de qualquer conexão. Devolve a recusa em pt-BR, ou `null` quando pode seguir.
 * Sem alvo legível o reset não roda: o operador não teria como conferir o que será apagado.
 */
export function resetArgsProblem(argv: readonly string[], databaseUrl: string | undefined): string | null {
  if (!argv.includes("--reset")) {
    return isResetConfirmed(argv) ? `${RESET_CONFIRM_FLAG} só vale junto com --reset.` : null;
  }
  if (argv.includes("--demo")) return "--reset e --demo não combinam: escolha um dos dois.";
  if (maskDatabaseHost(databaseUrl) === null) return "Não consegui ler o host de DATABASE_URL, então não dá para conferir o que seria apagado. Nada foi alterado.";
  if (!isResetConfirmed(argv)) {
    return `O reset apaga TODOS os dados do banco acima. Nada foi alterado. Para seguir, rode de novo com ${RESET_CONFIRM_FLAG}.`;
  }
  return null;
}

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Esvazia todas as tabelas do schema em uso (menos o controle de migrações) e reinicia a numeração dos lotes. */
async function truncateEverything(db: PrismaClient): Promise<number> {
  const tables = await db.$queryRaw<{ schemaname: string; tablename: string }[]>`
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return 0;
  const list = tables.map((table) => `${quote(table.schemaname)}.${quote(table.tablename)}`).join(", ");
  // Um só TRUNCATE é atômico: ou apaga tudo ou nada.
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  return tables.length;
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * `npm run seed:reset`: apaga TUDO e semeia de novo, para entregar o ambiente limpo ao avaliador. Usuário não pode ser
 * apagado um a um (o trigger append-only de `Bid` rejeita o `SET NULL`), então o caminho é o TRUNCATE, que o trigger
 * não intercepta de propósito. O TRUNCATE roda segurando o advisory lock do seed e, ao soltá-lo, o `runSeed` o toma de novo.
 * Se o `runSeed` pular (outro seed entrou no intervalo, ou nada foi esvaziado), o reset falha em vez de fingir sucesso.
 */
export async function resetAndSeed(deps: SeedDeps): Promise<SeedResult> {
  const { db, log = () => undefined } = deps;
  const count = await withSeedLock(db, () => truncateEverything(db));
  log(`Banco esvaziado (${count} tabelas).`);
  let result: SeedResult;
  try {
    result = await runSeed(deps);
  } catch (err) {
    // O seed grava pelos services, fora da transação do lock: uma falha no meio deixaria contas sem todos os lotes, e o
    // seed do próximo start da API pularia ("já existem usuários"). Melhor um banco vazio e o erro à vista.
    try {
      await withSeedLock(db, () => truncateEverything(db));
    } catch (cleanupErr) {
      throw new Error(`${messageOf(err)} A limpeza do seed parcial também falhou (${messageOf(cleanupErr)}): rode o reset de novo antes de subir a API.`, { cause: err });
    }
    throw err;
  }
  if (result.skipped) {
    throw new Error("O reset terminou sem semear: outro seed entrou no intervalo ou o banco não foi esvaziado. Confira o banco e rode o reset de novo.");
  }
  return result;
}
