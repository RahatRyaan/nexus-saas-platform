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
        return Math.min(times * 2000, 10000);
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err) => logger.warn(`Redis connection pending: ${err.message || 'offline'}`));
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
        return Math.min(times * 2000, 10000);
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

    bullMqRedisClient.on('connect', () => logger.info('BullMQ Redis connected'));
    bullMqRedisClient.on('error', (err) => logger.warn(`BullMQ Redis pending: ${err.message || 'offline'}`));
  }
  return bullMqRedisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
  if (bullMqRedisClient) {
    await bullMqRedisClient.quit().catch(() => {});
    bullMqRedisClient = null;
  }
  logger.info('Redis connections disconnected');
}

export { redisClient };
