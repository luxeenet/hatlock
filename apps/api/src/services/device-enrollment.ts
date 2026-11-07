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
    hw.tpmEKCertHash ?? ''
  ].join('|').toLowerCase().trim();

  return crypto.createHash('sha256').update(fields).digest('hex');
}

export async function enrollDevice(input: EnrollmentInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate enrollment token — find the pre-registered device
    const device = await tx.device.findFirst({
      where: {
        // The enrollment token is stored as a tag or looked up differently
        // For now: match by serial number + business context passed in token
        serialNumber: input.hardware.serialNumber
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
      // New enrollment — device not yet in the system
      throw Object.assign(new Error('Device not found. Please register the device first.'), { statusCode: 404 });
    }

    const identityHash = computeIdentityHash(input.hardware);
    const previousOS = device.currentOS;
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

    // 5. Update device with new OS
    await tx.device.update({
      where: { id: device.id },
      data: {
        currentOS: input.os,
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

  // Active restrictions
  if (device.restrictions.length > 0) {
    const restriction = device.restrictions[0];
    return {
      authorized: false,
      reason: restriction.reason,
      restrictionInfo: {
        outstandingAmountTZS: restriction.outstandingAmountTZS,
        paymentInstructions: restriction.paymentInstructions,
        supportContact: restriction.supportContact,
        recoveryInstructions: restriction.recoveryInstructions
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
