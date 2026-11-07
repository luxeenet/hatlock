// Financing Agreement Service
// Core business logic for Hire Purchase agreements
// CRITICAL: Ownership rules enforced strictly — business owns until verified completion

import { prisma } from '../lib/prisma.js';
import { Decimal } from 'decimal.js';
import { addDays, addWeeks, addMonths, addQuarters, addYears } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import {
  HirePurchaseStatus,
  PaymentFrequency,
  LedgerEntryType,
  DeviceStatus,
  AuditAction,
  UserRole,
  AgreementType
} from '@prisma/client';
import { auditLog } from './audit.js';
import { scheduleNotification } from './notifications.js';
import { generateOwnershipCertificate } from './pdf.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Agreement Number Generator ────────────────────────────────────────────────
const agreementCounters: Record<string, number> = {};  // In-memory; use DB sequence in prod

export async function generateAgreementNumber(businessId: string, type: 'HP' | 'RT'): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${businessId}:${type}:${year}`;

  // Use DB for atomic counter in production
  const count = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "FinancingAgreement"
    WHERE "businessId" = ${businessId} AND EXTRACT(YEAR FROM "createdAt") = ${year}
  `;
  const seq = (Number(count[0]?.count ?? 0) + 1).toString().padStart(6, '0');
  return `${type}-${year}-${seq}`;
}

// ─── Payment Schedule Generation ─────────────────────────────────────────────

export function calculateInstalmentDates(
  startDate: Date,
  frequency: PaymentFrequency,
  count: number
): Date[] {
  const dates: Date[] = [];
  let current = startDate;

  for (let i = 0; i < count; i++) {
    switch (frequency) {
      case PaymentFrequency.DAILY: current = addDays(current, 1); break;
      case PaymentFrequency.WEEKLY: current = addWeeks(current, 1); break;
      case PaymentFrequency.BIWEEKLY: current = addWeeks(current, 2); break;
      case PaymentFrequency.MONTHLY: current = addMonths(current, 1); break;
      case PaymentFrequency.QUARTERLY: current = addQuarters(current, 1); break;
      case PaymentFrequency.ANNUALLY: current = addYears(current, 1); break;
      default: current = addWeeks(current, 1);
    }
    dates.push(new Date(current));
  }
  return dates;
}

export function calculateInstalmentCount(
  financedBalance: Decimal,
  instalmentAmount: Decimal
): number {
  return Math.ceil(financedBalance.div(instalmentAmount).toNumber());
}

// ─── Create Financing Agreement ───────────────────────────────────────────────

export interface CreateFinancingAgreementInput {
  businessId: string;
  branchId?: string;
  customerId: string;
  deviceId: string;
  purchasePriceTZS: number;
  depositAmountTZS: number;
  instalmentAmountTZS: number;
  financingChargesTZS: number;
  paymentFrequency: PaymentFrequency;
  startDate: Date;
  gracePeriodDays: number;
  defaultPolicyDays: number;
  lateFeeAmountTZS: number;
  lateFeeIsPercent: boolean;
  ownershipTransferConditions?: Record<string, unknown>;
  createdBy: string;
  notes?: string;
}

