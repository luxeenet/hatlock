// Luxeenet Super-Admin Platform Routes
// Global tenant management, business verification, SaaS quotas, and cross-tenant health

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { UserRole, BusinessStatus } from '@prisma/client';

const UpdateTenantStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED'])
});

const OverrideQuotaSchema = z.object({
  deviceLimit: z.number().int().positive()
});

export async function superAdminRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // Require SUPER_ADMIN role
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = (request as any).user?.role;
    if (userRole !== UserRole.SUPER_ADMIN) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Luxeenet Super-Admin privileges required' });
    }
  });

  // Global Platform Overview
  server.get('/overview', {
    schema: {
      tags: ['Super Admin'],
      summary: 'Get global platform-wide statistics across all tenants'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const [
      totalBusinesses,
      activeBusinesses,
      totalDevicesGlobal,
      totalAgreementsGlobal,
      totalPaymentsGlobal
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { status: BusinessStatus.ACTIVE } }),
      prisma.device.count(),
      prisma.financingAgreement.count(),
      prisma.paymentTransaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amountTZS: true }
      })
    ]);

    return reply.send({
      platform: {
        totalBusinesses,
        activeBusinesses,
        totalDevicesGlobal,
        totalAgreementsGlobal,
        globalGrossVolumeTZS: totalPaymentsGlobal._sum.amountTZS || 0
      }
    });
  });

  // List all businesses
  server.get('/businesses', {
    schema: {
      tags: ['Super Admin'],
      summary: 'List all registered business tenants'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businesses = await prisma.business.findMany({
      include: {
        subscription: true,
        _count: {
          select: { devices: true, employees: true, customers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ businesses });
  });

  // Update business status (e.g. approve or suspend)
  server.patch('/businesses/:businessId/status', {
    schema: {
      tags: ['Super Admin'],
      summary: 'Change tenant business status'
    }
  }, async (request: FastifyRequest<{ Params: { businessId: string } }>, reply: FastifyReply) => {
    const { businessId } = request.params;
    const parse = UpdateTenantStatusSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: { status: parse.data.status as BusinessStatus }
    });

    return reply.send({ business });
  });

  // Override business device limit
  server.patch('/businesses/:businessId/quota', {
    schema: {
      tags: ['Super Admin'],
      summary: 'Override business device limit quota'
    }
  }, async (request: FastifyRequest<{ Params: { businessId: string } }>, reply: FastifyReply) => {
    const { businessId } = request.params;
    const parse = OverrideQuotaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const sub = await prisma.subscription.findUnique({ where: { businessId } });
    if (sub?.planId) {
      await prisma.plan.update({
        where: { id: sub.planId },
        data: { maxDevices: parse.data.deviceLimit }
      });
    }

    return reply.send({ status: 'QUOTA_UPDATED', deviceLimit: parse.data.deviceLimit });
  });
}
