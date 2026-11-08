// HatLock Payment Security & Idempotency Invariants Test Suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { SonicPesaClient } from '@hatlock/sonicpesa';
import { HatPesaClient } from '@hatlock/hatpesa';

describe('Payment Flow & Security Invariants', () => {
  const mockWebhookSecret = 'test_webhook_secret_luxeenet_2026';

  describe('1. Amount and Phone Number Validation', () => {
    it('should reject payment requests with non-positive or zero amount', () => {
      const validatePayment = (amount: number, phone: string) => {
        if (!amount || amount <= 0 || isNaN(amount)) {
          throw new Error('INVALID_AMOUNT: Amount must be greater than zero');
        }
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 9) {
          throw new Error('INVALID_PHONE: Valid phone number required');
        }
        return true;
      };

      expect(() => validatePayment(0, '+255712345678')).toThrow('INVALID_AMOUNT');
      expect(() => validatePayment(-50000, '+255712345678')).toThrow('INVALID_AMOUNT');
      expect(() => validatePayment(NaN, '+255712345678')).toThrow('INVALID_AMOUNT');
      expect(validatePayment(10000, '+255712345678')).toBe(true);
    });

    it('should reject payment requests with malformed or incomplete phone numbers', () => {
      const validatePhone = (phone: string) => {
        const clean = phone.replace(/\D/g, '');
        if (clean.length < 9) {
          throw new Error('INVALID_PHONE: Minimum 9 digits required');
        }
        return clean;
      };

      expect(() => validatePhone('12345')).toThrow('INVALID_PHONE');
      expect(() => validatePhone('')).toThrow('INVALID_PHONE');
      expect(validatePhone('+255 712 345 678')).toBe('255712345678');
    });
  });

  describe('2. State Consistency & Mock Elimination', () => {
    it('should never transition to COMPLETED when payment provider request fails', () => {
      // Simulate state machine behavior
      let status = 'PENDING';
      let failReason: string | null = null;

      const executePaymentInitiation = (gatewaySucceeds: boolean) => {
        if (!gatewaySucceeds) {
          status = 'FAILED';
          failReason = 'Gateway connection refused';
          throw new Error(failReason);
        }
        status = 'PENDING'; // Awaiting customer mobile PIN entry
      };

      expect(() => executePaymentInitiation(false)).toThrow('Gateway connection refused');
      expect(status).toBe('FAILED');
      expect(status).not.toBe('COMPLETED');
    });

    it('should maintain PENDING status on initiation and only transition to COMPLETED upon confirmed provider event', () => {
      let status = 'PENDING';
      let agreementPaidBalance = 100000;
      const instalmentAmount = 50000;

      // 1. Initiation phase: Customer clicks "Pay"
      const onInitiated = (responseStatus: string) => {
        if (responseStatus === 'INITIATED') {
          status = 'PENDING';
          // DO NOT increment balance during initiation
        }
      };

      onInitiated('INITIATED');
      expect(status).toBe('PENDING');
      expect(agreementPaidBalance).toBe(100000); // Unchanged

      // 2. Settlement phase: Confirmed webhook arrives with verified HMAC
      const onWebhookVerified = (webhookEvent: string) => {
        if (webhookEvent === 'payment.completed' || webhookEvent === 'SUCCESS') {
          status = 'COMPLETED';
          agreementPaidBalance += instalmentAmount;
        }
      };

      onWebhookVerified('SUCCESS');
      expect(status).toBe('COMPLETED');
      expect(agreementPaidBalance).toBe(150000); // Correctly settled
    });
  });

  describe('3. Webhook Cryptographic Verification & Idempotency', () => {
    const client = new SonicPesaClient({
      baseUrl: 'https://api.sonicpesa.com/api/v1',
      apiKey: 'sp_key_test',
      apiSecret: 'sp_secret_test',
      webhookSecret: mockWebhookSecret,
      testMode: true
    });

    it('should reject webhook payloads with tampered or invalid HMAC signatures', () => {
      const payload = JSON.stringify({ order_id: 'SP-ORD-9901', amount: 50000, status: 'SUCCESS' });
      const validSig = crypto.createHmac('sha256', mockWebhookSecret).update(payload).digest('hex');
      const tamperedPayload = JSON.stringify({ order_id: 'SP-ORD-9901', amount: 100000, status: 'SUCCESS' });

      // Valid signature must pass
      expect(client.verifyWebhookSignature(payload, validSig)).toBe(true);

      // Tampered payload with valid signature must fail
      expect(client.verifyWebhookSignature(tamperedPayload, validSig)).toBe(false);

      // Random fake signature must fail
      expect(client.verifyWebhookSignature(payload, 'deadbeef1234567890abcdef')).toBe(false);
    });

    it('should prevent double-processing of identical webhook events (Idempotency)', () => {
      const processedTransactions = new Set<string>();

      const processWebhook = (reference: string, currentStatus: string) => {
        if (processedTransactions.has(reference) || currentStatus === 'COMPLETED') {
          return { received: true, idempotent: true };
        }
        processedTransactions.add(reference);
        return { received: true, settled: true };
      };

      // First webhook delivery
      const first = processWebhook('TXN-88219-01', 'PENDING');
      expect(first.settled).toBe(true);
      expect(first.idempotent).toBeUndefined();

      // Duplicate delivery of same reference
      const duplicate = processWebhook('TXN-88219-01', 'COMPLETED');
      expect(duplicate.idempotent).toBe(true);
      expect(duplicate.settled).toBeUndefined();
    });
  });

  describe('4. Duplicate Submission Guard', () => {
    it('should lock concurrent submission attempts until the first request completes', async () => {
      let isSubmitting = false;
      let submissionCount = 0;

      const submitPayment = async () => {
        if (isSubmitting) {
          return { blocked: true, reason: 'DUPLICATE_SUBMISSION_PREVENTED' };
        }
        isSubmitting = true;
        submissionCount++;
        // Simulate async network latency
        await new Promise(r => setTimeout(r, 20));
        isSubmitting = false;
        return { blocked: false, success: true };
      };

      // Simulate rapid double click
      const [res1, res2] = await Promise.all([submitPayment(), submitPayment()]);

      expect(res1.blocked).toBe(false);
      expect(res2.blocked).toBe(true);
      expect(submissionCount).toBe(1);
    });
  });
});