export async function createFinancingAgreement(input: CreateFinancingAgreementInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate device availability
    const device = await tx.device.findFirst({
      where: { id: input.deviceId, businessId: input.businessId },
      include: { financingAgreements: { where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED', 'DEFAULTED'] } } }, rentalAgreements: { where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } } } }
    });

    if (!device) throw Object.assign(new Error('Device not found or not owned by business'), { statusCode: 404 });
    if (device.isRetired) throw Object.assign(new Error('Device is retired'), { statusCode: 409 });
    if (device.financingAgreements.length > 0 || device.rentalAgreements.length > 0) {
      throw Object.assign(new Error('Device already has an active agreement'), { statusCode: 409 });
    }

    // 2. Validate customer belongs to this business
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, businessId: input.businessId }
    });
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

    // 3. Calculate financial terms using Decimal.js for precision
    const purchasePrice = new Decimal(input.purchasePriceTZS);
    const deposit = new Decimal(input.depositAmountTZS);
    const financingCharges = new Decimal(input.financingChargesTZS);
    const instalmentAmount = new Decimal(input.instalmentAmountTZS);

    const financedBalance = purchasePrice.minus(deposit);
    if (financedBalance.isNegative()) throw Object.assign(new Error('Deposit cannot exceed purchase price'), { statusCode: 400 });

    const totalInstalments = calculateInstalmentCount(financedBalance.plus(financingCharges), instalmentAmount);
    const totalContractual = deposit.plus(financedBalance).plus(financingCharges);
    const expectedCompletionDate = (() => {
      const dates = calculateInstalmentDates(input.startDate, input.paymentFrequency, totalInstalments);
      return dates[dates.length - 1] ?? input.startDate;
    })();

    // 4. Generate agreement number
    const agreementNumber = await generateAgreementNumber(input.businessId, 'HP');

    // 5. Create agreement
    const agreement = await tx.financingAgreement.create({
      data: {
        agreementNumber,
        businessId: input.businessId,
        branchId: input.branchId,
        customerId: input.customerId,
        deviceId: input.deviceId,
        status: HirePurchaseStatus.DRAFT,
        purchasePriceTZS: purchasePrice,
        depositAmountTZS: deposit,
        financedBalanceTZS: financedBalance,
        financingChargesTZS: financingCharges,
        totalContractualTZS: totalContractual,
        instalmentAmountTZS: instalmentAmount,
        paymentFrequency: input.paymentFrequency,
        startDate: input.startDate,
        expectedCompletionDate,
        gracePeriodDays: input.gracePeriodDays,
        defaultPolicyDays: input.defaultPolicyDays,
        lateFeeAmountTZS: new Decimal(input.lateFeeAmountTZS),
        lateFeeIsPercent: input.lateFeeIsPercent,
        ownershipTransferConditions: (input.ownershipTransferConditions as any) ?? { allInstalmentsRequired: true, noOutstandingCharges: true, noUnresolvedDisputes: true },
        notes: input.notes
      }
    });

    // 6. Create payment schedule and instalments
    const schedule = await tx.paymentSchedule.create({
      data: { financingAgreementId: agreement.id }
    });

    const instalmentDates = calculateInstalmentDates(input.startDate, input.paymentFrequency, totalInstalments);
    const principalPerInstalment = financedBalance.div(totalInstalments).toDecimalPlaces(2);
    const chargesPerInstalment = financingCharges.div(totalInstalments).toDecimalPlaces(2);

    await tx.instalment.createMany({
      data: instalmentDates.map((dueDate, index) => ({
        scheduleId: schedule.id,
        financingAgreementId: agreement.id,
        instalmentNumber: index + 1,
        dueDate,
        principalAmountTZS: principalPerInstalment,
        chargesAmountTZS: chargesPerInstalment,
        totalAmountTZS: instalmentAmount,
        gracePeriodEndsAt: addDays(dueDate, input.gracePeriodDays)
      }))
    });

    // 7. Update device status
    await tx.device.update({
      where: { id: input.deviceId },
      data: {
        status: DeviceStatus.AVAILABLE,  // Will change to ACTIVE when agreement approved
        currentCustomerId: input.customerId,
        currentAgreementId: agreement.id,
        currentAgreementType: AgreementType.HIRE_PURCHASE
      }
    });

    // 8. Record initial business ownership
    await tx.deviceOwnershipRecord.create({
      data: {
        deviceId: input.deviceId,
        ownerType: 'BUSINESS',
        businessId: input.businessId,
        basis: 'HIRE_PURCHASE_AGREEMENT',
        agreementId: agreement.id,
        agreementType: AgreementType.HIRE_PURCHASE
      }
    });

    return agreement;
  });
}

// ─── Approve Agreement ────────────────────────────────────────────────────────

export async function approveFinancingAgreement(
  agreementId: string,
  businessId: string,
  approvedBy: string
) {
  return prisma.$transaction(async (tx) => {
    const agreement = await tx.financingAgreement.findFirst({
      where: { id: agreementId, businessId }
    });
    if (!agreement) throw Object.assign(new Error('Agreement not found'), { statusCode: 404 });
    if (agreement.status !== HirePurchaseStatus.PENDING_APPROVAL) {
      throw Object.assign(new Error(`Cannot approve agreement in status ${agreement.status}`), { statusCode: 409 });
    }
    if (!agreement.customerAcceptedAt) {
      throw Object.assign(new Error('Customer must accept agreement before business approval'), { statusCode: 409 });
    }

    const updated = await tx.financingAgreement.update({
      where: { id: agreementId },
      data: {
        status: HirePurchaseStatus.ACTIVE,
        businessApprovedAt: new Date(),
        businessApprovedBy: approvedBy
      }
    });

    await tx.device.update({
      where: { id: agreement.deviceId },
      data: { status: DeviceStatus.ACTIVE }
    });

    await auditLog({
      actorId: approvedBy,
      businessId,
      action: AuditAction.APPROVE,
      resource: 'FinancingAgreement',
      resourceId: agreementId,
      financingAgreementId: agreementId
    });

    // Notify customer
    await scheduleNotification({
      customerId: agreement.customerId,
      type: 'AGREEMENT_APPROVED',
      subject: `Your hire purchase agreement ${agreement.agreementNumber} has been approved`,
      body: `Your hire purchase agreement (${agreement.agreementNumber}) has been approved. Your first payment is due according to your payment schedule.`
    });

    return updated;
  });
}

