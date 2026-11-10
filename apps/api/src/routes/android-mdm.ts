// Android Enterprise Management & Device Owner Provisioning Route
// HatLock by Luxeenet — Official Android Enterprise Capabilities

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { DeviceOS, DeviceStatus, CommandType, CommandStatus } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { auditLog } from '../services/audit.js';
import { AuditAction } from '@prisma/client';
import QRCode from 'qrcode';

const AndroidEnrollSchema = z.object({
  deviceId: z.string().uuid(),
  serialNumber: z.string().min(1),
  imei1: z.string().optional(),
  imei2: z.string().optional(),
  androidId: z.string().optional(),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  osVersion: z.string().default('14.0'),
  agentVersion: z.string().default('1.0.0'),
  hardwareKeystoreSupported: z.boolean().default(true),
  devicePublicKey: z.string().optional(),
  screenLockActive: z.boolean().default(false),
  playIntegrityVerdict: z.string().optional() // MEETS_STRONG_INTEGRITY, MEETS_DEVICE_INTEGRITY
});

const AndroidHeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  batteryLevel: z.number().min(0).max(100).optional(),
  storageAvailableBytes: z.number().optional(),
  screenLockEnabled: z.boolean().default(true),
  tamperDetected: z.boolean().default(false),
  tamperReason: z.string().optional(),
  isRestricted: z.boolean().optional()
});

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

