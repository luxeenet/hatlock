// Notifications In-App Feed Routes
// Delivers alerts, security warnings, and overdue reminders to business dashboard and customer portal

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function notificationRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List notifications
  server.get('/', {
    schema: {
      tags: ['Notifications'],
      summary: 'List notifications for current business'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const notifications = await prisma.notification.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return reply.send({ notifications });
  });

  // Mark notification read
  server.patch('/:notificationId/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark notification as read'
    }
  }, async (request: FastifyRequest<{ Params: { notificationId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { notificationId } = request.params;

    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, businessId },
      data: { status: 'READ' as any }
    });

    return reply.send({ status: 'UPDATED', count: updated.count });
  });
}
