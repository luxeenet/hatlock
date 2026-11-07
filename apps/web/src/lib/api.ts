// HatLock API Client
// Standardized client connecting Next.js frontend with Fastify backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('hatlock_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}/api/v1${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.message || errorJson.error || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  // Check if response is empty or binary (PDF)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    const blob = await response.blob();
    return blob as unknown as T;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// Customers
// ----------------------------------------------------------------------------
export interface Customer {
  id: string;
  businessId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  address?: string;
  city?: string;
  country: string;
  notes?: string;
  createdAt: string;
  _count?: {
    financingAgreements: number;
    rentalAgreements: number;
  };
}

export const apiCustomers = {
  list: () => request<{ customers: Customer[] }>('/customers'),
  get: (id: string) => request<{ customer: Customer & any }>(`/customers/${id}`),
  create: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    idNumber: string;
    address?: string;
    city?: string;
    country?: string;
    notes?: string;
  }) => request<{ customer: Customer }>('/customers', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<{ message: string }>(`/customers/${id}`, {
    method: 'DELETE'
  })
};

// ----------------------------------------------------------------------------
// Devices
// ----------------------------------------------------------------------------
export interface Device {
  id: string;
  businessId: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  currentOS: 'WINDOWS' | 'LINUX' | 'UNKNOWN';
  status: 'AVAILABLE' | 'ACTIVE' | 'RESTRICTED' | 'GRACE_PERIOD' | 'CUSTOMER_OWNED' | 'MAINTENANCE';
  condition: string;
  purchasePrice?: number;
  notes?: string;
  createdAt: string;
  branch?: { id: string; name: string };
  identity?: { tpmPresent: boolean };
  financingAgreements?: Array<{
    agreementNumber: string;
    customer: { id: string; firstName: string; lastName: string };
  }>;
  rentalAgreements?: Array<{
    agreementNumber: string;
    customer: { id: string; firstName: string; lastName: string };
  }>;
}

