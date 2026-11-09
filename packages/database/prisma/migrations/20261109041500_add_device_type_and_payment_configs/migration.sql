-- AlterEnum
ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'ANDROID';
ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'IOS';
ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'MACOS';
ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'IPADOS';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DeviceType" AS ENUM ('LAPTOP', 'DESKTOP', 'SMARTPHONE', 'TABLET', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "complianceStatus" TEXT NOT NULL DEFAULT 'COMPLIANT',
ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS "deviceType" "DeviceType" NOT NULL DEFAULT 'LAPTOP',
ADD COLUMN IF NOT EXISTS "enrollmentType" TEXT,
ADD COLUMN IF NOT EXISTS "platform" TEXT,
ADD COLUMN IF NOT EXISTS "tamperAlerts" JSONB;

-- AlterTable
ALTER TABLE "DeviceIdentity" ADD COLUMN IF NOT EXISTS "androidId" TEXT,
ADD COLUMN IF NOT EXISTS "appleUDID" TEXT,
ADD COLUMN IF NOT EXISTS "encryptionStatus" TEXT,
ADD COLUMN IF NOT EXISTS "imei1" TEXT,
ADD COLUMN IF NOT EXISTS "imei2" TEXT,
ADD COLUMN IF NOT EXISTS "playIntegrityVerdict" TEXT,
ADD COLUMN IF NOT EXISTS "screenLockEnabled" BOOLEAN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentProviderConfig" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "webhookSecret" TEXT,
    "metadata" JSONB,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PayoutRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amountTZS" DECIMAL(14,2) NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "providerReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentProviderConfig_businessId_idx" ON "PaymentProviderConfig"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentProviderConfig_businessId_provider_key" ON "PaymentProviderConfig"("businessId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRecord_idempotencyKey_key" ON "PayoutRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayoutRecord_businessId_idx" ON "PayoutRecord"("businessId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PayoutRecord_provider_idx" ON "PayoutRecord"("provider");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PaymentProviderConfig" ADD CONSTRAINT "PaymentProviderConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
