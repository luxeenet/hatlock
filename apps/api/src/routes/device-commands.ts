// Device Command Agent Routes
// Delivers signed, time-limited commands to Windows & Linux agents and records acknowledgments

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPendingCommands, acknowledgeCommand } from '../services/device-commands.js';
import { prisma } from '../lib/prisma.js';

const AcknowledgeSchema = z.object({
  commandId: z.string().uuid(),
  deviceId: z.string().uuid(),
  success: z.boolean(),
  failReason: z.string().optional()
});

export async function deviceCommandRoutes(server: FastifyInstance) {
  // Agent polls or queries pending commands
  server.get('/commands/pending/:deviceId', {
    schema: {
      tags: ['Agent'],
      summary: 'Get pending signed commands for a device'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND', message: 'Device does not exist' });
    }

    const commands = await getPendingCommands(deviceId);

    return reply.send({
      deviceId,
      count: commands.length,
      commands
    });
  });

  // Agent acknowledges execution of a signed command
  server.post('/commands/acknowledge', {
    schema: {
      tags: ['Agent'],
      summary: 'Acknowledge execution of a device command'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = AcknowledgeSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parse.error.flatten()
      });
    }

    const { commandId, deviceId, success, failReason } = parse.data;

    try {
      const updated = await acknowledgeCommand(commandId, deviceId, success, failReason);
      return reply.send({
        status: 'SUCCESS',
        command: updated
      });
    } catch (err: any) {
      server.log.error(err, 'Failed to acknowledge command');
      return reply.status(err.statusCode || 500).send({
        error: 'COMMAND_ACK_FAILED',
        message: err.message
      });
    }
  });
}
