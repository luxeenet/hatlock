// Device Enrollment Routes
// Handles Windows and Linux Agent hardware registration, re-enrollment, and token provisioning

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { enrollDevice, determineDeviceAuthorization } from '../services/device-enrollment.js';
import { DeviceOS } from '@prisma/client';

const HardwareIdentitySchema = z.object({
  systemUUID: z.string().optional(),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  motherboardSerial: z.string().optional(),
  biosUUID: z.string().optional(),
  cpuId: z.string().optional(),
  macAddresses: z.array(z.string()).default([]),
  storageSerials: z.array(z.string()).default([]),
  tpmPresent: z.boolean().default(false),
  tpmVersion: z.string().optional(),
  tpmManufacturer: z.string().optional(),
  tpmEKCertHash: z.string().optional(),
  secureBoot: z.boolean().optional(),
  uefiEnabled: z.boolean().optional(),
  devicePublicKey: z.string().optional()
});

const EnrollRequestSchema = z.object({
  enrollmentToken: z.string().min(1),
  hardware: HardwareIdentitySchema,
  os: z.enum(['WINDOWS', 'LINUX']),
  osVersion: z.string().optional(),
  distro: z.string().optional(),
  agentVersion: z.string().min(1)
});

export async function deviceEnrollmentRoutes(server: FastifyInstance) {
  // Device Enrollment Endpoint
  server.post('/enroll', {
    schema: {
      tags: ['Agent'],
      summary: 'Enroll a device with hardware identity',
      description: 'Used by Windows and Linux agents to enroll or re-enroll hardware. Detects OS switching and storage changes.'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = EnrollRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.flatten()
      });
    }

    try {
      const result = await enrollDevice({
        ...parseResult.data,
        os: parseResult.data.os as DeviceOS,
        ipAddress: request.ip
      });

      return reply.status(200).send({
        status: 'SUCCESS',
        message: 'Device enrolled successfully',
        data: result
      });
    } catch (err: any) {
      server.log.error(err, 'Enrollment failed');
      return reply.status(err.statusCode || 500).send({
        error: 'ENROLLMENT_FAILED',
        message: err.message
      });
    }
  });

  // Device Status Check (Public authorization inquiry using deviceId)
  server.get('/status/:deviceId', {
    schema: {
      tags: ['Agent'],
      summary: 'Query current device authorization status'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;
    const authStatus = await determineDeviceAuthorization(deviceId);
    return reply.send({
      deviceId,
      status: authStatus
    });
  });
}
