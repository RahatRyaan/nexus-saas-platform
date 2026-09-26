import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let bullMqRedisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy(times) {
        const delay = Math.min(times * 1000, 10000);
        return delay;
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err) => logger.error('Redis error', { err: err.message }));
    redisClient.on('close', () => logger.warn('Redis connection closed'));
  }
  return redisClient;
}

export function getBullMqRedisClient(): Redis {
  if (!bullMqRedisClient) {
    bullMqRedisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy(times) {
        const delay = Math.min(times * 1000, 10000);
        return delay;
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });
  }
  return bullMqRedisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (bullMqRedisClient) {
    await bullMqRedisClient.quit();
    bullMqRedisClient = null;
  }
  logger.info('Redis connections disconnected');
}

export { redisClient };
