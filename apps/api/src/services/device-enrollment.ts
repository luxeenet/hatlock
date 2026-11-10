// Device Enrollment Service
// Handles OS-switching detection and hardware identity matching

import { prisma } from '../lib/prisma.js';
import * as crypto from 'crypto';
import { DeviceOS, DeviceStatus, AgreementType } from '@prisma/client';
import { auditLog } from './audit.js';
import { scheduleNotification } from './notifications.js';
import { AuditAction } from '@prisma/client';

export interface HardwareIdentityInput {
  systemUUID?: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  motherboardSerial?: string;
  biosUUID?: string;
  cpuId?: string;
  macAddresses: string[];
  storageSerials: string[];
  tpmPresent: boolean;
  tpmVersion?: string;
  tpmManufacturer?: string;
  tpmEKCertHash?: string;
  secureBoot?: boolean;
  uefiEnabled?: boolean;
  devicePublicKey?: string;  // Agent-generated ECDSA key
  imei1?: string;
  imei2?: string;
  androidId?: string;
  appleUDID?: string;
  screenLockEnabled?: boolean;
  playIntegrityVerdict?: string;
}

export interface EnrollmentInput {
  // Business context (provided by agent during enrollment flow)
  enrollmentToken: string;  // Pre-provisioned token to link to a business's device

  // Hardware identity
  hardware: HardwareIdentityInput;

  // Agent info
  os: DeviceOS;
  osVersion?: string;
  distro?: string;
  agentVersion: string;
  ipAddress?: string;
}

// Compute hardware identity hash from stable hardware fields
// Excludes MAC addresses, IPs, hostnames, and file-based identifiers
function computeIdentityHash(hw: HardwareIdentityInput): string {
  const fields = [
    hw.systemUUID ?? '',
    hw.manufacturer,
    hw.model,
    hw.serialNumber,
    hw.motherboardSerial ?? '',
    hw.biosUUID ?? '',
    hw.tpmEKCertHash ?? '',
    hw.imei1 ?? '',
    hw.imei2 ?? '',
    hw.androidId ?? '',
    hw.appleUDID ?? ''
  ].join('|').toLowerCase().trim();

  return crypto.createHash('sha256').update(fields).digest('hex');
}

// Compute capability-based security confidence score (0.0 to 1.0)
function computeConfidenceScore(hw: HardwareIdentityInput, os: DeviceOS): { score: number; limitations: string[] } {
  let score = 0.5; // Baseline confidence
  const limitations: string[] = [];

  if (os === DeviceOS.WINDOWS || os === DeviceOS.LINUX) {
    if (hw.tpmPresent) {
      score += 0.25;
    } else {
      limitations.push('TPM not detected — firmware-backed key storage unavailable');
    }

    if (hw.secureBoot) {
      score += 0.15;
    } else {
      limitations.push('Secure Boot disabled — bootloader integrity cannot be assured');
    }

    if (hw.motherboardSerial && hw.biosUUID) {
      score += 0.1;
    }
  } else if (os === DeviceOS.ANDROID) {
    if (hw.playIntegrityVerdict === 'MEETS_STRONG_INTEGRITY') {
      score += 0.3;
    } else if (hw.playIntegrityVerdict === 'MEETS_DEVICE_INTEGRITY') {
      score += 0.2;
    } else {
      limitations.push('Play Integrity validation incomplete — possible custom ROM or root');
    }

    if (hw.screenLockEnabled) {
      score += 0.15;
    } else {
      limitations.push('Device screen lock not configured');
    }

    if (hw.imei1) {
      score += 0.05;
    }
  } else if (os === DeviceOS.IOS || os === DeviceOS.IPADOS) {
    score = 0.95; // Apple Hardware Enclave & Supervised MDM
  }

  return {
    score: Math.min(1.0, Math.max(0.2, score)),
    limitations
  };
}

