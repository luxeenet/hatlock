// Tenant isolation middleware
// Ensures all queries are scoped to the authenticated business
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as any;
  if (!user) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // Super admin bypasses tenant isolation
  if (user.role === UserRole.SUPER_ADMIN) {
    return;
  }

  if (!user.businessId) {
    return reply.status(403).send({ error: 'FORBIDDEN', message: 'No business context in token' });
  }

  (request as any).businessId = user.businessId;
}
