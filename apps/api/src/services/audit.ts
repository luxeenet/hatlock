// Audit log service — creates immutable audit entries
import { prisma } from '../lib/prisma.js';
import { AuditAction, UserRole } from '@prisma/client';

interface AuditLogParams {
  actorId?: string;
  actorRole?: UserRole;
  businessId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  financingAgreementId?: string;
  rentalAgreementId?: string;
  changes?: { before?: unknown; after?: unknown };
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        businessId: params.businessId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        financingAgreementId: params.financingAgreementId,
        rentalAgreementId: params.rentalAgreementId,
        changes: params.changes ? JSON.parse(JSON.stringify(params.changes)) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined
      }
    });
  } catch (err) {
    // Audit logging must never crash the main request
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}
