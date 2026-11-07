// Rental Agreement Service
// CRITICAL: Business ALWAYS retains ownership.
// Completing all rental payments NEVER transfers ownership.
// The device MUST be returned unless renewed.

import { prisma } from '../lib/prisma.js';
import { Decimal } from 'decimal.js';
import { addDays, addWeeks, addMonths, addQuarters, addYears } from 'date-fns';
import {
  RentalStatus,
  PaymentFrequency,
  LedgerEntryType,
  DeviceStatus,
  AuditAction,
  AgreementType
} from '@prisma/client';
import { auditLog } from './audit.js';
import { scheduleNotification } from './notifications.js';
import { generateAgreementNumber, calculateInstalmentDates } from './financing.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Create Rental Agreement ─────────────────────────────────────────────────

export interface CreateRentalAgreementInput {
  businessId: string;
  branchId?: string;
  customerId: string;
  deviceId: string;
  rentalPriceTZS: number;
  paymentFrequency: PaymentFrequency;
  startDate: Date;
  endDate: Date;
  securityDepositTZS: number;
  gracePeriodDays: number;
  defaultPolicyDays: number;
  lateFeeAmountTZS: number;
  lateFeeIsPercent: boolean;
  deviceConditionAtHandover?: string;
  accessoriesIssued?: string[];
  isAutoRenewable?: boolean;
  createdBy: string;
  notes?: string;
}

export async function createRentalAgreement(input: CreateRentalAgreementInput) {
  return prisma.$transaction(async (tx) => {
    // Validate device
    const device = await tx.device.findFirst({
      where: { id: input.deviceId, businessId: input.businessId },
      include: {
        financingAgreements: { where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED', 'DEFAULTED'] } } },
        rentalAgreements: { where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } } }
      }
    });
    if (!device) throw Object.assign(new Error('Device not found'), { statusCode: 404 });
    if (device.isRetired) throw Object.assign(new Error('Device is retired'), { statusCode: 409 });
    if (device.financingAgreements.length > 0 || device.rentalAgreements.length > 0) {
      throw Object.assign(new Error('Device already has an active agreement'), { statusCode: 409 });
    }

    const customer = await tx.customer.findFirst({ where: { id: input.customerId, businessId: input.businessId } });
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

    // Calculate rental charges
    const rentalPrice = new Decimal(input.rentalPriceTZS);
    const chargeCount = calculateRentalChargeCount(input.startDate, input.endDate, input.paymentFrequency);
    const totalExpected = rentalPrice.mul(chargeCount);

    const agreementNumber = await generateAgreementNumber(input.businessId, 'RT');

    const agreement = await tx.rentalAgreement.create({
      data: {
        agreementNumber,
        businessId: input.businessId,
        branchId: input.branchId,
        customerId: input.customerId,
        deviceId: input.deviceId,
        status: RentalStatus.DRAFT,
        rentalPriceTZS: rentalPrice,
        paymentFrequency: input.paymentFrequency,
        securityDepositTZS: new Decimal(input.securityDepositTZS),
        totalExpectedTZS: totalExpected,
        startDate: input.startDate,
        endDate: input.endDate,
        nextPaymentDate: calculateNextPaymentDate(input.startDate, input.paymentFrequency),
        returnDeadline: addDays(input.endDate, 7),
        gracePeriodDays: input.gracePeriodDays,
        defaultPolicyDays: input.defaultPolicyDays,
        lateFeeAmountTZS: new Decimal(input.lateFeeAmountTZS),
        lateFeeIsPercent: input.lateFeeIsPercent,
        deviceConditionAtHandover: input.deviceConditionAtHandover,
        accessoriesIssued: input.accessoriesIssued ?? [],
        isAutoRenewable: input.isAutoRenewable ?? false,
        notes: input.notes
      }
    });

    // Create payment schedule
    const schedule = await tx.paymentSchedule.create({
      data: { rentalAgreementId: agreement.id }
    });

    // Generate rental charge schedule
    const chargeDates = calculateInstalmentDates(input.startDate, input.paymentFrequency, chargeCount);
    let periodStart = input.startDate;

    await tx.rentalCharge.createMany({
      data: chargeDates.map((dueDate, index) => {
        const periodEnd = dueDate;
        const charge = {
          scheduleId: schedule.id,
          rentalAgreementId: agreement.id,
          chargeNumber: index + 1,
          periodStart,
          periodEnd,
          dueDate,
          amountTZS: rentalPrice,
          gracePeriodEndsAt: addDays(dueDate, input.gracePeriodDays)
        };
        periodStart = addDays(dueDate, 1);
        return charge;
      })
    });

    // Create security deposit record (SEPARATE from rental revenue — never mix)
    if (input.securityDepositTZS > 0) {
      await tx.securityDeposit.create({
        data: {
          rentalAgreementId: agreement.id,
          customerId: input.customerId,
          businessId: input.businessId,
          amountTZS: new Decimal(input.securityDepositTZS)
        }
      });
    }

    // Business retains ownership — record this explicitly
    await tx.deviceOwnershipRecord.create({
      data: {
        deviceId: input.deviceId,
        ownerType: 'BUSINESS',   // ALWAYS BUSINESS for rental
        businessId: input.businessId,
        customerId: undefined,  // Never set for rental
        basis: 'RENTAL_AGREEMENT',
        agreementId: agreement.id,
        agreementType: AgreementType.RENTAL
      }
    });

    await tx.device.update({
      where: { id: input.deviceId },
      data: {
        currentCustomerId: input.customerId,
        currentAgreementId: agreement.id,
        currentAgreementType: AgreementType.RENTAL
      }
    });

    return agreement;
  });
}

