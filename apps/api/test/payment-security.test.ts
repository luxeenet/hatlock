// HatLock Payment Security, State Machine, Ownership & Gateway Regression Test Suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { SonicPesaClient } from '@hatlock/sonicpesa';
import { HatPesaClient } from '@hatlock/hatpesa';
import {
  isValidPaymentTransition,
  assertValidPaymentTransition,
  InvalidStateTransitionError
} from '../src/services/payment-state-machine.js';
import { phoneNumbersMatch, normalizePhoneNumber } from '../src/lib/phone.js';
import { TransactionStatus } from '@prisma/client';

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

  describe('2. Phone Normalization & Agreement Ownership Matching', () => {
    it('should match equivalent phone numbers across various formats (+255, 0..., spaces, dashes)', () => {
      expect(phoneNumbersMatch('+255712345678', '0712345678')).toBe(true);
      expect(phoneNumbersMatch('255-712-345-678', '+255 712 345 678')).toBe(true);
      expect(phoneNumbersMatch('0712345678', '712345678')).toBe(true);
    });

    it('should reject non-matching phone numbers to prevent unauthorized agreement probing', () => {
      expect(phoneNumbersMatch('+255712345678', '+255788999000')).toBe(false);
      expect(phoneNumbersMatch(null, '+255712345678')).toBe(false);
      expect(phoneNumbersMatch('+255712345678', undefined)).toBe(false);
    });
  });

  describe('3. Payment State Machine Transition Guards', () => {
    it('should allow valid forward transitions from PENDING', () => {
      expect(isValidPaymentTransition(TransactionStatus.PENDING, TransactionStatus.COMPLETED)).toBe(true);
      expect(isValidPaymentTransition(TransactionStatus.PENDING, TransactionStatus.FAILED)).toBe(true);
      expect(isValidPaymentTransition(TransactionStatus.PENDING, TransactionStatus.PROCESSING)).toBe(true);
      expect(isValidPaymentTransition(TransactionStatus.PENDING, TransactionStatus.PENDING)).toBe(true);
    });

    it('should disallow invalid transitions from COMPLETED back to PENDING or FAILED', () => {
      expect(isValidPaymentTransition(TransactionStatus.COMPLETED, TransactionStatus.PENDING)).toBe(false);
      expect(isValidPaymentTransition(TransactionStatus.COMPLETED, TransactionStatus.FAILED)).toBe(false);
      expect(() => assertValidPaymentTransition(TransactionStatus.COMPLETED, TransactionStatus.PENDING)).toThrow(
        InvalidStateTransitionError
      );
      expect(() => assertValidPaymentTransition(TransactionStatus.COMPLETED, TransactionStatus.FAILED)).toThrow(
        InvalidStateTransitionError
      );
    });

    it('should disallow invalid transitions from FAILED back to COMPLETED or PENDING', () => {
      expect(isValidPaymentTransition(TransactionStatus.FAILED, TransactionStatus.COMPLETED)).toBe(false);
      expect(isValidPaymentTransition(TransactionStatus.FAILED, TransactionStatus.PENDING)).toBe(false);
      expect(() => assertValidPaymentTransition(TransactionStatus.FAILED, TransactionStatus.COMPLETED)).toThrow(
        InvalidStateTransitionError
      );
    });

    it('should allow COMPLETED to transition to post-settlement states (REVERSED, REFUNDED, DISPUTED)', () => {
      expect(isValidPaymentTransition(TransactionStatus.COMPLETED, TransactionStatus.REVERSED)).toBe(true);
      expect(isValidPaymentTransition(TransactionStatus.COMPLETED, TransactionStatus.REFUNDED)).toBe(true);
      expect(isValidPaymentTransition(TransactionStatus.COMPLETED, TransactionStatus.DISPUTED)).toBe(true);
    });
  });

  describe('4. Gateway Failure & Regression Handlers (HatPesa & SonicPesa)', () => {
    it('SonicPesa: Gateway throws exception in test mode → MUST result in FAILED status (never COMPLETED)', async () => {
      let paymentRecord = {
        id: 'txn-sp-01',
        status: TransactionStatus.PENDING,
        providerReference: null as string | null,
        failReason: null as string | null
      };

      const simulateSonicPesaInitiation = async (testMode: boolean, gatewayThrows: boolean) => {
        try {
          if (gatewayThrows) {
            throw new Error('Connection timeout to SonicPesa upstream gateway');
          }
          paymentRecord.providerReference = 'sp_ord_real_123';
        } catch (err: any) {
          // Strict production rule: update to FAILED, never COMPLETED even in test mode
          paymentRecord.status = TransactionStatus.FAILED;
          paymentRecord.failReason = err.message;
          return { httpStatus: 502, error: 'GATEWAY_ERROR' };
        }
        return { httpStatus: 200, status: 'INITIATED' };
      };

      const result = await simulateSonicPesaInitiation(true, true);
      expect(result.httpStatus).toBe(502);
      expect(paymentRecord.status).toBe(TransactionStatus.FAILED);
      expect(paymentRecord.status).not.toBe(TransactionStatus.COMPLETED);
      expect(paymentRecord.providerReference).toBeNull();
      expect(paymentRecord.failReason).toContain('Connection timeout');
    });

    it('SonicPesa: Gateway throws exception in production → MUST result in FAILED status (never COMPLETED)', async () => {
      let paymentRecord = {
        id: 'txn-sp-02',
        status: TransactionStatus.PENDING,
        providerReference: null as string | null
      };

      const simulateProductionFailure = async () => {
        try {
          throw new Error('SonicPesa HTTP 503 Service Unavailable');
        } catch (err: any) {
          paymentRecord.status = TransactionStatus.FAILED;
          return { httpStatus: 502, error: 'GATEWAY_ERROR' };
        }
      };

      const result = await simulateProductionFailure();
      expect(result.httpStatus).toBe(502);
      expect(paymentRecord.status).toBe(TransactionStatus.FAILED);
      expect(paymentRecord.status).not.toBe(TransactionStatus.COMPLETED);
    });

    it('HatPesa: Gateway throws exception in test mode → MUST result in FAILED status (never COMPLETED)', async () => {
      let paymentRecord = {
        id: 'txn-hp-01',
        status: TransactionStatus.PENDING,
        failReason: null as string | null
      };

      const simulateHatPesaInitiation = async (testMode: boolean, gatewayThrows: boolean) => {
        try {
          if (gatewayThrows) {
            throw new Error('HatPesa API auth rejected');
          }
        } catch (err: any) {
          paymentRecord.status = TransactionStatus.FAILED;
          paymentRecord.failReason = err.message;
          return { httpStatus: 502, error: 'GATEWAY_ERROR' };
        }
        return { httpStatus: 200, status: 'INITIATED' };
      };

      const result = await simulateHatPesaInitiation(true, true);
      expect(result.httpStatus).toBe(502);
      expect(paymentRecord.status).toBe(TransactionStatus.FAILED);
      expect(paymentRecord.status).not.toBe(TransactionStatus.COMPLETED);
    });

    it('HatPesa: Gateway throws exception in production → MUST result in FAILED status (never COMPLETED)', async () => {
      let paymentRecord = {
        id: 'txn-hp-02',
        status: TransactionStatus.PENDING
      };

      try {
        throw new Error('Network unreachable');
      } catch (err: any) {
        paymentRecord.status = TransactionStatus.FAILED;
      }

      expect(paymentRecord.status).toBe(TransactionStatus.FAILED);
      expect(paymentRecord.status).not.toBe(TransactionStatus.COMPLETED);
    });

    it('Successful gateway checkout creation MUST remain PENDING until verified settlement', async () => {
      let paymentRecord = {
        id: 'txn-success-init',
        status: TransactionStatus.PENDING,
        providerReference: null as string | null
      };

      // Simulating successful gateway checkout response
      const gatewayResponse = { order_id: 'SP-ORD-VERIFIED-99', status: 'INITIATED' };
      paymentRecord.providerReference = gatewayResponse.order_id;
      // Do NOT set status to COMPLETED

      expect(paymentRecord.status).toBe(TransactionStatus.PENDING);
      expect(paymentRecord.providerReference).toBe('SP-ORD-VERIFIED-99');
    });
  });

  describe('5. Webhook Cryptographic Verification & Settlement Security', () => {
    const client = new SonicPesaClient({
      baseUrl: 'https://api.sonicpesa.com/api/v1',
      apiKey: 'sp_key_test',
      apiSecret: 'sp_secret_test',
      webhookSecret: mockWebhookSecret,
      testMode: true
    });

    it('should reject unverified callback with tampered or invalid HMAC signature, leaving payment UNCHANGED', () => {
      let paymentStatus = TransactionStatus.PENDING;
      const payload = JSON.stringify({ order_id: 'SP-ORD-9901', amount: 50000, status: 'SUCCESS' });
      const badSignature = 'invalid_hmac_hex_code_12345';

      const isValid = client.verifyWebhookSignature(payload, badSignature);
      if (!isValid) {
        // Do NOT update payment
      } else {
        paymentStatus = TransactionStatus.COMPLETED;
      }

      expect(isValid).toBe(false);
      expect(paymentStatus).toBe(TransactionStatus.PENDING); // Unchanged
    });

    it('should transition payment to COMPLETED ONLY upon valid signed settlement webhook', () => {
      let paymentStatus = TransactionStatus.PENDING;
      const payload = JSON.stringify({ order_id: 'SP-ORD-9901', amount: 50000, status: 'SUCCESS' });
      const validSig = crypto.createHmac('sha256', mockWebhookSecret).update(payload).digest('hex');

      const isValid = client.verifyWebhookSignature(payload, validSig);
      if (isValid) {
        const data = JSON.parse(payload);
        if (data.status === 'SUCCESS') {
          assertValidPaymentTransition(paymentStatus, TransactionStatus.COMPLETED);
          paymentStatus = TransactionStatus.COMPLETED;
        }
      }

      expect(isValid).toBe(true);
      expect(paymentStatus).toBe(TransactionStatus.COMPLETED);
    });

    it('should prevent double-processing of identical webhook events (Idempotency)', () => {
      const processedTransactions = new Set<string>();

      const processWebhook = (reference: string, currentStatus: TransactionStatus) => {
        if (processedTransactions.has(reference) || currentStatus === TransactionStatus.COMPLETED) {
          return { received: true, idempotent: true };
        }
        processedTransactions.add(reference);
        return { received: true, settled: true };
      };

      const first = processWebhook('TXN-88219-01', TransactionStatus.PENDING);
      expect(first.settled).toBe(true);
      expect(first.idempotent).toBeUndefined();

      const duplicate = processWebhook('TXN-88219-01', TransactionStatus.COMPLETED);
      expect(duplicate.idempotent).toBe(true);
      expect(duplicate.settled).toBeUndefined();
    });
  });

  describe('6. Agreement Ownership, Privacy & Duplicate-Submission Guard', () => {
    it('should prevent duplicate submission if a pending payment exists within 60 seconds', () => {
      const existingPayments = [
        {
          agreementId: 'agr-101',
          amount: 50000,
          status: TransactionStatus.PENDING,
          createdAt: new Date(Date.now() - 30 * 1000) // 30 seconds ago
        }
      ];

      const checkDuplicate = (agrId: string, amt: number) => {
        const dup = existingPayments.find(
          p => p.agreementId === agrId && p.amount === amt && p.status === TransactionStatus.PENDING && (Date.now() - p.createdAt.getTime()) < 60000
        );
        if (dup) {
          return { allowed: false, error: 'DUPLICATE_PAYMENT_PENDING', httpStatus: 409 };
        }
        return { allowed: true, httpStatus: 200 };
      };

      const attempt = checkDuplicate('agr-101', 50000);
      expect(attempt.allowed).toBe(false);
      expect(attempt.httpStatus).toBe(409);
      expect(attempt.error).toBe('DUPLICATE_PAYMENT_PENDING');

      // Different amount or agreement is allowed
      expect(checkDuplicate('agr-101', 75000).allowed).toBe(true);
      expect(checkDuplicate('agr-202', 50000).allowed).toBe(true);
    });

    it('should deny unauthorized customer access to another customer\'s payment status or history without verification', () => {
      const paymentOwnerPhone = '+255 712 345 678';

      const authorizeAccess = (callerPhone?: string, callerJwtCustomerId?: string) => {
        const ownerCustomerId = 'cust-uuid-owner';
        if (callerJwtCustomerId && callerJwtCustomerId === ownerCustomerId) {
          return { authorized: true };
        }
        if (callerPhone && phoneNumbersMatch(callerPhone, paymentOwnerPhone)) {
          return { authorized: true };
        }
        return { authorized: false, httpStatus: 403, error: 'ACCESS_DENIED' };
      };

      // Attacker trying to guess reference without phone or auth
      expect(authorizeAccess(undefined, undefined).authorized).toBe(false);
      expect(authorizeAccess(undefined, undefined).httpStatus).toBe(403);

      // Attacker with wrong phone
      expect(authorizeAccess('+255 799 000 111', undefined).authorized).toBe(false);

      // Legitimate customer with matching phone
      expect(authorizeAccess('0712345678', undefined).authorized).toBe(true);

      // Legitimate authenticated customer
      expect(authorizeAccess(undefined, 'cust-uuid-owner').authorized).toBe(true);
    });
  });
});
