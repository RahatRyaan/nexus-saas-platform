import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from './errorHandler';
import { getRedisClient } from '../config/redis';
import { Subscription } from '../modules/billing/billing.model';

export type Plan = 'free' | 'pro';

export function planGate(requiredPlan: Plan): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const workspaceId =
      req.params.workspaceId ||
      req.params.id ||
      req.query.workspaceId ||
      req.body.workspaceId ||
      req.user.workspaceId;

    if (!workspaceId) {
      return next(new ForbiddenError('Workspace context required for plan check'));
    }

    const redis = getRedisClient();
    let plan = await redis.get(`plan:${workspaceId}`);

    if (!plan) {
      const sub = await Subscription.findOne({ workspaceId, status: 'active' }).lean();
      plan = sub ? (sub as any).plan : 'free';
      await redis.setex(`plan:${workspaceId}`, 3600, plan as string);
    }

    if (requiredPlan === 'pro' && plan !== 'pro') {
      return next(new ForbiddenError('Upgrade to Pro to access this feature'));
    }

    next();
  };
}
