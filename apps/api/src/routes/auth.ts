// Authentication routes — Register, Login, Refresh, MFA, Logout
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { TOTP } from 'otpauth';
import * as crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { env } from '../lib/env.js';
import { auditLog } from '../services/audit.js';
import { AuditAction, UserRole } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().optional(),
  // Business info (creates business + owner in one step)
  businessName: z.string().min(2).max(200),
  businessEmail: z.string().email(),
  businessPhone: z.string(),
  businessAddress: z.string().optional(),
  businessCity: z.string().optional(),
  businessRegistrationNumber: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaCode: z.string().length(6).optional()
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

const mfaSetupSchema = z.object({
  code: z.string().length(6)  // Confirm MFA is working before enabling
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128)
});

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function generateAgreementNumber(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function generateTokens(server: FastifyInstance, userId: string, role: UserRole, businessId?: string) {
  const accessToken = server.jwt.sign({
    sub: userId,
    role,
    businessId,
    tokenType: 'user'
  } as any);

  const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt }
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

export async function authRoutes(server: FastifyInstance) {
  // POST /api/v1/auth/register — Business owner registration
  server.post('/register', {
    schema: {
      description: 'Register a new business and owner account',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'businessName', 'businessEmail', 'businessPhone'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          phone: { type: 'string' },
          businessName: { type: 'string' },
          businessEmail: { type: 'string', format: 'email' },
          businessPhone: { type: 'string' },
          businessAddress: { type: 'string' },
          businessCity: { type: 'string' },
          businessRegistrationNumber: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: 'CONFLICT', message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    // Create business + user + employee + default roles in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the business
      const business = await tx.business.create({
        data: {
          name: body.businessName,
          email: body.businessEmail,
          phone: body.businessPhone,
          address: body.businessAddress,
          city: body.businessCity,
          registrationNumber: body.businessRegistrationNumber,
          status: 'PENDING_VERIFICATION'
        }
      });

      // Assign a default STARTER subscription
      const starterPlan = await tx.plan.findFirst({
        where: { plan: 'STARTER', isActive: true }
      });

      if (starterPlan) {
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(now.getDate() + 30);

        await tx.subscription.create({
          data: {
            businessId: business.id,
            planId: starterPlan.id,
            status: 'TRIALING',
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd,
            trialEndsAt: trialEnd
          }
        });
      }

      // Create the user
      const user = await tx.user.create({
        data: {
          email: body.email,
          phone: body.phone,
          passwordHash,
          role: UserRole.BUSINESS_OWNER,
          isActive: true
        }
      });

      // Create employee record
      const nameParts = body.email.split('@')[0].split('.');
      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          businessId: business.id,
          firstName: nameParts[0] ?? 'Owner',
          lastName: nameParts[1] ?? '',
          position: 'Owner'
        }
      });

      // Create a default branch (head office)
      await tx.branch.create({
        data: {
          businessId: business.id,
          name: 'Head Office',
          address: body.businessAddress,
          phone: body.businessPhone
        }
      });

      return { user, business, employee };
    });

    await auditLog({
      actorId: result.user.id,
      actorRole: UserRole.BUSINESS_OWNER,
      businessId: result.business.id,
      action: AuditAction.CREATE,
      resource: 'Business',
      resourceId: result.business.id,
      changes: { after: { businessName: body.businessName, ownerEmail: body.email } }
    });

    const tokens = await generateTokens(server, result.user.id, UserRole.BUSINESS_OWNER, result.business.id);

    return reply.status(201).send({
      message: 'Registration successful. Your business account is pending verification.',
      user: { id: result.user.id, email: result.user.email, role: result.user.role },
      business: { id: result.business.id, name: result.business.name, status: result.business.status },
      ...tokens
    });
  });

  // POST /api/v1/auth/login
  server.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
    schema: {
      description: 'Login with email and password (optionally MFA code)',
      tags: ['Auth']
    }
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const cleanEmail = body.email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: 'insensitive' } },
      include: { employee: { select: { businessId: true } } }
    });

    if (!user || !user.isActive) {
      server.log.warn({ email: cleanEmail }, 'Login attempt: user not found or inactive');
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordValid) {
      server.log.warn({ userId: user.id, email: cleanEmail }, 'Login attempt: invalid password');
      // Log failed attempt
      await auditLog({
        actorId: user.id,
        action: AuditAction.LOGIN,
        resource: 'User',
        resourceId: user.id,
        metadata: { success: false, reason: 'Invalid password', ip: request.ip }
      });
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    // MFA check
    if (user.mfaEnabled) {
      if (!body.mfaCode) {
        return reply.status(200).send({ mfaRequired: true, message: 'MFA code required' });
      }

      if (!user.mfaSecret) {
        return reply.status(500).send({ error: 'MFA_ERROR', message: 'MFA configuration error' });
      }

      const totp = new TOTP({ secret: user.mfaSecret, algorithm: 'SHA1', digits: 6, period: 30 });
      const valid = totp.validate({ token: body.mfaCode, window: 1 });
      if (valid === null) {
        return reply.status(401).send({ error: 'INVALID_MFA', message: 'Invalid MFA code' });
      }
    }

    let businessId = user.employee?.businessId;
    if (!businessId && user.role === UserRole.SUPER_ADMIN) {
      const activeBiz = await prisma.business.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      }) || await prisma.business.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      businessId = activeBiz?.id;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await auditLog({
      actorId: user.id,
      actorRole: user.role,
      businessId,
      action: AuditAction.LOGIN,
      resource: 'User',
      resourceId: user.id,
      metadata: { success: true, ip: request.ip }
    });

    const tokens = await generateTokens(server, user.id, user.role, businessId);

    return reply.send({
      user: { id: user.id, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled, businessId },
      businessId,
      ...tokens
    });
  });

  // POST /api/v1/auth/refresh
  server.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    const tokenHash = crypto.createHash('sha256').update(body.refreshToken).digest('hex');

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { employee: { select: { businessId: true } } } } }
    });

    if (stored && stored.revokedAt) {
      // Refresh token reuse detected! Compromised token family -> Revoke all tokens for this user
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await auditLog({
        actorId: stored.userId,
        actorRole: stored.user?.role,
        action: AuditAction.UPDATE,
        resource: 'RefreshTokenFamily',
        resourceId: stored.id,
        metadata: { alert: 'REFRESH_TOKEN_REUSE_DETECTED', ip: request.ip }
      });
      return reply.status(401).send({
        error: 'REVOKED_TOKEN_REUSE',
        message: 'Security alert: Refresh token reuse detected. All active sessions have been revoked.'
      });
    }

    if (!stored || stored.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'INVALID_TOKEN', message: 'Refresh token invalid or expired' });
    }

    if (!stored.user.isActive) {
      return reply.status(401).send({ error: 'ACCOUNT_INACTIVE', message: 'Account is inactive' });
    }

    // Rotate — revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    const businessId = stored.user.employee?.businessId;
    const tokens = await generateTokens(server, stored.userId, stored.user.role, businessId);

    return reply.send(tokens);
  });

  // POST /api/v1/auth/logout
  server.post('/logout', {
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const body = refreshSchema.safeParse(request.body);
    if (body.success) {
      const tokenHash = crypto.createHash('sha256').update(body.data.refreshToken).digest('hex');
      await prisma.refreshToken.updateMany({
        where: { tokenHash, userId: currentUser.sub },
        data: { revokedAt: new Date() }
      });
    }

    await auditLog({
      actorId: currentUser.sub,
      actorRole: currentUser.role,
      businessId: currentUser.businessId,
      action: AuditAction.LOGOUT,
      resource: 'User',
      resourceId: currentUser.sub
    });

    return reply.send({ message: 'Logged out successfully' });
  });

  // GET /api/v1/auth/mfa/setup — Generate TOTP secret and QR code
  server.get('/mfa/setup', {
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const user = await prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: { email: true, mfaEnabled: true }
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (user.mfaEnabled) return reply.status(409).send({ error: 'MFA_ALREADY_ENABLED' });

    const totp = new TOTP({
      issuer: 'HatLock by Luxeenet',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    });

    const secret = totp.secret.base32;

    // Store pending secret temporarily in Redis (not in DB until confirmed)
    await redis.setex(`mfa:pending:${currentUser.sub}`, 600, secret);

    const qrDataUrl = totp.toString(); // otpauth URI

    return reply.send({
      secret,
      otpauthUri: qrDataUrl,
      instructions: 'Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.), then confirm with a 6-digit code to enable MFA.'
    });
  });

  // POST /api/v1/auth/mfa/enable — Confirm and enable MFA
  server.post('/mfa/enable', {
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const body = mfaSetupSchema.parse(request.body);

    const pendingSecret = await redis.get(`mfa:pending:${currentUser.sub}`);
    if (!pendingSecret) {
      return reply.status(400).send({ error: 'NO_PENDING_SETUP', message: 'No pending MFA setup. Call /mfa/setup first.' });
    }

    const totp = new TOTP({ secret: pendingSecret, algorithm: 'SHA1', digits: 6, period: 30 });
    const valid = totp.validate({ token: body.code, window: 1 });
    if (valid === null) {
      return reply.status(400).send({ error: 'INVALID_CODE', message: 'MFA code verification failed' });
    }

    await prisma.user.update({
      where: { id: currentUser.sub },
      data: { mfaEnabled: true, mfaSecret: pendingSecret }  // In production: encrypt mfaSecret
    });

    await redis.del(`mfa:pending:${currentUser.sub}`);

    await auditLog({
      actorId: currentUser.sub,
      actorRole: currentUser.role,
      businessId: currentUser.businessId,
      action: AuditAction.MFA_ENABLE,
      resource: 'User',
      resourceId: currentUser.sub
    });

    return reply.send({ message: 'MFA enabled successfully' });
  });

  // POST /api/v1/auth/mfa/disable
  server.post('/mfa/disable', {
    preHandler: [server.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const body = z.object({
      password: z.string(),
      mfaCode: z.string().length(6)
    }).parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: currentUser.sub } });
    if (!user || !user.mfaEnabled) return reply.status(400).send({ error: 'MFA_NOT_ENABLED' });

    const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordValid) return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });

    const totp = new TOTP({ secret: user.mfaSecret!, algorithm: 'SHA1', digits: 6, period: 30 });
    const valid = totp.validate({ token: body.mfaCode, window: 1 });
    if (valid === null) return reply.status(401).send({ error: 'INVALID_MFA' });

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null }
    });

    await auditLog({
      actorId: user.id,
      actorRole: user.role,
      businessId: currentUser.businessId,
      action: AuditAction.MFA_DISABLE,
      resource: 'User',
      resourceId: user.id
    });

    return reply.send({ message: 'MFA disabled' });
  });

  // POST /api/v1/auth/change-password
  server.post('/change-password', {
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const body = changePasswordSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: currentUser.sub } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

    // Revoke all refresh tokens except current session
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    return reply.send({ message: 'Password changed successfully. Please log in again.' });
  });

  // GET /api/v1/auth/me
  server.get('/me', {
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const user = await prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: {
        id: true, email: true, phone: true, role: true,
        mfaEnabled: true, lastLoginAt: true, createdAt: true,
        employee: {
          select: {
            businessId: true, branchId: true, firstName: true, lastName: true, position: true,
            business: { select: { id: true, name: true, status: true } }
          }
        }
      }
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send(user);
  });

  // PATCH /api/v1/auth/me
  server.patch('/me', {
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    const currentUser = request.user as any;
    const body = z.object({
      phone: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      position: z.string().optional()
    }).parse(request.body);

    const user = await prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: { employee: true }
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (body.phone !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: body.phone }
      });
    }

    if (user.employee && (body.firstName || body.lastName || body.position)) {
      await prisma.employee.update({
        where: { id: user.employee.id },
        data: {
          firstName: body.firstName || user.employee.firstName,
          lastName: body.lastName || user.employee.lastName,
          position: body.position || user.employee.position
        }
      });
    }

    return reply.send({ message: 'Profile updated successfully' });
  });
}
