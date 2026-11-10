// Device Command Service — Signed Commands with Replay Protection
// Commands are digitally signed, time-limited, idempotent, and bound to specific device+agreement

import { prisma } from '../lib/prisma.js';
import * as crypto from 'crypto';
import { addHours, addMinutes } from 'date-fns';
import { env } from '../lib/env.js';
import {
  CommandType,
  CommandStatus,
  AgreementType,
  DeviceStatus
} from '@prisma/client';
import { auditLog } from './audit.js';
import { AuditAction } from '@prisma/client';

// Command payload types
export interface RestrictionPayload {
  type: 'RESTRICT';
  restrictionType: 'OVERLAY_LOCK' | 'SOFT_LOCK';
  businessName: string;
  agreementNumber: string;
  agreementType: 'HIRE_PURCHASE' | 'RENTAL';
  deviceDetails: string;
  reason: string;
  outstandingAmountTZS: number;
  currency: string;
  paymentInstructions: string;
  supportContact: string;
  recoveryInstructions: string;
}

export interface UnrestrictionPayload {
  type: 'UNRESTRICT';
  reason: string;
  agreementNumber: string;
}

export interface UpdatePayload {
  type: 'UPDATE';
  version: string;
  downloadUrl: string;
  checksum: string;
}

type CommandPayload = RestrictionPayload | UnrestrictionPayload | UpdatePayload | Record<string, unknown>;

// Sign command payload with ECDSA P-256
function signCommand(deviceId: string, nonce: string, expiresAt: Date, payload: CommandPayload): string {
  const canonical = JSON.stringify({
    deviceId,
    nonce,
    expiresAt: expiresAt.toISOString(),
    payload
  });

  const sign = crypto.createSign('SHA256');
  sign.update(canonical);
  sign.end();

  return sign.sign(env.COMMAND_SIGNING_PRIVATE_KEY, 'base64');
}

// Verify command signature (used by agents)
export function verifyCommandSignature(
  deviceId: string,
  nonce: string,
  expiresAt: Date,
  payload: CommandPayload,
  signature: string
): boolean {
  const canonical = JSON.stringify({
    deviceId,
    nonce,
    expiresAt: expiresAt.toISOString(),
    payload
  });

  const verify = crypto.createVerify('SHA256');
  verify.update(canonical);
  verify.end();

  try {
    return verify.verify(env.COMMAND_SIGNING_PUBLIC_KEY, signature, 'base64');
  } catch {
    return false;
  }
}

// ─── Issue Restriction Command ────────────────────────────────────────────────

export async function issueRestrictionCommand(
  deviceId: string,
  businessId: string,
  agreementId: string,
  agreementType: AgreementType,
  payload: RestrictionPayload,
  issuedBy: string
) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.device.findFirst({ where: { id: deviceId, businessId } });
    if (!device) throw Object.assign(new Error('Device not found'), { statusCode: 404 });

    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = addHours(new Date(), 24);  // Commands expire in 24h

    const signature = signCommand(deviceId, nonce, expiresAt, payload);

    const command = await tx.deviceCommand.create({
      data: {
        deviceId,
        agreementId,
        agreementType,
        commandType: CommandType.RESTRICT,
        status: CommandStatus.PENDING,
        payload: payload as any,
        signature,
        nonce,
        issuedAt: new Date(),
        expiresAt,
        issuedBy
      }
    });

    // Update device status
    await tx.device.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.RESTRICTED }
    });

    // Create restriction record
    const restrictionData: any = {
      deviceId,
      businessId,
      agreementType,
      commandId: command.id,
      restrictionType: payload.restrictionType,
      reason: payload.reason,
      outstandingAmountTZS: payload.outstandingAmountTZS,
      paymentInstructions: payload.paymentInstructions,
      supportContact: payload.supportContact,
      recoveryInstructions: payload.recoveryInstructions
    };

    if (agreementId && agreementId !== 'MANUAL') {
      if (agreementType === AgreementType.HIRE_PURCHASE) {
        restrictionData.financingAgreementId = agreementId;
      } else {
        restrictionData.rentalAgreementId = agreementId;
      }
    }

    await tx.deviceRestriction.create({ data: restrictionData });

    await auditLog({
      actorId: issuedBy,
      businessId,
      action: AuditAction.RESTRICT,
      resource: 'Device',
      resourceId: deviceId,
      metadata: { commandId: command.id, agreementId, agreementType }
    });

    // Record device event
    await tx.deviceEvent.create({
      data: {
        deviceId,
        eventType: 'RESTRICTION_COMMAND_ISSUED',
        details: { commandId: command.id, reason: payload.reason, agreementNumber: payload.agreementNumber }
      }
    });

    return command;
  });
}

// ─── Issue Unrestriction Command ──────────────────────────────────────────────

export async function issueUnrestrictionCommand(
  deviceId: string,
  businessId: string,
  agreementId: string,
  agreementType: AgreementType,
  reason: string,
  agreementNumber: string,
  issuedBy: string,
  transactionId?: string
) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.device.findFirst({ where: { id: deviceId, businessId } });
    if (!device) throw Object.assign(new Error('Device not found'), { statusCode: 404 });

    const payload: UnrestrictionPayload = {
      type: 'UNRESTRICT',
      reason,
      agreementNumber
    };

    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = addHours(new Date(), 2);  // Shorter expiry for restoration

    const signature = signCommand(deviceId, nonce, expiresAt, payload);

    const command = await tx.deviceCommand.create({
      data: {
        deviceId,
        agreementId,
        agreementType,
        commandType: CommandType.UNRESTRICT,
        status: CommandStatus.PENDING,
        payload: payload as any,
        signature,
        nonce,
        expiresAt,
        issuedBy
      }
    });

    // Update device status
    await tx.device.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.UNLOCK_PENDING }
    });

    // Lift active restrictions
    await tx.deviceRestriction.updateMany({
      where: { deviceId, isActive: true },
      data: {
        isActive: false,
        liftedAt: new Date(),
        liftedByCommandId: command.id,
        liftedByTransactionId: transactionId
      }
    });

    await auditLog({
      actorId: issuedBy,
      businessId,
      action: AuditAction.UNRESTRICT,
      resource: 'Device',
      resourceId: deviceId,
      metadata: { commandId: command.id, agreementId, reason }
    });

    return command;
  });
}