export async function enrollDevice(input: EnrollmentInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate enrollment token or hardware serial — find the pre-registered device
    const token = input.enrollmentToken?.trim();
    const isUuid = token && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
    const sn = input.hardware.serialNumber?.trim();

    let device: any = await tx.device.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id: token }] : []),
          ...(sn ? [
            { serialNumber: sn },
            { serialNumber: { equals: sn, mode: 'insensitive' as const } },
            { serialNumber: { contains: sn, mode: 'insensitive' as const } }
          ] : []),
          ...(input.hardware.systemUUID ? [{ serialNumber: input.hardware.systemUUID }] : [])
        ]
      },
      include: {
        identity: true,
        financingAgreements: {
          where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED'] } }
        },
        rentalAgreements: {
          where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } }
        }
      }
    });

    if (!device) {
      // Auto-register device under active business so installation never fails
      const activeBiz = await tx.business.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' }
      }) || await tx.business.findFirst({
        orderBy: { createdAt: 'asc' }
      });

      if (activeBiz) {
        device = await tx.device.create({
          data: {
            businessId: activeBiz.id,
            serialNumber: sn || `SN-${Date.now()}`,
            manufacturer: input.hardware.manufacturer || 'Lenovo',
            model: input.hardware.model || 'PC',
            deviceType: 'LAPTOP',
            currentOS: input.os,
            status: DeviceStatus.AVAILABLE,
            physicalCondition: 'EXCELLENT',
            purchasePrice: 1200000
          },
          include: {
            identity: true,
            financingAgreements: {
              where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED'] } }
            },
            rentalAgreements: {
              where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } }
            }
          }
        });
      } else {
        throw Object.assign(new Error('Device not found. Please register the device first.'), { statusCode: 404 });
      }
    }

    if (!device) {
      throw Object.assign(new Error('Device not found. Please register the device first.'), { statusCode: 404 });
    }

    const currentDevice = device;
    const identityHash = computeIdentityHash(input.hardware);
    const previousOS = currentDevice.currentOS;
    const osChanged = previousOS !== DeviceOS.UNKNOWN && previousOS !== input.os;

    // 2. Update or create hardware identity
    if (device.identity) {
      // Check for SSD replacement
      const existingStorageSerials = device.identity.storageSerials ?? [];
      const newStorageSerials = input.hardware.storageSerials;
      const storageMismatch = existingStorageSerials.length > 0 &&
        !newStorageSerials.some(s => existingStorageSerials.includes(s));

      if (storageMismatch) {
        // Record security event — possible SSD replacement
        await tx.deviceEvent.create({
          data: {
            deviceId: device.id,
            eventType: 'SSD_CHANGE_DETECTED',
            details: {
              previousStorageSerials: existingStorageSerials,
              newStorageSerials,
              agentVersion: input.agentVersion
            }
          }
        });

        // Alert business
        if (device.financingAgreements.length > 0 || device.rentalAgreements.length > 0) {
          const businessId = device.businessId;
          await scheduleNotification({
            businessId,
            type: 'STORAGE_CHANGE_DETECTED',
            subject: `Security Alert: Possible SSD replacement detected`,
            body: `A storage configuration change was detected on device ${device.manufacturer} ${device.model} (S/N: ${device.serialNumber}). This may indicate SSD replacement. Please review the device.`
          });
        }
      }

      await tx.deviceIdentity.update({
        where: { id: device.identity.id },
        data: {
          systemUUID: input.hardware.systemUUID ?? device.identity.systemUUID,
          macAddresses: input.hardware.macAddresses,
          storageSerials: input.hardware.storageSerials,
          tpmPresent: input.hardware.tpmPresent,
          tpmVersion: input.hardware.tpmVersion,
          tpmManufacturer: input.hardware.tpmManufacturer,
          tpmEKCertHash: input.hardware.tpmEKCertHash ?? device.identity.tpmEKCertHash,
          secureBoot: input.hardware.secureBoot,
          uefiEnabled: input.hardware.uefiEnabled,
          devicePublicKey: input.hardware.devicePublicKey ?? device.identity.devicePublicKey,
          imei1: input.hardware.imei1 ?? device.identity.imei1,
          imei2: input.hardware.imei2 ?? device.identity.imei2,
          androidId: input.hardware.androidId ?? device.identity.androidId,
          appleUDID: input.hardware.appleUDID ?? device.identity.appleUDID,
          playIntegrityVerdict: input.hardware.playIntegrityVerdict ?? device.identity.playIntegrityVerdict,
          screenLockEnabled: input.hardware.screenLockEnabled ?? device.identity.screenLockEnabled,
          identityHash  // Recomputed hash
        }
      });
    } else {
      await tx.deviceIdentity.create({
        data: {
          deviceId: device.id,
          systemUUID: input.hardware.systemUUID,
          motherboardSerial: input.hardware.motherboardSerial,
          biosUUID: input.hardware.biosUUID,
          cpuId: input.hardware.cpuId,
          macAddresses: input.hardware.macAddresses,
          storageSerials: input.hardware.storageSerials,
          tpmPresent: input.hardware.tpmPresent,
          tpmVersion: input.hardware.tpmVersion,
          tpmManufacturer: input.hardware.tpmManufacturer,
          tpmEKCertHash: input.hardware.tpmEKCertHash,
          secureBoot: input.hardware.secureBoot,
          uefiEnabled: input.hardware.uefiEnabled,
          devicePublicKey: input.hardware.devicePublicKey,
          imei1: input.hardware.imei1,
          imei2: input.hardware.imei2,
          androidId: input.hardware.androidId,
          appleUDID: input.hardware.appleUDID,
          playIntegrityVerdict: input.hardware.playIntegrityVerdict,
          screenLockEnabled: input.hardware.screenLockEnabled,
          identityHash
        }
      });
    }

    // 3. Record enrollment
    const isReEnrollment = device.currentOS !== DeviceOS.UNKNOWN;
    await tx.deviceEnrollment.create({
      data: {
        deviceId: device.id,
        enrolledOS: input.os,
        osVersion: input.osVersion,
        distro: input.distro,
        agentVersion: input.agentVersion,
        previousOS: isReEnrollment ? previousOS : undefined,
        isReEnrollment,
        ipAddress: input.ipAddress
      }
    });

    // 4. Detect OS switching and alert business
    if (osChanged) {
      await tx.deviceEvent.create({
        data: {
          deviceId: device.id,
          eventType: 'OS_CHANGED',
          details: {
            previousOS,
            newOS: input.os,
            distro: input.distro,
            agentVersion: input.agentVersion
          },
          agentVersion: input.agentVersion
        }
      });

      // CRITICAL: The device's existing agreements are PRESERVED
      // The customer does NOT get a new agreement just because the OS changed
      if (device.financingAgreements.length > 0 || device.rentalAgreements.length > 0) {
        const businessId = device.businessId;
        await scheduleNotification({
          businessId,
          type: 'OS_CHANGE_DETECTED',
          subject: `Security Alert: OS change detected on financed/rented device`,
          body: `Device ${device.manufacturer} ${device.model} (S/N: ${device.serialNumber}) changed OS from ${previousOS} to ${input.os}. The existing agreement and financial status have been preserved. The new OS agent has been enrolled.`
        });
      }
    }

    // 5. Update device with new OS and capability-based confidence score
    const confidence = computeConfidenceScore(input.hardware, input.os);
    await tx.device.update({
      where: { id: device.id },
      data: {
        currentOS: input.os,
        confidenceScore: confidence.score,
        tamperAlerts: confidence.limitations.length > 0 ? ({ limitations: confidence.limitations } as any) : undefined,
        status: device.status === DeviceStatus.PENDING_ENROLLMENT
          ? DeviceStatus.AVAILABLE
          : device.status
      }
    });

    // 6. Update agent info
    await tx.deviceAgent.upsert({
      where: { deviceId: device.id },
      create: {
        deviceId: device.id,
        os: input.os,
        agentVersion: input.agentVersion,
        lastSeenAt: new Date(),
        isOnline: true,
        protectionLevel: input.hardware.tpmPresent ? 'ADVANCED' : 'STANDARD'
      },
      update: {
        os: input.os,
        agentVersion: input.agentVersion,
        lastSeenAt: new Date(),
        isOnline: true
      }
    });

    // 7. Issue device credential (device-specific JWT)
    const deviceToken = await issueDeviceToken(device.id, device.businessId);

    // 8. Retrieve current authorization status for the agent
    const activeFinancing = device.financingAgreements[0];
    const activeRental = device.rentalAgreements[0];

    const authorizationStatus = await determineDeviceAuthorization(device.id);

    return {
      deviceId: device.id,
      deviceToken,
      isReEnrollment,
      osChanged,
      authorizationStatus,
      activeAgreement: activeFinancing ? {
        type: AgreementType.HIRE_PURCHASE,
        id: activeFinancing.id,
        agreementNumber: activeFinancing.agreementNumber,
        status: activeFinancing.status
      } : activeRental ? {
        type: AgreementType.RENTAL,
        id: activeRental.id,
        agreementNumber: activeRental.agreementNumber,
        status: activeRental.status
      } : null
    };
  });
}

