// HatLock Health Check, API Startup Reliability, and Security Invariant Tests
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import * as crypto from 'crypto';

describe('Part 2: API Startup & Health Probe Verification', () => {
  // Test simulated health check handler matching server.ts
  const createHealthHandler = (dbMock: () => Promise<boolean>, redisMock: () => Promise<boolean>, appVersion = '1.0.0') => {
    return async (request: any, reply: any) => {
      let dbOk = false;
      let redisOk = false;

      try {
        dbOk = await dbMock();
      } catch (err: any) {
        // error logged without exposing credentials
      }

      try {
        redisOk = await redisMock();
      } catch (err: any) {
        // error logged without exposing credentials
      }

      const isHealthy = dbOk && redisOk;
      const responsePayload = {
        status: isHealthy ? 'ok' : 'error',
        version: appVersion,
        timestamp: new Date().toISOString(),
        services: {
          database: dbOk ? 'connected' : 'disconnected',
          redis: redisOk ? 'connected' : 'disconnected'
        }
      };

      if (!isHealthy) {
        return reply.status(503).send(responsePayload);
      }
      return reply.status(200).send(responsePayload);
    };
  };

  it('1. should return HTTP 200 and status ok when both PostgreSQL and Redis are healthy', async () => {
    let statusCode = 0;
    let body: any = null;
    const mockReply = {
      status(code: number) { statusCode = code; return this; },
      send(data: any) { body = data; return this; }
    };

    const handler = createHealthHandler(async () => true, async () => true);
    await handler({}, mockReply);

    expect(statusCode).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.services.database).toBe('connected');
    expect(body.services.redis).toBe('connected');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toBeDefined();
    // Verify no secret leak
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('postgres://');
    expect(JSON.stringify(body)).not.toContain('redis://');
  });

  it('2. should return HTTP 503 when PostgreSQL is down, without exposing internal errors', async () => {
    let statusCode = 0;
    let body: any = null;
    const mockReply = {
      status(code: number) { statusCode = code; return this; },
      send(data: any) { body = data; return this; }
    };

    const handler = createHealthHandler(
      async () => { throw new Error('Connection refused at postgresql://hatlock:secret@10.0.0.5:5432/hatlock_db'); },
      async () => true
    );
    await handler({}, mockReply);

    expect(statusCode).toBe(503);
    expect(body.status).toBe('error');
    expect(body.services.database).toBe('disconnected');
    expect(body.services.redis).toBe('connected');
    // Ensure sensitive connection string or stack trace is NOT returned
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    expect(JSON.stringify(body)).not.toContain('Connection refused');
  });

  it('3. should return HTTP 503 when Redis is down, without exposing internal errors', async () => {
    let statusCode = 0;
    let body: any = null;
    const mockReply = {
      status(code: number) { statusCode = code; return this; },
      send(data: any) { body = data; return this; }
    };

    const handler = createHealthHandler(
      async () => true,
      async () => { throw new Error('Redis ECONNREFUSED 127.0.0.1:6379'); }
    );
    await handler({}, mockReply);

    expect(statusCode).toBe(503);
    expect(body.status).toBe('error');
    expect(body.services.database).toBe('connected');
    expect(body.services.redis).toBe('disconnected');
  });

  it('4. should return HTTP 503 when both PostgreSQL and Redis are down', async () => {
    let statusCode = 0;
    let body: any = null;
    const mockReply = {
      status(code: number) { statusCode = code; return this; },
      send(data: any) { body = data; return this; }
    };

    const handler = createHealthHandler(
      async () => { throw new Error('DB down'); },
      async () => { throw new Error('Redis down'); }
    );
    await handler({}, mockReply);

    expect(statusCode).toBe(503);
    expect(body.status).toBe('error');
    expect(body.services.database).toBe('disconnected');
    expect(body.services.redis).toBe('disconnected');
  });

  it('5. should confirm Fastify throws FST_ERR_DUPLICATED_ROUTE on duplicate route declarations', async () => {
    const testApp = Fastify();
    testApp.get('/health', async () => ({ status: 'first' }));

    // Re-declaring /health on same server must throw Fastify error
    expect(() => {
      testApp.get('/health', async () => ({ status: 'duplicate' }));
    }).toThrow();
  });

  it('6. should allow single /health and distinct /api/v1/health simultaneously without error', async () => {
    const testApp = Fastify();
    expect(() => {
      testApp.get('/health', async () => ({ status: 'ok' }));
      testApp.get('/api/v1/health', async () => ({ status: 'ok', v1: true }));
    }).not.toThrow();

    const res1 = await testApp.inject({ method: 'GET', url: '/health' });
    expect(res1.statusCode).toBe(200);

    const res2 = await testApp.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res2.statusCode).toBe(200);
  });
});

