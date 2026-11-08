// HatLock Customer Portal — Centralized API Client

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://api.luxeenet.com' : 'http://localhost:3000');

export interface InitiatePaymentParams {
  agreementType: 'HIRE_PURCHASE' | 'RENTAL';
  agreementId: string;
  amount: number;
  phoneNumber: string;
  provider: 'HATPESA' | 'SONICPESA';
}

export interface InitiatePaymentResponse {
  status: string;
  provider: string;
  reference: string;
  order_id?: string;
  payment: {
    id: string;
    transactionReference: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    amountTZS: number;
    currency: string;
    paymentProvider: string;
    createdAt: string;
  };
  gateway?: any;
  simulated?: boolean;
}

export interface TransactionStatusResponse {
  payment: {
    id: string;
    transactionReference: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
    amountTZS: number;
    currency: string;
    paymentProvider: string;
    paidAt?: string;
    createdAt: string;
    failReason?: string;
  };
}

export const customerApi = {
  /**
   * Initiate mobile money payment push for an agreement
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResponse> {
    const res = await fetch(`${API_BASE}/api/v1/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.message || data.error || `Payment initiation failed (${res.status})`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Check real status of payment transaction from backend
   */
  async checkPaymentStatus(reference: string): Promise<TransactionStatusResponse> {
    const res = await fetch(`${API_BASE}/api/v1/payments/status/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to check transaction status');
    }

    return data;
  },

  /**
   * Fetch verified payment history for an agreement
   */
  async getPaymentHistory(agreementId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/api/v1/payments/history/${encodeURIComponent(agreementId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json().catch(() => ({ payments: [] }));
    return data.payments || [];
  }
};