// ─── Record Payment ───────────────────────────────────────────────────────────

export async function recordFinancingPayment(
  agreementId: string,
  businessId: string,
  amountTZS: number,
  transactionId: string,
  recordedBy: string
) {
  return prisma.$transaction(async (tx) => {
    const agreement = await tx.financingAgreement.findFirst({
      where: { id: agreementId, businessId },
      include: {
        instalments: {
          where: { isPaid: false },
          orderBy: { instalmentNumber: 'asc' }
        }
      }
    });
    if (!agreement) throw Object.assign(new Error('Agreement not found'), { statusCode: 404 });

    const allowedStatuses = [
      HirePurchaseStatus.ACTIVE, HirePurchaseStatus.PAYMENT_DUE,
      HirePurchaseStatus.OVERDUE, HirePurchaseStatus.GRACE_PERIOD,
      HirePurchaseStatus.RESTRICTED, HirePurchaseStatus.PAYMENT_VERIFICATION,
      HirePurchaseStatus.SETTLEMENT_PENDING, HirePurchaseStatus.EARLY_SETTLEMENT_PENDING
    ];
    if (!allowedStatuses.includes(agreement.status as any)) {
      throw Object.assign(new Error(`Cannot record payment for agreement in status ${agreement.status}`), { statusCode: 409 });
    }

    let remaining = new Decimal(amountTZS);
    const updatedInstalments: string[] = [];

    // Apply payment to oldest unpaid instalments first
    for (const instalment of agreement.instalments) {
      if (remaining.isZero()) break;

      const owed = new Decimal(instalment.totalAmountTZS.toString())
        .plus(new Decimal(instalment.lateFeeAppliedTZS?.toString() ?? '0'))
        .minus(new Decimal(instalment.paidAmountTZS.toString()));
      const toApply = remaining.lessThan(owed) ? remaining : owed;

      const newPaid = new Decimal(instalment.paidAmountTZS.toString()).plus(toApply);
      const isPaid = newPaid.gte(
        new Decimal(instalment.totalAmountTZS.toString()).plus(new Decimal(instalment.lateFeeAppliedTZS?.toString() ?? '0'))
      );

      await tx.instalment.update({
        where: { id: instalment.id },
        data: {
          paidAmountTZS: newPaid,
          isPaid,
          paidAt: isPaid ? new Date() : null,
          isOverdue: false  // Reset overdue when payment received
        }
      });

      if (isPaid) updatedInstalments.push(instalment.id);
      remaining = remaining.minus(toApply);
    }

    // Add to financial ledger (immutable)
    const totalPaid = await tx.instalment.aggregate({
      where: { financingAgreementId: agreementId },
      _sum: { paidAmountTZS: true }
    });
    const runningBalance = new Decimal(agreement.totalContractualTZS.toString()).minus(new Decimal(totalPaid._sum.paidAmountTZS?.toString() ?? '0').plus(amountTZS));

    await tx.financialLedger.create({
      data: {
        businessId,
        customerId: agreement.customerId,
        financingAgreementId: agreementId,
        agreementType: AgreementType.HIRE_PURCHASE,
        deviceId: agreement.deviceId,
        transactionId,
        entryType: LedgerEntryType.INSTALMENT,
        amountTZS: new Decimal(amountTZS),
        bucket: 'PRINCIPAL',
        runningBalanceTZS: runningBalance.isNegative() ? new Decimal(0) : runningBalance,
        description: `Instalment payment — ${agreement.agreementNumber}`,
        referenceNumber: agreement.agreementNumber,
        recordedBy
      }
    });

    // Check if all instalments are now paid
    const unpaidCount = await tx.instalment.count({
      where: { financingAgreementId: agreementId, isPaid: false }
    });

    let updatedStatus = agreement.status;
    if (unpaidCount === 0) {
      updatedStatus = HirePurchaseStatus.SETTLEMENT_PENDING;
    } else if ([HirePurchaseStatus.RESTRICTED, HirePurchaseStatus.OVERDUE, HirePurchaseStatus.PAYMENT_DUE].includes(agreement.status as any)) {
      updatedStatus = HirePurchaseStatus.PAYMENT_VERIFICATION;
    }

    const updated = await tx.financingAgreement.update({
      where: { id: agreementId },
      data: { status: updatedStatus }
    });

    return { agreement: updated, appliedToInstalments: updatedInstalments, allPaid: unpaidCount === 0 };
  });
}

