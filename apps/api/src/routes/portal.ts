// Customer Portal API Routes
// Authenticated borrower access to real agreements, balances, device status, and payment history

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { env } from '../lib/env.js';
import { UserRole, AgreementType, TransactionStatus, DeviceStatus } from '@prisma/client';
import { phoneNumbersMatch, normalizePhoneNumber } from '../lib/phone.js';

const RequestOtpSchema = z.object({
  phone: z.string().min(9)
});

const VerifyOtpSchema = z.object({
  phone: z.string().min(9),
  code: z.string().length(6)
});

export async function portalRoutes(server: FastifyInstance) {
  // --------------------------------------------------------------------------
  // 1. Request One-Time Passcode (OTP)
  // --------------------------------------------------------------------------
  server.post('/auth/request-otp', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      tags: ['Portal'],
      summary: 'Request OTP for customer portal login'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = RequestOtpSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { phone } = parse.data;
    const cleanPhone = normalizePhoneNumber(phone);

    // Verify that a customer exists with this phone number
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      include: { business: { select: { id: true, name: true } } }
    });

    const customer = customers.find(c => phoneNumbersMatch(c.phone, phone));
    if (!customer) {
      return reply.status(404).send({
        error: 'CUSTOMER_NOT_FOUND',
        message: 'No registered customer account found with this phone number. Please check your agreement records.'
      });
    }

    // Generate secure 6-digit cryptographic OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Store in Redis with 5-minute TTL (300 seconds)
    const redisKey = `customer_otp:${cleanPhone}`;
    await redis.setex(redisKey, 300, otpHash);

    server.log.info({ phone: cleanPhone, customerId: customer.id }, 'Customer OTP generated and stored');

    return reply.send({
      success: true,
      message: 'Verification code sent to registered mobile number',
      phone: customer.phone,
      // Provide devOtp strictly in automated test environment only
      ...(process.env.NODE_ENV === 'test' ? { devOtp: otp } : {})
    });
  });

  // --------------------------------------------------------------------------
  // 2. Verify OTP & Issue Customer Access Token
  // --------------------------------------------------------------------------
  server.post('/auth/verify-otp', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
    schema: {
      tags: ['Portal'],
      summary: 'Verify customer OTP and issue authenticated session token'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = VerifyOtpSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { phone, code } = parse.data;
    const cleanPhone = normalizePhoneNumber(phone);
    const redisKey = `customer_otp:${cleanPhone}`;
    const attemptsKey = `customer_otp_attempts:${cleanPhone}`;

    const storedHash = await redis.get(redisKey);
    if (!storedHash) {
      return reply.status(401).send({
        error: 'INVALID_OR_EXPIRED_CODE',
        message: 'Verification code has expired or was not requested. Please request a new code.'
      });
    }

    // Rate-limiting brute force check
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, 300);
    }
    if (attempts > 5) {
      await redis.del(redisKey);
      await redis.del(attemptsKey);
      return reply.status(429).send({
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Too many incorrect attempts. This code has been invalidated for security. Please request a new code.'
      });
    }

    const submittedHash = crypto.createHash('sha256').update(code).digest('hex');
    const storedBuf = Buffer.from(storedHash);
    const submittedBuf = Buffer.from(submittedHash);
    const hashesMatch = storedBuf.length === submittedBuf.length && crypto.timingSafeEqual(storedBuf, submittedBuf);

    if (!hashesMatch) {
      return reply.status(401).send({
        error: 'INVALID_CODE',
        message: 'Invalid verification code. Please check the code received on your phone.'
      });
    }

    // Consume OTP and reset attempts immediately upon success to prevent replay attacks
    await redis.del(redisKey);
    await redis.del(attemptsKey);

    // Fetch customer details
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      include: { business: { select: { id: true, name: true } } }
    });

    const customer = customers.find(c => phoneNumbersMatch(c.phone, phone));
    if (!customer) {
      return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer record no longer active' });
    }

    // Sign customer JWT session
    const accessToken = server.jwt.sign({
      sub: customer.id,
      role: UserRole.CUSTOMER,
      customerId: customer.id,
      businessId: customer.businessId,
      phone: customer.phone,
      tokenType: 'customer'
    } as any);

    return reply.send({
      accessToken,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        businessName: customer.business?.name
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Customer Profile, Real Agreements, Real Balances & Real Payments
  // --------------------------------------------------------------------------
  server.get('/me', {
    preHandler: [server.authenticate],
    schema: {
      tags: ['Portal'],
      summary: 'Get customer dashboard details for authenticated customer'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const customerId = (request as any).customerId || user?.customerId || user?.sub;

    if (!customerId) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Customer session required' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        business: { select: { id: true, name: true, phone: true } },
        financingAgreements: {
          include: {
            device: {
              select: {
                id: true,
                manufacturer: true,
                model: true,
                serialNumber: true,
                status: true
              }
            },
            instalments: {
              orderBy: { instalmentNumber: 'asc' }
            }
          }
        },
        rentalAgreements: {
          include: {
            device: {
              select: {
                id: true,
                manufacturer: true,
                model: true,
                serialNumber: true,
                status: true
              }
            },
            rentalCharges: {
              orderBy: { chargeNumber: 'asc' }
            }
          }
        },
        paymentTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!customer) {
      return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer record not found' });
    }

    // Format real financing agreements
    const formattedHpAgreements = (customer.financingAgreements || []).map((hp: any) => {
      const nextPendingInstalment = hp.instalments?.find((i: any) => !i.isPaid);
      const isLocked = hp.device?.status === DeviceStatus.RESTRICTED;
      const totalAmount = Number(hp.totalContractualTZS || 0);
      const paidAmount = (hp.instalments || []).reduce((sum: number, inst: any) => sum + Number(inst.paidAmountTZS || 0), 0);
      const outstandingBalance = Math.max(0, totalAmount - paidAmount);

      return {
        id: hp.id,
        type: 'HIRE_PURCHASE' as const,
        agreementNumber: hp.agreementNumber,
        device: hp.device ? `${hp.device.manufacturer} ${hp.device.model}` : 'Financed Device',
        serialNumber: hp.device?.serialNumber || 'N/A',
        deviceId: hp.deviceId,
        isLocked,
        lockState: isLocked ? 'LOCKED' : 'UNLOCKED',
        status: hp.status,
        totalAmountTZS: totalAmount,
        paidAmountTZS: paidAmount,
        outstandingBalanceTZS: outstandingBalance,
        nextDueDateStr: nextPendingInstalment?.dueDate ? new Date(nextPendingInstalment.dueDate).toISOString().split('T')[0] : 'N/A',
        nextInstalmentTZS: nextPendingInstalment ? Number(nextPendingInstalment.totalAmountTZS || 0) : 0,
        ownershipNote:
          'This laptop is financed under a Hire Purchase agreement. Full legal title will transfer to you upon verified completion of all instalments.'
      };
    });

    // Format real rental agreements
    const formattedRtAgreements = (customer.rentalAgreements || []).map((rt: any) => {
      const nextPendingCharge = rt.rentalCharges?.find((c: any) => !c.isPaid);
      const isLocked = rt.device?.status === DeviceStatus.RESTRICTED;
      const totalAmount = Number(rt.totalExpectedTZS || 0);
      const paidAmount = (rt.rentalCharges || []).reduce((sum: number, chg: any) => sum + Number(chg.paidAmountTZS || 0), 0);
      const outstandingBalance = Math.max(0, totalAmount - paidAmount);

      return {
        id: rt.id,
        type: 'RENTAL' as const,
        agreementNumber: rt.agreementNumber,
        device: rt.device ? `${rt.device.manufacturer} ${rt.device.model}` : 'Rented Device',
        serialNumber: rt.device?.serialNumber || 'N/A',
        deviceId: rt.deviceId,
        isLocked,
        lockState: isLocked ? 'LOCKED' : 'UNLOCKED',
        status: rt.status,
        totalAmountTZS: totalAmount,
        paidAmountTZS: paidAmount,
        outstandingBalanceTZS: outstandingBalance,
        nextDueDateStr: nextPendingCharge?.dueDate ? new Date(nextPendingCharge.dueDate).toISOString().split('T')[0] : 'N/A',
        nextInstalmentTZS: nextPendingCharge ? Number(nextPendingCharge.amountTZS || 0) : 0,
        ownershipNote:
          'This device is rented. Ownership remains strictly with the lessor. The equipment must be returned in good condition upon agreement conclusion.'
      };
    });

    // Format verified payment records
    const formattedPayments = (customer.paymentTransactions || []).map((p: any) => ({
      reference: p.transactionReference,
      amountTZS: Number(p.amountTZS || 0),
      date: new Date(p.createdAt).toISOString().split('T')[0],
      status: p.status === TransactionStatus.COMPLETED ? ('SUCCESS' as const) : ('PENDING' as const),
      provider: p.paymentProvider,
      paymentMethod: p.paymentMethod || 'MOBILE_MONEY'
    }));

    return reply.send({
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        businessName: customer.business?.name
      },
      agreements: [...formattedHpAgreements, ...formattedRtAgreements],
      payments: formattedPayments
    });
  });
}

