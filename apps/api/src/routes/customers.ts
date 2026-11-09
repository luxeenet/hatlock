// Customer Management Routes
// Customer registration, KYC records, and agreement mapping

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const CustomerCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  idNumber: z.string().min(4),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('KE'),
  notes: z.string().optional()
});

export async function customerRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List customers for tenant
  server.get('/', {
    schema: {
      tags: ['Customers'],
      summary: 'List customers for current business'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const where: any = {};
    if (businessId) where.businessId = businessId;

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            financingAgreements: true,
            rentalAgreements: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ customers });
  });

  // Create customer
  server.post('/', {
    schema: {
      tags: ['Customers'],
      summary: 'Register a new customer'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    let targetBusinessId = (request as any).businessId || (request.body as any)?.businessId;
    if (!targetBusinessId) {
      const activeBiz = await prisma.business.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      }) || await prisma.business.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });

      if (activeBiz) {
        targetBusinessId = activeBiz.id;
      } else {
        const defaultBiz = await prisma.business.create({
          data: {
            name: 'Luxeenet Enterprise',
            registrationNumber: 'DAR-TECH-2024-TZ',
            email: 'admin@luxeenet.com',
            phone: '+255700000000',
            address: 'Samora Avenue',
            city: 'Dar es Salaam',
            country: 'Tanzania',
            status: 'ACTIVE'
          }
        });
        targetBusinessId = defaultBiz.id;
      }
    }

    const parse = CustomerCreateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const { idNumber, notes, country, ...rest } = parse.data;
    const customer = await prisma.customer.create({
      data: {
        ...rest,
        nationalId: idNumber,
        businessId: targetBusinessId
      }
    });

    return reply.status(201).send({ customer });
  });

  // Get customer detail
  server.get('/:customerId', {
    schema: {
      tags: ['Customers'],
      summary: 'Get customer profile with active agreements and devices'
    }
  }, async (request: FastifyRequest<{ Params: { customerId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { customerId } = request.params;

    const where: any = { id: customerId };
    if (businessId) where.businessId = businessId;

    const customer = await prisma.customer.findFirst({
      where,
      include: {
        financingAgreements: {
          include: {
            device: true,
            instalments: { orderBy: { instalmentNumber: 'asc' } }
          }
        },
        rentalAgreements: {
          include: {
            device: true,
            rentalCharges: { orderBy: { chargeNumber: 'asc' } }
          }
        },
        paymentTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!customer) {
      return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer does not exist' });
    }

    return reply.send({ customer });
  });

  // Update customer
  server.patch('/:customerId', {
    schema: {
      tags: ['Customers'],
      summary: 'Update customer profile'
    }
  }, async (request: FastifyRequest<{ Params: { customerId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { customerId } = request.params;
    const body = request.body as any;

    const where: any = { id: customerId };
    if (businessId) where.businessId = businessId;

    const customer = await prisma.customer.findFirst({
      where
    });

    if (!customer) {
      return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer does not exist' });
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(body.firstName && { firstName: body.firstName }),
        ...(body.lastName && { lastName: body.lastName }),
        ...(body.phone && { phone: body.phone }),
        ...(body.email && { email: body.email }),
        ...(body.idNumber && { nationalId: body.idNumber }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.notes !== undefined && { notes: body.notes })
      }
    });

    return reply.send({ customer: updated });
  });

  // Delete/Deactivate customer
  server.delete('/:customerId', {
    schema: {
      tags: ['Customers'],
      summary: 'Deactivate customer account'
    }
  }, async (request: FastifyRequest<{ Params: { customerId: string } }>, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const { customerId } = request.params;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
      include: {
        financingAgreements: { where: { status: 'ACTIVE' } },
        rentalAgreements: { where: { status: 'ACTIVE' } }
      }
    });

    if (!customer) {
      return reply.status(404).send({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer does not exist' });
    }

    if (customer.financingAgreements.length > 0 || customer.rentalAgreements.length > 0) {
      return reply.status(400).send({
        error: 'CUSTOMER_HAS_ACTIVE_AGREEMENTS',
        message: 'Cannot remove customer with active agreements. Complete or terminate agreements first.'
      });
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false }
    });

    return reply.send({ message: 'Customer deactivated successfully' });
  });
}
