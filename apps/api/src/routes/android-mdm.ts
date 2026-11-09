// Android Enterprise Management & Device Owner Provisioning Route
// HatLock by Luxeenet — Official Android Enterprise Capabilities

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { DeviceOS, DeviceStatus, CommandType, CommandStatus } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { auditLog } from '../services/audit.js';
import { AuditAction } from '@prisma/client';
import QRCode from 'qrcode';

const AndroidEnrollSchema = z.object({
  deviceId: z.string().uuid(),
  serialNumber: z.string().min(1),
  imei1: z.string().optional(),
  imei2: z.string().optional(),
  androidId: z.string().optional(),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  osVersion: z.string().default('14.0'),
  agentVersion: z.string().default('1.0.0'),
  hardwareKeystoreSupported: z.boolean().default(true),
  devicePublicKey: z.string().optional(),
  screenLockActive: z.boolean().default(false),
  playIntegrityVerdict: z.string().optional() // MEETS_STRONG_INTEGRITY, MEETS_DEVICE_INTEGRITY
});

const AndroidHeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  batteryLevel: z.number().min(0).max(100).optional(),
  storageAvailableBytes: z.number().optional(),
  screenLockEnabled: z.boolean().default(true),
  tamperDetected: z.boolean().default(false),
  tamperReason: z.string().optional(),
  isRestricted: z.boolean().optional()
});

