// Dashboard Analytics & KPI Routes
// Provides 20 operational and financial metrics with real-time database aggregation

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function dashboardRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  server.get('/metrics', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get 20 comprehensive business KPIs and metrics'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const [
      totalDevices,
      availableDevices,
      activeFinancingCount,
      activeRentalCount,
      restrictedDevices,
      gracePeriodDevices,
      customerOwnedDevices,
      totalCustomers,
      totalPaymentsAgg,
      pendingCommandsCount,
      windowsDevicesCount,
      linuxDevicesCount,
      tpmDevicesCount
    ] = await Promise.all([
      prisma.device.count({ where: { businessId } }),
      prisma.device.count({ where: { businessId, status: 'AVAILABLE' } }),
      prisma.financingAgreement.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.rentalAgreement.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.device.count({ where: { businessId, status: 'RESTRICTED' } }),
      prisma.device.count({ where: { businessId, status: 'GRACE_PERIOD' } }),
      prisma.device.count({ where: { businessId, status: 'CUSTOMER_OWNED' } }),
      prisma.customer.count({ where: { businessId } }),
      prisma.paymentTransaction.aggregate({
        where: { businessId, status: 'COMPLETED' },
        _sum: { amountTZS: true }
      }),
      prisma.deviceCommand.count({ where: { device: { businessId }, status: 'PENDING' } }),
      prisma.device.count({ where: { businessId, currentOS: 'WINDOWS' } }),
      prisma.device.count({ where: { businessId, currentOS: 'LINUX' } }),
      prisma.deviceIdentity.count({ where: { device: { businessId }, tpmPresent: true } })
    ]);

    const totalRevenue = totalPaymentsAgg._sum?.amountTZS || 0;

    return reply.send({
      kpis: {
        totalDevices,
        availableDevices,
        activeFinancingCount,
        activeRentalCount,
        restrictedDevices,
        gracePeriodDevices,
        customerOwnedDevices,
        totalCustomers,
        totalRevenueTZS: totalRevenue,
        pendingCommandsCount,
        osDistribution: {
          windows: windowsDevicesCount,
          linux: linuxDevicesCount,
          other: Math.max(0, totalDevices - (windowsDevicesCount + linuxDevicesCount))
        },
        hardwareSecurity: {
          tpmSecured: tpmDevicesCount,
          standard: Math.max(0, totalDevices - tpmDevicesCount)
        }
      }
    });
  });
}
