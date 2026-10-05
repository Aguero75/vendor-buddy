-- Preserve the vendor-based schema and existing receipt rows. Inventory is opt-in:
-- NULL stock means the product is not quantity-tracked.

CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL', 'PAYSTACK', 'CRYPTO');
CREATE TYPE "OtpPurpose" AS ENUM ('VOID_RECEIPT', 'CHANGE_EMAIL');

ALTER TYPE "ReceiptStatus" RENAME TO "ReceiptStatus_old";
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'PARTIAL', 'VOIDED');
ALTER TABLE "Receipt" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Receipt"
  ALTER COLUMN "status" TYPE "ReceiptStatus"
  USING ("status"::TEXT::"ReceiptStatus");
ALTER TABLE "Receipt" ALTER COLUMN "status" SET DEFAULT 'PAID';
DROP TYPE "ReceiptStatus_old";

ALTER TABLE "Product"
  ADD COLUMN "stock" INTEGER,
  ADD COLUMN "zeroSince" TIMESTAMP(3);

ALTER TABLE "Receipt"
  ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "nowpaymentsId" TEXT,
  ADD COLUMN "invoiceAmount" DECIMAL(14,4),
  ADD COLUMN "invoiceCurrency" TEXT,
  ADD COLUMN "cryptoCurrency" TEXT,
  ADD COLUMN "cryptoAmount" DECIMAL(36,18),
  ADD COLUMN "stockApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customerKey" TEXT,
  ADD COLUMN "fxRate" DECIMAL(14,4),
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedBy" TEXT,
  ADD COLUMN "voidReason" TEXT;

-- Existing gateway receipts remain identified as Paystack. Previously-created
-- receipts did not decrement stock, so stockApplied deliberately remains false.
UPDATE "Receipt"
SET "method" = CASE
  WHEN "paystackRef" IS NOT NULL THEN 'PAYSTACK'::"PaymentMethod"
  ELSE 'MANUAL'::"PaymentMethod"
END,
"paidAt" = CASE WHEN "status" = 'PAID' AND "paidAt" IS NULL THEN "createdAt" ELSE "paidAt" END,
"customerKey" = CASE
  WHEN "phone" IS NOT NULL
    AND length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 7
    AND regexp_replace("phone", '[^0-9]', '', 'g') LIKE '234%'
    THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
  WHEN "phone" IS NOT NULL
    AND length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 7
    AND regexp_replace("phone", '[^0-9]', '', 'g') LIKE '0%'
    THEN '+234' || substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 2)
  WHEN "phone" IS NOT NULL
    AND length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 7
    THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
  WHEN "email" IS NOT NULL THEN lower(trim("email"))
  ELSE NULL
END;

CREATE TABLE "Settings" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "ownerEmail" TEXT,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "availableForBookings" BOOLEAN NOT NULL DEFAULT false,
  "fxRate" DECIMAL(14,4),
  "fxRateAt" TIMESTAMP(3),
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Settings_vendorId_key" ON "Settings"("vendorId");
ALTER TABLE "Settings"
  ADD CONSTRAINT "Settings_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "Settings" ("id", "vendorId")
SELECT 'settings_' || "id", "id" FROM "Vendor";

CREATE TABLE "SecurityOtp" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "targetId" TEXT NOT NULL,
  "payload" TEXT,
  "codeHash" TEXT NOT NULL,
  "codeHash2" TEXT,
  "requestedBy" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityOtp_vendorId_purpose_targetId_idx"
  ON "SecurityOtp"("vendorId", "purpose", "targetId");
ALTER TABLE "SecurityOtp"
  ADD CONSTRAINT "SecurityOtp_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Receipt_status_paidAt_idx" ON "Receipt"("status", "paidAt");
CREATE INDEX "Receipt_customerKey_idx" ON "Receipt"("customerKey");
CREATE INDEX "Receipt_needsReview_idx" ON "Receipt"("needsReview");
