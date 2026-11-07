import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

describe('Hire-Purchase Financial Engine & Ownership Transfer', () => {
  it('calculates contractual balances without floating point drift', () => {
    const purchasePrice = new Decimal('3200000.00'); // 3,200,000 TZS
    const depositPercent = new Decimal('0.20');       // 20% down payment
    const financingRate = new Decimal('0.15');        // 15% financing fee
    const months = new Decimal('12');

    const depositAmount = purchasePrice.times(depositPercent);
    const financedPrincipal = purchasePrice.minus(depositAmount);
    const financingCharge = financedPrincipal.times(financingRate);
    const totalContractual = depositAmount.plus(financedPrincipal).plus(financingCharge);
    const monthlyInstalment = financedPrincipal.plus(financingCharge).dividedBy(months);

    expect(depositAmount.toString()).toBe('640000');
    expect(financedPrincipal.toString()).toBe('2560000');
    expect(financingCharge.toString()).toBe('384000');
    expect(totalContractual.toString()).toBe('3584000');
    expect(monthlyInstalment.toDecimalPlaces(2).toString()).toBe('245333.33');
  });

  it('enforces ownership transfer invariants strictly for hire-purchase only', () => {
    interface Agreement {
      type: 'HIRE_PURCHASE' | 'RENTAL';
      status: string;
      totalPaidTZS: number;
      totalContractualTZS: number;
      hasOutstandingFees: boolean;
      ownershipTransferred: boolean;
    }

    const canTransferOwnership = (ag: Agreement): { allowed: boolean; reason?: string } => {
      // Rule 1: Rental agreements NEVER transfer ownership
      if (ag.type === 'RENTAL') {
        return { allowed: false, reason: 'Rental agreements retain business ownership permanently' };
      }

      // Rule 2: Cannot transfer twice (idempotency)
      if (ag.ownershipTransferred) {
        return { allowed: false, reason: 'Ownership already transferred' };
      }

      // Rule 3: Must be 100% paid
      if (ag.totalPaidTZS < ag.totalContractualTZS) {
        return { allowed: false, reason: 'Agreement has unpaid principal or financing balance' };
      }

      // Rule 4: No outstanding late fees or penalties
      if (ag.hasOutstandingFees) {
        return { allowed: false, reason: 'Outstanding late fees must be cleared' };
      }

      return { allowed: true };
    };

    // Case 1: Rental cannot transfer
    const rental: Agreement = {
      type: 'RENTAL',
      status: 'COMPLETED',
      totalPaidTZS: 2000000,
      totalContractualTZS: 2000000,
      hasOutstandingFees: false,
      ownershipTransferred: false,
    };
    expect(canTransferOwnership(rental).allowed).toBe(false);

    // Case 2: Incomplete hire-purchase
    const incompleteHP: Agreement = {
      type: 'HIRE_PURCHASE',
      status: 'ACTIVE',
      totalPaidTZS: 3000000,
      totalContractualTZS: 3584000,
      hasOutstandingFees: false,
      ownershipTransferred: false,
    };
    expect(canTransferOwnership(incompleteHP).allowed).toBe(false);

    // Case 3: Fully paid hire-purchase
    const fullyPaidHP: Agreement = {
      type: 'HIRE_PURCHASE',
      status: 'ACTIVE',
      totalPaidTZS: 3584000,
      totalContractualTZS: 3584000,
      hasOutstandingFees: false,
      ownershipTransferred: false,
    };
    expect(canTransferOwnership(fullyPaidHP).allowed).toBe(true);
  });
});
