-- Galeria de imagens do lote: ItemImage guarda ate 5 fotos por item; Item.imageCount substitui "imageMime IS NOT NULL".
-- Migracao unica e atomica: cria, copia a imagem antiga para a posicao 0, confere as contagens e so entao apaga as colunas antigas.

CREATE TABLE "ItemImage" (
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ItemImage_pkey" PRIMARY KEY ("itemId","position")
);

ALTER TABLE "Item" ADD COLUMN "imageCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ItemImage" ADD CONSTRAINT "ItemImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ItemImage" ("itemId", "position", "mime", "data")
SELECT "id", 0, "imageMime", "imageData" FROM "Item" WHERE "imageData" IS NOT NULL AND "imageMime" IS NOT NULL;

UPDATE "Item" SET "imageCount" = 1 WHERE "imageData" IS NOT NULL AND "imageMime" IS NOT NULL;

-- Se algo nao bater, a migracao falha antes de apagar qualquer coisa.
DO $$
DECLARE
  with_image integer;
  copied integer;
  counted integer;
  identical integer;
BEGIN
  SELECT count(*) INTO with_image FROM "Item" WHERE "imageData" IS NOT NULL OR "imageMime" IS NOT NULL;
  SELECT count(*) INTO copied FROM "ItemImage";
  SELECT count(*) INTO counted FROM "Item" WHERE "imageCount" = 1;
  SELECT count(*) INTO identical
    FROM "Item" i
    JOIN "ItemImage" m ON m."itemId" = i."id" AND m."position" = 0 AND m."data" = i."imageData" AND m."mime" = i."imageMime";
  IF with_image <> copied OR with_image <> counted OR with_image <> identical THEN
    RAISE EXCEPTION 'Contagens divergentes na migracao de imagens: itens com imagem %, copiadas %, imageCount %, identicas %',
      with_image, copied, counted, identical;
  END IF;
END $$;

ALTER TABLE "Item" DROP COLUMN "imageData", DROP COLUMN "imageMime";
