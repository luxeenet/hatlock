// Branch Management Routes
// Allows businesses to create, list, and manage store branches for physical inventory allocation

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const BranchCreateSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional()
});

export async function branchRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List branches
  server.get('/', {
    schema: {
      tags: ['Branches'],
      summary: 'List all branches for current tenant'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const branches = await prisma.branch.findMany({
      where: { businessId },
      include: {
        _count: {
          select: { devices: true, employees: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ branches });
  });

  // Create branch
  server.post('/', {
    schema: {
      tags: ['Branches'],
      summary: 'Create a new branch'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = BranchCreateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const branch = await prisma.branch.create({
      data: {
        ...parse.data,
        businessId
      }
    });

    return reply.status(201).send({ branch });
  });

  // Delete branch
  server.delete('/:branchId', {
    schema: {
      tags: ['Branches'],
      summary: 'Delete a branch if empty'
    }
  }, async (request: FastifyRequest<{ Params: { branchId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { branchId } = request.params;

    const deviceCount = await prisma.device.count({ where: { branchId, businessId } });
    if (deviceCount > 0) {
      return reply.status(400).send({
        error: 'BRANCH_NOT_EMPTY',
        message: 'Cannot delete branch that still has assigned devices'
      });
    }

    await prisma.branch.delete({ where: { id: branchId, businessId } });
    return reply.send({ status: 'DELETED' });
  });
}
