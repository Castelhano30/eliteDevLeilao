-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AUCTIONEER', 'BIDDER');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('DEPOSIT', 'HOLD', 'RELEASE', 'REFUND', 'SALE_DEBIT', 'SALE_CREDIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "userId" TEXT NOT NULL,
    "totalCents" BIGINT NOT NULL DEFAULT 0,
    "committedCents" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "lotId" TEXT,
    "totalAfter" BIGINT NOT NULL,
    "committedAfter" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_seq_key" ON "LedgerEntry"("seq");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_seq_idx" ON "LedgerEntry"("userId", "seq");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma não expressa CHECK: a carteira nunca fica negativa nem comprometida acima do total
ALTER TABLE "Wallet" ADD CONSTRAINT "wallet_committed_nonneg" CHECK ("committedCents" >= 0);
ALTER TABLE "Wallet" ADD CONSTRAINT "wallet_total_gte_committed" CHECK ("totalCents" >= "committedCents");
