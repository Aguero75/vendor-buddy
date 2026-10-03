CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

ALTER TABLE "Receipt"
ADD COLUMN "email" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "paystackRef" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "status" "ReceiptStatus" NOT NULL DEFAULT 'PAID';

CREATE UNIQUE INDEX "Receipt_paystackRef_key" ON "Receipt"("paystackRef");
