// HatPesa Payment Gateway Integration Adapter
// HatLock by Luxeenet
//
// IMPORTANT: This adapter implements the real HatPesa integration interface.
// If HatPesa credentials are unavailable, calls will fail — this is intentional.
// Do NOT simulate successful production payments.
//
// Configuration required:
//   HATPESA_BASE_URL=https://api.hatpesa.com
//   HATPESA_API_KEY=<your-api-key>
//   HATPESA_WEBHOOK_SECRET=<your-webhook-secret>
//   HATPESA_TEST_MODE=true|false

import * as crypto from 'crypto';

export interface HatPesaConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
  testMode: boolean;
}

export interface CreateCheckoutInput {
  amount: number;           // In TZS (smallest unit if applicable)
  currency: string;         // 'TZS'
  reference: string;        // Internal transaction reference (idempotency key)
  description: string;
  customerPhone: string;
  customerEmail?: string;
  callbackUrl: string;      // Server-to-server callback URL
  returnUrl?: string;       // Browser redirect after payment
  metadata?: Record<string, string>;
}

export interface CheckoutResponse {
  checkoutId: string;
  checkoutUrl: string;
  reference: string;
  status: 'pending' | 'created';
  expiresAt: string;
}

export interface PaymentVerificationResult {
  reference: string;
  providerReference: string;
  status: 'completed' | 'failed' | 'pending' | 'reversed';
  amount: number;
  currency: string;
  paymentMethod: string;
  paidAt?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookPayload {
  event: 'payment.completed' | 'payment.failed' | 'payment.reversed';
  reference: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class HatPesaClient {
  private config: HatPesaConfig;

  constructor(config: HatPesaConfig) {
    this.config = config;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-HatPesa-Mode': this.config.testMode ? 'test' : 'live',
      'User-Agent': 'HatLock/1.0.0'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: Record<string, unknown> = {};
      try { errorJson = JSON.parse(errorText); } catch { /* ignore */ }

      const error = new Error(
        `HatPesa API error: ${response.status} ${response.statusText} — ${(errorJson as any).message ?? errorText}`
      );
      (error as any).statusCode = response.status;
      (error as any).hatpesaError = errorJson;
      throw error;
    }

    return response.json() as Promise<T>;
  }

  // ─── Create Payment Checkout ────────────────────────────────────────────────

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResponse> {
    // Validate API key is configured
    if (!this.config.apiKey) {
      throw new Error(
        'HatPesa API key not configured. Set HATPESA_API_KEY environment variable. ' +
        'Contact HatPesa to obtain credentials.'
      );
    }

    return this.request<CheckoutResponse>('POST', '/v1/checkouts', {
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      description: input.description,
      customer: {
        phone: input.customerPhone,
        email: input.customerEmail
      },
      callbackUrl: input.callbackUrl,
      returnUrl: input.returnUrl,
      metadata: input.metadata,
      testMode: this.config.testMode
    });
  }

  // ─── Verify Payment (Server-to-Server) ─────────────────────────────────────
  // CRITICAL: Never trust customer-submitted payment confirmations.
  // Always verify directly with HatPesa server-to-server.

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    if (!this.config.apiKey) {
      throw new Error('HatPesa API key not configured');
    }

    return this.request<PaymentVerificationResult>('GET', `/v1/payments/${encodeURIComponent(reference)}`);
  }

  // ─── Verify Webhook Signature ───────────────────────────────────────────────
  // Must be called before processing any webhook payload

  verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
    if (!this.config.webhookSecret) {
      console.error('[HatPesa] Webhook secret not configured — rejecting all webhooks');
      return false;
    }

    // HatPesa uses HMAC-SHA256: signature = HMAC(secret, timestamp + '.' + body)
    const signedContent = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(signedContent)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  // ─── Check Timestamp to Prevent Replay Attacks ─────────────────────────────

  isTimestampFresh(timestamp: string, toleranceSeconds = 300): boolean {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return false;
    const now = Math.floor(Date.now() / 1000);
    return Math.abs(now - ts) <= toleranceSeconds;
  }

  // ─── Get Payment History ────────────────────────────────────────────────────

  async getPayments(params: {
    reference?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ payments: PaymentVerificationResult[]; total: number; page: number }> {
    const query = new URLSearchParams();
    if (params.reference) query.set('reference', params.reference);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', (params.limit ?? 50).toString());

    return this.request(`GET`, `/v1/payments?${query.toString()}`);
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _client: HatPesaClient | null = null;

export function getHatPesaClient(config?: HatPesaConfig): HatPesaClient {
  if (!_client && config) {
    _client = new HatPesaClient(config);
  }
  if (!_client) {
    throw new Error('HatPesa client not initialized. Call getHatPesaClient(config) first.');
  }
  return _client;
}

export function initHatPesa(config: HatPesaConfig): HatPesaClient {
  _client = new HatPesaClient(config);
  return _client;
}