// ─── Complete Agreement and Transfer Ownership ────────────────────────────────
// CRITICAL: This is the only path to ownership transfer for HP agreements.
// Never called for rental agreements.

export async function completeFinancingAndTransferOwnership(
  agreementId: string,
  businessId: string,
  authorizedBy: string
) {
  return prisma.$transaction(async (tx) => {
    const agreement = await tx.financingAgreement.findFirst({
      where: { id: agreementId, businessId },
      include: {
        instalments: true,
        ownershipTransfer: true  // Check if already transferred
      }
    });

    if (!agreement) throw Object.assign(new Error('Agreement not found'), { statusCode: 404 });

    // GUARD: Cannot transfer twice
    if (agreement.ownershipTransfer) {
      throw Object.assign(new Error('Ownership has already been transferred for this agreement'), { statusCode: 409 });
    }

    // GUARD: Must be in SETTLEMENT_PENDING or COMPLETED (awaiting transfer)
    const validStatuses: HirePurchaseStatus[] = [
      HirePurchaseStatus.SETTLEMENT_PENDING,
      HirePurchaseStatus.COMPLETED,
      HirePurchaseStatus.OWNERSHIP_TRANSFER_PENDING
    ];
    if (!validStatuses.includes(agreement.status as any)) {
      throw Object.assign(new Error(`Cannot transfer ownership for agreement in status ${agreement.status}`), { statusCode: 409 });
    }

    // VERIFICATION 1: All instalments paid
    const unpaidInstalments = agreement.instalments.filter(i => !i.isPaid);
    if (unpaidInstalments.length > 0) {
      throw Object.assign(new Error(`Cannot transfer ownership: ${unpaidInstalments.length} instalment(s) unpaid`), { statusCode: 422 });
    }

    // VERIFICATION 2: No unresolved disputed transactions
    const disputedTxns = await tx.paymentTransaction.count({
      where: {
        financingAgreementId: agreementId,
        status: { in: ['DISPUTED', 'REVERSED'] }
      }
    });
    if (disputedTxns > 0) {
      throw Object.assign(new Error(`Cannot transfer ownership: ${disputedTxns} disputed/reversed transaction(s) unresolved`), { statusCode: 422 });
    }

    // VERIFICATION 3: Check ownership conditions
    const conditions = agreement.ownershipTransferConditions as Record<string, boolean>;
    // All standard conditions must be met
    if (conditions.allInstalmentsRequired && unpaidInstalments.length > 0) {
      throw Object.assign(new Error('All instalments must be paid'), { statusCode: 422 });
    }

    const now = new Date();

    // 1. Complete the agreement
    await tx.financingAgreement.update({
      where: { id: agreementId },
      data: {
        status: HirePurchaseStatus.OWNERSHIP_TRANSFERRED,
        completedAt: now,
        ownershipTransferredAt: now
      }
    });

    // 2. Create ownership transfer record (immutable)
    const transfer = await tx.ownershipTransfer.create({
      data: {
        deviceId: agreement.deviceId,
        financingAgreementId: agreementId,
        businessId,
        customerId: agreement.customerId,
        transferredAt: now,
        verifiedByLedger: true,
        allConditionsMet: true,
        authorizedBy
      }
    });

    // 3. Close existing business ownership record
    await tx.deviceOwnershipRecord.updateMany({
      where: { deviceId: agreement.deviceId, endedAt: null },
      data: { endedAt: now }
    });

    // 4. Create customer ownership record
    await tx.deviceOwnershipRecord.create({
      data: {
        deviceId: agreement.deviceId,
        ownerType: 'CUSTOMER',
        businessId,  // Original seller (for history)
        customerId: agreement.customerId,
        startedAt: now,
        basis: 'HIRE_PURCHASE_COMPLETION',
        agreementId: agreementId,
        agreementType: AgreementType.HIRE_PURCHASE
      }
    });

    // 5. Update device status — PERMANENTLY released from financing
    await tx.device.update({
      where: { id: agreement.deviceId },
      data: {
        status: DeviceStatus.CUSTOMER_OWNED,
        currentAgreementId: null,
        currentAgreementType: null
        // currentCustomerId stays for history
      }
    });

    // 6. Lift any active restrictions (permanently — device is now customer-owned)
    await tx.deviceRestriction.updateMany({
      where: { deviceId: agreement.deviceId, isActive: true },
      data: { isActive: false, liftedAt: now, auditNotes: 'Lifted: ownership transferred to customer' }
    });

    // 7. Generate ownership certificate PDF
    setImmediate(() => {
      generateOwnershipCertificate(agreementId).then(async () => {
        await prisma.ownershipTransfer.update({
          where: { id: transfer.id },
          data: {
            certificatePdfUrl: `/api/v1/ownership/certificates/${transfer.id}.pdf`,
            certificateGeneratedAt: new Date()
          }
        });
      }).catch(console.error);
    });

    // 8. Audit log
    await auditLog({
      actorId: authorizedBy,
      businessId,
      action: AuditAction.TRANSFER_OWNERSHIP,
      resource: 'FinancingAgreement',
      resourceId: agreementId,
      financingAgreementId: agreementId,
      changes: {
        after: {
          ownershipTransferredAt: now,
          customerId: agreement.customerId,
          deviceId: agreement.deviceId
        }
      }
    });

    // 9. Notify customer
    await scheduleNotification({
      customerId: agreement.customerId,
      type: 'OWNERSHIP_TRANSFERRED',
      subject: `Congratulations! Your laptop ownership has been transferred`,
      body: `Your hire purchase agreement (${agreement.agreementNumber}) is complete. Ownership of your laptop has been officially transferred to you. Your ownership certificate will be available for download shortly.`
    });

    return { transfer, agreementNumber: agreement.agreementNumber };
  });
}

