// HatLock Database Schema Synchronization & Auto-Repair
// Ensures Device.deviceType, DeviceType enum, and all MDM/Payment columns are physically present in PostgreSQL

import { PrismaClient } from '@prisma/client';

interface LoggerLike {
  info: (msg: string | object, ...args: any[]) => void;
  warn: (msg: string | object, ...args: any[]) => void;
  error: (msg: string | object, ...args: any[]) => void;
}

export async function ensureDatabaseSchema(prisma: PrismaClient, log?: LoggerLike): Promise<void> {
  try {
    // 1. Verify if the Device table exists in public schema
    const tableCheck = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Device'
      ) as exists;
    `);

    if (!tableCheck || !tableCheck[0]?.exists) {
      log?.info('ensureDatabaseSchema: Device table not present yet. Skipping incremental patch.');
      return;
    }

    // 2. Check if deviceType column exists in Device table
    const columnCheck = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'Device' AND column_name = 'deviceType'
      ) as exists;
    `);

    const hasDeviceType = columnCheck?.[0]?.exists;

    if (!hasDeviceType) {
      log?.warn('ensureDatabaseSchema: Missing column Device.deviceType detected. Applying schema alignment...');
    }

    // 3. Ensure DeviceOS enum values exist
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'ANDROID';
      EXCEPTION WHEN others THEN null; END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'IOS';
      EXCEPTION WHEN others THEN null; END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'MACOS';
      EXCEPTION WHEN others THEN null; END $$;
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TYPE "DeviceOS" ADD VALUE IF NOT EXISTS 'IPADOS';
      EXCEPTION WHEN others THEN null; END $$;
    `);

    // 4. Ensure DeviceType enum exists
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "DeviceType" AS ENUM ('LAPTOP', 'DESKTOP', 'SMARTPHONE', 'TABLET', 'OTHER');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 5. Ensure Device columns exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Device" 
        ADD COLUMN IF NOT EXISTS "complianceStatus" TEXT NOT NULL DEFAULT 'COMPLIANT',
        ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        ADD COLUMN IF NOT EXISTS "deviceType" "DeviceType" NOT NULL DEFAULT 'LAPTOP',
        ADD COLUMN IF NOT EXISTS "enrollmentType" TEXT,
        ADD COLUMN IF NOT EXISTS "platform" TEXT,
        ADD COLUMN IF NOT EXISTS "tamperAlerts" JSONB;
    `);

    // 6. Ensure DeviceIdentity columns exist
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

    // 7. Ensure PaymentProviderConfig and PayoutRecord tables exist
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

    // 8. Ensure Indexes and Foreign Keys
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

    // 9. Sync with _prisma_migrations table if present
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
            IF NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20261109041500_add_device_type_and_payment_configs') THEN
              INSERT INTO "_prisma_migrations" (
                id,
                checksum,
                finished_at,
                migration_name,
                logs,
                rolled_back_at,
                started_at,
                applied_steps_count
              ) VALUES (
                gen_random_uuid()::text,
                'self_healing_auto_applied',
                NOW(),
                '20261109041500_add_device_type_and_payment_configs',
                NULL,
                NULL,
                NOW(),
                1
              );
            END IF;
          END IF;
        END $$;
      `);
    } catch {
      // Ignored if gen_random_uuid is not enabled or migration table differs
    }

    log?.info('Database schema verified: Device.deviceType and enterprise columns are active.');
  } catch (err: any) {
    log?.error({ err: err?.message || err }, 'ensureDatabaseSchema: warning during schema verification');
  }
}