export const apiDevices = {
  list: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return request<{ devices: Device[] }>(`/devices?${query.toString()}`);
  },
  get: (id: string) => request<{ device: Device }>(`/devices/${id}`),
  create: (data: {
    serialNumber: string;
    manufacturer: string;
    model: string;
    purchasePrice?: number;
    condition?: string;
    notes?: string;
  }) => request<{ device: Device }>('/devices', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendCommand: (deviceId: string, data: { action: 'RESTRICT' | 'RESTORE'; reason: string; lockScreenMessage?: string }) =>
    request<{ commandId: string; action: string; status: string }>(`/devices/${deviceId}/command`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// ----------------------------------------------------------------------------
// Financing (Hire Purchase)
// ----------------------------------------------------------------------------
export interface FinancingAgreement {
  id: string;
  agreementNumber: string;
  businessId: string;
  customerId: string;
  deviceId: string;
  totalAmountTZS: number;
  downPaymentTZS: number;
  remainingBalanceTZS: number;
  paymentFrequency: string;
  instalmentCount: number;
  paidInstalmentCount: number;
  status: 'DRAFT' | 'ACTIVE' | 'OVERDUE' | 'GRACE_PERIOD' | 'RESTRICTED' | 'OWNERSHIP_TRANSFERRED' | 'COMPLETED';
  startDate: string;
  customer?: { id: string; firstName: string; lastName: string; email: string; phone: string };
  device?: { id: string; serialNumber: string; manufacturer: string; model: string; status: string };
  _count?: { instalments: number; transactions: number };
}

export const apiFinancing = {
  list: (params?: { status?: string; customerId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.customerId) query.set('customerId', params.customerId);
    return request<{ agreements: FinancingAgreement[] }>(`/financing?${query.toString()}`);
  },
  create: (data: {
    customerId: string;
    deviceId: string;
    totalAmountTZS: number;
    downPaymentTZS?: number;
    paymentFrequency: string;
    instalmentCount: number;
    startDate: string;
    gracePeriodDays?: number;
  }) => request<{ agreement: FinancingAgreement }>('/financing', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getCertificate: (id: string) => request<Blob>(`/financing/${id}/certificate`)
};

// ----------------------------------------------------------------------------
// Rentals
// ----------------------------------------------------------------------------
export interface RentalAgreement {
  id: string;
  agreementNumber: string;
  businessId: string;
  customerId: string;
  deviceId: string;
  rentalPriceTZS?: number | string;
  rentalRatePerPeriodTZS?: number;
  paymentFrequency: string;
  durationPeriods?: number;
  totalExpectedTZS?: number | string;
  securityDepositTZS?: number | string;
  securityDepositRefunded?: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'RETURN_PENDING' | 'OVERDUE' | 'RESTRICTED' | 'COMPLETED';
  startDate: string;
  endDate?: string;
  customer?: { id: string; firstName: string; lastName: string; email: string; phone: string };
  device?: { id: string; serialNumber: string; manufacturer: string; model: string; status: string };
  _count?: { rentalCharges: number; transactions: number };
}

export const apiRentals = {
  list: (params?: { status?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    return request<{ rentals: RentalAgreement[] }>(`/rentals?${query.toString()}`);
  },
  create: (data: {
    customerId: string;
    deviceId: string;
    rentalRatePerPeriodTZS: number;
    paymentFrequency: string;
    durationPeriods: number;
    startDate: string;
    securityDepositTZS?: number;
    notes?: string;
  }) => request<{ rental: RentalAgreement }>('/rentals', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

// ----------------------------------------------------------------------------
// Payments (HatPesa)
// ----------------------------------------------------------------------------
export interface PaymentTransaction {
  id: string;
  businessId: string;
  customerId: string;
  financingAgreementId?: string;
  rentalAgreementId?: string;
  amountTZS: number;
  currency: string;
  method: string;
  reference: string;
  externalTransactionId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  createdAt: string;
  financingAgreement?: { id: string; agreementNumber: string };
  rentalAgreement?: { id: string; agreementNumber: string };
}

export const apiPayments = {
  list: (params?: { customerId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.customerId) query.set('customerId', params.customerId);
    if (params?.status) query.set('status', params.status);
    return request<{ payments: PaymentTransaction[] }>(`/payments?${query.toString()}`);
  },
  initiate: (data: {
    agreementType: 'HIRE_PURCHASE' | 'RENTAL';
    agreementId: string;
    amount: number;
    phoneNumber: string;
    paymentMethod?: string;
  }) => request<{ transactionId: string; reference: string; status: string }>('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

// ----------------------------------------------------------------------------
// Device Returns & Inspection
// ----------------------------------------------------------------------------
export interface DeviceReturn {
  id: string;
  businessId: string;
  deviceId: string;
  customerId: string;
  rentalAgreementId?: string;
  status: 'REQUESTED' | 'RECEIVED' | 'INSPECTING' | 'COMPLETED' | 'CANCELLED';
  requestedAt: string;
  completedAt?: string;
  device?: Device;
  customer?: Customer;
  inspection?: {
    result: string;
    conditionRating: string;
    repairCostEstimateTZS: number;
    refundSecurityDepositTZS: number;
  };
}

export const apiReturns = {
  list: () => request<{ returns: DeviceReturn[] }>('/returns'),
  create: (data: {
    agreementId: string;
    deviceId: string;
    reason?: string;
    conditionNotes?: string;
  }) => request<{ returnRequest: DeviceReturn }>('/returns', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  inspect: (returnId: string, data: {
    result: string;
    conditionRating: string;
    damageNotes?: string;
    repairCostEstimateTZS: number;
    refundSecurityDepositTZS: number;
  }) => request<{ inspection: any; returnRequest: DeviceReturn }>(`/returns/${returnId}/inspect`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

// ----------------------------------------------------------------------------
// Super Admin Console
// ----------------------------------------------------------------------------
export interface TenantBusiness {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  createdAt: string;
  subscription?: {
    status: string;
    plan?: { name: string; maxDevices: number };
  };
  _count?: {
    devices: number;
    employees: number;
    customers: number;
  };
}

export const apiSuperAdmin = {
  overview: () => request<{
    platform: {
      totalBusinesses: number;
      activeBusinesses: number;
      totalDevicesGlobal: number;
      totalAgreementsGlobal: number;
      globalGrossVolumeTZS: number;
    };
  }>('/super-admin/overview'),
  listBusinesses: () => request<{ businesses: TenantBusiness[] }>('/super-admin/businesses'),
  updateStatus: (businessId: string, status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED') =>
    request<{ business: TenantBusiness }>(`/super-admin/businesses/${businessId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
  updateQuota: (businessId: string, deviceLimit: number) =>
    request<{ status: string; deviceLimit: number }>(`/super-admin/businesses/${businessId}/quota`, {
      method: 'PATCH',
      body: JSON.stringify({ deviceLimit })
    })
};

// ----------------------------------------------------------------------------
// Employees & Branches
// ----------------------------------------------------------------------------
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  branch?: { id: string; name: string };
  user?: { email: string; role: string; isActive: boolean };
}

export const apiEmployees = {
  list: () => request<{ employees: Employee[] }>('/employees'),
  create: (data: {
    email: string;
    firstName: string;
    lastName: string;
    position: string;
    phone?: string;
    branchId?: string;
    role?: string;
  }) => request<{ employee: Employee }>('/employees', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  createdAt: string;
  _count?: { devices: number; employees: number };
}

export const apiBranches = {
  list: () => request<{ branches: Branch[] }>('/branches'),
  create: (data: { name: string; address?: string; phone?: string }) =>
    request<{ branch: Branch }>('/branches', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// ----------------------------------------------------------------------------
// Audit Logs & Reports
// ----------------------------------------------------------------------------
export interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  actorRole: string;
  createdAt: string;
  actor?: { email: string };
}

export const apiAudit = {
  list: (params?: { limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ logs: AuditLogItem[] }>(`/audit?${query.toString()}`);
  }
};

export const apiReports = {
  getSummary: () => request<{ report: any }>('/reports/summary')
};

// ----------------------------------------------------------------------------
// Auth & Profile
// ----------------------------------------------------------------------------
export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
  employee?: {
    businessId: string;
    branchId?: string;
    firstName: string;
    lastName: string;
    position?: string;
    business?: { id: string; name: string; status: string };
  };
}

export const apiAuth = {
  getProfile: () => request<UserProfile>('/auth/me'),
  updateProfile: (data: { phone?: string; firstName?: string; lastName?: string; position?: string }) =>
    request<{ message: string }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};
