import { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { env } from '../../config/env';

export class BillingController {
  static async checkout(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const priceId = req.body.priceId || env.STRIPE_PRO_PRICE_ID || 'price_dummy_pro';

    const result = await BillingService.createCheckoutSession(
      workspaceId!,
      req.user!.userId,
      req.user!.email,
      priceId,
    );
    res.status(200).json(result);
  }

  static async webhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;
    const result = await BillingService.handleWebhook(req.body as Buffer, sig);
    res.status(200).json(result);
  }

  static async getStatus(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const subscription = await BillingService.getBillingStatus(workspaceId!);
    res.status(200).json({ subscription });
  }

  static async getInvoices(req: Request, res: Response): Promise<void> {
    const workspaceId = req.query.workspaceId as string || req.user!.workspaceId;
    const invoices = await BillingService.getInvoices(workspaceId!);
    res.status(200).json({ invoices });
  }
}
