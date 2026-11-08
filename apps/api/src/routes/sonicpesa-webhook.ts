// SonicPesa Webhook Route — Raw body required for signature verification
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { initSonicPesa } from '@hatlock/sonicpesa';
import { issueUnrestrictionCommand } from '../services/device-commands.js';
import { recordFinancingPayment } from '../services/financing.js';
import { recordRentalPayment } from '../services/rental.js';
import { AgreementType, TransactionStatus, VerificationStatus, AuditAction } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { auditLog } from '../services/audit.js';

const sonicpesa = initSonicPesa({
  baseUrl: env.SONICPESA_BASE_URL,
  apiKey: env.SONICPESA_API_KEY,
  apiSecret: env.SONICPESA_API_SECRET,
  webhookSecret: env.SONICPESA_WEBHOOK_SECRET,
  testMode: env.SONICPESA_TEST_MODE
});

export async function sonicpesaWebhookRoutes(server: FastifyInstance) {
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => done(null, body)
  );

  server.post('/', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
    schema: { hide: true }
  }, async (request, reply) => {
    const rawBuffer = request.body as Buffer;
    const rawBody = rawBuffer.toString('utf8');
    const signature = (request.headers['x-sonicpesa-signature'] || request.headers['x-signature']) as string;

    // 1. Verify webhook signature — reject without verification
    if (!signature) {
      logger.warn('SonicPesa webhook: Missing signature header');
      return reply.status(400).send({ error: 'Missing signature header' });
    }

    if (!sonicpesa.verifyWebhookSignature(rawBody, signature)) {
      logger.warn('SonicPesa webhook: Invalid HMAC-SHA256 signature');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // 2. Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON payload' });
    }

    const { order_id, amount, currency, status: paymentStatus, transaction_id, channel } = payload;

    if (!order_id) {
      return reply.status(400).send({ error: 'Missing order_id in webhook payload' });
    }

    logger.info({ order_id, paymentStatus, transaction_id }, 'SonicPesa webhook verified');

    // 3. Find the transaction by order reference / idempotency key
    let transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          { providerReference: order_id },
          { idempotencyKey: order_id },
          { transactionReference: order_id }
        ]
      }
    });

    if (!transaction) {
      logger.error({ order_id }, 'SonicPesa webhook: Transaction not found');
      // Acknowledge receipt to avoid webhook retry flooding, but record warning
      return reply.status(200).send({ received: true, warning: 'Transaction not found for order_id' });
    }

    // 4. Idempotency check — don't process already-completed transactions
    if (transaction.status === TransactionStatus.COMPLETED) {
      logger.info({ order_id }, 'SonicPesa webhook: Already processed — idempotent return');
      return reply.status(200).send({ received: true, idempotent: true });
    }

    // 5. Server-to-server independent verification
    let verifiedStatus: string = paymentStatus;
    try {
      if (env.SONICPESA_API_KEY && env.SONICPESA_API_SECRET) {
        const orderStatus = await sonicpesa.checkOrderStatus(order_id);
        verifiedStatus = orderStatus.payment_status;
      }
    } catch (err: any) {
      logger.warn({ err: err.message, order_id }, 'SonicPesa: Secondary server-to-server check warning, proceeding with signed payload');
    }

    // Handle Non-Success statuses
    if (verifiedStatus !== 'SUCCESS') {
      const mappedStatus =
        (verifiedStatus === 'CANCELLED' || verifiedStatus === 'REJECTED') ? TransactionStatus.FAILED : TransactionStatus.PENDING;

      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: mappedStatus,
          verificationStatus: VerificationStatus.FAILED,
          failReason: `SonicPesa status: ${verifiedStatus}`,
          webhookReceivedAt: new Date(),
          providerMetadata: payload
        }
      });

      return reply.status(200).send({ received: true, status: mappedStatus });
    }

    // 6. Verified SUCCESS — Process Atomic Double-Entry Settlement
    const verifiedAmount = Number(amount || transaction.amountTZS);

    const updatedTxn = await prisma.$transaction(async (tx) => {
      return tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          verificationStatus: VerificationStatus.VERIFIED,
          reconciliationStatus: 'RECONCILED',
          providerReference: transaction_id || order_id,
          paymentMethod: channel || 'SONICPESA_MOBILE',
          verifiedAt: new Date(),
          reconciledAt: new Date(),
          webhookReceivedAt: new Date(),
          providerMetadata: payload
        }
      });
    });

    // Settle instalment according to contract type
    if (transaction.financingAgreementId) {
      try {
        const result = await recordFinancingPayment(
          transaction.financingAgreementId,
          transaction.businessId,
          verifiedAmount,
          transaction.id,
          'SONICPESA_WEBHOOK'
        );

        if (transaction.deviceId && (result.agreement.status === 'PAYMENT_VERIFICATION' || result.agreement.status === 'ACTIVE')) {
          const agreement = await prisma.financingAgreement.findUnique({
            where: { id: transaction.financingAgreementId }
          });
          if (agreement) {
            await issueUnrestrictionCommand(
              transaction.deviceId,
              transaction.businessId,
              transaction.financingAgreementId,
              AgreementType.HIRE_PURCHASE,
              'SonicPesa payment verified — device restored',
              agreement.agreementNumber,
              'SONICPESA_WEBHOOK',
              transaction.id
            );
          }
        }
      } catch (err: any) {
        logger.error({ err, order_id }, 'SonicPesa: Failed to record financing payment');
      }
    } else if (transaction.rentalAgreementId) {
      try {
        await recordRentalPayment(
          transaction.rentalAgreementId,
          transaction.businessId,
          verifiedAmount,
          transaction.id,
          'SONICPESA_WEBHOOK'
        );

        if (transaction.deviceId) {
          const agreement = await prisma.rentalAgreement.findUnique({
            where: { id: transaction.rentalAgreementId }
          });
          if (agreement) {
            await issueUnrestrictionCommand(
              transaction.deviceId,
              transaction.businessId,
              transaction.rentalAgreementId,
              AgreementType.RENTAL,
              'SonicPesa rental payment verified — device restored',
              agreement.agreementNumber,
              'SONICPESA_WEBHOOK',
              transaction.id
            );
          }
        }
      } catch (err: any) {
        logger.error({ err, order_id }, 'SonicPesa: Failed to record rental payment');
      }
    }

    // 8. Audit logging
    await auditLog({
      businessId: transaction.businessId,
      action: AuditAction.UPDATE,
      resource: 'PaymentTransaction',
      resourceId: transaction.id,
      metadata: {
        provider: 'SONICPESA',
        order_id,
        transaction_id,
        amount: verifiedAmount,
        currency: currency || 'TZS',
        reconciled: true
      }
    });

    return reply.status(200).send({ received: true, settled: true, transactionId: updatedTxn.id });
  });
}
