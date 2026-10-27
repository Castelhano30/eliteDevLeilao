import type { Prisma, PrismaClient } from "@prisma/client";

const TRIGGER = "bid_no_update_delete";

/**
 * Simula quem tem acesso direto ao banco: desliga o trigger append-only de `Bid`, roda a adulteração e o religa,
 * tudo numa **única transação** (T2). O DDL do Postgres é transacional: se `fn` lançar, o rollback desfaz também o
 * `DISABLE`, então o trigger nunca fica desligado para outro teste. O `ALTER TABLE` pega lock exclusivo, por isso a
 * suíte roda com `fileParallelism: false`.
 */
export async function withAppendOnlyTriggerDisabled<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`ALTER TABLE "Bid" DISABLE TRIGGER ${TRIGGER}`);
    const result = await fn(tx);
    await tx.$executeRawUnsafe(`ALTER TABLE "Bid" ENABLE TRIGGER ${TRIGGER}`);
    return result;
  });
}

/** `tgenabled` do trigger: `O` = habilitado, `D` = desabilitado. */
export async function appendOnlyTriggerState(prisma: PrismaClient): Promise<string | undefined> {
  const rows = await prisma.$queryRaw<{ tgenabled: string }[]>`
    SELECT tgenabled FROM pg_trigger WHERE tgname = ${TRIGGER}`;
  return rows[0]?.tgenabled;
}