// ─── Calculate Rental Charge Count ───────────────────────────────────────────

function calculateRentalChargeCount(start: Date, end: Date, frequency: PaymentFrequency): number {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (frequency) {
    case PaymentFrequency.DAILY: return Math.ceil(diffDays);
    case PaymentFrequency.WEEKLY: return Math.ceil(diffDays / 7);
    case PaymentFrequency.BIWEEKLY: return Math.ceil(diffDays / 14);
    case PaymentFrequency.MONTHLY: return Math.ceil(diffDays / 30.44);
    case PaymentFrequency.QUARTERLY: return Math.ceil(diffDays / 91.31);
    case PaymentFrequency.ANNUALLY: return Math.ceil(diffDays / 365);
    default: return Math.ceil(diffDays / 7);
  }
}

function calculateNextPaymentDate(start: Date, frequency: PaymentFrequency): Date {
  switch (frequency) {
    case PaymentFrequency.DAILY: return addDays(start, 1);
    case PaymentFrequency.WEEKLY: return addWeeks(start, 1);
    case PaymentFrequency.BIWEEKLY: return addWeeks(start, 2);
    case PaymentFrequency.MONTHLY: return addMonths(start, 1);
    case PaymentFrequency.QUARTERLY: return addQuarters(start, 1);
    case PaymentFrequency.ANNUALLY: return addYears(start, 1);
    default: return addWeeks(start, 1);
  }
}

// ─── Record Rental Payment ───────────────────────────────────────────────────

