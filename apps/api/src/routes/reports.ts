// Financial & Operations Reporting Routes
// Generates CSV and aggregated summary analytics for business operations

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function reportRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // Device Inventory CSV
  server.get('/devices/csv', {
    schema: {
      tags: ['Reports'],
      summary: 'Export device inventory CSV'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const devices = await prisma.device.findMany({
      where: { businessId },
      include: { branch: true, identity: true },
      orderBy: { createdAt: 'desc' }
    });

    const headers = 'ID,Serial Number,Manufacturer,Model,Status,OS,Branch,Condition,Purchase Price,Created At\n';
    const rows = devices.map(d => [
      d.id,
      `"${d.serialNumber}"`,
      `"${d.manufacturer}"`,
      `"${d.model}"`,
      d.status,
      d.currentOS,
      `"${d.branch?.name || 'Main'}"`,
      d.physicalCondition || 'GOOD',
      d.purchasePrice || 0,
      d.createdAt.toISOString()
    ].join(',')).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="HatLock-Device-Inventory.csv"');
    return reply.send(headers + rows);
  });

  // Revenue & Collections CSV
  server.get('/payments/csv', {
    schema: {
      tags: ['Reports'],
      summary: 'Export collections and payments CSV'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const payments = await prisma.paymentTransaction.findMany({
      where: { businessId },
      include: {
        financingAgreement: true,
        rentalAgreement: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const headers = 'ID,Reference,Amount,Currency,Customer ID,Agreement,Status,Method,Created At\n';
    const rows = payments.map((p: any) => [
      p.id,
      p.transactionReference,
      p.amountTZS,
      p.currency,
      p.customerId,
      p.financingAgreement?.agreementNumber || p.rentalAgreement?.agreementNumber || 'N/A',
      p.status,
      p.paymentMethod || 'N/A',
      p.createdAt.toISOString()
    ].join(',')).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="HatLock-Payments-Report.csv"');
    return reply.send(headers + rows);
  });
}