// ─── Evaluate Overdue Status ──────────────────────────────────────────────────

export async function evaluateOverdueStatus(agreementId: string) {
  const now = new Date();

  const agreement = await prisma.financingAgreement.findUnique({
    where: { id: agreementId },
    include: {
      instalments: { where: { isPaid: false }, orderBy: { dueDate: 'asc' } }
    }
  });

  if (!agreement) return null;

  const overdueInstalments = agreement.instalments.filter(i => {
    const gracePeriodEnd = i.gracePeriodEndsAt ?? addDays(i.dueDate, agreement.gracePeriodDays);
    return i.dueDate < now && gracePeriodEnd < now;
  });

  const inGrace = agreement.instalments.filter(i => {
    const gracePeriodEnd = i.gracePeriodEndsAt ?? addDays(i.dueDate, agreement.gracePeriodDays);
    return i.dueDate < now && gracePeriodEnd >= now;
  });

  if (overdueInstalments.length > 0) {
    // Apply late fees if not already applied
    for (const inst of overdueInstalments) {
      if (inst.lateFeeAppliedTZS.toNumber() === 0 && agreement.lateFeeAmountTZS.toNumber() > 0) {
        const lateFee = agreement.lateFeeIsPercent
          ? new Decimal(inst.totalAmountTZS.toString()).mul(new Decimal(agreement.lateFeeAmountTZS.toString())).div(100)
          : new Decimal(agreement.lateFeeAmountTZS.toString());

        await prisma.instalment.update({
          where: { id: inst.id },
          data: { lateFeeAppliedTZS: lateFee, isOverdue: true, overdueAt: now }
        });
      }
    }

    // Check if past default policy
    const daysSinceFirstOverdue = Math.floor(
      (now.getTime() - overdueInstalments[0].dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let newStatus: HirePurchaseStatus;
    if (daysSinceFirstOverdue >= agreement.defaultPolicyDays) {
      newStatus = HirePurchaseStatus.DEFAULTED;
    } else {
      newStatus = HirePurchaseStatus.OVERDUE;
    }

    await prisma.financingAgreement.update({
      where: { id: agreementId },
      data: { status: newStatus }
    });

    return { status: newStatus, overdueCount: overdueInstalments.length };
  } else if (inGrace.length > 0) {
    await prisma.financingAgreement.update({
      where: { id: agreementId },
      data: { status: HirePurchaseStatus.GRACE_PERIOD }
    });
    return { status: HirePurchaseStatus.GRACE_PERIOD, graceCount: inGrace.length };
  }

  return { status: agreement.status };
}
