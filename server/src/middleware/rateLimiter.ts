import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { env } from '../config/env';

export function createRateLimiter(windowMs: number, max: number, prefix: string) {
  if (env.NODE_ENV === 'test') {
    return (_req: any, _res: any, next: any) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-expect-error Redis client compatible
      sendCommand: (...args: string[]) => getRedisClient().call(...args),
      prefix: `rl:${prefix}:`,
    }),
    message: {
      error: 'Too many requests, please try again later.',
    },
  });
}

export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 10, 'auth');
export const apiRateLimiter = createRateLimiter(60 * 1000, 100, 'api');
export const aiRateLimiter = createRateLimiter(60 * 1000, 20, 'ai');