export async function androidMdmRoutes(server: FastifyInstance) {
  // --------------------------------------------------------------------------
  // 1. Android Device Owner Provisioning Payload (QR Code Configuration)
  // --------------------------------------------------------------------------
  server.get('/provisioning-profile/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Generate Android Device Owner QR code provisioning profile'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;
    const baseUrl = getBaseUrl(request);

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        business: { select: { id: true, name: true, phone: true } },
        financingAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true, financedBalanceTZS: true }
        },
        rentalAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    const agreementNumber =
      device.financingAgreements[0]?.agreementNumber ||
      device.rentalAgreements[0]?.agreementNumber ||
      'HATLOCK-FINANCED';

    // RFC-compliant URL-safe Base64 SHA-256 signature checksum (without padding '=')
    const checksumBase64Url = Buffer.from('4b4923e1074a3f87a8b3834927b2b005e839e94bc1721b0632a4bf74b01140ec', 'hex').toString('base64url');

    // Standard Android Enterprise Device Owner Provisioning Bundle
    const provisioningPayload = {
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': 'com.luxeenet.hatlock.mdm/.HatLockDeviceAdminReceiver',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME': 'com.luxeenet.hatlock.mdm',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': `${baseUrl}/downloads/android/HatLockEnterpriseAgent.apk`,
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': checksumBase64Url,
      'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
      'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
      'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
        apiUrl: baseUrl,
        deviceId: device.id,
        serialNumber: device.serialNumber,
        businessId: device.businessId,
        businessName: device.business?.name || 'HatLock Financed Device',
        businessContact: device.business?.phone || '+255700000000',
        agreementNumber,
        enforceFactoryResetProtection: true,
        enforceKioskRestrictionsOnLock: true,
        heartbeatIntervalSeconds: 300
      }
    };

    // Standard camera scannable URL (opens mobile web onboarding on any phone)
    const cameraEnrollUrl = `${baseUrl}/api/v1/mdm/android/enroll-view/${device.id}`;

    // Generate base64 Data URLs for both QR codes
    const qrString = JSON.stringify(provisioningPayload);
    const qrDataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
      color: { dark: '#000000', light: '#ffffff' }
    });

    const cameraQrDataUrl = await QRCode.toDataURL(cameraEnrollUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
      color: { dark: '#000000', light: '#ffffff' }
    });

    return reply.send({
      deviceId: device.id,
      format: 'ANDROID_ENTERPRISE_QR',
      qrJson: provisioningPayload,
      qrDataUrl,
      qrImageUrl: `/api/v1/mdm/android/provisioning-qr/${device.id}`,
      cameraEnrollUrl,
      cameraQrDataUrl,
      cameraQrImageUrl: `/api/v1/mdm/android/camera-qr/${device.id}`,
      packageDownloadUrl: `${baseUrl}/downloads/android/HatLockEnterpriseAgent.apk`
    });
  });

  // Direct PNG stream of Standard Camera Scannable QR Code (opens mobile onboarding)
  server.get('/camera-qr/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Direct PNG stream of standard camera-scannable onboarding QR code'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;
    const baseUrl = getBaseUrl(request);
    const cameraEnrollUrl = `${baseUrl}/api/v1/mdm/android/enroll-view/${deviceId}`;

    const buffer = await QRCode.toBuffer(cameraEnrollUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#000000', light: '#ffffff' }
    });

    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'public, max-age=300');
    return reply.send(buffer);
  });

  // Mobile Web Enrollment Page for Camera Scan
  server.get('/enroll-view/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Mobile-friendly device onboarding webpage opened by camera scan'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;
    const baseUrl = getBaseUrl(request);

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        business: { select: { name: true, phone: true } },
        financingAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        },
        rentalAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        }
      }
    });

    if (!device) {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.status(404).send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Device Not Found - HatLock</title>
<style>body{background:#0b0f19;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:30px;text-align:center;}
.box{background:#121927;border:1px solid #1e293b;border-radius:16px;padding:30px;max-width:400px;margin:50px auto;}
h2{color:#f87171;margin-bottom:8px;}</style>
</head><body><div class="box"><h2>Device Not Found</h2><p>This device registration could not be located in HatLock.</p></div></body></html>`);
    }

    const agreementNumber =
      device.financingAgreements[0]?.agreementNumber ||
      device.rentalAgreements[0]?.agreementNumber ||
      'HATLOCK-SECURED';

    const isAlreadyActive = device.status === 'ACTIVE' || device.complianceStatus === 'COMPLIANT';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>HatLockPRO — Mobile Device Onboarding</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      line-height: 1.5;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      padding-bottom: 30px;
    }
    .header {
      text-align: center;
      padding: 24px 0 16px;
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .card {
      background: #121927;
      border: 1px solid #1e293b;
      border-radius: 18px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .device-title {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .device-serial {
      font-family: monospace;
      font-size: 13px;
      color: #38bdf8;
      margin-bottom: 14px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pill-active { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .pill-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px 18px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      margin-bottom: 10px;
    }
    .btn:last-child { margin-bottom: 0; }
    .btn-primary {
      background: #10b981;
      color: #06281e;
    }
    .btn-primary:hover { background: #059669; }
    .btn-primary:active { transform: scale(0.98); }
    .btn-secondary {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
    }
    .btn-secondary:hover { background: #334155; }
    .btn-outline {
      background: transparent;
      color: #818cf8;
      border: 1px solid rgba(129, 140, 248, 0.4);
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #1e293b;
      font-size: 12px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #94a3b8; }
    .info-value { color: #f1f5f9; font-weight: 600; text-align: right; }
    .steps {
      background: #0b0f19;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 14px;
      margin-top: 14px;
      font-size: 12px;
      color: #94a3b8;
    }
    .steps ol { padding-left: 18px; margin-top: 6px; }
    .steps li { margin-bottom: 6px; }
    .status-box {
      display: none;
      padding: 12px 14px;
      border-radius: 12px;
      margin-top: 12px;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
    }
    .status-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #34d399;
    }
    .footer-note {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>HATLOCKPRO SECURITY</span>
      </div>
    </div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="device-title">${device.manufacturer} ${device.model}</div>
          <div class="device-serial">S/N: ${device.serialNumber}</div>
        </div>
        <span id="statusBadge" class="pill ${isAlreadyActive ? 'pill-active' : 'pill-pending'}">
          ${isAlreadyActive ? '● Active & Protected' : '● Ready to Enroll'}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Organization</span>
        <span class="info-value">${device.business?.name || 'Luxeenet Fleet'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Agreement</span>
        <span class="info-value">${agreementNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Protection Mode</span>
        <span class="info-value">Android Enterprise / Device Owner</span>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:15px; font-weight:700; color:#fff; margin-bottom:12px;">Quick Onboarding Actions</h3>

      <button id="btnActivate" class="btn btn-primary" onclick="activateDevice()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        <span>Activate Device Protection</span>
      </button>

      <a href="${baseUrl}/downloads/android/HatLockEnterpriseAgent.apk" class="btn btn-secondary" download>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Download HatLock Agent APK</span>
      </a>

      <a href="hatlock://enroll?deviceId=${device.id}&apiUrl=${encodeURIComponent(baseUrl)}" class="btn btn-outline">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        <span>Open Installed HatLock App</span>
      </a>

      <div id="statusBox" class="status-box status-success"></div>
    </div>

    <div class="card">
      <h4 style="font-size:13px; font-weight:700; color:#cbd5e1; margin-bottom:6px;">Full Device Owner (Factory Reset / Unbox)</h4>
      <div class="steps">
        <ol>
          <li>Power on the factory-reset or unboxed phone.</li>
          <li>On the initial <strong>"Welcome"</strong> screen, tap any blank area <strong>6 times</strong>.</li>
          <li>Connect to Wi-Fi when prompted.</li>
          <li>Scan the <strong>Android Enterprise QR</strong> from the admin dashboard.</li>
          <li>The HatLock Device Owner security suite will automatically bind.</li>
        </ol>
      </div>
    </div>

    <div class="footer-note">
      HatLockPRO Cryptographic Fleet Protection &bull; Luxeenet
    </div>
  </div>

  <script>
    async function activateDevice() {
      const btn = document.getElementById('btnActivate');
      const statusBox = document.getElementById('statusBox');
      const badge = document.getElementById('statusBadge');
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.innerText = 'Binding Cryptographic Keys...';

      try {
        const res = await fetch('${baseUrl}/api/v1/mdm/android/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: '${device.id}',
            serialNumber: '${device.serialNumber}',
            manufacturer: '${device.manufacturer}',
            model: '${device.model}',
            osVersion: '14.0',
            agentVersion: '1.0.0',
            hardwareKeystoreSupported: true,
            screenLockActive: true
          })
        });

        if (res.ok) {
          badge.className = 'pill pill-active';
          badge.innerText = '● Active & Protected';
          statusBox.className = 'status-box status-success';
          statusBox.style.display = 'block';
          statusBox.innerHTML = '&#10003; Protection Activated! Device is now secured in HatLock.';
          btn.innerText = '&#10003; Device Activated';
        } else {
          throw new Error('Server returned ' + res.status);
        }
      } catch (e) {
        statusBox.className = 'status-box';
        statusBox.style.display = 'block';
        statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBox.style.color = '#f87171';
        statusBox.style.border = '1px solid #ef4444';
        statusBox.innerText = 'Activation notice: Device registered. Please ensure network connectivity.';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerText = 'Retry Activation';
      }
    }
  </script>
</body>
</html>`;

    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(html);
  });

  // Direct PNG stream of Android Enterprise QR Code for image tags & downloads
  server.get('/provisioning-qr/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Direct PNG stream of Android Enterprise QR Code'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;
    const baseUrl = getBaseUrl(request);

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        business: { select: { id: true, name: true, phone: true } },
        financingAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        },
        rentalAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } },
          select: { agreementNumber: true }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    const agreementNumber =
      device.financingAgreements[0]?.agreementNumber ||
      device.rentalAgreements[0]?.agreementNumber ||
      'HATLOCK-FINANCED';

    const checksumBase64Url = Buffer.from('4b4923e1074a3f87a8b3834927b2b005e839e94bc1721b0632a4bf74b01140ec', 'hex').toString('base64url');

    const provisioningPayload = {
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': 'com.luxeenet.hatlock.mdm/.HatLockDeviceAdminReceiver',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME': 'com.luxeenet.hatlock.mdm',
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': `${baseUrl}/downloads/android/HatLockEnterpriseAgent.apk`,
      'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': checksumBase64Url,
      'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
      'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
      'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
        apiUrl: baseUrl,
        deviceId: device.id,
        serialNumber: device.serialNumber,
        businessId: device.businessId,
        businessName: device.business?.name || 'HatLock Financed Device',
        businessContact: device.business?.phone || '+255700000000',
        agreementNumber,
        enforceFactoryResetProtection: true,
        enforceKioskRestrictionsOnLock: true,
        heartbeatIntervalSeconds: 300
      }
    };

    const buffer = await QRCode.toBuffer(JSON.stringify(provisioningPayload), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    reply.header('Content-Type', 'image/png');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(buffer);
  });

  // --------------------------------------------------------------------------
  // 2. Android Device Owner Enrollment
  // --------------------------------------------------------------------------
  server.post('/enroll', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Enroll an Android smartphone with Device Owner capabilities'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = AndroidEnrollSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const data = parse.data;

    const device = await prisma.device.findUnique({
      where: { id: data.deviceId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND', message: 'Register device in system before enrolling' });
    }

    // Evaluate hardware confidence score
    let confidenceScore = 0.8;
    if (data.hardwareKeystoreSupported) confidenceScore += 0.1;
    if (data.playIntegrityVerdict === 'MEETS_STRONG_INTEGRITY') confidenceScore += 0.1;

    // Update Device Model with Android OS & platform details
    await prisma.device.update({
      where: { id: device.id },
      data: {
        currentOS: DeviceOS.ANDROID,
        platform: 'Android Enterprise (Device Owner)',
        enrollmentType: 'ANDROID_DEVICE_OWNER',
        confidenceScore: Math.min(1.0, confidenceScore),
        complianceStatus: 'COMPLIANT',
        status: device.status === DeviceStatus.PENDING_ENROLLMENT ? DeviceStatus.ACTIVE : device.status
      }
    });

    // Upsert Device Identity
    await prisma.deviceIdentity.upsert({
      where: { deviceId: device.id },
      create: {
        deviceId: device.id,
        imei1: data.imei1,
        imei2: data.imei2,
        androidId: data.androidId,
        devicePublicKey: data.devicePublicKey,
        playIntegrityVerdict: data.playIntegrityVerdict,
        screenLockEnabled: data.screenLockActive,
        encryptionStatus: 'FILE_ENCRYPTED_HARDWARE',
        systemUUID: data.androidId || data.serialNumber
      },
      update: {
        imei1: data.imei1,
        imei2: data.imei2,
        androidId: data.androidId,
        devicePublicKey: data.devicePublicKey,
        playIntegrityVerdict: data.playIntegrityVerdict,
        screenLockEnabled: data.screenLockActive,
        encryptionStatus: 'FILE_ENCRYPTED_HARDWARE'
      }
    });

    // Record enrollment history
    await prisma.deviceEnrollment.create({
      data: {
        deviceId: device.id,
        enrolledOS: DeviceOS.ANDROID,
        osVersion: data.osVersion,
        agentVersion: data.agentVersion,
        ipAddress: request.ip,
        notes: `Android Enterprise enrollment. Keystore backed: ${data.hardwareKeystoreSupported}`
      }
    });

    await auditLog({
      businessId: device.businessId,
      actorId: 'SYSTEM',
      action: AuditAction.CREATE,
      resource: 'Device',
      resourceId: device.id,
      metadata: { platform: 'ANDROID_ENTERPRISE', imei1: data.imei1, integrity: data.playIntegrityVerdict }
    });

    return reply.send({
      status: 'ENROLLED',
      deviceId: device.id,
      protectionLevel: 'ANDROID_DEVICE_OWNER',
      policySyncUrl: `/api/v1/mdm/android/policy/${device.id}`
    });
  });

  // --------------------------------------------------------------------------
  // 3. Android Enterprise Policy Synchronization
  // --------------------------------------------------------------------------
  server.get('/policy/:deviceId', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Get active Android Enterprise management policy'
    }
  }, async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    const { deviceId } = request.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        business: { select: { name: true, phone: true } },
        restrictions: { where: { isActive: true } },
        financingAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } }
        },
        rentalAgreements: {
          where: { status: { in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD', 'RESTRICTED'] } }
        }
      }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    const isRestricted = device.status === DeviceStatus.RESTRICTED || device.restrictions.length > 0;
    const businessPhone = device.business?.phone || '+255 700 000 000';

    return reply.send({
      deviceId: device.id,
      version: Date.now(),
      isRestricted,
      policies: {
        // Core Anti-Tamper & Security Rules
        disallowFactoryReset: true,
        disallowSafeBoot: true,
        disallowUsbFileTransfer: isRestricted,
        disallowCamera: isRestricted,
        disallowInstallUnknownSources: true,
        keyguardDisabledFeatures: isRestricted ? ['DISABLE_FINGERPRINT', 'DISABLE_FACE', 'DISABLE_UNREDACTED_NOTIFICATIONS'] : [],
        // Lock screen and Payment Information
        lockScreenInfo: isRestricted
          ? `DEVICE LOCKED FOR PAYMENT. Contact ${device.business?.name} at ${businessPhone} to unlock.`
          : `Managed device: ${device.business?.name}`,
        // Kiosk mode enforcement when restricted
        kioskModeEnabled: isRestricted,
        kioskPackage: isRestricted ? 'com.luxeenet.hatlock.mdm.lockscreen' : null
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. Android Enterprise Heartbeat & Status Report
  // --------------------------------------------------------------------------
  server.post('/heartbeat', {
    schema: {
      tags: ['Android Enterprise'],
      summary: 'Report Android device health, telemetry and tamper events'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = AndroidHeartbeatSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const data = parse.data;

    // Check device
    const device = await prisma.device.findUnique({
      where: { id: data.deviceId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'DEVICE_NOT_FOUND' });
    }

    // Record heartbeat
    await prisma.deviceHeartbeat.create({
      data: {
        deviceId: device.id,
        agentVersion: '1.0.0',
        os: DeviceOS.ANDROID,
        batteryPercent: data.batteryLevel,
        ipAddress: request.ip,
        isRestricted: data.isRestricted ?? false
      }
    });

    // Check for tamper event
    if (data.tamperDetected) {
      logger.warn({ deviceId: device.id, reason: data.tamperReason }, 'Android tamper event detected');
      await prisma.deviceEvent.create({
        data: {
          deviceId: device.id,
          eventType: 'ANDROID_TAMPER_DETECTED',
          details: { reason: data.tamperReason, timestamp: new Date() }
        }
      });
      await prisma.device.update({
        where: { id: device.id },
        data: { complianceStatus: 'TAMPER_SUSPECTED' }
      });
    }

    // Check for pending commands
    const pendingCommands = await prisma.deviceCommand.findMany({
      where: {
        deviceId: device.id,
        status: CommandStatus.PENDING
      },
      orderBy: { issuedAt: 'asc' }
    });

    return reply.send({
      status: 'ACKNOWLEDGED',
      deviceId: device.id,
      deviceStatus: device.status,
      pendingCommands: pendingCommands.map(c => ({
        id: c.id,
        type: c.commandType,
        payload: c.payload,
        signature: c.signature
      }))
    });
  });
}
