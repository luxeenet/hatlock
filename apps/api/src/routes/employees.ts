// Employee & Team Role Management Routes
// Allows business owners and admins to manage staff accounts and permissions

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { UserRole } from '@prisma/client';

const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['BUSINESS_ADMIN', 'BUSINESS_EMPLOYEE']),
  branchId: z.string().uuid().optional(),
  phone: z.string().optional()
});

export async function employeeRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List employees
  server.get('/', {
    schema: {
      tags: ['Employees'],
      summary: 'List employees for current business'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const employees = await prisma.employee.findMany({
      where: {
        businessId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            phone: true,
            isActive: true,
            createdAt: true
          }
        },
        branch: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = employees.map(emp => ({
      id: emp.id,
      userId: emp.userId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      position: emp.position,
      email: emp.user.email,
      role: emp.user.role,
      phone: emp.user.phone,
      isActive: emp.isActive && emp.user.isActive,
      createdAt: emp.createdAt,
      branch: emp.branch
    }));

    return reply.send({ employees: formatted });
  });

  // Create employee
  server.post('/', {
    schema: {
      tags: ['Employees'],
      summary: 'Create and invite a new employee account'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const callerRole = (request.user as any)?.role;

    if (callerRole !== UserRole.BUSINESS_OWNER && callerRole !== UserRole.BUSINESS_ADMIN) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only owners and admins can add employees' });
    }

    const parse = CreateEmployeeSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const existing = await prisma.user.findUnique({ where: { email: parse.data.email } });
    if (existing) {
      return reply.status(409).send({ error: 'EMAIL_EXISTS', message: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(parse.data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: parse.data.email,
        passwordHash,
        role: parse.data.role as any,
        phone: parse.data.phone,
        employee: {
          create: {
            businessId,
            branchId: parse.data.branchId,
            firstName: parse.data.firstName,
            lastName: parse.data.lastName
          }
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            branchId: true
          }
        }
      }
    });

    return reply.status(201).send({
      employee: {
        id: user.employee?.id,
        userId: user.id,
        email: user.email,
        firstName: user.employee?.firstName,
        lastName: user.employee?.lastName,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  });
}
