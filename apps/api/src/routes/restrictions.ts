// Device Restrictions & Enforcement History Routes
// Audit view of all automated and manual device lockouts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function restrictionRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List all restriction records
  server.get('/', {
    schema: {
      tags: ['Restrictions'],
      summary: 'List device restriction and lockout history'
    }
  }, async (request: FastifyRequest<{ Querystring: { activeOnly?: boolean; deviceId?: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { activeOnly, deviceId } = request.query;

    const where: any = { businessId };
    if (activeOnly) where.isActive = true;
    if (deviceId) where.deviceId = deviceId;

    const restrictions = await prisma.deviceRestriction.findMany({
      where,
      include: {
        device: { select: { id: true, serialNumber: true, manufacturer: true, model: true } }
      },
      orderBy: { restrictedAt: 'desc' }
    });

    return reply.send({ restrictions });
  });
}
