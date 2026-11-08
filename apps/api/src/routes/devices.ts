// Device Inventory & Management Routes
// Laptop registration, enrollment code generation, hardware profile viewing, and manual commands

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { DeviceStatus, DeviceOS, AgreementType } from '@prisma/client';
import { issueRestrictionCommand, issueUnrestrictionCommand } from '../services/device-commands.js';

const DeviceCreateSchema = z.object({
  serialNumber: z.string().min(2),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  branchId: z.string().uuid().optional(),
  purchasePrice: z.number().positive().optional(),
  condition: z.string().default('EXCELLENT'),
  deviceType: z.string().optional(),
  operatingSystem: z.string().optional(),
  notes: z.string().optional()
});

const CommandDispatchSchema = z.object({
  action: z.enum(['RESTRICT', 'RESTORE']),
  reason: z.string().min(1),
  lockScreenMessage: z.string().optional()
});

export async function deviceRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List devices for current business
  // List devices
  server.get('/', {
    schema: {
      tags: ['Devices'],
      summary: 'List device inventory with universal multi-brand and platform filters'
    }
  }, async (request: FastifyRequest<{
    Querystring: {
      status?: string;
      branchId?: string;
      search?: string;
      manufacturer?: string;
      platform?: string;
      os?: string;
      complianceStatus?: string;
      deviceType?: string;
      customerId?: string;
      agreementId?: string;
    }
  }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { status, branchId, search, manufacturer, platform, os, complianceStatus, deviceType, customerId, agreementId } = request.query;

    const where: any = { businessId };
    if (status) where.status = status as DeviceStatus;
    if (branchId) where.branchId = branchId;
    if (manufacturer) where.manufacturer = { equals: manufacturer, mode: 'insensitive' };
    if (platform) where.platform = { contains: platform, mode: 'insensitive' };
    if (os) where.currentOS = os as DeviceOS;
    if (complianceStatus) where.complianceStatus = complianceStatus;
    if (deviceType) where.deviceType = deviceType as any;
    if (customerId) where.currentCustomerId = customerId;
    if (agreementId) {
      where.OR = [
        { financingAgreements: { some: { id: agreementId } } },
        { rentalAgreements: { some: { id: agreementId } } }
      ];
    }
    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { assetTag: { contains: search, mode: 'insensitive' } }
      ];
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        agentInfo: true,
        identity: true,
        restrictions: { where: { isActive: true } },
        financingAgreements: {
          where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED'] } },
          include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } } }
        },
        rentalAgreements: {
          where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } },
          include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ devices });
  });

  // Register device into inventory
  server.post('/', {
    schema: {
      tags: ['Devices'],
      summary: 'Register new device into inventory'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = DeviceCreateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const existing = await prisma.device.findFirst({
      where: { serialNumber: parse.data.serialNumber, businessId }
    });

    if (existing) {
      return reply.status(409).send({
        error: 'DUPLICATE_SERIAL',
        message: 'A device with this serial number is already registered in your business inventory'
      });
    }

    const { condition, deviceType, operatingSystem, ...devRest } = parse.data;
    const device = await prisma.device.create({
      data: {
        ...devRest,
        physicalCondition: condition,
        deviceType: (deviceType || 'LAPTOP') as any,
        businessId,
        status: DeviceStatus.AVAILABLE,
        currentOS: (operatingSystem || DeviceOS.UNKNOWN) as DeviceOS
      }
    });

    return reply.status(201).send({ device });
  });

  // Get device details
  server.get('/:deviceId', {
    schema: {
      tags: ['Devices'],
      summary: 'Get full device specification, hardware identity, and history'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { deviceId } = request.params;

    const device = await prisma.device.findFirst({
      where: { id: deviceId, businessId },
      include: {
        branch: true,
        identity: true,
        agentInfo: true,
        restrictions: { orderBy: { restrictedAt: 'desc' }, take: 5 },
        commands: { orderBy: { issuedAt: 'desc' }, take: 10 },
        events: { orderBy: { occurredAt: 'desc' }, take: 15 },
        financingAgreements: {
          include: {
            customer: true,
            instalments: { orderBy: { instalmentNumber: 'asc' } }
          }
        },
        rentalAgreements: {
          include: {
            customer: true,
            rentalCharges: { orderBy: { chargeNumber: 'asc' } }
          }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    return reply.send({ device });
  });

  // Manual device restriction or restoration command from dashboard
  server.post('/:deviceId/command', {
    schema: {
      tags: ['Devices'],
      summary: 'Send manual restrict/restore command to device'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const userId = (request as any).user?.id || 'OPERATOR';
    const { deviceId } = request.params;

    const parse = CommandDispatchSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const device = await prisma.device.findFirst({
      where: { id: deviceId, businessId },
      include: {
        business: true,
        financingAgreements: {
          where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'OWNERSHIP_TRANSFERRED'] } }
        },
        rentalAgreements: {
          where: { status: { notIn: ['COMPLETED', 'TERMINATED', 'CANCELLED', 'EXPIRED', 'RETURNED'] } }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND', message: 'Device not found' });
    }

    const hp = device.financingAgreements[0];
    const rental = device.rentalAgreements[0];
    const agreementId = hp ? hp.id : rental ? rental.id : 'MANUAL';
    const agreementType = hp ? AgreementType.HIRE_PURCHASE : AgreementType.RENTAL;
    const agreementNumber = hp ? hp.agreementNumber : rental ? rental.agreementNumber : 'MANUAL';

    if (parse.data.action === 'RESTRICT') {
      const command = await issueRestrictionCommand(
        device.id,
        businessId,
        agreementId,
        agreementType,
        {
          type: 'RESTRICT',
          restrictionType: 'OVERLAY_LOCK',
          businessName: device.business.name,
          agreementNumber,
          agreementType: agreementType === AgreementType.HIRE_PURCHASE ? 'HIRE_PURCHASE' : 'RENTAL',
          deviceDetails: `${device.manufacturer} ${device.model}`,
          reason: parse.data.reason,
          outstandingAmountTZS: 0,
          currency: 'TZS',
          paymentInstructions: parse.data.lockScreenMessage || 'Contact business administrator to restore access',
          supportContact: device.business.phone || 'Support',
          recoveryInstructions: 'Please contact support with device serial number.'
        },
        userId
      );
      return reply.send({ status: 'COMMAND_DISPATCHED', command });
    } else {
      const command = await issueUnrestrictionCommand(
        device.id,
        businessId,
        agreementId,
        agreementType,
        parse.data.reason,
        agreementNumber,
        userId
      );
      return reply.send({ status: 'COMMAND_DISPATCHED', command });
    }
  });
}
