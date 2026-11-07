// Laptop Rental Agreement Routes
// Handles fixed-term/renewable leasing, security deposits, and return workflows
// CRITICAL: Ownership NEVER transfers upon payment completion

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { PaymentFrequency, DeviceStatus, RentalStatus } from '@prisma/client';
import { calculateInstalmentDates, generateAgreementNumber } from '../services/financing.js';
import { generateRentalContractPdf } from '../services/pdf.js';

const CreateRentalSchema = z.object({
  customerId: z.string().uuid(),
  deviceId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  rentalRatePerPeriodTZS: z.number().positive(),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
  durationPeriods: z.number().int().positive(),
  startDate: z.string().datetime(),
  securityDepositTZS: z.number().min(0).default(0),
  gracePeriodDays: z.number().int().min(0).default(2),
  notes: z.string().optional()
});

export async function rentalRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List rental agreements
  server.get('/', {
    schema: {
      tags: ['Rentals'],
      summary: 'List equipment rental agreements'
    }
  }, async (request: FastifyRequest<{ Querystring: { status?: string; customerId?: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { status, customerId } = request.query;

    const where: any = { businessId };
    if (status) where.status = status as RentalStatus;
    if (customerId) where.customerId = customerId;

    const rentals = await prisma.rentalAgreement.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        device: { select: { id: true, serialNumber: true, manufacturer: true, model: true, status: true } },
        _count: { select: { rentalCharges: true, transactions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ rentals });
  });

  // Create rental agreement
  server.post('/', {
    schema: {
      tags: ['Rentals'],
      summary: 'Create a new rental agreement'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = CreateRentalSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const data = parse.data;

    // Verify device availability
    const device = await prisma.device.findFirst({
      where: { id: data.deviceId, businessId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    if (device.status !== DeviceStatus.AVAILABLE && device.status !== DeviceStatus.PENDING_ENROLLMENT) {
      return reply.status(400).send({
        error: 'DEVICE_UNAVAILABLE',
        message: `Device is in status ${device.status} and cannot be rented`
      });
    }

    const agreementNumber = await generateAgreementNumber(businessId, 'RT');
    const startDate = new Date(data.startDate);
    const instalmentDates = calculateInstalmentDates(startDate, data.paymentFrequency as PaymentFrequency, data.durationPeriods);
    const endDate = instalmentDates[instalmentDates.length - 1];
    const totalRentalAmount = data.rentalRatePerPeriodTZS * data.durationPeriods;

    const agreement = await prisma.$transaction(async (tx) => {
      const created = await tx.rentalAgreement.create({
        data: {
          agreementNumber,
          businessId,
          customerId: data.customerId,
          deviceId: data.deviceId,
          branchId: data.branchId || device.branchId,
          rentalPriceTZS: data.rentalRatePerPeriodTZS,
          totalExpectedTZS: totalRentalAmount,
          nextPaymentDate: instalmentDates[0] || startDate,
          securityDepositTZS: data.securityDepositTZS,
          paymentFrequency: data.paymentFrequency as PaymentFrequency,
          startDate,
          endDate,
          gracePeriodDays: data.gracePeriodDays,
          status: 'ACTIVE'
        }
      });

      // Create payment schedule and rental charges
      const schedule = await tx.paymentSchedule.create({
        data: {
          rentalAgreementId: created.id
        }
      });

      const charges = instalmentDates.map((dueDate, idx) => ({
        scheduleId: schedule.id,
        rentalAgreementId: created.id,
        chargeNumber: idx + 1,
        periodStart: idx === 0 ? startDate : instalmentDates[idx - 1],
        periodEnd: dueDate,
        dueDate,
        amountTZS: data.rentalRatePerPeriodTZS,
        paidAmountTZS: 0,
        isPaid: false
      }));

      await tx.rentalCharge.createMany({ data: charges });

      // Update device
      await tx.device.update({
        where: { id: device.id },
        data: { status: DeviceStatus.ACTIVE }
      });

      return created;
    });

    return reply.status(201).send({ agreement });
  });

  // Get rental details
  server.get('/:rentalId', {
    schema: {
      tags: ['Rentals'],
      summary: 'Get rental agreement details'
    }
  }, async (request: FastifyRequest<{ Params: { rentalId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { rentalId } = request.params;

    const agreement = await prisma.rentalAgreement.findFirst({
      where: { id: rentalId, businessId },
      include: {
        customer: true,
        device: { include: { agentInfo: true, identity: true } },
        rentalCharges: { orderBy: { chargeNumber: 'asc' } },
        transactions: { orderBy: { createdAt: 'desc' } },
        deviceReturn: true
      }
    });

    if (!agreement) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Rental agreement not found' });
    }

    return reply.send({ agreement });
  });

  // Download Rental Agreement Contract PDF
  server.get('/:rentalId/contract', {
    schema: {
      tags: ['Rentals'],
      summary: 'Download Rental Contract PDF'
    }
  }, async (request: FastifyRequest<{ Params: { rentalId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { rentalId } = request.params;

    const agreement = await prisma.rentalAgreement.findFirst({
      where: { id: rentalId, businessId }
    });

    if (!agreement) return reply.status(404).send({ error: 'NOT_FOUND' });

    try {
      const pdf = await generateRentalContractPdf(rentalId);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="RentalContract-${agreement.agreementNumber}.pdf"`);
      return reply.send(pdf);
    } catch (err: any) {
      return reply.status(500).send({ error: 'PDF_FAILED', message: err.message });
    }
  });
}