// ─── Get Pending Commands for Device ─────────────────────────────────────────
// Called by agents on heartbeat — deliver pending commands

export async function getPendingCommands(deviceId: string) {
  const now = new Date();
  const commands = await prisma.deviceCommand.findMany({
    where: {
      deviceId,
      status: CommandStatus.PENDING,
      expiresAt: { gt: now }  // Only non-expired commands
    },
    orderBy: { issuedAt: 'asc' }
  });

  return commands.map(cmd => ({
    ...cmd,
    canonical: JSON.stringify({
      deviceId: cmd.deviceId,
      nonce: cmd.nonce,
      expiresAt: cmd.expiresAt.toISOString(),
      payload: cmd.payload
    })
  }));
}

// ─── Acknowledge Command Execution ────────────────────────────────────────────

export async function acknowledgeCommand(
  commandId: string,
  deviceId: string,
  success: boolean,
  failReason?: string
) {
  return prisma.$transaction(async (tx) => {
    const command = await tx.deviceCommand.findFirst({
      where: { id: commandId, deviceId }
    });
    if (!command) throw Object.assign(new Error('Command not found'), { statusCode: 404 });
    if (command.status === CommandStatus.EXECUTED) return command;  // Idempotent

    // Replay protection: once executed, cannot be re-executed
    if (command.status !== CommandStatus.PENDING && command.status !== CommandStatus.DELIVERED) {
      throw Object.assign(new Error('Command already processed'), { statusCode: 409 });
    }

    const now = new Date();

    const updated = await tx.deviceCommand.update({
      where: { id: commandId },
      data: {
        status: success ? CommandStatus.EXECUTED : CommandStatus.FAILED,
        executedAt: success ? now : null,
        failedAt: !success ? now : null,
        acknowledgedAt: now,
        failReason: failReason
      }
    });

    // Update device status based on command outcome
    if (success) {
      if (command.commandType === CommandType.RESTRICT) {
        await tx.device.update({ where: { id: deviceId }, data: { status: DeviceStatus.RESTRICTED } });
      } else if (command.commandType === CommandType.UNRESTRICT) {
        await tx.device.update({ where: { id: deviceId }, data: { status: DeviceStatus.ACTIVE } });
      }
    }

    // Record event
    await tx.deviceEvent.create({
      data: {
        deviceId,
        eventType: success ? 'COMMAND_EXECUTED' : 'COMMAND_FAILED',
        details: { commandId, commandType: command.commandType, failReason }
      }
    });

    return updated;
  });
}

// ─── Validate Command (used by agent before executing) ────────────────────────

export function validateCommandForAgent(command: {
  deviceId: string;
  nonce: string;
  expiresAt: Date;
  payload: CommandPayload;
  signature: string;
}) {
  // Check expiry
  if (new Date() > command.expiresAt) {
    return { valid: false, reason: 'Command expired' };
  }

  // Verify signature
  const signatureValid = verifyCommandSignature(
    command.deviceId,
    command.nonce,
    command.expiresAt,
    command.payload,
    command.signature
  );

  if (!signatureValid) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

export async function dispatchDeviceCommand(params: {
  deviceId: string;
  commandType: 'RESTRICT_DEVICE' | 'RESTORE_DEVICE';
  payload: any;
}) {
  const device = await prisma.device.findUnique({
    where: { id: params.deviceId },
    include: {
      financingAgreements: {
        where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED'] } }
      },
      rentalAgreements: {
        where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } }
      }
    }
  });

  if (!device) return null;

  const hp = device.financingAgreements[0];
  const rental = device.rentalAgreements[0];

  const agreementId = hp ? hp.id : rental ? rental.id : 'NO_AGREEMENT';
  const agreementType = hp ? AgreementType.HIRE_PURCHASE : AgreementType.RENTAL;

  if (params.commandType === 'RESTRICT_DEVICE') {
    return issueRestrictionCommand(
      device.id,
      device.businessId,
      agreementId,
      agreementType,
      {
        type: 'RESTRICT',
        restrictionType: 'OVERLAY_LOCK',
        businessName: params.payload.businessName || 'HatLock Financed Laptop',
        agreementNumber: params.payload.agreementNumber || 'AGR',
        agreementType: agreementType === AgreementType.HIRE_PURCHASE ? 'HIRE_PURCHASE' : 'RENTAL',
        deviceDetails: `${device.manufacturer} ${device.model}`,
        reason: params.payload.reason || 'Payment overdue',
        outstandingAmountTZS: params.payload.outstandingAmount || 0,
        currency: params.payload.currency || 'TZS',
        paymentInstructions: params.payload.lockScreenMessage || 'Please pay the outstanding balance via HatPesa',
        supportContact: params.payload.contactPhone || 'support@luxeenet.com',
        recoveryInstructions: 'Contact your financing administrator to restore device access.'
      },
      'SYSTEM_WATCHDOG'
    );
  } else {
    return issueUnrestrictionCommand(
      device.id,
      device.businessId,
      agreementId,
      agreementType,
      params.payload.reason || 'Restored by system',
      params.payload.agreementNumber || 'AGR',
      'SYSTEM_WATCHDOG'
    );
  }
}

