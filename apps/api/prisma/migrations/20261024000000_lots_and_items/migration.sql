-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fuel" TEXT NOT NULL,
    "referencePriceCents" BIGINT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "imageData" BYTEA,
    "imageMime" TEXT,
    "imageCredit" TEXT,
    "imageCreditUrl" TEXT,
    "rawData" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "auctioneerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "startingBidCents" BIGINT NOT NULL,
    "minIncrementCents" BIGINT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "originalEndsAt" TIMESTAMP(3) NOT NULL,
    "currentBidCents" BIGINT,
    "leaderId" TEXT,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "lastHash" TEXT NOT NULL,
    "seal" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lot_number_key" ON "Lot"("number");

-- CreateIndex
CREATE INDEX "Lot_endsAt_idx" ON "Lot"("endsAt");

-- CreateIndex
CREATE INDEX "Lot_auctioneerId_idx" ON "Lot"("auctioneerId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_auctioneerId_fkey" FOREIGN KEY ("auctioneerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prisma não expressa CHECK: endurecimento das regras do lote (S02 §5.1)
ALTER TABLE "Lot" ADD CONSTRAINT "lot_starting_bid_min" CHECK ("startingBidCents" >= 100);
ALTER TABLE "Lot" ADD CONSTRAINT "lot_min_increment_min" CHECK ("minIncrementCents" >= 100);
ALTER TABLE "Lot" ADD CONSTRAINT "lot_ends_after_start" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Lot" ADD CONSTRAINT "lot_original_ends_after_start" CHECK ("originalEndsAt" >= "startsAt");
