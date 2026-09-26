import Stripe from 'stripe';
import mongoose from 'mongoose';
import { Subscription, ISubscription } from './billing.model';
import { Workspace } from '../workspace/workspace.model';
import { env } from '../../config/env';
import { getRedisClient } from '../../config/redis';
import { NotFoundError, AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2024-06-20',
});

export class BillingService {
  static async createCheckoutSession(
    workspaceId: string,
    userId: string,
    userEmail: string,
    priceId: string,
  ): Promise<{ url: string }> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace');

    let subscription = await Subscription.findOne({ workspaceId });
    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { workspaceId, userId },
      });
      customerId = customer.id;

      if (!subscription) {
        subscription = new Subscription({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          stripeCustomerId: customerId,
          plan: 'free',
          status: 'active',
        });
        await subscription.save();
      } else {
        subscription.stripeCustomerId = customerId;
        await subscription.save();
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.CLIENT_URL}/settings/billing?success=true`,
      cancel_url: `${env.CLIENT_URL}/settings/billing?canceled=true`,
      metadata: { workspaceId, userId },
    });

    if (!session.url) throw new AppError('Failed to create checkout session', 500);
    return { url: session.url };
  }

  static async handleWebhook(
    payload: Buffer,
    sigHeader: string,
  ): Promise<{ received: boolean }> {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        sigHeader,
        env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy',
      );
    } catch (err: any) {
      logger.error('Stripe webhook signature verification failed', { err });
      throw new AppError(`Webhook error: ${err.message}`, 400);
    }

    // Idempotency check: have we processed this event already?
    const alreadyProcessed = await Subscription.findOne({
      stripeEventIds: event.id,
    });
    if (alreadyProcessed) {
      logger.info(`Stripe event ${event.id} already processed, skipping`);
      return { received: true };
    }

    logger.info(`Processing Stripe event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        if (workspaceId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await this.syncSubscription(workspaceId, sub, event.id, 'pro');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionDoc = await Subscription.findOne({
          stripeSubscriptionId: sub.id,
        });
        if (subscriptionDoc) {
          const plan = sub.status === 'active' ? 'pro' : 'free';
          await this.syncSubscription(
            subscriptionDoc.workspaceId.toString(),
            sub,
            event.id,
            plan,
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionDoc = await Subscription.findOne({
          stripeSubscriptionId: sub.id,
        });
        if (subscriptionDoc) {
          await this.syncSubscription(
            subscriptionDoc.workspaceId.toString(),
            sub,
            event.id,
            'free',
          );
        }
        break;
      }
    }

    return { received: true };
  }

  private static async syncSubscription(
    workspaceId: string,
    stripeSub: Stripe.Subscription,
    eventId: string,
    plan: 'free' | 'pro',
  ): Promise<void> {
    const status = stripeSub.status as any;

    await Subscription.findOneAndUpdate(
      { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      {
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: stripeSub.items.data[0]?.price.id,
        plan,
        status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        $addToSet: { stripeEventIds: eventId },
      },
      { upsert: true, new: true },
    );

    // Update Workspace model & Redis cache
    await Workspace.findByIdAndUpdate(workspaceId, { plan });
    const redis = getRedisClient();
    await redis.set(`plan:${workspaceId}`, plan);

    logger.info(`Subscription synced for workspace ${workspaceId}: plan=${plan}, status=${status}`);
  }

  static async getBillingStatus(workspaceId: string): Promise<ISubscription | null> {
    return Subscription.findOne({ workspaceId: new mongoose.Types.ObjectId(workspaceId) });
  }

  static async getInvoices(workspaceId: string): Promise<Stripe.Invoice[]> {
    const sub = await Subscription.findOne({ workspaceId });
    if (!sub?.stripeCustomerId) return [];

    const invoices = await stripe.invoices.list({
      customer: sub.stripeCustomerId,
      limit: 10,
    });
    return invoices.data;
  }
}
