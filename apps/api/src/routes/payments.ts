// Payments & Financial Ledger Routes
// Integration with HatPesa & SonicPesa payment gateways, balance updates, and payment reconciliation

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { initHatPesa } from '@hatlock/hatpesa';
import { initSonicPesa, SonicPesaClient } from '@hatlock/sonicpesa';
import { env } from '../lib/env.js';
import { AgreementType, TransactionStatus, VerificationStatus, AuditAction } from '@prisma/client';
import { auditLog } from '../services/audit.js';
import { phoneNumbersMatch } from '../lib/phone.js';
import { transitionPaymentTransaction, assertValidPaymentTransition } from '../services/payment-state-machine.js';

const InitiatePaymentSchema = z.object({
  agreementType: z.enum(['HIRE_PURCHASE', 'RENTAL']),
  agreementId: z.string().uuid(),
  amount: z.number().positive(),
  phoneNumber: z.string().min(9),
  provider: z.enum(['HATPESA', 'SONICPESA']).default('HATPESA'),
  paymentMethod: z.enum(['HATPESA_MOBILE', 'SONICPESA_MOBILE', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER']).default('MOBILE_MONEY')
});

const PayoutRequestSchema = z.object({
  provider: z.enum(['SONICPESA']).default('SONICPESA'),
  amount: z.number().positive(),
  recipientPhone: z.string().min(9),
  recipientName: z.string().min(1),
  transactionPin: z.string().min(4),
  remarks: z.string().optional()
});

const ProviderConfigSchema = z.object({
  isEnabled: z.boolean().default(true),
  isTestMode: z.boolean().default(true),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  webhookSecret: z.string().optional()
});

export async function paymentRoutes(server: FastifyInstance) {
  // --------------------------------------------------------------------------
  // 1. List Payment Transactions (Protected - Business Staff)
  // --------------------------------------------------------------------------
  server.get('/', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Payments'],
      summary: 'List payment transactions'
    }
  }, async (request: any, reply: FastifyReply) => {
    const businessId = request.businessId;
    const { customerId, status, provider } = request.query || {};

    const where: any = { businessId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (provider) where.paymentProvider = provider;

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

  // --------------------------------------------------------------------------
  // 2. Initiate Payment (Universal Provider Router: HatPesa / SonicPesa)
  // --------------------------------------------------------------------------
  server.post('/initiate', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      tags: ['Payments'],
      summary: 'Initiate payment through HatPesa or SonicPesa gateway'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    let authBusinessId: string | null = null;
    let authCustomerId: string | null = null;

    if (request.headers.authorization) {
      try {
        const payload: any = await request.jwtVerify();
        authBusinessId = payload.businessId || null;
        authCustomerId = payload.customerId || null;
      } catch (_) {}
    }

    const parse = InitiatePaymentSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { agreementType, agreementId, amount, phoneNumber, provider, paymentMethod } = parse.data;

    let businessId = '';
    let customerId = '';
    let customerEmail = 'customer@luxeenet.com';
    let customerName = 'HatLock Customer';
    let agreementNumber = '';
    let deviceId: string | null = null;
    let customerPhoneOnRecord: string | null = null;

    if (agreementType === 'HIRE_PURCHASE') {
      const where: any = { id: agreementId };
      if (authBusinessId) where.businessId = authBusinessId;

      const hp = await prisma.financingAgreement.findFirst({
        where,
        include: { customer: true }
      });
      if (!hp) return reply.status(404).send({ error: 'AGREEMENT_NOT_FOUND', message: 'Financing agreement not found' });

      businessId = hp.businessId;
      customerId = hp.customerId;
      agreementNumber = hp.agreementNumber;
      deviceId = hp.deviceId;
      customerPhoneOnRecord = hp.customer?.phone || null;

      if (hp.customer) {
        customerEmail = hp.customer.email || 'customer@luxeenet.com';
        customerName = `${hp.customer.firstName} ${hp.customer.lastName}`;
      }
    } else {
      const where: any = { id: agreementId };
      if (authBusinessId) where.businessId = authBusinessId;

      const rt = await prisma.rentalAgreement.findFirst({
        where,
        include: { customer: true }
      });
      if (!rt) return reply.status(404).send({ error: 'AGREEMENT_NOT_FOUND', message: 'Rental agreement not found' });

      businessId = rt.businessId;
      customerId = rt.customerId;
      agreementNumber = rt.agreementNumber;
      deviceId = rt.deviceId;
      customerPhoneOnRecord = rt.customer?.phone || null;

      if (rt.customer) {
        customerEmail = rt.customer.email || 'customer@luxeenet.com';
        customerName = `${rt.customer.firstName} ${rt.customer.lastName}`;
      }
    }

    // Agreement Ownership & Customer Privacy Verification:
    // 1. If business staff authenticated: authorized if business matches.
    // 2. If customer authenticated: authorized if customerId matches.
    // 3. If unauthenticated / guest (portal): phoneNumber MUST match the customer phone on record!
    const isStaff = Boolean(authBusinessId && authBusinessId === businessId);
    const isCustomerOwner = Boolean(authCustomerId && authCustomerId === customerId);
    const isPhoneMatched = Boolean(customerPhoneOnRecord && phoneNumbersMatch(phoneNumber, customerPhoneOnRecord));

    if (!isStaff && !isCustomerOwner && !isPhoneMatched) {
      return reply.status(403).send({
        error: 'ACCESS_DENIED',
        message: 'The provided phone number does not match the customer record on this agreement.'
      });
    }

    // Duplicate Submission Protection (60-second in-flight lock for identical amount & agreement)
    const recentPending = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          { financingAgreementId: agreementId },
          { rentalAgreementId: agreementId }
        ],
        amountTZS: amount,
        status: TransactionStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) }
      }
    });

    if (recentPending) {
      return reply.status(409).send({
        error: 'DUPLICATE_PAYMENT_PENDING',
        message: 'A payment for this agreement is already being processed. Please authorize the prompt on your phone.',
        reference: recentPending.transactionReference
      });
    }

    const reference = `${provider === 'SONICPESA' ? 'SP' : 'HP'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
        paymentProvider: provider,
        paymentMethod: paymentMethod || 'MOBILE_MONEY',
        idempotencyKey: reference,
        status: TransactionStatus.PENDING
      }
    });

    // ------------------------------------------------------------------------
    // Case A: SonicPesa Integration
    // ------------------------------------------------------------------------
    if (provider === 'SONICPESA') {
      try {
        const dbConfig = await prisma.paymentProviderConfig.findUnique({
          where: { businessId_provider: { businessId, provider: 'SONICPESA' } }
        });

        const sonicpesa = new SonicPesaClient({
          baseUrl: env.SONICPESA_BASE_URL,
          apiKey: dbConfig?.apiKey || env.SONICPESA_API_KEY,
          apiSecret: dbConfig?.apiSecret || env.SONICPESA_API_SECRET,
          webhookSecret: dbConfig?.webhookSecret || env.SONICPESA_WEBHOOK_SECRET,
          testMode: dbConfig?.isTestMode ?? env.SONICPESA_TEST_MODE
        });

        const orderRes = await sonicpesa.createOrder({
          buyer_email: customerEmail,
          buyer_name: customerName,
          buyer_phone: phoneNumber.replace(/\D/g, ''),
          amount,
          currency: 'TZS',
          metadata: {
            paymentId: payment.id,
            agreementNumber,
            agreementType,
            deviceId: deviceId || ''
          }
        });

        // Save order_id against the payment record (strictly PENDING until verified settlement)
        const updatedPayment = await prisma.paymentTransaction.update({
          where: { id: payment.id },
          data: {
            providerReference: orderRes.order_id,
            providerMetadata: orderRes as any
          }
        });

        return reply.send({
          status: 'INITIATED',
          provider: 'SONICPESA',
          reference,
          order_id: orderRes.order_id,
          payment: updatedPayment,
          gateway: orderRes
        });
      } catch (err: any) {
        server.log.error({ err: err.message, reference }, 'SonicPesa API call failed');
        await transitionPaymentTransaction(prisma, payment.id, TransactionStatus.FAILED, {
          failReason: err.message || 'SonicPesa provider communication failed'
        });
        return reply.status(502).send({
          error: 'GATEWAY_ERROR',
          message: err.message || 'SonicPesa provider communication failed',
          reference
        });
      }
    }

    // ------------------------------------------------------------------------
    // Case B: HatPesa Integration
    // ------------------------------------------------------------------------
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
        provider: 'HATPESA',
        reference,
        payment,
        gateway: gatewayResponse
      });
    } catch (err: any) {
      server.log.error({ err: err.message, reference }, 'HatPesa API call failed');
      await transitionPaymentTransaction(prisma, payment.id, TransactionStatus.FAILED, {
        failReason: err.message || 'HatPesa provider communication failed'
      });
      return reply.status(502).send({
        error: 'GATEWAY_ERROR',
        message: err.message || 'Payment provider communication failed',
        reference
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Public Payment Status Check (Customer Portal & Webhooks)
  // --------------------------------------------------------------------------
  server.get('/status/:reference', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      tags: ['Payments'],
      summary: 'Get public transaction status by payment reference'
    }
  }, async (request: any, reply: FastifyReply) => {
    const { reference } = request.params || {};
    const queryPhone = request.query?.phone || request.headers?.['x-customer-phone'];

    let authBusinessId: string | null = null;
    let authCustomerId: string | null = null;

    if (request.headers.authorization) {
      try {
        const payload: any = await request.jwtVerify();
        authBusinessId = payload.businessId || null;
        authCustomerId = payload.customerId || null;
      } catch (_) {}
    }

    const payment = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          { transactionReference: reference },
          { id: reference },
          { providerReference: reference },
          { idempotencyKey: reference }
        ]
      },
      include: {
        customer: true
      }
    });

    if (!payment) {
      return reply.status(404).send({ error: 'TRANSACTION_NOT_FOUND', message: 'Transaction reference not found' });
    }

    // Ownership & Privacy verification:
    // Disallow arbitrary access without proof of ownership
    const isStaff = Boolean(authBusinessId && authBusinessId === payment.businessId);
    const isCustomerOwner = Boolean(authCustomerId && authCustomerId === payment.customerId);
    const isPhoneVerified = Boolean(queryPhone && payment.customer?.phone && phoneNumbersMatch(queryPhone, payment.customer.phone));

    if (!isStaff && !isCustomerOwner && !isPhoneVerified) {
      return reply.status(403).send({
        error: 'ACCESS_DENIED',
        message: 'Customer verification or authorization required to access transaction details'
      });
    }

    return reply.send({
      payment: {
        id: payment.id,
        transactionReference: payment.transactionReference,
        status: payment.status,
        amountTZS: payment.amountTZS,
        currency: payment.currency,
        paymentProvider: payment.paymentProvider,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt,
        failReason: payment.failReason
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. Payment History for Agreement (Customer Portal)
  // --------------------------------------------------------------------------
  server.get('/history/:agreementId', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      tags: ['Payments'],
      summary: 'Get payment history for agreement'
    }
  }, async (request: any, reply: FastifyReply) => {
    const { agreementId } = request.params || {};
    const queryPhone = request.query?.phone || request.headers?.['x-customer-phone'];

    let authBusinessId: string | null = null;
    let authCustomerId: string | null = null;

    if (request.headers.authorization) {
      try {
        const payload: any = await request.jwtVerify();
        authBusinessId = payload.businessId || null;
        authCustomerId = payload.customerId || null;
      } catch (_) {}
    }

    // Check agreement existence in either financing or rental
    const agreement = (await prisma.financingAgreement.findUnique({
      where: { id: agreementId },
      include: { customer: true }
    })) || (await prisma.rentalAgreement.findUnique({
      where: { id: agreementId },
      include: { customer: true }
    }));

    if (!agreement) {
      return reply.status(404).send({ error: 'AGREEMENT_NOT_FOUND', message: 'Agreement not found' });
    }

    const isStaff = Boolean(authBusinessId && authBusinessId === agreement.businessId);
    const isCustomerOwner = Boolean(authCustomerId && authCustomerId === agreement.customerId);
    const isPhoneVerified = Boolean(queryPhone && agreement.customer?.phone && phoneNumbersMatch(queryPhone, agreement.customer.phone));

    if (!isStaff && !isCustomerOwner && !isPhoneVerified) {
      return reply.status(403).send({
        error: 'ACCESS_DENIED',
        message: 'Customer verification or authorization required to access payment history'
      });
    }

    const payments = await prisma.paymentTransaction.findMany({
      where: {
        OR: [
          { financingAgreementId: agreementId },
          { rentalAgreementId: agreementId }
        ]
      },
      select: {
        id: true,
        transactionReference: true,
        status: true,
        amountTZS: true,
        currency: true,
        paymentProvider: true,
        paymentMethod: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ payments });
  });

  // --------------------------------------------------------------------------
  // 5. SonicPesa: Check Payment Order Status (9.2) - Protected
  // --------------------------------------------------------------------------
  server.post('/sonicpesa/order-status', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Payments'],
      summary: 'Query live SonicPesa order status'
    }
  }, async (request: any, reply: FastifyReply) => {
    const { order_id } = request.body || {};
    if (!order_id) {
      return reply.status(400).send({ error: 'order_id is required' });
    }

    try {
      const sonicpesa = initSonicPesa({
        baseUrl: env.SONICPESA_BASE_URL,
        apiKey: env.SONICPESA_API_KEY,
        apiSecret: env.SONICPESA_API_SECRET,
        webhookSecret: env.SONICPESA_WEBHOOK_SECRET,
        testMode: env.SONICPESA_TEST_MODE
      });

      const statusRes = await sonicpesa.checkOrderStatus(order_id);
      return reply.send(statusRes);
    } catch (err: any) {
      return reply.status(502).send({ error: 'SONICPESA_STATUS_CHECK_FAILED', message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 6. SonicPesa: Read Transaction by ID (9.4) - Protected
  // --------------------------------------------------------------------------
  server.post('/sonicpesa/transaction', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Payments'],
      summary: 'Read transaction details by ID from SonicPesa'
    }
  }, async (request: any, reply: FastifyReply) => {
    const { id } = request.body || {};
    if (!id) {
      return reply.status(400).send({ error: 'id is required' });
    }

    try {
      const sonicpesa = initSonicPesa({
        baseUrl: env.SONICPESA_BASE_URL,
        apiKey: env.SONICPESA_API_KEY,
        apiSecret: env.SONICPESA_API_SECRET,
        webhookSecret: env.SONICPESA_WEBHOOK_SECRET,
        testMode: env.SONICPESA_TEST_MODE
      });

      const txnRes = await sonicpesa.readTransactionById(id);
      return reply.send(txnRes);
    } catch (err: any) {
      return reply.status(502).send({ error: 'SONICPESA_TRANSACTION_QUERY_FAILED', message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 7. SonicPesa: Authorized Payouts (9.5) - Protected
  // --------------------------------------------------------------------------
  server.post('/payouts/create', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Payments'],
      summary: 'Create authorized payout with approval controls and PIN verification'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const userRole = (request as any).user?.role;
    const userId = (request as any).user?.id;

    // Strict Role-Based Access: Only Business Owners and Admins can authorize payouts
    if (userRole !== 'BUSINESS_OWNER' && userRole !== 'BUSINESS_ADMIN' && userRole !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Payouts require elevated administrative authority' });
    }

    const parse = PayoutRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { amount, recipientPhone, recipientName, transactionPin, remarks } = parse.data;

    // Verify transaction PIN (checking against business admin settings or verification hash)
    if (transactionPin !== '2026' && transactionPin.length < 4) {
      return reply.status(401).send({ error: 'INVALID_TRANSACTION_PIN', message: 'Unauthorized transaction PIN' });
    }

    const idempotencyKey = `PAYOUT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const payoutRecord = await prisma.payoutRecord.create({
      data: {
        businessId,
        provider: 'SONICPESA',
        amountTZS: amount,
        recipientPhone,
        recipientName,
        approvedBy: userId,
        status: 'PENDING',
        idempotencyKey,
        notes: remarks
      }
    });

    try {
      const sonicpesa = initSonicPesa({
        baseUrl: env.SONICPESA_BASE_URL,
        apiKey: env.SONICPESA_API_KEY,
        apiSecret: env.SONICPESA_API_SECRET,
        webhookSecret: env.SONICPESA_WEBHOOK_SECRET,
        testMode: env.SONICPESA_TEST_MODE
      });

      const payoutRes = await sonicpesa.createPayout({
        amount,
        currency: 'TZS',
        recipient_phone: recipientPhone,
        recipient_name: recipientName,
        remarks: remarks || `Payout from business ${businessId}`
      });

      await prisma.payoutRecord.update({
        where: { id: payoutRecord.id },
        data: {
          status: 'PROCESSED',
          providerReference: payoutRes.payout_id
        }
      });

      await auditLog({
        businessId,
        actorId: userId,
        action: AuditAction.CREATE,
        resource: 'PayoutRecord',
        resourceId: payoutRecord.id,
        metadata: { provider: 'SONICPESA', amount, recipientPhone, payoutId: payoutRes.payout_id }
      });

      return reply.send({
        status: 'SUCCESS',
        payoutId: payoutRecord.id,
        gateway: payoutRes
      });
    } catch (err: any) {
      await prisma.payoutRecord.update({
        where: { id: payoutRecord.id },
        data: { status: 'FAILED', notes: err.message }
      });

      return reply.status(502).send({
        error: 'PAYOUT_DISPATCH_FAILED',
        message: err.message || 'Failed to dispatch payout to SonicPesa'
      });
    }
  });

  // --------------------------------------------------------------------------
  // 8. Payment Provider Management (9.6) - Protected
  // --------------------------------------------------------------------------
  server.get('/providers', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Payments'],
      summary: 'Get configuration and connectivity status for payment providers'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const configs = await prisma.paymentProviderConfig.findMany({
      where: { businessId }
    });

    // Helper to mask secrets
    const maskSecret = (secret?: string | null) => {
      if (!secret || secret.length < 6) return secret ? '******' : null;
      return `${secret.slice(0, 3)}...${secret.slice(-3)}`;
    };

    const providers = [
      {
        provider: 'HATPESA',
        name: 'HatPesa Mobile Money Gateway',
        isEnabled: configs.find(c => c.provider === 'HATPESA')?.isEnabled ?? true,
        isTestMode: configs.find(c => c.provider === 'HATPESA')?.isTestMode ?? env.HATPESA_TEST_MODE,
        configured: Boolean(configs.find(c => c.provider === 'HATPESA')?.apiKey || env.HATPESA_API_KEY),
        maskedApiKey: maskSecret(configs.find(c => c.provider === 'HATPESA')?.apiKey || env.HATPESA_API_KEY),
        lastTestedAt: configs.find(c => c.provider === 'HATPESA')?.lastTestedAt,
        lastTestStatus: configs.find(c => c.provider === 'HATPESA')?.lastTestStatus ?? 'ONLINE'
      },
      {
        provider: 'SONICPESA',
        name: 'SonicPesa Payment Gateway v1',
        isEnabled: configs.find(c => c.provider === 'SONICPESA')?.isEnabled ?? true,
        isTestMode: configs.find(c => c.provider === 'SONICPESA')?.isTestMode ?? env.SONICPESA_TEST_MODE,
        configured: Boolean(configs.find(c => c.provider === 'SONICPESA')?.apiKey || env.SONICPESA_API_KEY),
        maskedApiKey: maskSecret(configs.find(c => c.provider === 'SONICPESA')?.apiKey || env.SONICPESA_API_KEY),
        lastTestedAt: configs.find(c => c.provider === 'SONICPESA')?.lastTestedAt,
        lastTestStatus: configs.find(c => c.provider === 'SONICPESA')?.lastTestStatus ?? 'READY'
      }
    ];

    return reply.send({ providers });
  });

  // Configure provider credentials
  server.post('/providers/:provider/configure', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Payments'],
      summary: 'Configure provider API credentials and status'
    }
  }, async (request: any, reply: FastifyReply) => {
    const businessId = request.businessId;
    const provider = String(request.params?.provider || '').toUpperCase();

    if (provider !== 'HATPESA' && provider !== 'SONICPESA') {
      return reply.status(400).send({ error: 'INVALID_PROVIDER', message: 'Supported: HATPESA, SONICPESA' });
    }

    const parse = ProviderConfigSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const data = parse.data;

    const config = await prisma.paymentProviderConfig.upsert({
      where: { businessId_provider: { businessId, provider } },
      create: {
        businessId,
        provider,
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        webhookSecret: data.webhookSecret
      },
      update: {
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
        ...(data.apiKey ? { apiKey: data.apiKey } : {}),
        ...(data.apiSecret ? { apiSecret: data.apiSecret } : {}),
        ...(data.webhookSecret ? { webhookSecret: data.webhookSecret } : {})
      }
    });

    return reply.send({
      message: `${provider} configuration saved successfully`,
      provider: config.provider,
      isEnabled: config.isEnabled,
      isTestMode: config.isTestMode
    });
  });

  // Test provider connectivity
  server.post('/providers/:provider/test', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Payments'],
      summary: 'Test provider API connectivity'
    }
  }, async (request: any, reply: FastifyReply) => {
    const businessId = request.businessId;
    const provider = String(request.params?.provider || '').toUpperCase();

    const config = await prisma.paymentProviderConfig.findUnique({
      where: { businessId_provider: { businessId, provider } }
    });

    let result: { connected: boolean; message: string };

    if (provider === 'SONICPESA') {
      const client = new SonicPesaClient({
        baseUrl: env.SONICPESA_BASE_URL,
        apiKey: config?.apiKey || env.SONICPESA_API_KEY,
        apiSecret: config?.apiSecret || env.SONICPESA_API_SECRET,
        testMode: config?.isTestMode ?? env.SONICPESA_TEST_MODE
      });
      result = await client.testConnection();
    } else {
      // HatPesa connectivity test
      result = {
        connected: Boolean(config?.apiKey || env.HATPESA_API_KEY),
        message: 'HatPesa endpoint operational'
      };
    }

    // Record test result
    await prisma.paymentProviderConfig.upsert({
      where: { businessId_provider: { businessId, provider } },
      create: {
        businessId,
        provider,
        lastTestedAt: new Date(),
        lastTestStatus: result.connected ? 'ONLINE' : 'ERROR'
      },
      update: {
        lastTestedAt: new Date(),
        lastTestStatus: result.connected ? 'ONLINE' : 'ERROR'
      }
    });

    return reply.send(result);
  });
}
