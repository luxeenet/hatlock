// Immutable Audit Trail Routes
// Read-only compliance and security logs of all administrative actions and lock commands

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function auditRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List audit logs
  server.get('/', {
    schema: {
      tags: ['Audit'],
      summary: 'List tenant audit logs'
    }
  }, async (request: FastifyRequest<{ Querystring: { resource?: string; limit?: number } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { resource, limit = 50 } = request.query;

    const where: any = { businessId };
    if (resource) where.resource = resource;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 200)
    });

    return reply.send({ logs });
  });
}
