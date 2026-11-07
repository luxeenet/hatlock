-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'BUSINESS_OWNER', 'BUSINESS_ADMIN', 'BUSINESS_EMPLOYEE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING_ENROLLMENT', 'AVAILABLE', 'ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED', 'PAYMENT_VERIFICATION', 'UNLOCK_PENDING', 'RETURN_PENDING', 'RECOVERY_REQUIRED', 'RETURNED', 'INSPECTION_REQUIRED', 'MAINTENANCE', 'OWNERSHIP_TRANSFER_PENDING', 'CUSTOMER_OWNED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DeviceOS" AS ENUM ('WINDOWS', 'LINUX', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProtectionLevel" AS ENUM ('STANDARD', 'ADVANCED', 'NONE');

-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('HIRE_PURCHASE', 'RENTAL');

-- CreateEnum
CREATE TYPE "HirePurchaseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAYMENT_DUE', 'OVERDUE', 'GRACE_PERIOD', 'RESTRICTED', 'PAYMENT_VERIFICATION', 'UNLOCK_PENDING', 'EARLY_SETTLEMENT_PENDING', 'SETTLEMENT_PENDING', 'COMPLETED', 'OWNERSHIP_TRANSFER_PENDING', 'OWNERSHIP_TRANSFERRED', 'DEFAULTED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAYMENT_DUE', 'OVERDUE', 'GRACE_PERIOD', 'RESTRICTED', 'PAYMENT_VERIFICATION', 'UNLOCK_PENDING', 'RENEWAL_PENDING', 'EXPIRING', 'EXPIRED', 'RETURN_PENDING', 'RETURNED', 'INSPECTION_REQUIRED', 'COMPLETED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED', 'DISPUTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'RECONCILED', 'DISCREPANCY', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT', 'DOWN_PAYMENT', 'INSTALMENT', 'RENTAL_CHARGE', 'LATE_FEE', 'FINANCING_CHARGE', 'SECURITY_DEPOSIT', 'REFUND', 'DEPOSIT_RETURN', 'DISCOUNT', 'ADVANCE_PAYMENT', 'EARLY_SETTLEMENT', 'CORRECTION', 'REVERSAL', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('RESTRICT', 'UNRESTRICT', 'HEARTBEAT_REQUEST', 'UPDATE', 'REVOKE', 'RE_ENROLL', 'SHUTDOWN_WARNING');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'DELIVERED', 'EXECUTED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('OVERLAY_LOCK', 'LOGIN_BLOCK', 'SOFT_LOCK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'NOTIFIED', 'OVERDUE', 'COLLECTED', 'INSPECTED', 'COMPLETED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'PASS_WITH_MINOR_DAMAGE', 'FAIL_SIGNIFICANT_DAMAGE', 'FAIL_MISSING_ACCESSORIES', 'FAIL_LOST');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('BUSINESS', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'APPROVE', 'REJECT', 'SUSPEND', 'RESTORE', 'RESTRICT', 'UNRESTRICT', 'TRANSFER_OWNERSHIP', 'ENROLL_DEVICE', 'ISSUE_COMMAND', 'LOGIN', 'LOGOUT', 'MFA_ENABLE', 'MFA_DISABLE', 'EXPORT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "taxNumber" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Tanzania',
    "logoUrl" TEXT,
    "status" "BusinessStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "businessId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "EmployeeRole" (
    "employeeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "EmployeeRole_pkey" PRIMARY KEY ("employeeId","roleId")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "description" TEXT,
    "monthlyPriceTZS" DECIMAL(14,2) NOT NULL,
    "annualPriceTZS" DECIMAL(14,2) NOT NULL,
    "maxDevices" INTEGER NOT NULL,
    "maxBranches" INTEGER NOT NULL DEFAULT 1,
    "maxEmployees" INTEGER NOT NULL DEFAULT 5,
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "businessId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "nationalId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invitationToken" TEXT,
    "invitationSentAt" TIMESTAMP(3),
    "portalAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerVerification" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "idDocumentUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "assetTag" TEXT,
    "purchasePrice" DECIMAL(14,2),
    "acquisitionCost" DECIMAL(14,2),
    "purchasedAt" TIMESTAMP(3),
    "warrantyExpiresAt" TIMESTAMP(3),
    "physicalCondition" TEXT,
    "accessories" TEXT[],
    "notes" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentOS" "DeviceOS" NOT NULL DEFAULT 'UNKNOWN',
    "currentCustomerId" TEXT,
    "currentAgreementId" TEXT,
    "currentAgreementType" "AgreementType",
    "isRetired" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePhoto" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "DevicePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceIdentity" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "systemUUID" TEXT,
    "motherboardSerial" TEXT,
    "biosUUID" TEXT,
    "cpuId" TEXT,
    "macAddresses" TEXT[],
    "storageSerials" TEXT[],
    "tpmPresent" BOOLEAN NOT NULL DEFAULT false,
    "tpmVersion" TEXT,
    "tpmManufacturer" TEXT,
    "tpmEKCertHash" TEXT,
    "secureBoot" BOOLEAN,
    "uefiEnabled" BOOLEAN,
    "devicePublicKey" TEXT,
    "tpmBoundKeyHandle" TEXT,
    "identityHash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCapability" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceEnrollment" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolledOS" "DeviceOS" NOT NULL,
    "osVersion" TEXT,
    "distro" TEXT,
    "agentVersion" TEXT NOT NULL,
    "previousOS" "DeviceOS",
    "isReEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "enrolledBy" TEXT,
    "ipAddress" TEXT,
    "notes" TEXT,

    CONSTRAINT "DeviceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCredential" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "DeviceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceHeartbeat" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentVersion" TEXT NOT NULL,
    "os" "DeviceOS" NOT NULL,
    "osVersion" TEXT,
    "distro" TEXT,
    "uptime" INTEGER,
    "batteryPercent" INTEGER,
    "storageJson" JSONB,
    "cpuPercent" DOUBLE PRECISION,
    "memPercent" DOUBLE PRECISION,
    "networkJson" JSONB,
    "ipAddress" TEXT,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DeviceHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "agreementId" TEXT,
    "agreementType" "AgreementType",
    "commandType" "CommandType" NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "issuedBy" TEXT,

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentVersion" TEXT,

    CONSTRAINT "DeviceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAgent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "os" "DeviceOS" NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "protectionLevel" "ProtectionLevel" NOT NULL DEFAULT 'STANDARD',

    CONSTRAINT "DeviceAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "os" "DeviceOS" NOT NULL,
    "version" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingAgreement" (
    "id" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "HirePurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "purchasePriceTZS" DECIMAL(14,2) NOT NULL,
    "depositAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "financedBalanceTZS" DECIMAL(14,2) NOT NULL,
    "financingChargesTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalContractualTZS" DECIMAL(14,2) NOT NULL,
    "instalmentAmountTZS" DECIMAL(14,2) NOT NULL,
    "paymentFrequency" "PaymentFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expectedCompletionDate" TIMESTAMP(3) NOT NULL,
    "depositDueDate" TIMESTAMP(3),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 3,
    "defaultPolicyDays" INTEGER NOT NULL DEFAULT 30,
    "lateFeeAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lateFeeIsPercent" BOOLEAN NOT NULL DEFAULT false,
    "ownershipTransferConditions" JSONB NOT NULL,
    "customerAcceptedAt" TIMESTAMP(3),
    "customerSignatureUrl" TEXT,
    "businessApprovedAt" TIMESTAMP(3),
    "businessApprovedBy" TEXT,
    "agreementPdfUrl" TEXT,
    "agreementPdfGeneratedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownershipTransferredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancingAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalAgreement" (
    "id" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'DRAFT',
    "rentalPriceTZS" DECIMAL(14,2) NOT NULL,
    "paymentFrequency" "PaymentFrequency" NOT NULL,
    "securityDepositTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalExpectedTZS" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "nextPaymentDate" TIMESTAMP(3) NOT NULL,
    "returnDeadline" TIMESTAMP(3),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 3,
    "isAutoRenewable" BOOLEAN NOT NULL DEFAULT false,
    "maxRenewalCount" INTEGER NOT NULL DEFAULT 0,
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "parentRentalId" TEXT,
    "lateFeeAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lateFeeIsPercent" BOOLEAN NOT NULL DEFAULT false,
    "defaultPolicyDays" INTEGER NOT NULL DEFAULT 30,
    "deviceConditionAtHandover" TEXT,
    "accessoriesIssued" TEXT[],
    "customerAcceptedAt" TIMESTAMP(3),
    "customerSignatureUrl" TEXT,
    "businessApprovedAt" TIMESTAMP(3),
    "businessApprovedBy" TEXT,
    "agreementPdfUrl" TEXT,
    "agreementPdfGeneratedAt" TIMESTAMP(3),
    "financiallySettledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" TEXT NOT NULL,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRecalculatedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instalment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "financingAgreementId" TEXT NOT NULL,
    "instalmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalAmountTZS" DECIMAL(14,2) NOT NULL,
    "chargesAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmountTZS" DECIMAL(14,2) NOT NULL,
    "paidAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lateFeeAppliedTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "overdueAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Instalment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalCharge" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "rentalAgreementId" TEXT NOT NULL,
    "chargeNumber" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountTZS" DECIMAL(14,2) NOT NULL,
    "paidAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lateFeeAppliedTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "overdueAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "RentalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedger" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agreementId" TEXT,
    "agreementType" "AgreementType",
    "deviceId" TEXT,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "transactionId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "amountTZS" DECIMAL(14,2) NOT NULL,
    "bucket" TEXT NOT NULL,
    "runningBalanceTZS" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversalLedgerId" TEXT,

    CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "transactionReference" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "agreementType" "AgreementType",
    "deviceId" TEXT,
    "amountTZS" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "paymentProvider" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "providerReference" TEXT,
    "providerMetadata" JSONB,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "webhookReceivedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "failReason" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityDeposit" (
    "id" TEXT NOT NULL,
    "rentalAgreementId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amountTZS" DECIMAL(14,2) NOT NULL,
    "paidAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "isRefunded" BOOLEAN NOT NULL DEFAULT false,
    "refundedAmountTZS" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(3),
    "deductionsJson" JSONB,
    "reconciliationNotes" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositTransaction" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "amountTZS" DECIMAL(14,2) NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "transactionRef" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,

    CONSTRAINT "DepositTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceRestriction" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "agreementType" "AgreementType" NOT NULL,
    "commandId" TEXT,
    "restrictionType" "RestrictionType" NOT NULL DEFAULT 'OVERLAY_LOCK',
    "reason" TEXT NOT NULL,
    "outstandingAmountTZS" DECIMAL(14,2),
    "paymentInstructions" TEXT,
    "supportContact" TEXT,
    "recoveryInstructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restrictedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedByCommandId" TEXT,
    "liftedByTransactionId" TEXT,
    "auditNotes" TEXT,

    CONSTRAINT "DeviceRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAuthorization" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "agreementType" "AgreementType" NOT NULL,
    "isAuthorized" BOOLEAN NOT NULL DEFAULT true,
    "authorizationBasis" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "commandId" TEXT,

    CONSTRAINT "DeviceAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceReturn" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "agreementType" "AgreementType" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "businessApprovedAt" TIMESTAMP(3),
    "businessApprovedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "DeviceReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceInspection" (
    "id" TEXT NOT NULL,
    "deviceReturnId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedBy" TEXT,
    "result" "InspectionResult" NOT NULL,
    "conditionRating" TEXT,
    "accessories" JSONB,
    "damageDescription" TEXT,
    "estimatedRepairCostTZS" DECIMAL(14,2),
    "photoUrls" TEXT[],
    "notes" TEXT,

    CONSTRAINT "DeviceInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceMaintenance" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "costTZS" DECIMAL(14,2),
    "performedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "DeviceMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceOwnershipRecord" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ownerType" "OwnershipType" NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "basis" TEXT NOT NULL,
    "agreementId" TEXT,
    "agreementType" "AgreementType",
    "notes" TEXT,

    CONSTRAINT "DeviceOwnershipRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "financingAgreementId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedByLedger" BOOLEAN NOT NULL DEFAULT false,
    "allConditionsMet" BOOLEAN NOT NULL DEFAULT false,
    "certificatePdfUrl" TEXT,
    "certificateGeneratedAt" TIMESTAMP(3),
    "authorizedBy" TEXT,
    "notes" TEXT,
    "correctionRequestId" TEXT,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "customerId" TEXT,
    "userId" TEXT,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "financingAgreementId" TEXT,
    "rentalAgreementId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "customerId" TEXT,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "category" TEXT,
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderRole" TEXT,
    "message" TEXT NOT NULL,
    "attachments" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Business_registrationNumber_key" ON "Business"("registrationNumber");

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- CreateIndex
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_businessId_idx" ON "Employee"("businessId");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_businessId_key" ON "Role"("name", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessId_key" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "Subscription_businessId_idx" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_invitationToken_key" ON "Customer"("invitationToken");

-- CreateIndex
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerVerification_customerId_key" ON "CustomerVerification"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_assetTag_key" ON "Device"("assetTag");

-- CreateIndex
CREATE INDEX "Device_businessId_idx" ON "Device"("businessId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_currentOS_idx" ON "Device"("currentOS");

-- CreateIndex
CREATE INDEX "Device_currentCustomerId_idx" ON "Device"("currentCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_businessId_serialNumber_key" ON "Device"("businessId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceIdentity_deviceId_key" ON "DeviceIdentity"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceIdentity_identityHash_idx" ON "DeviceIdentity"("identityHash");

-- CreateIndex
CREATE INDEX "DeviceIdentity_systemUUID_idx" ON "DeviceIdentity"("systemUUID");

-- CreateIndex
CREATE INDEX "DeviceIdentity_tpmEKCertHash_idx" ON "DeviceIdentity"("tpmEKCertHash");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCapability_deviceId_capability_key" ON "DeviceCapability"("deviceId", "capability");

-- CreateIndex
CREATE INDEX "DeviceEnrollment_deviceId_idx" ON "DeviceEnrollment"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceCredential_deviceId_idx" ON "DeviceCredential"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceCredential_credentialHash_idx" ON "DeviceCredential"("credentialHash");

-- CreateIndex
CREATE INDEX "DeviceHeartbeat_deviceId_receivedAt_idx" ON "DeviceHeartbeat"("deviceId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCommand_nonce_key" ON "DeviceCommand"("nonce");

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_status_idx" ON "DeviceCommand"("deviceId", "status");

-- CreateIndex
CREATE INDEX "DeviceCommand_nonce_idx" ON "DeviceCommand"("nonce");

-- CreateIndex
CREATE INDEX "DeviceCommand_expiresAt_idx" ON "DeviceCommand"("expiresAt");

-- CreateIndex
CREATE INDEX "DeviceEvent_deviceId_occurredAt_idx" ON "DeviceEvent"("deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "DeviceEvent_eventType_idx" ON "DeviceEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAgent_deviceId_key" ON "DeviceAgent"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentVersion_os_version_key" ON "AgentVersion"("os", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FinancingAgreement_agreementNumber_key" ON "FinancingAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "FinancingAgreement_businessId_status_idx" ON "FinancingAgreement"("businessId", "status");

-- CreateIndex
CREATE INDEX "FinancingAgreement_customerId_idx" ON "FinancingAgreement"("customerId");

-- CreateIndex
CREATE INDEX "FinancingAgreement_deviceId_idx" ON "FinancingAgreement"("deviceId");

-- CreateIndex
CREATE INDEX "FinancingAgreement_agreementNumber_idx" ON "FinancingAgreement"("agreementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RentalAgreement_agreementNumber_key" ON "RentalAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "RentalAgreement_businessId_status_idx" ON "RentalAgreement"("businessId", "status");

-- CreateIndex
CREATE INDEX "RentalAgreement_customerId_idx" ON "RentalAgreement"("customerId");

-- CreateIndex
CREATE INDEX "RentalAgreement_deviceId_idx" ON "RentalAgreement"("deviceId");

-- CreateIndex
CREATE INDEX "RentalAgreement_agreementNumber_idx" ON "RentalAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "RentalAgreement_endDate_idx" ON "RentalAgreement"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSchedule_financingAgreementId_key" ON "PaymentSchedule"("financingAgreementId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSchedule_rentalAgreementId_key" ON "PaymentSchedule"("rentalAgreementId");

-- CreateIndex
CREATE INDEX "Instalment_financingAgreementId_isPaid_idx" ON "Instalment"("financingAgreementId", "isPaid");

-- CreateIndex
CREATE INDEX "Instalment_dueDate_idx" ON "Instalment"("dueDate");

-- CreateIndex
CREATE INDEX "RentalCharge_rentalAgreementId_isPaid_idx" ON "RentalCharge"("rentalAgreementId", "isPaid");

-- CreateIndex
CREATE INDEX "RentalCharge_dueDate_idx" ON "RentalCharge"("dueDate");

-- CreateIndex
CREATE INDEX "FinancialLedger_businessId_agreementType_idx" ON "FinancialLedger"("businessId", "agreementType");

-- CreateIndex
CREATE INDEX "FinancialLedger_customerId_idx" ON "FinancialLedger"("customerId");

-- CreateIndex
CREATE INDEX "FinancialLedger_financingAgreementId_idx" ON "FinancialLedger"("financingAgreementId");

-- CreateIndex
CREATE INDEX "FinancialLedger_rentalAgreementId_idx" ON "FinancialLedger"("rentalAgreementId");

-- CreateIndex
CREATE INDEX "FinancialLedger_recordedAt_idx" ON "FinancialLedger"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_transactionReference_key" ON "PaymentTransaction"("transactionReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentTransaction_businessId_idx" ON "PaymentTransaction"("businessId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_customerId_idx" ON "PaymentTransaction"("customerId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerReference_idx" ON "PaymentTransaction"("providerReference");

-- CreateIndex
CREATE INDEX "PaymentTransaction_idempotencyKey_idx" ON "PaymentTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDeposit_rentalAgreementId_key" ON "SecurityDeposit"("rentalAgreementId");

-- CreateIndex
CREATE INDEX "SecurityDeposit_rentalAgreementId_idx" ON "SecurityDeposit"("rentalAgreementId");

-- CreateIndex
CREATE INDEX "DeviceRestriction_deviceId_isActive_idx" ON "DeviceRestriction"("deviceId", "isActive");

-- CreateIndex
CREATE INDEX "DeviceRestriction_financingAgreementId_idx" ON "DeviceRestriction"("financingAgreementId");

-- CreateIndex
CREATE INDEX "DeviceRestriction_rentalAgreementId_idx" ON "DeviceRestriction"("rentalAgreementId");

-- CreateIndex
CREATE INDEX "DeviceAuthorization_deviceId_idx" ON "DeviceAuthorization"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceReturn_rentalAgreementId_key" ON "DeviceReturn"("rentalAgreementId");

-- CreateIndex
CREATE INDEX "DeviceReturn_deviceId_idx" ON "DeviceReturn"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceReturn_customerId_idx" ON "DeviceReturn"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInspection_deviceReturnId_key" ON "DeviceInspection"("deviceReturnId");

-- CreateIndex
CREATE INDEX "DeviceInspection_deviceId_idx" ON "DeviceInspection"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceMaintenance_deviceId_idx" ON "DeviceMaintenance"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceOwnershipRecord_deviceId_endedAt_idx" ON "DeviceOwnershipRecord"("deviceId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipTransfer_financingAgreementId_key" ON "OwnershipTransfer"("financingAgreementId");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_deviceId_idx" ON "OwnershipTransfer"("deviceId");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_customerId_idx" ON "OwnershipTransfer"("customerId");

-- CreateIndex
CREATE INDEX "Notification_businessId_status_idx" ON "Notification"("businessId", "status");

-- CreateIndex
CREATE INDEX "Notification_customerId_status_idx" ON "Notification"("customerId", "status");

-- CreateIndex
CREATE INDEX "Notification_scheduledFor_idx" ON "Notification"("scheduledFor");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_occurredAt_idx" ON "AuditLog"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "SupportTicket_businessId_status_idx" ON "SupportTicket"("businessId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_customerId_status_idx" ON "SupportTicket"("customerId", "status");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRole" ADD CONSTRAINT "EmployeeRole_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRole" ADD CONSTRAINT "EmployeeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVerification" ADD CONSTRAINT "CustomerVerification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePhoto" ADD CONSTRAINT "DevicePhoto_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceIdentity" ADD CONSTRAINT "DeviceIdentity_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCapability" ADD CONSTRAINT "DeviceCapability_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEnrollment" ADD CONSTRAINT "DeviceEnrollment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHeartbeat" ADD CONSTRAINT "DeviceHeartbeat_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAgent" ADD CONSTRAINT "DeviceAgent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingAgreement" ADD CONSTRAINT "FinancingAgreement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingAgreement" ADD CONSTRAINT "FinancingAgreement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingAgreement" ADD CONSTRAINT "FinancingAgreement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingAgreement" ADD CONSTRAINT "FinancingAgreement_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_parentRentalId_fkey" FOREIGN KEY ("parentRentalId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instalment" ADD CONSTRAINT "Instalment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PaymentSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instalment" ADD CONSTRAINT "Instalment_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PaymentSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityDeposit" ADD CONSTRAINT "SecurityDeposit_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositTransaction" ADD CONSTRAINT "DepositTransaction_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "SecurityDeposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRestriction" ADD CONSTRAINT "DeviceRestriction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRestriction" ADD CONSTRAINT "DeviceRestriction_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRestriction" ADD CONSTRAINT "DeviceRestriction_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAuthorization" ADD CONSTRAINT "DeviceAuthorization_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAuthorization" ADD CONSTRAINT "DeviceAuthorization_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAuthorization" ADD CONSTRAINT "DeviceAuthorization_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceReturn" ADD CONSTRAINT "DeviceReturn_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceReturn" ADD CONSTRAINT "DeviceReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceReturn" ADD CONSTRAINT "DeviceReturn_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInspection" ADD CONSTRAINT "DeviceInspection_deviceReturnId_fkey" FOREIGN KEY ("deviceReturnId") REFERENCES "DeviceReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInspection" ADD CONSTRAINT "DeviceInspection_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceMaintenance" ADD CONSTRAINT "DeviceMaintenance_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceOwnershipRecord" ADD CONSTRAINT "DeviceOwnershipRecord_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_financingAgreementId_fkey" FOREIGN KEY ("financingAgreementId") REFERENCES "FinancingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
