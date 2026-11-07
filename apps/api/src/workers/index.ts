// HatLock Background Workers & Schedulers
// Automates:
// 1. Overdue agreement detection & grace period transitions
// 2. Grace period expiration -> Restriction command dispatch
// 3. Stale command expiration

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { issueRestrictionCommand } from '../services/device-commands.js';
import { AgreementType, HirePurchaseStatus, RentalStatus } from '@prisma/client';

let intervalTimer: NodeJS.Timeout | null = null;

export async function processOverdueAgreements() {
  const now = new Date();
  try {
    // 1. Process Hire Purchase Agreements that have unpaid past-due instalments
    const overdueHp = await prisma.financingAgreement.findMany({
      where: {
        status: { in: [HirePurchaseStatus.ACTIVE, HirePurchaseStatus.PAYMENT_DUE, HirePurchaseStatus.GRACE_PERIOD] },
        instalments: {
          some: {
            isPaid: false,
            dueDate: { lt: now }
          }
        }
      },
      include: {
        device: true,
        business: true,
        instalments: {
          where: { isPaid: false, dueDate: { lt: now } },
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    for (const agreement of overdueHp) {
      const firstOverdue = agreement.instalments[0];
      if (!firstOverdue) continue;

      const graceDays = agreement.gracePeriodDays || 3;
      const graceEnd = firstOverdue.gracePeriodEndsAt || new Date(firstOverdue.dueDate.getTime() + graceDays * 86400000);

      if (now > graceEnd) {
        // Grace period expired -> Restrict device
        logger.warn(`Hire purchase ${agreement.agreementNumber} grace period expired. Applying restriction.`);

        await prisma.financingAgreement.update({
          where: { id: agreement.id },
          data: { status: HirePurchaseStatus.RESTRICTED }
        });

        if (agreement.deviceId && agreement.device) {
          const unpaidBalance = Number(firstOverdue.totalAmountTZS) - Number(firstOverdue.paidAmountTZS);
          await issueRestrictionCommand(
            agreement.deviceId,
            agreement.businessId,
            agreement.id,
            AgreementType.HIRE_PURCHASE,
            {
              type: 'RESTRICT',
              restrictionType: 'OVERLAY_LOCK',
              businessName: agreement.business.name,
              agreementNumber: agreement.agreementNumber,
              agreementType: 'HIRE_PURCHASE',
              deviceDetails: `${agreement.device.manufacturer} ${agreement.device.model} (${agreement.device.serialNumber})`,
              reason: 'Payment overdue and grace period expired',
              outstandingAmountTZS: unpaidBalance > 0 ? unpaidBalance : Number(agreement.instalmentAmountTZS),
              currency: 'TZS',
              paymentInstructions: 'Please make payment via HatPesa mobile money to immediately restore access.',
              supportContact: agreement.business.phone || 'support@luxeenet.com',
              recoveryInstructions: 'Contact your financing provider to settle arrears.'
            },
            'SYSTEM_WATCHDOG'
          );
        }
      } else {
        // In grace period
        if (agreement.status !== HirePurchaseStatus.GRACE_PERIOD) {
          await prisma.financingAgreement.update({
            where: { id: agreement.id },
            data: { status: HirePurchaseStatus.GRACE_PERIOD }
          });
        }
      }
    }

    // 2. Process Rental Agreements that have unpaid past-due charges
    const overdueRentals = await prisma.rentalAgreement.findMany({
      where: {
        status: { in: [RentalStatus.ACTIVE, RentalStatus.PAYMENT_DUE, RentalStatus.GRACE_PERIOD] },
        rentalCharges: {
          some: {
            isPaid: false,
            dueDate: { lt: now }
          }
        }
      },
      include: {
        device: true,
        business: true,
        rentalCharges: {
          where: { isPaid: false, dueDate: { lt: now } },
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    for (const agreement of overdueRentals) {
      const firstOverdue = agreement.rentalCharges[0];
      if (!firstOverdue) continue;

      const graceDays = agreement.gracePeriodDays || 3;
      const graceEnd = firstOverdue.gracePeriodEndsAt || new Date(firstOverdue.dueDate.getTime() + graceDays * 86400000);

      if (now > graceEnd) {
        logger.warn(`Rental agreement ${agreement.agreementNumber} overdue. Applying restriction.`);

        await prisma.rentalAgreement.update({
          where: { id: agreement.id },
          data: { status: RentalStatus.RESTRICTED }
        });

        if (agreement.deviceId && agreement.device) {
          const unpaidBalance = Number(firstOverdue.amountTZS) - Number(firstOverdue.paidAmountTZS);
          await issueRestrictionCommand(
            agreement.deviceId,
            agreement.businessId,
            agreement.id,
            AgreementType.RENTAL,
            {
              type: 'RESTRICT',
              restrictionType: 'OVERLAY_LOCK',
              businessName: agreement.business.name,
              agreementNumber: agreement.agreementNumber,
              agreementType: 'RENTAL',
              deviceDetails: `${agreement.device.manufacturer} ${agreement.device.model} (${agreement.device.serialNumber})`,
              reason: 'Rental payment overdue and grace period expired',
              outstandingAmountTZS: unpaidBalance > 0 ? unpaidBalance : Number(agreement.rentalPriceTZS),
              currency: 'TZS',
              paymentInstructions: 'Please make payment via HatPesa mobile money to immediately restore access.',
              supportContact: agreement.business.phone || 'support@luxeenet.com',
              recoveryInstructions: 'Contact lessor to renew or return rental laptop.'
            },
            'SYSTEM_WATCHDOG'
          );
        }
      } else {
        if (agreement.status !== RentalStatus.GRACE_PERIOD) {
          await prisma.rentalAgreement.update({
            where: { id: agreement.id },
            data: { status: RentalStatus.GRACE_PERIOD }
          });
        }
      }
    }

    // 3. Mark expired pending commands as EXPIRED
    const expiredCommands = await prisma.deviceCommand.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    if (expiredCommands.count > 0) {
      logger.info(`Expired ${expiredCommands.count} stale device commands.`);
    }

  } catch (err) {
    logger.error(err, 'Error running automated overdue check worker');
  }
}

export async function startWorkers() {
  logger.info('Initializing background jobs worker (30-second watchdog cycle)...');
  
  // Run once on startup
  processOverdueAgreements().catch(err => logger.error(err, 'Initial worker run error'));

  // Run periodically
  intervalTimer = setInterval(() => {
    processOverdueAgreements().catch(err => logger.error(err, 'Worker run error'));
  }, 30000);
}

export async function stopWorkers() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
    logger.info('Background workers stopped cleanly.');
  }
}
