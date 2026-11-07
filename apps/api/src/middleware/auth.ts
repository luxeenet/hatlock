// Authentication and authorization middleware
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { UserRole } from '@prisma/client';

export interface JWTPayload {
  sub: string;           // User ID
  email: string;
  role: UserRole;
  businessId?: string;   // Tenant context
  deviceId?: string;     // For device tokens
  tokenType: 'user' | 'device' | 'refresh';
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    businessId?: string;  // Resolved tenant ID
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export function authMiddleware(server: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<JWTPayload>();
      (request as any).user = payload;
      (request as any).businessId = payload.businessId;

      // If businessId not in JWT payload, resolve from employee record or header
      if (!(request as any).businessId) {
        const headerBiz = request.headers['x-business-id'];
        if (typeof headerBiz === 'string' && headerBiz) {
          (request as any).businessId = headerBiz;
        } else {
          const emp = await prisma.employee.findFirst({
            where: { userId: payload.sub },
            select: { businessId: true }
          });
          if (emp) {
            (request as any).businessId = emp.businessId;
          } else {
            // Default to first active business for super-admin operations
            const defaultBiz = await prisma.business.findFirst({ select: { id: true } });
            if (defaultBiz) {
              (request as any).businessId = defaultBiz.id;
            }
          }
        }
      }

      // Check if user is still active (cache in Redis for perf)
      if (payload.tokenType === 'user') {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { isActive: true, role: true }
        });
        if (!user || !user.isActive) {
          return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Account inactive or not found' });
        }
      }
    } catch {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
  };
}

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = (request.user as any) as JWTPayload | undefined;
  if (!user) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // Super admin has no tenant context — they access all businesses
  if (user.role === UserRole.SUPER_ADMIN) {
    return;
  }

  if (!user.businessId) {
    return reply.status(403).send({ error: 'FORBIDDEN', message: 'No business context' });
  }

  (request as any).businessId = user.businessId;
}

// Role guard factory
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request.user as any) as JWTPayload | undefined;
    if (!user) {
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    }
    if (!roles.includes(user.role)) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: `Required role: ${roles.join(' or ')}`
      });
    }
  };
}

// Super admin only guard
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

// Business level access (owner or admin)
export const requireBusinessAdmin = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.BUSINESS_OWNER,
  UserRole.BUSINESS_ADMIN
);
