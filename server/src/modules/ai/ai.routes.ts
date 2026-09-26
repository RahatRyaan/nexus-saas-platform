import { Router } from 'express';
import { AIController } from './ai.controller';
import { authenticate } from '../../middleware/auth';
import { aiRateLimiter } from '../../middleware/rateLimiter';
import { planGate } from '../../middleware/planGate';
import { asyncHandler } from '../../utils/asyncHandler';

export const aiRouter = Router();

aiRouter.use(authenticate);
aiRouter.use(aiRateLimiter);

aiRouter.post('/summarize', asyncHandler(AIController.summarize));
aiRouter.post('/suggest-tasks', asyncHandler(AIController.suggestTasks));
aiRouter.post('/ask', planGate('pro'), asyncHandler(AIController.ask));
