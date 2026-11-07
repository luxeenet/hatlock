// @hatlock/shared - Central shared types, validation schemas, and constants
// HatLock by Luxeenet

import { z } from 'zod';

export const USER_ROLES = [
  'SUPER_ADMIN',
  'BUSINESS_OWNER',
  'BUSINESS_ADMIN',
  'BUSINESS_EMPLOYEE',
  'CUSTOMER'
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEVICE_STATUSES = [
  'PENDING_ENROLLMENT',
  'AVAILABLE',
  'ACTIVE',
  'PAYMENT_DUE',
  'GRACE_PERIOD',
  'RESTRICTED',
  'PAYMENT_VERIFICATION',
  'UNLOCK_PENDING',
  'RETURN_PENDING',
  'RECOVERY_REQUIRED',
  'RETURNED',
  'INSPECTION_REQUIRED',
  'MAINTENANCE',
  'OWNERSHIP_TRANSFER_PENDING',
  'CUSTOMER_OWNED',
  'RETIRED'
] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const HIRE_PURCHASE_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'PAYMENT_DUE',
  'OVERDUE',
  'GRACE_PERIOD',
  'RESTRICTED',
  'PAYMENT_VERIFICATION',
  'UNLOCK_PENDING',
  'EARLY_SETTLEMENT_PENDING',
  'SETTLEMENT_PENDING',
  'COMPLETED',
  'OWNERSHIP_TRANSFER_PENDING',
  'OWNERSHIP_TRANSFERRED',
  'DEFAULTED',
  'TERMINATED',
  'CANCELLED'
] as const;

export type HirePurchaseStatus = (typeof HIRE_PURCHASE_STATUSES)[number];

export const RENTAL_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'PAYMENT_DUE',
  'OVERDUE',
  'GRACE_PERIOD',
  'RESTRICTED',
  'PAYMENT_VERIFICATION',
  'UNLOCK_PENDING',
  'RENEWAL_PENDING',
  'RENEWED',
  'RETURN_PENDING',
  'DEVICE_RETURNED',
  'INSPECTION_PENDING',
  'COMPLETED',
  'DEFAULTED',
  'TERMINATED',
  'CANCELLED'
] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const COMMAND_TYPES = [
  'RESTRICT_DEVICE',
  'RESTORE_DEVICE',
  'DEVICE_PING',
  'DEVICE_INVENTORY',
  'DEVICE_DIAGNOSTICS',
  'UPDATE_POLICY',
  'RESTART_AGENT',
  'RECOVERY_TOKEN'
] as const;

export type CommandType = (typeof COMMAND_TYPES)[number];

export const COMMAND_STATUSES = [
  'PENDING',
  'DISPATCHED',
  'ACKNOWLEDGED',
  'EXECUTED',
  'FAILED',
  'EXPIRED',
  'REVOKED'
] as const;

export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const SUBSCRIPTION_PLANS = {
  STARTER: {
    id: 'STARTER',
    name: 'Starter Plan',
    maxDevices: 25,
    priceMonthly: 49,
    features: ['basic_monitoring', 'automated_lock', 'email_alerts']
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business Pro',
    maxDevices: 250,
    priceMonthly: 149,
    features: ['basic_monitoring', 'automated_lock', 'email_alerts', 'sms_alerts', 'tpm_attestation', 'multi_branch']
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise Scale',
    maxDevices: 10000,
    priceMonthly: 499,
    features: ['all_features', 'dedicated_ip', 'custom_sla', 'audit_export', 'custom_integrations']
  }
} as const;

export const HardwareIdentitySchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required'),
  systemUuid: z.string().min(1, 'System UUID is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  model: z.string().min(1, 'Model is required'),
  motherboardSerial: z.string().optional(),
  tpmPresent: z.boolean().default(false),
  tpmVersion: z.string().optional(),
  secureBootEnabled: z.boolean().default(false),
  osType: z.enum(['WINDOWS', 'LINUX']),
  osVersion: z.string(),
  agentVersion: z.string(),
  cpuId: z.string().optional(),
  macAddresses: z.array(z.string()).default([])
});

export type HardwareIdentityDto = z.infer<typeof HardwareIdentitySchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().length(6).optional()
});

export const RegisterBusinessSchema = z.object({
  businessName: z.string().min(2),
  registrationNumber: z.string().min(2),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7),
  country: z.string().default('KE'),
  currency: z.string().default('KES'),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  adminPassword: z.string().min(8)
});

export const CustomerCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  idNumber: z.string().min(4),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().optional(),
  notes: z.string().optional()
});

export const DeviceCreateSchema = z.object({
  branchId: z.string().uuid().optional(),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  purchasePrice: z.number().positive().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  condition: z.string().default('EXCELLENT'),
  notes: z.string().optional()
});
