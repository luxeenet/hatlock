// Authentication and authorization middleware
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { UserRole } from '@prisma/client';

export interface JWTPayload {
  sub: string;           // User or Customer ID
  email?: string;
  phone?: string;
  role: UserRole;
  businessId?: string;   // Tenant context
  customerId?: string;   // Customer context
  deviceId?: string;     // For device tokens
  tokenType: 'user' | 'customer' | 'device' | 'refresh';
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    businessId?: string;  // Resolved tenant ID
    customerId?: string;  // Resolved customer ID
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

      // 1. Handle Customer Portal Tokens
      if (payload.tokenType === 'customer' || payload.role === UserRole.CUSTOMER) {
        const customer = await prisma.customer.findUnique({
          where: { id: payload.sub },
          select: { id: true, businessId: true, isActive: true }
        });
        if (!customer || !customer.isActive) {
          return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Customer account inactive or not found' });
        }
        (request as any).customerId = customer.id;
        (request as any).businessId = customer.businessId;
        return;
      }

      // 2. Handle Staff/Admin User Tokens
      if (payload.tokenType === 'user' || !payload.tokenType) {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { isActive: true, role: true }
        });
        if (!user || !user.isActive) {
          return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Account inactive or not found' });
        }
      }

      // 3. Multi-Tenant Authorization & Header Spoofing Prevention
      const requestedBusinessId = request.headers['x-business-id'];

      if (payload.role === UserRole.SUPER_ADMIN) {
        // Super admin can optionally set tenant context for specific operations
        if (typeof requestedBusinessId === 'string' && requestedBusinessId) {
          const bizExists = await prisma.business.findUnique({
            where: { id: requestedBusinessId },
            select: { id: true }
          });
          if (bizExists) {
            (request as any).businessId = requestedBusinessId;
          } else {
            (request as any).businessId = payload.businessId || undefined;
          }
        } else {
          (request as any).businessId = payload.businessId || undefined;
        }
      } else {
        // Non-super-admin: Tenant context MUST be derived from verified membership
        const emp = await prisma.employee.findFirst({
          where: { userId: payload.sub },
          select: { businessId: true }
        });

        const authoritativeBiz = payload.businessId || emp?.businessId;

        if (!authoritativeBiz) {
          return reply.status(403).send({ error: 'FORBIDDEN', message: 'No verified business affiliation found' });
        }

        // Header Spoofing Check:
        // A user cannot access another business by supplying an arbitrary x-business-id header
        if (typeof requestedBusinessId === 'string' && requestedBusinessId) {
          if (requestedBusinessId !== authoritativeBiz) {
            return reply.status(403).send({
              error: 'TENANT_VIOLATION',
              message: 'Unauthorized business context switch attempted. Header does not match verified membership.'
            });
          }
        }

        (request as any).businessId = authoritativeBiz;
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

  // Super admin has platform-wide tenant context
  if (user.role === UserRole.SUPER_ADMIN) {
    return;
  }

  const resolvedBiz = (request as any).businessId || user.businessId;
  if (!resolvedBiz) {
    return reply.status(403).send({ error: 'FORBIDDEN', message: 'No verified business context' });
  }

  (request as any).businessId = resolvedBiz;
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
