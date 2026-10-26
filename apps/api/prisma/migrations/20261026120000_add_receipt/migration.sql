-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "pseudonym" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "finalHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_lotId_key" ON "Receipt"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_token_key" ON "Receipt"("token");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma não expressa CHECK (S05 §5): o comprovante é de um arremate, sempre com valor positivo.
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_amount_chk" CHECK ("amountCents" > 0);
