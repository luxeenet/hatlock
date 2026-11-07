// Notification Service
// Multi-channel notifications: In-App, Email, SMS, WhatsApp

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

export interface NotificationPayload {
  businessId?: string;
  userId?: string;
  customerId?: string;
  deviceId?: string;
  type: string;
  subject?: string;
  title?: string;
  message?: string;
  body?: string;
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  metadata?: Record<string, any>;
}

export async function scheduleNotification(payload: NotificationPayload) {
  try {
    logger.info({ payload }, 'Scheduling notification');

    const subject = payload.subject || payload.title || 'HatLock Notification';
    const body = payload.body || payload.message || '';
    const channel = payload.channel || payload.channels?.[0] || NotificationChannel.IN_APP;

    const notification = await prisma.notification.create({
      data: {
        businessId: payload.businessId,
        userId: payload.userId,
        customerId: payload.customerId,
        type: payload.type,
        subject,
        body,
        channel,
        status: NotificationStatus.PENDING,
      }
    });

    logger.info(`Notification ${notification.id} created successfully.`);
    return notification;
  } catch (err) {
    logger.error(err, 'Failed to schedule notification');
    return null;
  }
}
