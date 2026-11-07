// Payments & Financial Ledger Routes
// Integration with HatPesa payment gateway, balance updates, and payment reconciliation

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { initHatPesa } from '@hatlock/hatpesa';
import { env } from '../lib/env.js';
import { AgreementType, TransactionStatus } from '@prisma/client';

const InitiatePaymentSchema = z.object({
  agreementType: z.enum(['HIRE_PURCHASE', 'RENTAL']),
  agreementId: z.string().uuid(),
  amount: z.number().positive(),
  phoneNumber: z.string().min(9),
  paymentMethod: z.enum(['HATPESA_MOBILE', 'CARD', 'BANK_TRANSFER']).default('HATPESA_MOBILE')
});

export async function paymentRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List payments
  server.get('/', {
    schema: {
      tags: ['Payments'],
      summary: 'List payment transactions'
    }
  }, async (request: FastifyRequest<{
    Querystring: { customerId?: string; agreementId?: string; status?: string }
  }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { customerId, status } = request.query;

    const where: any = { businessId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const payments = await prisma.paymentTransaction.findMany({
      where,
      include: {
        financingAgreement: { select: { id: true, agreementNumber: true } },
        rentalAgreement: { select: { id: true, agreementNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ payments });
  });

  // Initiate HatPesa Payment
  server.post('/initiate', {
    schema: {
      tags: ['Payments'],
      summary: 'Initiate payment through HatPesa gateway'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = InitiatePaymentSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { agreementType, agreementId, amount, phoneNumber } = parse.data;

    let customerId = '';
    let agreementNumber = '';
    let deviceId: string | null = null;

    if (agreementType === 'HIRE_PURCHASE') {
      const hp = await prisma.financingAgreement.findFirst({
        where: { id: agreementId, businessId }
      });
      if (!hp) return reply.status(404).send({ error: 'AGREEMENT_NOT_FOUND' });
      customerId = hp.customerId;
      agreementNumber = hp.agreementNumber;
      deviceId = hp.deviceId;
    } else {
      const rt = await prisma.rentalAgreement.findFirst({
        where: { id: agreementId, businessId }
      });
      if (!rt) return reply.status(404).send({ error: 'AGREEMENT_NOT_FOUND' });
      customerId = rt.customerId;
      agreementNumber = rt.agreementNumber;
      deviceId = rt.deviceId;
    }

    const reference = `HP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create pending payment transaction record in DB
    const payment = await prisma.paymentTransaction.create({
      data: {
        transactionReference: reference,
        businessId,
        customerId,
        financingAgreementId: agreementType === 'HIRE_PURCHASE' ? agreementId : undefined,
        rentalAgreementId: agreementType === 'RENTAL' ? agreementId : undefined,
        agreementType: agreementType as AgreementType,
        deviceId: deviceId || undefined,
        amountTZS: amount,
        currency: 'TZS',
        paymentProvider: 'HATPESA',
        paymentMethod: 'MOBILE_MONEY',
        idempotencyKey: reference,
        status: TransactionStatus.PENDING
      }
    });

    // Attempt HatPesa mobile checkout
    try {
      const hatpesa = initHatPesa({
        apiKey: env.HATPESA_API_KEY,
        webhookSecret: env.HATPESA_WEBHOOK_SECRET,
        baseUrl: env.HATPESA_BASE_URL,
        testMode: env.HATPESA_TEST_MODE
      });

      const gatewayResponse = await hatpesa.createCheckout({
        reference,
        amount,
        currency: 'TZS',
        customerPhone: phoneNumber,
        description: `HatLock payment for ${agreementNumber}`,
        callbackUrl: `${env.API_BASE_URL}/webhooks/hatpesa`,
        metadata: {
          paymentId: payment.id,
          agreementNumber,
          agreementType,
          deviceId: deviceId || ''
        }
      });

      return reply.send({
        status: 'INITIATED',
        payment,
        gateway: gatewayResponse
      });
    } catch (err: any) {
      server.log.warn({ err: err.message }, 'HatPesa external gateway unreachable, completing in local dev simulation mode');
      if (env.NODE_ENV !== 'production' || env.HATPESA_TEST_MODE) {
        const completedPayment = await prisma.paymentTransaction.update({
          where: { id: payment.id },
          data: { status: TransactionStatus.COMPLETED }
        });
        return reply.send({
          status: 'INITIATED',
          reference,
          payment: completedPayment,
          simulated: true
        });
      }
      return reply.status(502).send({
        error: 'GATEWAY_ERROR',
        message: err.message || 'Payment provider communication failed'
      });
    }
  });
}
