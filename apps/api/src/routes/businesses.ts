// Business Profile & Tenant Configuration Routes
// Multi-tenant business administration

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const UpdateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(7).optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional()
});

export async function businessRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // Get current business profile
  server.get('/me', {
    schema: {
      tags: ['Business'],
      summary: 'Get current tenant business profile'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    if (!businessId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No business context associated with user' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        branches: true,
        subscription: true
      }
    });

    if (!business) {
      return reply.status(404).send({ error: 'BUSINESS_NOT_FOUND', message: 'Business record not found' });
    }

    return reply.send({ business });
  });

  // Update business profile
  server.patch('/me', {
    schema: {
      tags: ['Business'],
      summary: 'Update current tenant business profile'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    if (!businessId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'No business context' });
    }

    const parse = UpdateBusinessSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: parse.data
    });

    return reply.send({ business: updated });
  });
}