export async function recordRentalPayment(
  agreementId: string,
  businessId: string,
  amountTZS: number,
  transactionId: string,
  recordedBy: string
) {
  return prisma.$transaction(async (tx) => {
    const agreement = await tx.rentalAgreement.findFirst({
      where: { id: agreementId, businessId },
      include: {
        rentalCharges: { where: { isPaid: false }, orderBy: { chargeNumber: 'asc' } },
        securityDeposit: true
      }
    });
    if (!agreement) throw Object.assign(new Error('Rental agreement not found'), { statusCode: 404 });

    let remaining = new Decimal(amountTZS);

    // First, check if security deposit is outstanding
    if (agreement.securityDeposit && !agreement.securityDeposit.isPaid) {
      const depositOwed = new Decimal(agreement.securityDeposit.amountTZS.toString()).minus(new Decimal(agreement.securityDeposit.paidAmountTZS.toString()));
      const depositPayment = remaining.lessThan(depositOwed) ? remaining : depositOwed;

      const newDepositPaid = new Decimal(agreement.securityDeposit.paidAmountTZS.toString()).plus(depositPayment);
      const isDepositPaid = newDepositPaid.gte(new Decimal(agreement.securityDeposit.amountTZS.toString()));

      await tx.securityDeposit.update({
        where: { id: agreement.securityDeposit.id },
        data: { paidAmountTZS: newDepositPaid, isPaid: isDepositPaid, paidAt: isDepositPaid ? new Date() : null }
      });

      // Ledger entry for deposit (separate bucket — NEVER mixed with rental revenue)
      await tx.financialLedger.create({
        data: {
          businessId,
          customerId: agreement.customerId,
          rentalAgreementId: agreementId,
          agreementType: AgreementType.RENTAL,
          deviceId: agreement.deviceId,
          transactionId,
          entryType: LedgerEntryType.SECURITY_DEPOSIT,
          amountTZS: depositPayment,
          bucket: 'SECURITY_DEPOSIT',  // CRITICAL: separate bucket
          runningBalanceTZS: new Decimal(0),
          description: `Security deposit payment — ${agreement.agreementNumber}`,
          referenceNumber: agreement.agreementNumber,
          recordedBy
        }
      });

      await tx.depositTransaction.create({
        data: {
          depositId: agreement.securityDeposit.id,
          amountTZS: depositPayment,
          type: 'COLLECTION',
          description: 'Security deposit payment',
          transactionRef: transactionId
        }
      });

      remaining = remaining.minus(depositPayment);
    }

    // Apply remainder to rental charges
    const paidCharges: string[] = [];
    for (const charge of agreement.rentalCharges) {
      if (remaining.isZero()) break;

      const owed = new Decimal(charge.amountTZS.toString())
        .plus(new Decimal(charge.lateFeeAppliedTZS?.toString() ?? '0'))
        .minus(new Decimal(charge.paidAmountTZS.toString()));
      const toApply = remaining.lessThan(owed) ? remaining : owed;
      const newPaid = new Decimal(charge.paidAmountTZS.toString()).plus(toApply);
      const isPaid = newPaid.gte(
        new Decimal(charge.amountTZS.toString()).plus(new Decimal(charge.lateFeeAppliedTZS?.toString() ?? '0'))
      );

      await tx.rentalCharge.update({
        where: { id: charge.id },
        data: { paidAmountTZS: newPaid, isPaid, paidAt: isPaid ? new Date() : null, isOverdue: false }
      });

      if (isPaid) paidCharges.push(charge.id);
      remaining = remaining.minus(toApply);
    }

    // Rental ledger entry
    await tx.financialLedger.create({
      data: {
        businessId,
        customerId: agreement.customerId,
        rentalAgreementId: agreementId,
        agreementType: AgreementType.RENTAL,
        deviceId: agreement.deviceId,
        transactionId,
        entryType: LedgerEntryType.RENTAL_CHARGE,
        amountTZS: new Decimal(amountTZS).minus(remaining),
        bucket: 'RENTAL',  // NEVER mix with security deposit
        runningBalanceTZS: new Decimal(0),
        description: `Rental payment — ${agreement.agreementNumber}`,
        referenceNumber: agreement.agreementNumber,
        recordedBy
      }
    });

    // Check if all charges are paid
    const unpaidCount = await tx.rentalCharge.count({
      where: { rentalAgreementId: agreementId, isPaid: false }
    });

    let newStatus = agreement.status;
    if (unpaidCount === 0) {
      // CRITICAL: Financial settlement does NOT transfer ownership.
      // It only triggers the return/renewal workflow.
      newStatus = RentalStatus.COMPLETED;  // Financially settled
      // Business retains ownership — no ownership transfer happens here

      await scheduleNotification({
        customerId: agreement.customerId,
        type: 'RENTAL_FINANCIALLY_SETTLED',
        subject: `Your rental agreement is financially settled`,
        body: `All rental charges for agreement ${agreement.agreementNumber} have been paid. The laptop remains the property of the business. Please arrange for device return or contact us about renewal.`
      });
    } else if ([RentalStatus.RESTRICTED, RentalStatus.OVERDUE].includes(agreement.status as any)) {
      newStatus = RentalStatus.PAYMENT_VERIFICATION;
    }

    // Update next payment date
    const nextUnpaid = await tx.rentalCharge.findFirst({
      where: { rentalAgreementId: agreementId, isPaid: false },
      orderBy: { dueDate: 'asc' }
    });

    await tx.rentalAgreement.update({
      where: { id: agreementId },
      data: {
        status: newStatus,
        nextPaymentDate: nextUnpaid?.dueDate ?? agreement.endDate,
        financiallySettledAt: unpaidCount === 0 ? new Date() : null
      }
    });

    return { paidCharges, allPaid: unpaidCount === 0, remainingAmount: remaining };
  });
}

// ─── Renew Rental Agreement ──────────────────────────────────────────────────

