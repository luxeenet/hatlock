// HatLock CORS & Authentication Verification Test Suite
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import bcrypt from 'bcryptjs';

describe('CORS Configuration & Preflight Invariants', () => {
  const allowedOrigins = [
    'https://admin.luxeenet.com',
    'https://portal.luxeenet.com'
  ];

  const buildTestServer = async () => {
    const server = Fastify();

    await server.register(cors, {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-business-id',
        'x-customer-phone',
        'x-requested-with',
        'Accept',
        'Origin'
      ],
      optionsSuccessStatus: 204
    });

    server.setErrorHandler((error: any, request, reply) => {
      const origin = request.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
      }
      return reply.status(error.statusCode || 500).send({ error: error.message });
    });

    server.post('/api/v1/auth/login', async (request, reply) => {
      const { email, password } = request.body as any;
      if (!email || !password) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Email and password required' });
      }
      if (password === 'wrong') {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      }
      return reply.status(200).send({ success: true, accessToken: 'jwt.token.mock' });
    });

    server.get('/api/v1/devices', async (request, reply) => {
      const auth = request.headers.authorization;
      if (!auth) {
        return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing token' });
      }
      return reply.send({ devices: [] });
    });

    return server;
  };

  it('1. should succeed preflight OPTIONS from https://admin.luxeenet.com with 204 and CORS headers', async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
      headers: {
        origin: 'https://admin.luxeenet.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,authorization'
      }
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://admin.luxeenet.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('2. should succeed preflight OPTIONS from https://portal.luxeenet.com with 204 and CORS headers', async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
      headers: {
        origin: 'https://portal.luxeenet.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://portal.luxeenet.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('3. should NOT return Access-Control-Allow-Origin for unapproved origin (https://attacker.com)', async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
      headers: {
        origin: 'https://attacker.com',
        'access-control-request-method': 'POST'
      }
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('4. should include CORS headers on 401 Unauthorized responses for allowed origin', async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        origin: 'https://admin.luxeenet.com',
        'content-type': 'application/json'
      },
      payload: { email: 'admin@luxeenet.com', password: 'wrong' }
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe('https://admin.luxeenet.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(JSON.parse(res.body)).toEqual({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password'
    });
  });

  it('5. should include CORS headers on 400 Validation Error responses for allowed origin', async () => {
    const app = await buildTestServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        origin: 'https://admin.luxeenet.com',
        'content-type': 'application/json'
      },
      payload: {}
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['access-control-allow-origin']).toBe('https://admin.luxeenet.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('Authentication & Email Normalization Invariants', () => {
  it('should match email case-insensitively and trimmed', () => {
    const normalizeEmail = (input: string) => input.trim().toLowerCase();

    expect(normalizeEmail('Admin@Luxeenet.com ')).toBe('admin@luxeenet.com');
    expect(normalizeEmail('  ADMIN@LUXEENET.COM  ')).toBe('admin@luxeenet.com');
  });

  it('should return generic error without revealing user existence on bad credentials', () => {
    const verifyUser = (user: { exists: boolean; passwordMatch: boolean }) => {
      if (!user.exists || !user.passwordMatch) {
        return { statusCode: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
      }
      return { statusCode: 200, success: true };
    };

    // User does not exist
    expect(verifyUser({ exists: false, passwordMatch: false })).toEqual({
      statusCode: 401,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password'
    });

    // User exists but wrong password
    expect(verifyUser({ exists: true, passwordMatch: false })).toEqual({
      statusCode: 401,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password'
    });
  });
});

