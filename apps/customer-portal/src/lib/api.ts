// HatLock Customer Portal — Centralized API Client

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://api.luxeenet.com' : 'http://localhost:3000');

export function getCustomerAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('hatlock_customer_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CustomerAgreement {
  id: string;
  type: 'HIRE_PURCHASE' | 'RENTAL';
  agreementNumber: string;
  device: string;
  serialNumber: string;
  deviceId?: string | null;
  isLocked: boolean;
  lockState: string;
  status: string;
  totalAmountTZS: number;
  paidAmountTZS: number;
  outstandingBalanceTZS: number;
  nextDueDateStr: string;
  nextInstalmentTZS: number;
  ownershipNote: string;
}

export interface CustomerPaymentRecord {
  reference: string;
  amountTZS: number;
  date: string;
  status: 'SUCCESS' | 'PENDING';
  provider: string;
  paymentMethod: string;
}

export interface CustomerPortalData {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    businessName?: string;
  };
  agreements: CustomerAgreement[];
  payments: CustomerPaymentRecord[];
}

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
}

export interface TransactionStatusResponse {
  payment: {
    id: string;
    transactionReference: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
    amountTZS: number;
    currency: string;
    paymentProvider: string;
    createdAt: string;
    failReason?: string;
  };
}

export const customerApi = {
  /**
   * Request OTP verification code to registered mobile phone
   */
  async requestOtp(phone: string): Promise<{ success: boolean; message: string; phone: string; devOtp?: string }> {
    const res = await fetch(`${API_BASE}/api/v1/portal/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to send verification code');
    }
    return data;
  },

  /**
   * Verify OTP and receive authenticated customer token
   */
  async verifyOtp(phone: string, code: string): Promise<{ accessToken: string; customer: any }> {
    const res = await fetch(`${API_BASE}/api/v1/portal/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Verification code failed');
    }

    if (data.accessToken) {
      localStorage.setItem('hatlock_customer_token', data.accessToken);
    }
    if (data.customer) {
      localStorage.setItem('hatlock_customer_profile', JSON.stringify(data.customer));
    }
    return data;
  },

  /**
   * Fetch authenticated customer's real agreements, balances, device status, and payments
   */
  async getPortalData(): Promise<CustomerPortalData> {
    const res = await fetch(`${API_BASE}/api/v1/portal/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader()
      }
    });

    if (res.status === 401) {
      localStorage.removeItem('hatlock_customer_token');
      localStorage.removeItem('hatlock_customer_profile');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
      throw new Error('Customer session expired');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to load customer profile');
    }
    return data;
  },

  /**
   * Initiate mobile money payment push for an agreement
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResponse> {
    const res = await fetch(`${API_BASE}/api/v1/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader()
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
  async checkPaymentStatus(reference: string, phone?: string): Promise<TransactionStatusResponse> {
    const url = new URL(`${API_BASE}/api/v1/payments/status/${encodeURIComponent(reference)}`);
    if (phone) url.searchParams.set('phone', phone);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader()
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
  async getPaymentHistory(agreementId: string, phone?: string): Promise<any[]> {
    const url = new URL(`${API_BASE}/api/v1/payments/history/${encodeURIComponent(agreementId)}`);
    if (phone) url.searchParams.set('phone', phone);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader()
      }
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json().catch(() => ({ payments: [] }));
    return data.payments || [];
  },

  /**
   * Logout customer session
   */
  logout() {
    localStorage.removeItem('hatlock_customer_token');
    localStorage.removeItem('hatlock_customer_profile');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
};
