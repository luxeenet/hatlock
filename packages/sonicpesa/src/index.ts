// SonicPesa Payment Gateway Integration Adapter
// HatLock by Luxeenet
//
// SonicPesa Documentation: https://sonicpesa.com/docs
// Base Endpoint: https://api.sonicpesa.com/api/v1
// Authentication: X-API-KEY and X-API-SECRET headers

import * as crypto from 'crypto';

export interface SonicPesaConfig {
  baseUrl?: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret?: string;
  testMode?: boolean;
}

export interface SonicPesaCreateOrderInput {
  buyer_email: string;
  buyer_name: string;
  buyer_phone: string;
  amount: number;
  currency: 'TZS';
  metadata?: Record<string, unknown>;
}

export interface SonicPesaCreateOrderResponse {
  status: string;
  message?: string;
  order_id: string;
  payment_url?: string;
  amount?: number;
  currency?: string;
}

export type SonicPesaPaymentStatus = 'SUCCESS' | 'PENDING' | 'CANCELLED' | 'REJECTED';

export interface SonicPesaOrderStatusResponse {
  status: string;
  order_id: string;
  payment_status: SonicPesaPaymentStatus;
  amount: number;
  currency: string;
  transaction_id?: string;
  channel?: string;
  timestamp?: string | number;
}

export interface SonicPesaTransactionResponse {
  status: string;
  transaction_id: string;
  order_id: string;
  payment_status: SonicPesaPaymentStatus;
  amount: number;
  currency: string;
  channel?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface SonicPesaPayoutInput {
  amount: number;
  currency: 'TZS';
  recipient_phone: string;
  recipient_name: string;
  remarks?: string;
}

export interface SonicPesaPayoutResponse {
  status: string;
  payout_id: string;
  reference?: string;
  amount: number;
  currency: string;
  recipient_phone: string;
}

export class SonicPesaClient {
  private config: Required<Pick<SonicPesaConfig, 'apiKey' | 'apiSecret'>> & SonicPesaConfig;

  constructor(config: SonicPesaConfig) {
    this.config = {
      baseUrl: config.baseUrl || 'https://api.sonicpesa.com/api/v1',
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      webhookSecret: config.webhookSecret || config.apiSecret,
      testMode: config.testMode ?? false
    };
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('SonicPesa credentials not configured. Please set SONICPESA_API_KEY and SONICPESA_API_SECRET.');
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.config.baseUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-KEY': this.config.apiKey,
      'X-API-SECRET': this.config.apiSecret,
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
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // raw string
      }

      const error = new Error(
        `SonicPesa API error: ${response.status} ${response.statusText} — ${(errorJson as any).message ?? errorText}`
      );
      (error as any).statusCode = response.status;
      (error as any).sonicPesaError = errorJson;
      throw error;
    }

    return response.json() as Promise<T>;
  }

  // 9.1 Create Payment Order
  async createOrder(input: SonicPesaCreateOrderInput): Promise<SonicPesaCreateOrderResponse> {
    return this.request<SonicPesaCreateOrderResponse>('POST', '/payment/create_order', {
      buyer_email: input.buyer_email,
      buyer_name: input.buyer_name,
      buyer_phone: input.buyer_phone,
      amount: input.amount,
      currency: input.currency
    });
  }

  // 9.2 Check Payment Status
  async checkOrderStatus(orderId: string): Promise<SonicPesaOrderStatusResponse> {
    return this.request<SonicPesaOrderStatusResponse>('POST', '/payment/order_status', {
      order_id: orderId
    });
  }

  // 9.3 Verify Webhook Signature (HMAC-SHA256, constant-time)
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.webhookSecret || this.config.apiSecret;
    if (!secret || !signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature.toLowerCase(), 'hex'),
        Buffer.from(expectedSignature.toLowerCase(), 'hex')
      );
    } catch {
      return false;
    }
  }

  // 9.4 Read Transaction by ID
  async readTransactionById(id: string): Promise<SonicPesaTransactionResponse> {
    return this.request<SonicPesaTransactionResponse>('POST', '/transactions/readbyId', {
      order_id: id,
      transaction_id: id
    });
  }

  // 9.5 Create Authorized Payout
  async createPayout(input: SonicPesaPayoutInput): Promise<SonicPesaPayoutResponse> {
    return this.request<SonicPesaPayoutResponse>('POST', '/payouts/create', {
      amount: input.amount,
      currency: input.currency,
      recipient_phone: input.recipient_phone,
      recipient_name: input.recipient_name,
      remarks: input.remarks || 'HatLock Payout'
    });
  }

  // Connectivity Test
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      // Testing with order_status check or ping endpoint
      await this.checkOrderStatus('test_connectivity_probe').catch((err) => {
        // If it returns 404 or order not found, API authentication worked!
        if (err.statusCode === 400 || err.statusCode === 404) {
          return true;
        }
        throw err;
      });
      return { connected: true, message: 'SonicPesa API authenticated successfully' };
    } catch (err: any) {
      return { connected: false, message: err.message || 'Connection failed' };
    }
  }
}

// ----------------------------------------------------------------------------
// Client Factory / Singleton
// ----------------------------------------------------------------------------
let _sonicClient: SonicPesaClient | null = null;

export function getSonicPesaClient(config?: SonicPesaConfig): SonicPesaClient {
  if (!_sonicClient && config) {
    _sonicClient = new SonicPesaClient(config);
  }
  if (!_sonicClient) {
    throw new Error('SonicPesa client not initialized. Call initSonicPesa(config) first.');
  }
  return _sonicClient;
}

export function initSonicPesa(config: SonicPesaConfig): SonicPesaClient {
  _sonicClient = new SonicPesaClient(config);
  return _sonicClient;
}
