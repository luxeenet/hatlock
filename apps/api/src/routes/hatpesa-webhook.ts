// HatPesa Webhook Route — Raw body required for signature verification
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { initHatPesa } from '@hatlock/hatpesa';
import { issueUnrestrictionCommand } from '../services/device-commands.js';
import { recordFinancingPayment } from '../services/financing.js';
import { recordRentalPayment } from '../services/rental.js';
import { AgreementType, TransactionStatus, VerificationStatus } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { auditLog } from '../services/audit.js';
import { AuditAction } from '@prisma/client';

const hatpesa = initHatPesa({
  baseUrl: env.HATPESA_BASE_URL,
  apiKey: env.HATPESA_API_KEY,
  webhookSecret: env.HATPESA_WEBHOOK_SECRET,
  testMode: env.HATPESA_TEST_MODE
});

export async function hatpesaWebhookRoutes(server: FastifyInstance) {
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => done(null, body)
  );

  server.post('/', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
    schema: { hide: true }
  }, async (request, reply) => {
    const rawBody = (request.body as Buffer).toString('utf8');
    const signature = request.headers['x-hatpesa-signature'] as string;
    const timestamp = request.headers['x-hatpesa-timestamp'] as string;

    // 1. Verify webhook signature — reject without verification
    if (!signature || !timestamp) {
      logger.warn('HatPesa webhook: Missing signature headers');
      return reply.status(400).send({ error: 'Missing signature headers' });
    }

    if (!hatpesa.isTimestampFresh(timestamp)) {
      logger.warn('HatPesa webhook: Stale timestamp — possible replay attack');
      return reply.status(400).send({ error: 'Request timestamp too old' });
    }

    if (!hatpesa.verifyWebhookSignature(rawBody, signature, timestamp)) {
      logger.warn('HatPesa webhook: Invalid signature');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // 2. Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON payload' });
    }

    const { event, reference, providerReference, amount, currency, status: paymentStatus } = payload;

    logger.info({ event, reference }, 'HatPesa webhook received');

    // 3. Find the transaction by idempotency key (= our reference)
    let transaction = await prisma.paymentTransaction.findFirst({
      where: { idempotencyKey: reference }
    });

    if (!transaction) {
      // Sometimes webhooks arrive before our checkout redirect
      // Find by provider reference as fallback
      transaction = await prisma.paymentTransaction.findFirst({
        where: { providerReference }
      });
    }

    if (!transaction) {
      logger.error({ reference }, 'HatPesa webhook: Transaction not found');
      // Return 200 so HatPesa doesn't keep retrying — log for manual reconciliation
      return reply.status(200).send({ received: true, warning: 'Transaction not found' });
    }

    // 4. Idempotency check — don't process already-completed transactions
    if (transaction.status === TransactionStatus.COMPLETED) {
      logger.info({ reference }, 'HatPesa webhook: Already processed — idempotent return');
      return reply.status(200).send({ received: true, idempotent: true });
    }

    // 5. Server-to-server verification — NEVER trust webhook payload alone
    let verified: any;
    try {
      verified = await hatpesa.verifyPayment(reference);
    } catch (err: any) {
      logger.error({ err, reference }, 'HatPesa: Server verification failed');
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.PENDING,
          verificationStatus: VerificationStatus.FAILED,
          failReason: `Server verification failed: ${err.message}`
        }
      });
      return reply.status(200).send({ received: true });
    }

    if (verified.status !== 'completed') {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: paymentStatus === 'failed' ? TransactionStatus.FAILED : TransactionStatus.PENDING,
          verificationStatus: VerificationStatus.FAILED,
          providerReference: providerReference ?? verified.providerReference,
          webhookReceivedAt: new Date()
        }
      });
      return reply.status(200).send({ received: true });
    }

    // 6. Mark transaction as verified and completed
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.COMPLETED,
        verificationStatus: VerificationStatus.VERIFIED,
        providerReference: verified.providerReference ?? providerReference,
        webhookReceivedAt: new Date(),
        verifiedAt: new Date()
      }
    });

    // 7. Apply payment to agreement
    try {
      if (transaction.agreementType === AgreementType.HIRE_PURCHASE && transaction.financingAgreementId) {
        const result = await recordFinancingPayment(
          transaction.financingAgreementId,
          transaction.businessId,
          amount,
          transaction.id,
          'HATPESA_WEBHOOK'
        );

        // Auto-restore device if payment resolves restriction
        if (result.agreement.status === 'PAYMENT_VERIFICATION' || result.agreement.status === 'ACTIVE') {
          const device = await prisma.device.findFirst({
            where: { id: transaction.deviceId ?? undefined },
            include: { restrictions: { where: { isActive: true } } }
          });
          if (device?.restrictions.length && transaction.deviceId) {
            const agreement = await prisma.financingAgreement.findUnique({
              where: { id: transaction.financingAgreementId }
            });
            if (agreement) {
              await issueUnrestrictionCommand(
                transaction.deviceId,
                transaction.businessId,
                transaction.financingAgreementId,
                AgreementType.HIRE_PURCHASE,
                'Payment verified — device restored',
                agreement.agreementNumber,
                'HATPESA_WEBHOOK',
                transaction.id
              );
            }
          }
        }
      } else if (transaction.agreementType === AgreementType.RENTAL && transaction.rentalAgreementId) {
        const result = await recordRentalPayment(
          transaction.rentalAgreementId,
          transaction.businessId,
          amount,
          transaction.id,
          'HATPESA_WEBHOOK'
        );

        // Auto-restore rental device
        if (transaction.deviceId) {
          const device = await prisma.device.findFirst({
            where: { id: transaction.deviceId },
            include: { restrictions: { where: { isActive: true } } }
          });
          if (device?.restrictions.length) {
            const agreement = await prisma.rentalAgreement.findUnique({
              where: { id: transaction.rentalAgreementId }
            });
            if (agreement) {
              await issueUnrestrictionCommand(
                transaction.deviceId,
                transaction.businessId,
                transaction.rentalAgreementId,
                AgreementType.RENTAL,
                'Payment verified — device restored',
                agreement.agreementNumber,
                'HATPESA_WEBHOOK',
                transaction.id
              );
            }
          }
        }
      }
    } catch (err: any) {
      logger.error({ err, transactionId: transaction.id }, 'Error applying payment after webhook');
      // Don't fail the webhook — HatPesa will retry, payment was already recorded
    }

    await auditLog({
      businessId: transaction.businessId,
      action: AuditAction.UPDATE,
      resource: 'PaymentTransaction',
      resourceId: transaction.id,
      metadata: { event, reference, amount, verifiedAt: new Date() }
    });

    return reply.status(200).send({ received: true, processed: true });
  });
}
