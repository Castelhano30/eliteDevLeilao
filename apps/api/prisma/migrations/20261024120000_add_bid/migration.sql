-- CreateEnum
CREATE TYPE "ChainKind" AS ENUM ('BID', 'CANCEL');

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" "ChainKind" NOT NULL,
    "bidderId" TEXT,
    "pseudonym" TEXT,
    "amountCents" BIGINT,
    "at" TIMESTAMP(3) NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bid_lotId_bidderId_idx" ON "Bid"("lotId", "bidderId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_lotId_seq_key" ON "Bid"("lotId", "seq");

-- CreateIndex
CREATE INDEX "Lot_leaderId_idx" ON "Lot"("leaderId");

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prisma não expressa CHECK nem trigger (S03 §5)
-- BID leva autor, pseudônimo e valor positivo; CANCEL (S06) não leva nenhum dos três.
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_shape_chk" CHECK (
  (kind = 'BID' AND "bidderId" IS NOT NULL AND pseudonym IS NOT NULL AND "amountCents" IS NOT NULL AND "amountCents" > 0)
  OR
  (kind = 'CANCEL' AND "bidderId" IS NULL AND pseudonym IS NULL AND "amountCents" IS NULL)
);

-- INV-7: a cadeia é append-only. Sem trigger de TRUNCATE de propósito: os testes limpam com TRUNCATE ... CASCADE.
CREATE FUNCTION bid_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Bid é append-only (UPDATE/DELETE proibido)'; END $$;

CREATE TRIGGER bid_no_update_delete BEFORE UPDATE OR DELETE ON "Bid"
  FOR EACH ROW EXECUTE FUNCTION bid_block_mutation();

-- Endurecimento do lote para quando a S03 passa a escrever os contadores e o lance atual (adiado da revisão geral)
ALTER TABLE "Lot" ADD CONSTRAINT "lot_bid_count_nonneg" CHECK ("bidCount" >= 0);
ALTER TABLE "Lot" ADD CONSTRAINT "lot_entry_count_nonneg" CHECK ("entryCount" >= 0);
ALTER TABLE "Lot" ADD CONSTRAINT "lot_current_bid_min" CHECK ("currentBidCents" IS NULL OR "currentBidCents" >= "startingBidCents");