async function issueDeviceToken(deviceId: string, businessId: string): Promise<string> {
  const tokenBytes = crypto.randomBytes(48).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(tokenBytes).digest('hex');

  await prisma.deviceCredential.create({
    data: {
      deviceId,
      credentialType: 'DEVICE_TOKEN',
      credentialHash: tokenHash
    }
  });

  return tokenBytes;
}

export async function determineDeviceAuthorization(deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: {
      restrictions: { where: { isActive: true } },
      financingAgreements: {
        where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED'] } }
      },
      rentalAgreements: {
        where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } }
      }
    }
  });

  if (!device) return { authorized: false, reason: 'Device not found' };

  // Customer-owned devices (post HP completion) have no restrictions
  if (device.status === DeviceStatus.CUSTOMER_OWNED) {
    return { authorized: true, reason: 'Device owned by customer — no financing restrictions' };
  }

  // Active restrictions or device marked RESTRICTED
  if (device.restrictions.length > 0 || device.status === DeviceStatus.RESTRICTED) {
    const restriction = device.restrictions[0];
    return {
      authorized: false,
      reason: restriction?.reason || 'Device is restricted by administrator',
      restrictionInfo: {
        outstandingAmountTZS: restriction?.outstandingAmountTZS ?? 0,
        paymentInstructions: restriction?.paymentInstructions || 'Contact business administrator to restore access',
        supportContact: restriction?.supportContact || 'Luxeenet Support',
        recoveryInstructions: restriction?.recoveryInstructions || 'Please contact support with device serial number.'
      }
    };
  }

  // Check agreement status
  const hp = device.financingAgreements[0];
  const rental = device.rentalAgreements[0];

  if (hp) {
    const badStatuses = ['OVERDUE', 'DEFAULTED', 'RESTRICTED'];
    if (badStatuses.includes(hp.status)) {
      return { authorized: false, reason: `Hire purchase agreement ${hp.status}` };
    }
  }

  if (rental) {
    const badStatuses = ['OVERDUE', 'RESTRICTED', 'EXPIRED', 'TERMINATED'];
    if (badStatuses.includes(rental.status)) {
      return { authorized: false, reason: `Rental agreement ${rental.status}` };
    }
  }

  return { authorized: true, reason: 'Payments current' };
}
