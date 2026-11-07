// SaaS Subscription & Billing Routes
// Tier limits (STARTER, BUSINESS, ENTERPRISE), device quota enforcement, and tier upgrades

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { SUBSCRIPTION_PLANS } from '@hatlock/shared';

const UpgradeSchema = z.object({
  plan: z.enum(['STARTER', 'BUSINESS', 'ENTERPRISE'])
});

export async function subscriptionRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // Get current subscription status and device quota
  server.get('/', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Get SaaS subscription plan and usage'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: { plan: true }
    });

    const activeDevices = await prisma.device.count({
      where: { businessId }
    });

    const currentPlanKey = subscription?.plan?.plan || 'STARTER';
    const planMeta = SUBSCRIPTION_PLANS[currentPlanKey as keyof typeof SUBSCRIPTION_PLANS];

    return reply.send({
      subscription,
      usage: {
        activeDevices,
        maxDevices: subscription?.plan?.maxDevices || planMeta?.maxDevices || 25,
        remainingDevices: Math.max(0, (subscription?.plan?.maxDevices || planMeta?.maxDevices || 25) - activeDevices)
      },
      availablePlans: SUBSCRIPTION_PLANS
    });
  });

  // Upgrade subscription plan
  server.post('/upgrade', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Upgrade or change SaaS subscription tier'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const businessId = (request as any).businessId;
    const parse = UpgradeSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parse.error.flatten() });
    }

    const newPlan = parse.data.plan as SubscriptionPlan;
    const planMeta = SUBSCRIPTION_PLANS[newPlan];

    let plan = await prisma.plan.findFirst({
      where: { plan: newPlan }
    });

    if (!plan) {
      plan = await prisma.plan.create({
        data: {
          name: `${newPlan} Tier`,
          plan: newPlan,
          monthlyPriceTZS: 150000,
          annualPriceTZS: 1500000,
          maxDevices: planMeta?.maxDevices || 25,
          features: {}
        }
      });
    }

    const updated = await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000)
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE
      },
      include: { plan: true }
    });

    return reply.send({
      status: 'PLAN_UPDATED',
      subscription: updated
    });
  });
}
