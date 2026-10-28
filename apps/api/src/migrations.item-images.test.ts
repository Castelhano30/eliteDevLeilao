import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "../test/helpers/db";

const MIGRATION = "20261028120000_item_images";
const prismaDir = path.resolve(__dirname, "../prisma");

/**
 * A migração da galeria roda de verdade sobre um banco descartável que já tem lotes "antigos" (com `imageData` e
 * `imageMime` no `Item`): copia a imagem para a posição 0, confere as contagens e só então apaga as colunas antigas.
 */
describe.skipIf(!testDatabaseUrl)("migração item_images (dado antigo)", () => {
  const created: { name: string; scratch: string }[] = [];
  let admin: PrismaClient | undefined;

  const urlFor = (name: string) => {
    const url = new URL(testDatabaseUrl!);
    url.pathname = `/${name}`;
    return url.toString();
  };

  /** Banco novo com todas as migrações menos a da galeria. */
  async function databaseBeforeMigration(label: string) {
    admin ??= new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } });
    // Sobras de uma execução interrompida (o pid muda a cada vez).
    const stale = await admin.$queryRaw<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname LIKE 'lanceauto_mig_%'`;
    for (const { datname } of stale) await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    const name = `lanceauto_mig_${label}_${process.pid}`;
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    const scratch = mkdtempSync(path.join(os.tmpdir(), "lanceauto-mig-"));
    cpSync(path.join(prismaDir, "schema.prisma"), path.join(scratch, "schema.prisma"));
    cpSync(path.join(prismaDir, "migrations"), path.join(scratch, "migrations"), { recursive: true });
    rmSync(path.join(scratch, "migrations", MIGRATION), { recursive: true });
    created.push({ name, scratch });
    const url = urlFor(name);
    const deploy = () =>
      execSync(`npx prisma migrate deploy --schema "${path.join(scratch, "schema.prisma")}"`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
        stdio: "pipe",
      });
    return { url, scratch, deploy };
  }

  afterAll(async () => {
    for (const { name, scratch } of created) {
      await admin?.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => undefined);
      rmSync(scratch, { recursive: true, force: true });
    }
    await admin?.$disconnect();
  }, 60_000);

  const insertItem = (db: PrismaClient, id: string, data: Buffer | null, mime: string | null) =>
    db.$executeRaw`
      INSERT INTO "Item" ("id", "source", "externalId", "brand", "model", "year", "fuel", "referencePriceCents", "referenceMonth",
        "imageData", "imageMime", "imageCredit", "rawData", "fetchedAt")
      VALUES (${id}, 'FIPE', 'x', 'Toyota', 'Corolla', 2015, 'Flex', 8000000, '2026-10',
        ${data}, ${mime}, ${data ? "Foto: antiga" : null}, '{}'::jsonb, NOW())`;

  it("lote com imagem vira imageCount 1 e ItemImage na posição 0 com os mesmos bytes; sem imagem fica 0; colunas antigas somem", async () => {
    const { url, scratch, deploy } = await databaseBeforeMigration("ok");
    deploy();
    const db = new PrismaClient({ datasources: { db: { url } } });
    try {
      const bytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(5000, 7)]);
      await insertItem(db, "item-com-foto", bytes, "image/png");
      await insertItem(db, "item-sem-foto", null, null);

      cpSync(path.join(prismaDir, "migrations", MIGRATION), path.join(scratch, "migrations", MIGRATION), { recursive: true });
      expect(readdirSync(path.join(scratch, "migrations"))).toContain(MIGRATION);
      deploy();

      const items = await db.item.findMany({ orderBy: { id: "asc" }, select: { id: true, imageCount: true, imageCredit: true } });
      expect(items).toEqual([
        { id: "item-com-foto", imageCount: 1, imageCredit: "Foto: antiga" },
        { id: "item-sem-foto", imageCount: 0, imageCredit: null },
      ]);
      const images = await db.itemImage.findMany();
      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({ itemId: "item-com-foto", position: 0, mime: "image/png" });
      expect(Buffer.compare(Buffer.from(images[0]!.data), bytes)).toBe(0);
      const columns = await db.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'Item' AND column_name IN ('imageData', 'imageMime')`;
      expect(columns).toEqual([]);
    } finally {
      await db.$disconnect();
    }
  }, 120_000);

  it("contagens divergentes: a migração falha e nada é apagado (nem a tabela nova fica)", async () => {
    const { url, scratch, deploy } = await databaseBeforeMigration("bad");
    deploy();
    const db = new PrismaClient({ datasources: { db: { url } } });
    try {
      const bytes = Buffer.alloc(300, 1);
      await insertItem(db, "item-bom", bytes, "image/jpeg");
      // Tipo sem bytes: não há o que copiar, então as contagens não batem.
      await insertItem(db, "item-quebrado", null, "image/png");

      cpSync(path.join(prismaDir, "migrations", MIGRATION), path.join(scratch, "migrations", MIGRATION), { recursive: true });
      expect(() => deploy()).toThrow();

      const columns = await db.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'Item' AND column_name IN ('imageData', 'imageMime', 'imageCount')`;
      expect(columns.map((c) => c.column_name).sort()).toEqual(["imageData", "imageMime"]);
      const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE tablename = 'ItemImage'`;
      expect(tables).toEqual([]);
      const stored = await db.$queryRaw<{ id: string; len: number }[]>`SELECT "id", length("imageData") AS len FROM "Item" WHERE "imageData" IS NOT NULL`;
      expect(stored).toEqual([{ id: "item-bom", len: 300 }]);
    } finally {
      await db.$disconnect();
    }
  }, 120_000);
});
