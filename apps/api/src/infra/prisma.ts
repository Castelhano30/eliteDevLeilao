import { PrismaClient } from "@prisma/client";

export type Db = Pick<PrismaClient, "$queryRaw" | "$disconnect">;

export function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}
