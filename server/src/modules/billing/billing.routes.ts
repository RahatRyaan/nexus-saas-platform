import { Router } from 'express';
import { BillingController } from './billing.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { asyncHandler } from '../../utils/asyncHandler';
import { Workspace } from '../workspace/workspace.model';
import { Subscription } from './billing.model';
import { getRedisClient } from '../../config/redis';

export const billingRouter = Router();

// Webhook is public and unauthenticated (Stripe validates via signature)
billingRouter.post('/webhook', asyncHandler(BillingController.webhook));

// Authenticated routes
billingRouter.use(authenticate);

// Allow Owner and Admin to initiate purchase / upgrade tier
billingRouter.post('/checkout', requireRole('admin'), asyncHandler(BillingController.checkout));

// Upgrade plan directly (Supports SSLCommerz / Manual Plan Upgrade for Admin & Owner)
billingRouter.post('/upgrade', requireRole('admin'), asyncHandler(async (req, res) => {
  const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
  const { plan = 'pro' } = req.body;

  await Workspace.findByIdAndUpdate(workspaceId, { $set: { plan } });
  await Subscription.findOneAndUpdate(
    { workspaceId },
    { $set: { plan, status: 'active' } },
    { upsert: true, new: true },
  );

  const redis = getRedisClient();
  await redis.set(`plan:${workspaceId}`, plan);

  res.status(200).json({ message: `Successfully upgraded workspace to ${plan.toUpperCase()} plan!`, plan });
}));

billingRouter.get('/status', requireRole('member'), asyncHandler(BillingController.getStatus));
billingRouter.get('/invoices', requireRole('admin'), asyncHandler(BillingController.getInvoices));
