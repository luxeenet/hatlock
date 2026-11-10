// Device Agent Telemetry & Heartbeat Routes
// Windows & Linux agent health reporting, last seen tracking, and hardware state updates

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const HeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  agentVersion: z.string().min(1),
  os: z.enum(['WINDOWS', 'LINUX']),
  uptimeSeconds: z.number().nonnegative().optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  cpuUsagePercent: z.number().min(0).max(100).optional(),
  memoryUsagePercent: z.number().min(0).max(100).optional(),
  diskFreePercent: z.number().min(0).max(100).optional()
});

export async function agentRoutes(server: FastifyInstance) {
  // Agent Heartbeat
  server.post('/heartbeat', {
    schema: {
      tags: ['Agent'],
      summary: 'Device agent heartbeat and telemetry ping'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = HeartbeatSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parse.error.flatten()
      });
    }

    const data = parse.data;

    try {
      // Upsert device agent telemetry
      await prisma.deviceAgent.upsert({
        where: { deviceId: data.deviceId },
        create: {
          deviceId: data.deviceId,
          os: data.os as any,
          agentVersion: data.agentVersion,
          lastSeenAt: new Date(),
          isOnline: true
        },
        update: {
          agentVersion: data.agentVersion,
          lastSeenAt: new Date(),
          isOnline: true
        }
      });

      // Fetch whether any pending commands exist
      const pendingCount = await prisma.deviceCommand.count({
        where: {
          deviceId: data.deviceId,
          status: 'PENDING',
          expiresAt: { gt: new Date() }
        }
      });

      const dev = await prisma.device.findUnique({
        where: { id: data.deviceId },
        select: { status: true }
      });

      return reply.send({
        status: 'OK',
        serverTime: new Date().toISOString(),
        hasPendingCommands: pendingCount > 0,
        deviceStatus: dev?.status || 'AVAILABLE',
        isRestricted: dev?.status === 'RESTRICTED'
      });
    } catch (err: any) {
      server.log.error(err, 'Heartbeat processing failed');
      return reply.status(500).send({ error: 'HEARTBEAT_FAILED', message: err.message });
    }
  });
}
