// HatLock API Server — Main Entry Point
// Fastify + Prisma + Redis + BullMQ

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';

// Route imports
import { authRoutes } from './routes/auth.js';
import { businessRoutes } from './routes/businesses.js';
import { branchRoutes } from './routes/branches.js';
import { employeeRoutes } from './routes/employees.js';
import { customerRoutes } from './routes/customers.js';
import { deviceRoutes } from './routes/devices.js';
import { deviceEnrollmentRoutes } from './routes/device-enrollment.js';
import { deviceCommandRoutes } from './routes/device-commands.js';
import { financingRoutes } from './routes/financing.js';
import { rentalRoutes } from './routes/rentals.js';
import { paymentRoutes } from './routes/payments.js';
import { hatpesaWebhookRoutes } from './routes/hatpesa-webhook.js';
import { sonicpesaWebhookRoutes } from './routes/sonicpesa-webhook.js';
import { restrictionRoutes } from './routes/restrictions.js';
import { returnRoutes } from './routes/returns.js';
import { ownershipRoutes } from './routes/ownership.js';
import { reportRoutes } from './routes/reports.js';
import { notificationRoutes } from './routes/notifications.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { auditRoutes } from './routes/audit.js';
import { supportRoutes } from './routes/support.js';
import { superAdminRoutes } from './routes/super-admin.js';
import { agentRoutes } from './routes/agents.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { androidMdmRoutes } from './routes/android-mdm.js';
import { appleMdmRoutes } from './routes/apple-mdm.js';
import { portalRoutes } from './routes/portal.js';

// Hooks
import { tenantMiddleware } from './middleware/tenant.js';
import { authMiddleware } from './middleware/auth.js';

// Workers
import { startWorkers, stopWorkers } from './workers/index.js';

async function buildServer() {
  const server = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      serializers: {
        req(req) {
          return { method: req.method, url: req.url, remoteAddress: req.ip };
        }
      }
    },
    trustProxy: true,
    maxParamLength: 500
  });

  // Security headers
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        scriptSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  });

  // CORS
  const corsOrigins = env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  await server.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // Health check endpoint (production probe - checks both PostgreSQL & Redis)
  server.get('/health', {
    schema: { tags: ['System'], summary: 'System health probe (PostgreSQL & Redis)' }
  }, async (request, reply) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (err: any) {
      server.log.error({ err: err?.message || 'Database connectivity error' }, 'Health check: database unavailable');
    }

    try {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch (err: any) {
      server.log.error({ err: err?.message || 'Redis connectivity error' }, 'Health check: redis unavailable');
    }

    const isHealthy = dbOk && redisOk;
    const responsePayload = {
      status: isHealthy ? 'ok' : 'error',
      version: env.APP_VERSION,
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
  });

  // Preserved API v1 health endpoint
  server.get('/api/v1/health', {
    schema: { tags: ['System'], summary: 'API v1 health status' }
  }, async (request, reply) => {
    return reply.send({
      status: 'ok',
      version: env.APP_VERSION,
      timestamp: new Date().toISOString()
    });
  });

  // Rate limiting (global)
  await server.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => req.ip
  });

  // JWT
  await server.register(jwt, {
    secret: {
      private: env.JWT_PRIVATE_KEY,
      public: env.JWT_PUBLIC_KEY
    },
    sign: {
      algorithm: 'ES256',
      expiresIn: '15m'
    }
  });

  // OpenAPI docs
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'HatLock API',
        description: 'HatLock by Luxeenet — Device Financing, Hire Purchase, Rental & Protection API',
        version: '1.0.0',
        contact: {
          name: 'Luxeenet Support',
          email: 'support@luxeenet.com'
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false }
  });

  // Auth middleware — decorates request with user context
  server.decorate('authenticate', authMiddleware(server));
  server.decorate('requireTenant', tenantMiddleware);

  // Payment webhooks — raw body required for signature verification
  await server.register(hatpesaWebhookRoutes, { prefix: '/webhooks/hatpesa' });
  await server.register(sonicpesaWebhookRoutes, { prefix: '/webhooks/sonicpesa' });
  await server.register(sonicpesaWebhookRoutes, { prefix: '/api/v1/webhooks/sonicpesa' });

  // Public routes (no auth)
  await server.register(authRoutes, { prefix: '/api/v1/auth' });

  // Device agent routes (device token auth, not user JWT)
  await server.register(deviceEnrollmentRoutes, { prefix: '/api/v1/agent' });
  await server.register(deviceCommandRoutes, { prefix: '/api/v1/agent' });
  await server.register(agentRoutes, { prefix: '/api/v1/agent' });
  await server.register(androidMdmRoutes, { prefix: '/api/v1/mdm/android' });
  await server.register(appleMdmRoutes, { prefix: '/api/v1/mdm/apple' });

  // Protected business routes
  await server.register(businessRoutes, { prefix: '/api/v1/businesses' });
  await server.register(branchRoutes, { prefix: '/api/v1/branches' });
  await server.register(employeeRoutes, { prefix: '/api/v1/employees' });
  await server.register(customerRoutes, { prefix: '/api/v1/customers' });
  await server.register(deviceRoutes, { prefix: '/api/v1/devices' });
  await server.register(financingRoutes, { prefix: '/api/v1/financing' });
  await server.register(rentalRoutes, { prefix: '/api/v1/rentals' });
  await server.register(paymentRoutes, { prefix: '/api/v1/payments' });
  await server.register(restrictionRoutes, { prefix: '/api/v1/restrictions' });
  await server.register(returnRoutes, { prefix: '/api/v1/returns' });
  await server.register(ownershipRoutes, { prefix: '/api/v1/ownership' });
  await server.register(reportRoutes, { prefix: '/api/v1/reports' });
  await server.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await server.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' });
  await server.register(auditRoutes, { prefix: '/api/v1/audit' });
  await server.register(supportRoutes, { prefix: '/api/v1/support' });
  await server.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await server.register(portalRoutes, { prefix: '/api/v1/portal' });

  // Luxeenet super-admin routes (elevated auth required)
  await server.register(superAdminRoutes, { prefix: '/api/v1/admin' });
  await server.register(superAdminRoutes, { prefix: '/api/v1/super-admin' });

  // Error handler
  server.setErrorHandler((error: any, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation
      });
    }
    if (error.statusCode === 401) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: error.message });
    }
    if (error.statusCode === 403) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: error.message });
    }
    if (error.statusCode === 404) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: error.message });
    }
    // 409 Conflict
    if (error.statusCode === 409) {
      return reply.status(409).send({ error: 'CONFLICT', message: error.message });
    }
    server.log.error({ err: error, url: request.url }, 'Unhandled error');
    return reply.status(500).send({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
  });

  return server;
}

let activeApp: any = null;

async function start() {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('Database connected');

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connected');

    activeApp = await buildServer();

    // Start background workers
    await startWorkers();
    logger.info('Background workers started');

    await activeApp.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`HatLock API running on port ${env.PORT}`);
    logger.info(`API docs: http://localhost:${env.PORT}/docs`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await stopWorkers();
    if (activeApp) {
      await activeApp.close();
    }
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
});

start();

export { buildServer };