export async function androidMdmRoutes(server: FastifyInstance) {
  // --------------------------------------------------------------------------
  // 1. Android Device Owner Provisioning Payload (QR Code Configuration)
  // --------------------------------------------------------------------------
  server.get('/provisioning-profile/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Generate Android Device Owner QR code provisioning profile'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        business: { select: { id: true, name: true, phone: true } },
        financingAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true, financedBalanceTZS: true }
        },
        rentalAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    const agreementNumber =
      device.financingAgreements[0]?.agreementNumber ||
      device.rentalAgreements[0]?.agreementNumber ||
      'HATLOCK-FINANCED';

    // Standard Android Enterprise Device Owner Provisioning Bundle
    const provisioningPayload = {
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': 'com.luxeenet.hatlock.mdm/.HatLockDeviceAdminReceiver',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': `${env.API_BASE_URL}/downloads/android/HatLockEnterpriseAgent.apk`,
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': '4b4923e1074a3f87a8b3834927b2b005e839e94bc1721b0632a4bf74b01140ec',
      'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
      'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
      'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
        apiUrl: env.API_BASE_URL,
        deviceId: device.id,
        businessId: device.businessId,
        businessName: device.business?.name || 'HatLock Financed Device',
        businessContact: device.business?.phone || '+255700000000',
        agreementNumber,
        enforceFactoryResetProtection: true,
        enforceKioskRestrictionsOnLock: true,
        heartbeatIntervalSeconds: 300
      }
    };

    // Generate base64 Data URL for QR Code
    const qrString = JSON.stringify(provisioningPayload);
    const qrDataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    return reply.send({
      deviceId: device.id,
      format: 'ANDROID_ENTERPRISE_QR',
      qrJson: provisioningPayload,
      qrDataUrl,
      qrImageUrl: `/api/v1/mdm/android/provisioning-qr/${device.id}`
    });
  });

  // Direct PNG stream of Android Enterprise QR Code for image tags & downloads
  server.get('/provisioning-qr/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Direct PNG stream of Android Enterprise QR Code'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        business: { select: { id: true, name: true, phone: true } },
        financingAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        },
        rentalAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    const agreementNumber =
      device.financingAgreements[0]?.agreementNumber ||
      device.rentalAgreements[0]?.agreementNumber ||
      'HATLOCK-FINANCED';

    const provisioningPayload = {
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': 'com.luxeenet.hatlock.mdm/.HatLockDeviceAdminReceiver',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': `${env.API_BASE_URL}/downloads/android/HatLockEnterpriseAgent.apk`,
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': '4b4923e1074a3f87a8b3834927b2b005e839e94bc1721b0632a4bf74b01140ec',
      'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
      'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
      'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
        apiUrl: env.API_BASE_URL,
        deviceId: device.id,
        businessId: device.businessId,
        businessName: device.business?.name || 'HatLock Financed Device',
        businessContact: device.business?.phone || '+255700000000',
        agreementNumber,
        enforceFactoryResetProtection: true,
        enforceKioskRestrictionsOnLock: true,
        heartbeatIntervalSeconds: 300
      }
    };

    const buffer = await QRCode.toBuffer(JSON.stringify(provisioningPayload), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(buffer);
  });

  // --------------------------------------------------------------------------
  // 2. Android Device Owner Enrollment
  // --------------------------------------------------------------------------
  server.post('/enroll', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Enroll an Android smartphone with Device Owner capabilities'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = AndroidEnrollSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const data = parse.data;

    const device = await prisma.device.findUnique({
      where: { id: data.deviceId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND', message: 'Register device in system before enrolling' });
    }

    // Evaluate hardware confidence score
    let confidenceScore = 0.8;
    if (data.hardwareKeystoreSupported) confidenceScore += 0.1;
    if (data.playIntegrityVerdict === 'MEETS_STRONG_INTEGRITY') confidenceScore += 0.1;

    // Update Device Model with Android OS & platform details
    await prisma.device.update({
      where: { id: device.id },
      data: {
        currentOS: DeviceOS.ANDROID,
        platform: 'Android Enterprise (Device Owner)',
        enrollmentType: 'ANDROID_DEVICE_OWNER',
        confidenceScore: Math.min(1.0, confidenceScore),
        complianceStatus: 'COMPLIANT',
        status: device.status === DeviceStatus.PENDING_ENROLLMENT ? DeviceStatus.ACTIVE : device.status
      }
    });

    // Upsert Device Identity
    await prisma.deviceIdentity.upsert({
      where: { deviceId: device.id },
      create: {
        deviceId: device.id,
        imei1: data.imei1,
        imei2: data.imei2,
        androidId: data.androidId,
        devicePublicKey: data.devicePublicKey,
        playIntegrityVerdict: data.playIntegrityVerdict,
        screenLockEnabled: data.screenLockActive,
        encryptionStatus: 'FILE_ENCRYPTED_HARDWARE',
        systemUUID: data.androidId || data.serialNumber
      },
      update: {
        imei1: data.imei1,
        imei2: data.imei2,
        androidId: data.androidId,
        devicePublicKey: data.devicePublicKey,
        playIntegrityVerdict: data.playIntegrityVerdict,
        screenLockEnabled: data.screenLockActive,
        encryptionStatus: 'FILE_ENCRYPTED_HARDWARE'
      }
    });

    // Record enrollment history
    await prisma.deviceEnrollment.create({
      data: {
        deviceId: device.id,
        enrolledOS: DeviceOS.ANDROID,
        osVersion: data.osVersion,
        agentVersion: data.agentVersion,
        ipAddress: request.ip,
        notes: `Android Enterprise enrollment. Keystore backed: ${data.hardwareKeystoreSupported}`
      }
    });

    await auditLog({
      businessId: device.businessId,
      actorId: 'SYSTEM',
      action: AuditAction.CREATE,
      resource: 'Device',
      resourceId: device.id,
      metadata: { platform: 'ANDROID_ENTERPRISE', imei1: data.imei1, integrity: data.playIntegrityVerdict }
    });

    return reply.send({
      status: 'ENROLLED',
      deviceId: device.id,
      protectionLevel: 'ANDROID_DEVICE_OWNER',
      policySyncUrl: `/api/v1/mdm/android/policy/${device.id}`
    });
  });

  // --------------------------------------------------------------------------
  // 3. Android Enterprise Policy Synchronization
  // --------------------------------------------------------------------------
  server.get('/policy/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Get active Android Enterprise management policy'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        business: { select: { name: true, phone: true } },
        restrictions: { where: { isActive: true } },
        financingAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } }
        },
        rentalAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    const isRestricted = device.status === DeviceStatus.RESTRICTED || device.restrictions.length > 0;
    const businessPhone = device.business?.phone || '+255 700 000 000';

    return reply.send({
      deviceId: device.id,
      version: Date.now(),
      isRestricted,
      policies: {
        // Core Anti-Tamper & Security Rules
        disallowFactoryReset: true,
        disallowSafeBoot: true,
        disallowUsbFileTransfer: isRestricted,
        disallowCamera: isRestricted,
        disallowInstallUnknownSources: true,
        keyguardDisabledFeatures: isRestricted ? ['DISABLE_FINGERPRINT', 'DISABLE_FACE', 'DISABLE_UNREDACTED_NOTIFICATIONS'] : [],
        // Lock screen and Payment Information
        lockScreenInfo: isRestricted
          ? `DEVICE LOCKED FOR PAYMENT. Contact ${device.business?.name} at ${businessPhone} to unlock.`
          : `Managed device: ${device.business?.name}`,
        // Kiosk mode enforcement when restricted
        kioskModeEnabled: isRestricted,
        kioskPackage: isRestricted ? 'com.luxeenet.hatlock.mdm.lockscreen' : null
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. Android Enterprise Heartbeat & Status Report
  // --------------------------------------------------------------------------
  server.post('/heartbeat', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Report Android device health, telemetry and tamper events'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = AndroidHeartbeatSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const data = parse.data;

    // Check device
    const device = await prisma.device.findUnique({
      where: { id: data.deviceId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    // Record heartbeat
    await prisma.deviceHeartbeat.create({
      data: {
        deviceId: device.id,
        agentVersion: '1.0.0',
        os: DeviceOS.ANDROID,
        batteryPercent: data.batteryLevel,
        ipAddress: request.ip,
        isRestricted: data.isRestricted ?? false
      }
    });

    // Check for tamper event
    if (data.tamperDetected) {
      logger.warn({ deviceId: device.id, reason: data.tamperReason }, 'Android tamper event detected');
      await prisma.deviceEvent.create({
        data: {
          deviceId: device.id,
          eventType: 'ANDROID_TAMPER_DETECTED',
          details: { reason: data.tamperReason, timestamp: new Date() }
        }
      });
      await prisma.device.update({
        where: { id: device.id },
        data: { complianceStatus: 'TAMPER_SUSPECTED' }
      });
    }

    // Check for pending commands
    const pendingCommands = await prisma.deviceCommand.findMany({
      where: {
        deviceId: device.id,
        status: CommandStatus.PENDING
      },
      orderBy: { issuedAt: 'asc' }
    });

    return reply.send({
      status: 'ACKNOWLEDGED',
      deviceId: device.id,
      deviceStatus: device.status,
      pendingCommands: pendingCommands.map(c => ({
        id: c.id,
        type: c.commandType,
        payload: c.payload,
        signature: c.signature
      }))
    });
  });
}
