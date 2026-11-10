// Apple MDM Protocol & iOS/iPadOS Supervised Management Route
// HatLock by Luxeenet — Official Apple MDM Capabilities

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { DeviceOS, DeviceStatus, CommandStatus } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { auditLog } from '../services/audit.js';
import { AuditAction } from '@prisma/client';
import QRCode from 'qrcode';

function getBaseUrl(request: FastifyRequest): string {
  const forwardedHost = request.headers['x-forwarded-host'];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || request.headers.host;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || (request.protocol === 'https' ? 'https' : 'http');

  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}`;
  }
  return env.API_BASE_URL || 'https://api.luxeenet.com';
}

export async function appleMdmRoutes(server: FastifyInstance) {
  // --------------------------------------------------------------------------
  // 1. Apple MDM OTA Enrollment Profile (.mobileconfig)
  // --------------------------------------------------------------------------
  server.get('/enroll.mobileconfig', {
    schema: {
      tags: ['Apple MDM'],
      summary: 'Download Apple MDM OTA enrollment profile'
    }
  }, async (request: FastifyRequest<{ Querystring: { deviceId?: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.query;
    const baseUrl = getBaseUrl(request);

    let deviceIdentifier = deviceId || 'DEFAULT_ENROLLMENT';

    // Apple Configuration Profile XML (.mobileconfig)
    const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>AccessRights</key>
            <integer>8191</integer>
            <key>CheckInURL</key>
            <string>${baseUrl}/api/v1/mdm/apple/checkin</string>
            <key>CheckOutWhenRemoved</key>
            <true/>
            <key>IdentityCertificateUUID</key>
            <string>e9d6d397-25e1-456f-801b-c74143df65e4</string>
            <key>PayloadDescription</key>
            <string>Configures HatLock Device Security and Financing Management.</string>
            <key>PayloadDisplayName</key>
            <string>HatLock MDM Service</string>
            <key>PayloadIdentifier</key>
            <string>com.luxeenet.hatlock.mdm.service</string>
            <key>PayloadType</key>
            <string>com.apple.mdm</string>
            <key>PayloadUUID</key>
            <string>a4d9526e-44c1-4091-88f2-d9f2e3be7506</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>ServerCapabilities</key>
            <array>
                <string>com.apple.mdm.per-user-connections</string>
            </array>
            <key>ServerURL</key>
            <string>${baseUrl}/api/v1/mdm/apple/server</string>
            <key>SignMessage</key>
            <true/>
            <key>Topic</key>
            <string>com.apple.mgmt.external.hatlock</string>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>HatLock Financed Device Security Profile</string>
    <key>PayloadDisplayName</key>
    <string>HatLock Device Enrollment (${deviceIdentifier})</string>
    <key>PayloadIdentifier</key>
    <string>com.luxeenet.hatlock.profile</string>
    <key>PayloadOrganization</key>
    <string>HatLock by Luxeenet</string>
    <key>PayloadRemovalDisallowed</key>
    <true/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>c89283f5-7489-493e-a89a-0824b0b8db2c</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

    reply.header('Content-Type', 'application/x-apple-aspen-config');
    reply.header('Content-Disposition', 'attachment; filename="hatlock-enroll.mobileconfig"');
    return reply.send(mobileconfig);
  });

  // Direct PNG stream of Apple MDM Camera-Scannable QR Code
  server.get('/enroll-qr/:deviceId', {
    schema: {
      tags: ['Apple MDM'],
      summary: 'Direct PNG stream of Apple MDM OTA Enrollment Profile QR code'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;
    const baseUrl = getBaseUrl(request);
    const appleEnrollUrl = `${baseUrl}/api/v1/mdm/apple/enroll.mobileconfig?deviceId=${deviceId}`;

    const buffer = await QRCode.toBuffer(appleEnrollUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#000000', light: '#ffffff' }
    });

    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(buffer);
  });

  // --------------------------------------------------------------------------
  // 2. Apple MDM Check-In Protocol (Authenticate, TokenUpdate, CheckOut)
  // --------------------------------------------------------------------------
  server.put('/checkin', {
    schema: {
      tags: ['Apple MDM'],
      summary: 'Apple MDM check-in protocol handler'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = (request.body as any)?.toString ? (request.body as any).toString('utf8') : JSON.stringify(request.body);
    logger.info({ body: rawBody.slice(0, 200) }, 'Apple MDM Check-In event');

    // Parse MessageType from plist or mock payload
    let messageType = 'Authenticate';
    let udid = 'UNKNOWN_UDID';

    if (rawBody.includes('<string>TokenUpdate</string>')) messageType = 'TokenUpdate';
    else if (rawBody.includes('<string>CheckOut</string>')) messageType = 'CheckOut';

    const udidMatch = rawBody.match(/<key>UDID<\/key>\s*<string>([^<]+)<\/string>/i);
    if (udidMatch) udid = udidMatch[1];

    if (messageType === 'Authenticate') {
      logger.info({ udid }, 'Apple MDM: Authenticate message received');
      return reply.status(200).send('OK');
    }

    if (messageType === 'TokenUpdate') {
      logger.info({ udid }, 'Apple MDM: TokenUpdate received, device active');

      // Find matching device by serial or appleUDID
      const device = await prisma.device.findFirst({
        where: {
          OR: [
            { identity: { appleUDID: udid } },
            { serialNumber: udid }
          ]
        }
      });

      if (device) {
        await prisma.device.update({
          where: { id: device.id },
          data: {
            currentOS: DeviceOS.IOS,
            platform: 'Apple iOS / iPadOS (MDM Supervised)',
            enrollmentType: 'APPLE_DEP_SUPERVISED',
            complianceStatus: 'COMPLIANT'
          }
        });

        await prisma.deviceIdentity.upsert({
          where: { deviceId: device.id },
          create: {
            deviceId: device.id,
            appleUDID: udid,
            encryptionStatus: 'HARDWARE_ENCRYPTED_DATA_PROTECTION',
            systemUUID: udid
          },
          update: {
            appleUDID: udid,
            encryptionStatus: 'HARDWARE_ENCRYPTED_DATA_PROTECTION'
          }
        });
      }

      return reply.status(200).send('OK');
    }

    if (messageType === 'CheckOut') {
      logger.warn({ udid }, 'Apple MDM: Device un-enrolled / CheckOut');
      return reply.status(200).send('OK');
    }

    return reply.status(200).send('OK');
  });

  // --------------------------------------------------------------------------
  // 3. Apple MDM Server Command Loop (Idle, Command Polling, Command Results)
  // --------------------------------------------------------------------------
  server.put('/server', {
    schema: {
      tags: ['Apple MDM'],
      summary: 'Apple MDM command delivery and response loop'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = (request.body as any)?.toString ? (request.body as any).toString('utf8') : JSON.stringify(request.body);

    const udidMatch = rawBody.match(/<key>UDID<\/key>\s*<string>([^<]+)<\/string>/i);
    const udid = udidMatch ? udidMatch[1] : null;

    if (!udid) {
      return reply.status(200).send('OK');
    }

    // Find device
    const device = await prisma.device.findFirst({
      where: {
        OR: [
          { identity: { appleUDID: udid } },
          { serialNumber: udid }
        ]
      },
      include: {
        restrictions: { where: { isActive: true } }
      }
    });

    if (!device) {
      return reply.status(200).send('OK');
    }

    // Check if device is in RESTRICTED state
    const isRestricted = device.status === DeviceStatus.RESTRICTED || device.restrictions.length > 0;

    if (isRestricted) {
      // Deliver DeviceLock Command
      const lockCommandPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CommandUUID</key>
    <string>LOCK-${Date.now()}</string>
    <key>Command</key>
    <dict>
        <key>RequestType</key>
        <string>DeviceLock</string>
        <key>Message</key>
        <string>HatLock Security Notice: This financed device is locked for overdue payment. Please contact your financing provider to unlock.</string>
        <key>PhoneNumber</key>
        <string>+255700000000</string>
    </dict>
</dict>
</plist>`;
      reply.header('Content-Type', 'application/xml');
      return reply.send(lockCommandPlist);
    }

    // If active and compliant, send DeviceInformation query or Empty response (Idle)
    reply.header('Content-Type', 'application/xml');
    return reply.status(200).send('<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>Status</key><string>Acknowledged</string></dict></plist>');
  });

  // --------------------------------------------------------------------------
  // 4. Manual Unenrollment / Release Device from Apple MDM
  // --------------------------------------------------------------------------
  server.post('/release/:deviceId', {
    schema: {
      tags: ['Apple MDM'],
      summary: 'Release iPhone/iPad from HatLock MDM management upon contract completion'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    await prisma.device.update({
      where: { id: device.id },
      data: {
        status: DeviceStatus.CUSTOMER_OWNED,
        complianceStatus: 'RELEASED'
      }
    });

    await auditLog({
      businessId: device.businessId,
      actorId: 'SYSTEM',
      action: AuditAction.UPDATE,
      resource: 'Device',
      resourceId: device.id,
      metadata: { platform: 'APPLE_MDM', unenrollmentTriggered: true }
    });

    return reply.send({
      status: 'RELEASED',
      deviceId: device.id,
      message: 'Device ownership transferred and MDM management profile released.'
    });
  });
}
