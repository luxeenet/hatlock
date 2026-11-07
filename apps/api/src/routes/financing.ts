// Hire Purchase / Financing Routes
// Handles contract creation, instalment schedules, approval workflow, and ownership transfer

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { PaymentFrequency, DeviceStatus, HirePurchaseStatus } from '@prisma/client';
import { calculateInstalmentDates, generateAgreementNumber } from '../services/financing.js';
import { generateOwnershipCertificate } from '../services/pdf.js';

const CreateFinancingSchema = z.object({
  customerId: z.string().uuid(),
  deviceId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  totalAmountTZS: z.number().positive(),
  downPaymentTZS: z.number().min(0).default(0),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  instalmentCount: z.number().int().positive(),
  startDate: z.string().datetime(),
  gracePeriodDays: z.number().int().min(0).default(3),
  financingChargeRate: z.number().min(0).default(0),
  lateFeeAmountTZS: z.number().min(0).default(0)
});

export async function financingRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List financing agreements
  server.get('/', {
    schema: {
      tags: ['Financing'],
      summary: 'List hire purchase financing agreements'
    }
  }, async (request: FastifyRequest<{ Querystring: { status?: string; customerId?: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { status, customerId } = request.query;

    const where: any = { businessId };
    if (status) where.status = status as HirePurchaseStatus;
    if (customerId) where.customerId = customerId;

    const agreements = await prisma.financingAgreement.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        device: { select: { id: true, serialNumber: true, manufacturer: true, model: true, status: true } },
        _count: { select: { instalments: true, transactions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ agreements });
  });

  // Create hire purchase agreement
  server.post('/', {
    schema: {
      tags: ['Financing'],
      summary: 'Create a new hire purchase agreement with payment schedules'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = CreateFinancingSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const data = parse.data;

    // Verify device is AVAILABLE
    const device = await prisma.device.findFirst({
      where: { id: data.deviceId, businessId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    if (device.status !== DeviceStatus.AVAILABLE && device.status !== DeviceStatus.PENDING_ENROLLMENT) {
      return reply.status(400).send({
        error: 'DEVICE_UNAVAILABLE',
        message: `Device is currently in status ${device.status} and cannot be assigned`
      });
    }

    const agreementNumber = await generateAgreementNumber(businessId, 'HP');
    const principalToFinance = data.totalAmountTZS - data.downPaymentTZS;
    const instalmentAmount = Math.round(principalToFinance / data.instalmentCount);
    const startDate = new Date(data.startDate);
    const instalmentDates = calculateInstalmentDates(startDate, data.paymentFrequency as PaymentFrequency, data.instalmentCount);

    const agreement = await prisma.$transaction(async (tx) => {
      // 1. Create schedule container
      const schedule = await tx.paymentSchedule.create({
        data: {}
      });

      // 2. Create agreement
      const created = await tx.financingAgreement.create({
        data: {
          agreementNumber,
          businessId,
          customerId: data.customerId,
          deviceId: data.deviceId,
          branchId: data.branchId || device.branchId,
          purchasePriceTZS: data.totalAmountTZS,
          depositAmountTZS: data.downPaymentTZS,
          financedBalanceTZS: principalToFinance,
          financingChargesTZS: 0,
          totalContractualTZS: data.totalAmountTZS,
          instalmentAmountTZS: instalmentAmount,
          paymentFrequency: data.paymentFrequency as PaymentFrequency,
          startDate,
          expectedCompletionDate: instalmentDates[instalmentDates.length - 1],
          gracePeriodDays: data.gracePeriodDays,
          lateFeeAmountTZS: data.lateFeeAmountTZS,
          ownershipTransferConditions: { allInstalmentsRequired: true, noOutstandingCharges: true },
          status: 'ACTIVE',
          paymentSchedule: {
            connect: { id: schedule.id }
          }
        }
      });

      // 3. Generate instalment schedules
      for (let idx = 0; idx < instalmentDates.length; idx++) {
        await tx.instalment.create({
          data: {
            scheduleId: schedule.id,
            financingAgreementId: created.id,
            instalmentNumber: idx + 1,
            dueDate: instalmentDates[idx],
            principalAmountTZS: instalmentAmount,
            chargesAmountTZS: 0,
            totalAmountTZS: instalmentAmount,
            paidAmountTZS: 0
          }
        });
      }

      // 4. Update device status to ACTIVE
      await tx.device.update({
        where: { id: device.id },
        data: {
          status: DeviceStatus.ACTIVE,
          currentCustomerId: data.customerId,
          currentAgreementId: created.id,
          currentAgreementType: 'HIRE_PURCHASE'
        }
      });

      return created;
    });

    return reply.status(201).send({ agreement });
  });

  // Get agreement details + schedules
  server.get('/:agreementId', {
    schema: {
      tags: ['Financing'],
      summary: 'Get hire purchase agreement by ID'
    }
  }, async (request: FastifyRequest<{ Params: { agreementId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { agreementId } = request.params;

    const agreement = await prisma.financingAgreement.findFirst({
      where: { id: agreementId, businessId },
      include: {
        customer: true,
        device: { include: { agentInfo: true, identity: true } },
        instalments: { orderBy: { instalmentNumber: 'asc' } },
        transactions: { orderBy: { createdAt: 'desc' } },
        ownershipTransfer: true
      }
    });

    if (!agreement) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Agreement not found' });
    }

    return reply.send({ agreement });
  });

  // Download Ownership Certificate PDF
  server.get('/:agreementId/certificate', {
    schema: {
      tags: ['Financing'],
      summary: 'Download Official Certificate of Ownership Transfer'
    }
  }, async (request: FastifyRequest<{ Params: { agreementId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { agreementId } = request.params;

    const agreement = await prisma.financingAgreement.findFirst({
      where: { id: agreementId, businessId }
    });

    if (!agreement) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Agreement not found' });
    }

    try {
      const pdfBuffer = await generateOwnershipCertificate(agreementId);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="Certificate-${agreement.agreementNumber}.pdf"`);
      return reply.send(pdfBuffer);
    } catch (err: any) {
      return reply.status(500).send({ error: 'PDF_FAILED', message: err.message });
    }
  });
}
