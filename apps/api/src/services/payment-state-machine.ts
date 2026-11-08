// Payment State Machine and Transition Guard
import { TransactionStatus, PrismaClient } from '@prisma/client';

export class InvalidStateTransitionError extends Error {
  constructor(public currentStatus: TransactionStatus, public targetStatus: TransactionStatus) {
    super(`Invalid payment status transition from ${currentStatus} to ${targetStatus}`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Strict Payment Transaction State Transitions:
 * - PENDING -> PROCESSING, COMPLETED, FAILED
 * - PROCESSING -> COMPLETED, FAILED
 * - COMPLETED -> REVERSED, REFUNDED, DISPUTED (Terminal regarding settlement)
 * - FAILED -> Terminal (retries must use a new transactionReference)
 * - REVERSED / REFUNDED -> Terminal
 */
export function isValidPaymentTransition(current: TransactionStatus, target: TransactionStatus): boolean {
  if (current === target) return true; // Idempotent

  switch (current) {
    case TransactionStatus.PENDING:
      return (
        target === TransactionStatus.PROCESSING ||
        target === TransactionStatus.COMPLETED ||
        target === TransactionStatus.FAILED
      );
    case TransactionStatus.PROCESSING:
      return target === TransactionStatus.COMPLETED || target === TransactionStatus.FAILED;
    case TransactionStatus.COMPLETED:
      return (
        target === TransactionStatus.REVERSED ||
        target === TransactionStatus.REFUNDED ||
        target === TransactionStatus.DISPUTED
      );
    case TransactionStatus.FAILED:
    case TransactionStatus.REVERSED:
    case TransactionStatus.REFUNDED:
    case TransactionStatus.DISPUTED:
      return false; // Terminal states cannot transition back to active/pending/completed
    default:
      return false;
  }
}

export function assertValidPaymentTransition(current: TransactionStatus, target: TransactionStatus): void {
  if (!isValidPaymentTransition(current, target)) {
    throw new InvalidStateTransitionError(current, target);
  }
}

export async function transitionPaymentTransaction(
  db: PrismaClient | any,
  transactionId: string,
  targetStatus: TransactionStatus,
  updateData: Record<string, any> = {}
) {
  const current = await db.paymentTransaction.findUnique({
    where: { id: transactionId },
    select: { id: true, status: true }
  });

  if (!current) {
    throw new Error(`Payment transaction ${transactionId} not found`);
  }

  assertValidPaymentTransition(current.status, targetStatus);

  return db.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      ...updateData,
      status: targetStatus
    }
  });
}
