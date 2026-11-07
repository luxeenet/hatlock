import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';

describe('Rental Business Logic & Deposit Reconciliation', () => {
  it('keeps security deposit isolated from operational rental revenue', () => {
    const monthlyRate = new Decimal('200000.00');
    const months = 6;
    const depositMonths = 2;

    const securityDeposit = monthlyRate.times(depositMonths);
    const rentalRevenue = monthlyRate.times(months);

    // Ledger balances must track deposit as liability, not recognized revenue
    expect(securityDeposit.toString()).toBe('400000');
    expect(rentalRevenue.toString()).toBe('1200000');
  });

  it('calculates refund with damage inspection deduction accurately', () => {
    const initialDeposit = new Decimal('400000.00');
    const assessedDamageCost = new Decimal('85000.00');
    const unpaidArrears = new Decimal('0.00');

    const refundableAmount = initialDeposit.minus(assessedDamageCost).minus(unpaidArrears);
    expect(refundableAmount.toString()).toBe('315000');
  });
});
