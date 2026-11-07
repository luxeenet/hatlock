// Device Returns & Physical Condition Inspection Routes
// Handles rental return workflows, condition assessments, and security deposit reconciliations

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { DeviceStatus, ReturnStatus, InspectionResult, AgreementType, RentalStatus } from '@prisma/client';

const InitiateReturnSchema = z.object({
  agreementId: z.string().uuid(),
  deviceId: z.string().uuid(),
  reason: z.string().default('END_OF_LEASE'),
  conditionNotes: z.string().optional()
});

const CompleteInspectionSchema = z.object({
  result: z.enum(['PASS', 'PASS_WITH_MINOR_DAMAGE', 'FAIL_SIGNIFICANT_DAMAGE', 'FAIL_MISSING_ACCESSORIES', 'FAIL_LOST']).default('PASS'),
  conditionRating: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).default('GOOD'),
  damageNotes: z.string().optional(),
  repairCostEstimateTZS: z.number().default(0),
  refundSecurityDepositTZS: z.number().default(0)
});

export async function returnRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List all return requests
  server.get('/', {
    schema: {
      tags: ['Returns'],
      summary: 'List device return and inspection workflows'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const returns = await prisma.deviceReturn.findMany({
      where: { businessId },
      include: {
        device: true,
        customer: true,
        rentalAgreement: true,
        inspection: true
      },
      orderBy: { requestedAt: 'desc' }
    });

    return reply.send({ returns });
  });

  // Initiate Return
  server.post('/', {
    schema: {
      tags: ['Returns'],
      summary: 'Initiate a device return request'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = InitiateReturnSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { agreementId, deviceId, reason, conditionNotes } = parse.data;

    const rental = await prisma.rentalAgreement.findFirst({
      where: { id: agreementId, businessId }
    });

    if (!rental) {
      return reply.status(404).send({ error: 'RENTAL_NOT_FOUND' });
    }

    const returnRecord = await prisma.$transaction(async (tx) => {
      const ret = await tx.deviceReturn.create({
        data: {
          businessId,
          rentalAgreementId: agreementId,
          agreementType: AgreementType.RENTAL,
          deviceId,
          customerId: rental.customerId,
          status: ReturnStatus.REQUESTED,
          notes: conditionNotes || reason
        }
      });

      await tx.device.update({
        where: { id: deviceId },
        data: { status: DeviceStatus.RETURN_PENDING }
      });

      return ret;
    });

    return reply.status(201).send({ return: returnRecord });
  });

  // Complete Inspection
  server.post('/:returnId/inspect', {
    schema: {
      tags: ['Returns'],
      summary: 'Record condition inspection and complete device return'
    }
  }, async (request: FastifyRequest<{ Params: { returnId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { returnId } = request.params;

    const parse = CompleteInspectionSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const returnRecord = await prisma.deviceReturn.findFirst({
      where: { id: returnId, businessId }
    });

    if (!returnRecord) {
      return reply.status(404).send({ error: 'RETURN_NOT_FOUND' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Create inspection record
      await tx.deviceInspection.create({
        data: {
          deviceReturnId: returnId,
          deviceId: returnRecord.deviceId,
          result: parse.data.result as InspectionResult,
          conditionRating: parse.data.conditionRating,
          damageDescription: parse.data.damageNotes,
          estimatedRepairCostTZS: parse.data.repairCostEstimateTZS
        }
      });

      // 2. Update return status
      const ret = await tx.deviceReturn.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.COMPLETED
        }
      });

      // 3. Laptop returns to AVAILABLE inventory
      await tx.device.update({
        where: { id: returnRecord.deviceId },
        data: {
          status: DeviceStatus.AVAILABLE,
          currentAgreementId: null,
          currentAgreementType: null,
          currentCustomerId: null
        }
      });

      // 4. Mark rental completed if linked
      if (returnRecord.rentalAgreementId) {
        await tx.rentalAgreement.update({
          where: { id: returnRecord.rentalAgreementId },
          data: { status: RentalStatus.COMPLETED }
        });
      }

      return ret;
    });

    return reply.send({ return: updated, message: 'Inspection completed, laptop returned to available inventory.' });
  });
}
