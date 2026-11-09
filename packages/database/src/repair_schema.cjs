const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL || 'postgresql://hatlock:hatlock_dev_pass_2026@localhost:5432/hatlock_db?schema=public';

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

async function repair() {
  console.log('[HatLock] Connecting to database to repair schema...');
  try {
    await prisma.$connect();
    console.log('[HatLock] Connected. Verifying Device table...');

    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Device'
      ) as exists;
    `);

    if (!tableCheck || !tableCheck[0]?.exists) {
      console.log('[HatLock] Device table does not exist. Please run initial migration first.');
      return;
    }

    console.log('[HatLock] Ensuring DeviceOS enum values...');
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'ANDROID'; EXCEPTION WHEN others THEN null; END $$;`);
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'IOS'; EXCEPTION WHEN others THEN null; END $$;`);
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'MACOS'; EXCEPTION WHEN others THEN null; END $$;`);
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'IPADOS'; EXCEPTION WHEN others THEN null; END $$;`);

    console.log('[HatLock] Ensuring DeviceType enum...');
    await prisma.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "DeviceType" AS ENUM ('LAPTOP', 'DESKTOP', 'SMARTPHONE', 'TABLET', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);

    console.log('[HatLock] Ensuring Device table columns (deviceType, complianceStatus, etc.)...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Device" 
        ADD COLUMN IF NOT EXISTS "complianceStatus" TEXT NOT NULL DEFAULT 'COMPLIANT',
        ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        ADD COLUMN IF NOT EXISTS "deviceType" "DeviceType" NOT NULL DEFAULT 'LAPTOP',
        ADD COLUMN IF NOT EXISTS "enrollmentType" TEXT,
        ADD COLUMN IF NOT EXISTS "platform" TEXT,
        ADD COLUMN IF NOT EXISTS "tamperAlerts" JSONB;
    `);

    console.log('[HatLock] Ensuring DeviceIdentity table columns...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DeviceIdentity" 
        ADD COLUMN IF NOT EXISTS "androidId" TEXT,
        ADD COLUMN IF NOT EXISTS "appleUDID" TEXT,
        ADD COLUMN IF NOT EXISTS "encryptionStatus" TEXT,
        ADD COLUMN IF NOT EXISTS "imei1" TEXT,
        ADD COLUMN IF NOT EXISTS "imei2" TEXT,
        ADD COLUMN IF NOT EXISTS "playIntegrityVerdict" TEXT,
        ADD COLUMN IF NOT EXISTS "screenLockEnabled" BOOLEAN;
    `);

    console.log('[HatLock] Ensuring PaymentProviderConfig and PayoutRecord tables...');
    await prisma.$executeRawUnsafe(`
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
    `);

    await prisma.$executeRawUnsafe(`
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
    `);

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PaymentProviderConfig_businessId_idx" ON "PaymentProviderConfig"("businessId");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PaymentProviderConfig_businessId_provider_key" ON "PaymentProviderConfig"("businessId", "provider");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRecord_idempotencyKey_key" ON "PayoutRecord"("idempotencyKey");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PayoutRecord_businessId_idx" ON "PayoutRecord"("businessId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PayoutRecord_provider_idx" ON "PayoutRecord"("provider");`);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "PaymentProviderConfig" ADD CONSTRAINT "PaymentProviderConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    console.log('[HatLock] Schema repair complete! All columns including Device.deviceType are verified.');
  } catch (err) {
    console.error('[HatLock] Error repairing schema:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

repair();

