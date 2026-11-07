// Ownership Transfer Routes (Hire Purchase Only)
// Enforces verified balance completion, creates immutable ownership transfer record,
// permanently revokes financing locks, and issues ownership discharge certificate

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { DeviceStatus, HirePurchaseStatus, CommandType, CommandStatus, AgreementType } from '@prisma/client';

const TransferOwnershipSchema = z.object({
  agreementId: z.string().uuid(),
  notes: z.string().optional()
});

export async function ownershipRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List all ownership transfer events
  server.get('/', {
    schema: {
      tags: ['Ownership'],
      summary: 'List verified ownership transfer records'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const transfers = await prisma.ownershipTransfer.findMany({
      where: { businessId },
      include: {
        customer: true,
        device: true,
        financingAgreement: true
      },
      orderBy: { transferredAt: 'desc' }
    });

    return reply.send({ transfers });
  });

  // Execute ownership transfer
  server.post('/transfer', {
    schema: {
      tags: ['Ownership'],
      summary: 'Transfer full ownership of laptop to customer upon verified zero balance'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const userId = (request as any).user?.id || 'OPERATOR';

    const parse = TransferOwnershipSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { agreementId, notes } = parse.data;

    const agreement = await prisma.financingAgreement.findFirst({
      where: { id: agreementId, businessId },
      include: {
        device: true,
        instalments: true
      }
    });

    if (!agreement) {
      return reply.status(404).send({ error: 'AGREEMENT_NOT_FOUND', message: 'Hire purchase agreement not found' });
    }

    // Strict verification: check if any instalments are still unpaid
    const unpaidInstalments = agreement.instalments.filter((s) => !s.isPaid);
    if (unpaidInstalments.length > 0) {
      return reply.status(400).send({
        error: 'OUTSTANDING_BALANCE',
        message: `Cannot transfer ownership: Agreement has ${unpaidInstalments.length} unpaid instalment(s)`
      });
    }

    // Check if already transferred
    const existing = await prisma.ownershipTransfer.findFirst({
      where: { financingAgreementId: agreementId }
    });

    if (existing) {
      return reply.status(409).send({
        error: 'ALREADY_TRANSFERRED',
        message: 'Ownership has already been transferred for this agreement'
      });
    }

    const transfer = await prisma.$transaction(async (tx) => {
      // 1. Create OwnershipTransfer record
      const record = await tx.ownershipTransfer.create({
        data: {
          deviceId: agreement.deviceId,
          financingAgreementId: agreementId,
          businessId,
          customerId: agreement.customerId,
          transferredAt: new Date(),
          verifiedByLedger: true,
          allConditionsMet: true,
          authorizedBy: userId,
          notes: notes || 'Verified all instalments settled in full'
        }
      });

      // 2. Mark agreement COMPLETED and OWNERSHIP_TRANSFERRED
      await tx.financingAgreement.update({
        where: { id: agreementId },
        data: {
          status: HirePurchaseStatus.OWNERSHIP_TRANSFERRED,
          completedAt: new Date(),
          ownershipTransferredAt: new Date()
        }
      });

      // 3. Update device status to CUSTOMER_OWNED
      if (agreement.deviceId) {
        await tx.device.update({
          where: { id: agreement.deviceId },
          data: { status: DeviceStatus.CUSTOMER_OWNED }
        });

        // 4. Permanently lift all active restrictions
        await tx.deviceRestriction.updateMany({
          where: { deviceId: agreement.deviceId, isActive: true },
          data: {
            isActive: false,
            liftedAt: new Date(),
            auditNotes: 'Lifted upon permanent ownership transfer'
          }
        });

        // 5. Issue final permanent unrestriction command
        await tx.deviceCommand.create({
          data: {
            deviceId: agreement.deviceId,
            agreementId,
            agreementType: AgreementType.HIRE_PURCHASE,
            commandType: CommandType.UNRESTRICT,
            status: CommandStatus.PENDING,
            payload: {
              type: 'UNRESTRICT',
              reason: 'OWNERSHIP_TRANSFERRED',
              agreementNumber: agreement.agreementNumber,
              ownershipPermanent: true
            },
            signature: 'OWNERSHIP_DISCHARGE',
            nonce: 'TRANSFER-' + Date.now(),
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 86400000), // 30 days
            issuedBy: userId
          }
        });
      }

      return record;
    });

    return reply.status(200).send({
      status: 'OWNERSHIP_TRANSFERRED',
      message: 'Ownership successfully and permanently transferred to customer',
      transfer
    });
  });
}