export async function renewRentalAgreement(
  agreementId: string,
  businessId: string,
  newEndDate: Date,
  renewedBy: string
) {
  return prisma.$transaction(async (tx) => {
    const agreement = await tx.rentalAgreement.findFirst({
      where: { id: agreementId, businessId }
    });
    if (!agreement) throw Object.assign(new Error('Rental agreement not found'), { statusCode: 404 });

    const renewableStatuses = [RentalStatus.ACTIVE, RentalStatus.EXPIRING, RentalStatus.COMPLETED, RentalStatus.RENEWAL_PENDING];
    if (!renewableStatuses.includes(agreement.status as any)) {
      throw Object.assign(new Error(`Cannot renew agreement in status ${agreement.status}`), { statusCode: 409 });
    }

    // Mark old agreement as renewed
    await tx.rentalAgreement.update({
      where: { id: agreementId },
      data: { status: RentalStatus.COMPLETED }
    });

    // Create new rental agreement (renewal)
    const newAgreementNumber = await generateAgreementNumber(businessId, 'RT');
    const chargeCount = calculateRentalChargeCount(agreement.endDate, newEndDate, agreement.paymentFrequency);

    const newAgreement = await tx.rentalAgreement.create({
      data: {
        agreementNumber: newAgreementNumber,
        businessId,
        branchId: agreement.branchId,
        customerId: agreement.customerId,
        deviceId: agreement.deviceId,
        status: RentalStatus.ACTIVE,
        rentalPriceTZS: agreement.rentalPriceTZS,
        paymentFrequency: agreement.paymentFrequency,
        securityDepositTZS: new Decimal(0),  // Already collected
        totalExpectedTZS: new Decimal(agreement.rentalPriceTZS).mul(chargeCount),
        startDate: agreement.endDate,
        endDate: newEndDate,
        nextPaymentDate: calculateNextPaymentDate(agreement.endDate, agreement.paymentFrequency),
        returnDeadline: addDays(newEndDate, 7),
        gracePeriodDays: agreement.gracePeriodDays,
        defaultPolicyDays: agreement.defaultPolicyDays,
        lateFeeAmountTZS: agreement.lateFeeAmountTZS,
        lateFeeIsPercent: agreement.lateFeeIsPercent,
        isAutoRenewable: agreement.isAutoRenewable,
        renewalCount: agreement.renewalCount + 1,
        parentRentalId: agreementId,
        businessApprovedAt: new Date(),
        businessApprovedBy: renewedBy,
        customerAcceptedAt: new Date()  // Auto-accept if auto-renewable
      }
    });

    await auditLog({
      actorId: renewedBy,
      businessId,
      action: AuditAction.UPDATE,
      resource: 'RentalAgreement',
      resourceId: newAgreement.id,
      rentalAgreementId: newAgreement.id,
      changes: { after: { renewedFrom: agreementId, newEndDate } }
    });

    // Business ownership unchanged — just update device's current agreement
    await tx.device.update({
      where: { id: agreement.deviceId },
      data: { currentAgreementId: newAgreement.id }
    });

    return newAgreement;
  });
}

// ─── Request Device Return ───────────────────────────────────────────────────
// MUST be called when rental expires or terminates — device does not become customer property

export async function requestDeviceReturn(
  agreementId: string,
  businessId: string,
  requestedBy: string
) {
  return prisma.$transaction(async (tx) => {
    const agreement = await tx.rentalAgreement.findFirst({
      where: { id: agreementId, businessId },
      include: { deviceReturn: true }
    });
    if (!agreement) throw Object.assign(new Error('Rental agreement not found'), { statusCode: 404 });
    if (agreement.deviceReturn) return agreement.deviceReturn;  // Already requested

    const returnRecord = await tx.deviceReturn.create({
      data: {
        deviceId: agreement.deviceId,
        customerId: agreement.customerId,
        businessId,
        rentalAgreementId: agreementId,
        agreementType: AgreementType.RENTAL,
        status: 'REQUESTED',
        deadline: agreement.returnDeadline ?? addDays(new Date(), 7)
      }
    });

    await tx.rentalAgreement.update({
      where: { id: agreementId },
      data: { status: RentalStatus.RETURN_PENDING }
    });

    await tx.device.update({
      where: { id: agreement.deviceId },
      data: { status: DeviceStatus.RETURN_PENDING }
    });

    // Notify customer
    await scheduleNotification({
      customerId: agreement.customerId,
      type: 'RETURN_REQUESTED',
      subject: `Device return required — ${agreement.agreementNumber}`,
      body: `Your rental agreement ${agreement.agreementNumber} has ended. The laptop remains the property of the business and must be returned by ${agreement.returnDeadline?.toLocaleDateString() ?? '7 days from today'}.`
    });

    return returnRecord;
  });
}
