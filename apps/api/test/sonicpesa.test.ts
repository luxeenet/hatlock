import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { SonicPesaClient } from '@hatlock/sonicpesa';
import { SonicPesaCreateOrderSchema, SonicPesaPayoutSchema, SonicPesaWebhookPayloadSchema } from '@hatlock/shared';

describe('SonicPesa Payment Gateway Integration', () => {
  const mockConfig = {
    baseUrl: 'https://api.sonicpesa.com/api/v1',
    apiKey: 'sp_live_test_api_key_12345',
    apiSecret: 'sp_live_test_api_secret_67890',
    webhookSecret: 'sp_webhook_secret_key_abcde',
    testMode: true
  };

  const client = new SonicPesaClient(mockConfig);

  it('should initialize client with required credentials', () => {
    expect(client).toBeDefined();
  });

  it('should validate order creation schema strictly', () => {
    const validOrder = {
      buyer_email: 'customer@luxeenet.com',
      buyer_name: 'Juma Rashid',
      buyer_phone: '255712345678',
      amount: 150000,
      currency: 'TZS' as const
    };

    const parsed = SonicPesaCreateOrderSchema.safeParse(validOrder);
    expect(parsed.success).toBe(true);

    const invalidOrder = {
      buyer_email: 'invalid-email',
      buyer_name: '',
      buyer_phone: '123',
      amount: -50,
      currency: 'USD'
    };
    const invalidParsed = SonicPesaCreateOrderSchema.safeParse(invalidOrder);
    expect(invalidParsed.success).toBe(false);
  });

  it('should correctly verify valid HMAC-SHA256 webhook signatures using constant-time check', () => {
    const payload = JSON.stringify({
      order_id: 'sp_order_998877',
      amount: 150000,
      currency: 'TZS',
      status: 'SUCCESS',
      transaction_id: 'SP_TXN_554433',
      channel: 'MPESA'
    });

    const validSignature = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(payload)
      .digest('hex');

    const isValid = client.verifyWebhookSignature(payload, validSignature);
    expect(isValid).toBe(true);
  });

  it('should reject tampered or invalid webhook signatures', () => {
    const payload = JSON.stringify({
      order_id: 'sp_order_998877',
      amount: 150000,
      currency: 'TZS',
      status: 'SUCCESS'
    });

    const fakeSignature = crypto
      .createHmac('sha256', 'wrong_secret_key')
      .update(payload)
      .digest('hex');

    const isValid = client.verifyWebhookSignature(payload, fakeSignature);
    expect(isValid).toBe(false);

    // Tampered payload
    const tamperedPayload = JSON.stringify({
      order_id: 'sp_order_998877',
      amount: 500000, // attacker increased amount
      currency: 'TZS',
      status: 'SUCCESS'
    });
    const validSignatureOriginal = crypto
      .createHmac('sha256', mockConfig.webhookSecret)
      .update(payload)
      .digest('hex');

    const isTamperedValid = client.verifyWebhookSignature(tamperedPayload, validSignatureOriginal);
    expect(isTamperedValid).toBe(false);
  });

  it('should validate payout request schema and require authorization PIN', () => {
    const validPayout = {
      amount: 50000,
      currency: 'TZS' as const,
      recipient_phone: '255712345678',
      recipient_name: 'Hardware Supplier Ltd',
      transaction_pin: '2026',
      remarks: 'Batch payout'
    };

    const parsed = SonicPesaPayoutSchema.safeParse(validPayout);
    expect(parsed.success).toBe(true);

    const invalidPayout = {
      amount: -100,
      currency: 'USD',
      recipient_phone: '2',
      recipient_name: '',
      transaction_pin: ''
    };
    const invalidParsed = SonicPesaPayoutSchema.safeParse(invalidPayout);
    expect(invalidParsed.success).toBe(false);
  });

  it('should validate webhook status mapping to valid payment states', () => {
    const validPayload = {
      order_id: 'sp_67890abcdef',
      amount: 250000,
      currency: 'TZS',
      status: 'SUCCESS' as const,
      transaction_id: 'TXN_SP_001'
    };

    const parsed = SonicPesaWebhookPayloadSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(['SUCCESS', 'PENDING', 'CANCELLED', 'REJECTED']).toContain(parsed.data.status);
    }
  });
});