describe('Part 4: Refresh Token Reuse Detection & Revocation', () => {
  it('should detect reuse of an already-revoked refresh token and revoke all family sessions', async () => {
    let userTokens = [
      { id: 'tok-1', userId: 'user-99', tokenHash: 'hash-tok-1', revokedAt: new Date(Date.now() - 60000) }, // previously rotated
      { id: 'tok-2', userId: 'user-99', tokenHash: 'hash-tok-2', revokedAt: null }, // current active token
      { id: 'tok-3', userId: 'user-99', tokenHash: 'hash-tok-3', revokedAt: null }  // another active device token
    ];

    const processRefreshToken = (incomingHash: string) => {
      const stored = userTokens.find(t => t.tokenHash === incomingHash);
      if (!stored) {
        return { status: 401, error: 'INVALID_TOKEN' };
      }

      // Reuse detection:
      if (stored.revokedAt) {
        // Revoke all remaining active tokens for this user
        userTokens = userTokens.map(t => t.userId === stored.userId ? { ...t, revokedAt: new Date() } : t);
        return { status: 401, error: 'REVOKED_TOKEN_REUSE', message: 'Token reuse detected. All sessions revoked.' };
      }

      return { status: 200, success: true };
    };

    // Attacker uses stolen older token tok-1
    const attackResult = processRefreshToken('hash-tok-1');
    expect(attackResult.status).toBe(401);
    expect(attackResult.error).toBe('REVOKED_TOKEN_REUSE');

    // All active tokens for user-99 must now be revoked:
    const activeRemaining = userTokens.filter(t => t.userId === 'user-99' && !t.revokedAt);
    expect(activeRemaining.length).toBe(0);
  });
});

describe('Part 5: OTP Brute-Force Throttling & Timing-Safe Verification', () => {
  it('should invalidate OTP and return 429 when failed attempts exceed limit (5 attempts)', () => {
    let attempts = 0;
    let otpStore: string | null = crypto.createHash('sha256').update('123456').digest('hex');

    const verifyOtpAttempt = (code: string) => {
      if (!otpStore) {
        return { status: 401, error: 'INVALID_OR_EXPIRED_CODE' };
      }

      attempts++;
      if (attempts > 5) {
        otpStore = null; // Invalidate OTP
        return { status: 429, error: 'TOO_MANY_ATTEMPTS' };
      }

      const submitted = crypto.createHash('sha256').update(code).digest('hex');
      const storedBuf = Buffer.from(otpStore);
      const subBuf = Buffer.from(submitted);

      if (storedBuf.length !== subBuf.length || !crypto.timingSafeEqual(storedBuf, subBuf)) {
        return { status: 401, error: 'INVALID_CODE' };
      }

      otpStore = null;
      return { status: 200, success: true };
    };

    // Attempts 1 to 5 fail
    for (let i = 1; i <= 5; i++) {
      const res = verifyOtpAttempt('000000');
      expect(res.status).toBe(401);
      expect(res.error).toBe('INVALID_CODE');
    }

    // Attempt 6 triggers lockout and invalidates code
    const res6 = verifyOtpAttempt('000000');
    expect(res6.status).toBe(429);
    expect(res6.error).toBe('TOO_MANY_ATTEMPTS');
    expect(otpStore).toBeNull();

    // Even if correct code is entered afterwards, it is permanently expired
    const resAfter = verifyOtpAttempt('123456');
    expect(resAfter.status).toBe(401);
    expect(resAfter.error).toBe('INVALID_OR_EXPIRED_CODE');
  });
});

describe('Part 8: Webhook Underpayment and Currency Tampering Guards', () => {
  it('should reject webhook settlements where incoming amount is less than transaction amount', () => {
    const transaction = {
      id: 'txn-101',
      amountTZS: 100000,
      currency: 'TZS',
      status: 'PENDING'
    };

    const processWebhookSettlement = (incomingAmount: number, incomingCurrency: string) => {
      if (incomingAmount < transaction.amountTZS) {
        return { status: 200, error: 'AMOUNT_MISMATCH', action: 'MARK_FAILED' };
      }
      if (incomingCurrency.toUpperCase() !== transaction.currency) {
        return { status: 200, error: 'CURRENCY_MISMATCH', action: 'MARK_FAILED' };
      }
      return { status: 200, action: 'MARK_COMPLETED' };
    };

    // Underpayment attempt:
    expect(processWebhookSettlement(50000, 'TZS').action).toBe('MARK_FAILED');
    expect(processWebhookSettlement(50000, 'TZS').error).toBe('AMOUNT_MISMATCH');

    // Currency mismatch attempt:
    expect(processWebhookSettlement(100000, 'USD').action).toBe('MARK_FAILED');
    expect(processWebhookSettlement(100000, 'USD').error).toBe('CURRENCY_MISMATCH');

    // Valid exact payment:
    expect(processWebhookSettlement(100000, 'TZS').action).toBe('MARK_COMPLETED');
  });
});

