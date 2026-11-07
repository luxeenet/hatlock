// Support Requests & Customer Ticket Routes
// Handles device unlock queries, payment assistance, and dispute resolution

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const CreateTicketSchema = z.object({
  customerId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  subject: z.string().min(3),
  description: z.string().min(5),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});

export async function supportRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List support tickets
  server.get('/', {
    schema: {
      tags: ['Support'],
      summary: 'List support requests'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const tickets = await prisma.supportTicket.findMany({
      where: { businessId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ tickets });
  });

  // Create ticket
  server.post('/', {
    schema: {
      tags: ['Support'],
      summary: 'Create a new support ticket'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = CreateTicketSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        businessId,
        ...parse.data,
        status: 'OPEN'
      }
    });

    return reply.status(201).send({ ticket });
  });
}
