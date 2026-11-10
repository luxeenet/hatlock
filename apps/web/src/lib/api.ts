// HatLock API Client
// Standardized client connecting Next.js frontend with Fastify backend

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.luxeenet.com' : 'http://localhost:3000');

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('hatlock_token');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const storedUser = localStorage.getItem('hatlock_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed.businessId) {
        headers['x-business-id'] = parsed.businessId;
      }
    }
  } catch {}

  return headers;
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
    if (response.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      localStorage.removeItem('hatlock_token');
      localStorage.removeItem('hatlock_refresh_token');
      localStorage.removeItem('hatlock_user');
      window.location.href = '/login?expired=1';
    }

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
  update: (id: string, data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    idNumber: string;
    address: string;
    city: string;
    notes: string;
  }>) => request<{ customer: Customer }>(`/customers/${id}`, {
    method: 'PATCH',
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
  deviceType?: 'LAPTOP' | 'DESKTOP' | 'SMARTPHONE' | 'TABLET' | 'OTHER';
  currentOS: 'WINDOWS' | 'LINUX' | 'ANDROID' | 'IOS' | 'MACOS' | 'IPADOS' | 'UNKNOWN';
  platform?: string;
  complianceStatus?: string;
  confidenceScore?: number;
  enrollmentType?: string;
  status: 'AVAILABLE' | 'ACTIVE' | 'RESTRICTED' | 'GRACE_PERIOD' | 'CUSTOMER_OWNED' | 'MAINTENANCE' | 'PAYMENT_DUE' | 'RETURN_PENDING' | 'RETIRED';
  condition: string;
  purchasePrice?: number;
  notes?: string;
  createdAt: string;
  branch?: { id: string; name: string };
  identity?: {
    tpmPresent?: boolean;
    secureBoot?: boolean;
    imei1?: string;
    imei2?: string;
    playIntegrityVerdict?: string;
    encryptionStatus?: string;
  };
  agentInfo?: {
    agentVersion?: string;
    lastSeenAt?: string;
    isOnline?: boolean;
  };
  restrictions?: Array<{ id: string; isActive: boolean; reason: string }>;
  financingAgreements?: Array<{
    id?: string;
    agreementNumber: string;
    remainingBalanceTZS?: number;
    customer: { id: string; firstName: string; lastName: string; phone?: string };
  }>;
  rentalAgreements?: Array<{
    id?: string;
    agreementNumber: string;
    customer: { id: string; firstName: string; lastName: string; phone?: string };
  }>;
}

export const apiDevices = {
  list: (params?: {
    status?: string;
    search?: string;
    manufacturer?: string;
    platform?: string;
    os?: string;
    complianceStatus?: string;
    deviceType?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.manufacturer && params.manufacturer !== 'ALL') query.set('manufacturer', params.manufacturer);
    if (params?.platform && params.platform !== 'ALL') query.set('platform', params.platform);
    if (params?.os && params.os !== 'ALL') query.set('os', params.os);
    if (params?.complianceStatus && params.complianceStatus !== 'ALL') query.set('complianceStatus', params.complianceStatus);
    if (params?.deviceType && params.deviceType !== 'ALL') query.set('deviceType', params.deviceType);
    return request<{ devices: Device[] }>(`/devices?${query.toString()}`);
  },
  get: (id: string) => request<{ device: Device }>(`/devices/${id}`),
  create: (data: {
    serialNumber: string;
    manufacturer: string;
    model: string;
    purchasePrice?: number;
    condition?: string;
    deviceType?: string;
    operatingSystem?: string;
    notes?: string;
  }) => request<{ device: Device }>('/devices', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendCommand: (deviceId: string, data: { action: 'RESTRICT' | 'RESTORE'; reason: string; lockScreenMessage?: string }) =>
    request<{ commandId: string; action: string; status: string }>(`/devices/${deviceId}/command`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: Partial<{
    notes: string;
    condition: string;
    purchasePrice: number;
    model: string;
    branchId: string;
    status: string;
  }>) => request<{ device: Device }>(`/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<{ message: string }>(`/devices/${id}`, {
    method: 'DELETE'
  })
};

// ----------------------------------------------------------------------------
// Dashboard Analytics
// ----------------------------------------------------------------------------
export interface DashboardKPIs {
  totalDevices: number;
  availableDevices: number;
  activeFinancingCount: number;
  activeRentalCount: number;
  restrictedDevices: number;
  gracePeriodDevices: number;
  customerOwnedDevices: number;
  totalCustomers: number;
  totalRevenueTZS: number;
  pendingCommandsCount: number;
  osDistribution: {
    windows: number;
    linux: number;
    other: number;
  };
  hardwareSecurity: {
    tpmSecured: number;
    standard: number;
  };
}

export const apiDashboard = {
  getMetrics: () => request<{ kpis: DashboardKPIs }>('/dashboard/metrics')
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
  get: (id: string) => request<{ agreement: any }>(`/financing/${id}`),
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
  get: (id: string) => request<{ rental: any }>(`/rentals/${id}`),
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
// Payments (HatPesa & SonicPesa)
// ----------------------------------------------------------------------------
export interface PaymentProviderInfo {
  provider: 'HATPESA' | 'SONICPESA';
  name: string;
  isEnabled: boolean;
  isTestMode: boolean;
  configured: boolean;
  maskedApiKey?: string | null;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
}

export interface PaymentTransaction {
  id: string;
  businessId: string;
  customerId: string;
  financingAgreementId?: string;
  rentalAgreementId?: string;
  amountTZS: number;
  currency: string;
  paymentProvider?: string;
  method: string;
  reference: string;
  externalTransactionId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  createdAt: string;
  financingAgreement?: { id: string; agreementNumber: string };
  rentalAgreement?: { id: string; agreementNumber: string };
}

export const apiPayments = {
  list: (params?: { customerId?: string; status?: string; provider?: string }) => {
    const query = new URLSearchParams();
    if (params?.customerId) query.set('customerId', params.customerId);
    if (params?.status) query.set('status', params.status);
    if (params?.provider) query.set('provider', params.provider);
    return request<{ payments: PaymentTransaction[] }>(`/payments?${query.toString()}`);
  },
  initiate: (data: {
    agreementType: 'HIRE_PURCHASE' | 'RENTAL';
    agreementId: string;
    amount: number;
    phoneNumber: string;
    provider?: 'HATPESA' | 'SONICPESA';
    paymentMethod?: string;
  }) => request<{ transactionId: string; reference: string; status: string; order_id?: string; provider?: string }>('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getProviders: () => request<{ providers: PaymentProviderInfo[] }>('/payments/providers'),
  configureProvider: (provider: string, data: { isEnabled?: boolean; isTestMode?: boolean; apiKey?: string; apiSecret?: string; webhookSecret?: string }) =>
    request<{ message: string; provider: string }>(`/payments/providers/${provider}/configure`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  testProvider: (provider: string) =>
    request<{ connected: boolean; message: string }>(`/payments/providers/${provider}/test`, {
      method: 'POST'
    }),
  createPayout: (data: { amount: number; recipientPhone: string; recipientName: string; transactionPin: string; remarks?: string }) =>
    request<{ status: string; payoutId: string; gateway?: any }>('/payments/payouts/create', {
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
// MDM & Provisioning
// ----------------------------------------------------------------------------
export interface AndroidProvisioningProfile {
  deviceId: string;
  format: string;
  qrJson: Record<string, any>;
  qrDataUrl?: string;
  qrImageUrl?: string;
  cameraEnrollUrl?: string;
  cameraQrDataUrl?: string;
  cameraQrImageUrl?: string;
  packageDownloadUrl?: string;
}

export const apiMdm = {
  getAndroidProvisioningProfile: (deviceId: string) =>
    request<AndroidProvisioningProfile>(`/mdm/android/provisioning-profile/${deviceId}`),
  enrollAndroidDevice: (data: { deviceId: string; serialNumber: string; manufacturer: string; model: string }) =>
    request<{ status: string; deviceId: string; protectionLevel?: string }>(`/mdm/android/enroll`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        osVersion: '14.0',
        agentVersion: '1.0.0',
        hardwareKeystoreSupported: true,
        screenLockActive: true
      })
    })
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
