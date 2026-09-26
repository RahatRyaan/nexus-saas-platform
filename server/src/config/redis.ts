import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;
let bullMqRedisClient: Redis | null = null;

const isRedisConfigured =
  Boolean(env.REDIS_URL) &&
  !env.REDIS_URL.includes('localhost') &&
  !env.REDIS_URL.includes('127.0.0.1');

export function getRedisClient(): Redis {
  if (!redisClient) {
    if (!isRedisConfigured && env.NODE_ENV === 'production') {
      // Return a quiet mock client in production if REDIS_URL is not set to cloud
      redisClient = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: null,
      });
      return redisClient;
    }

    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy(times) {
        // Retry with backoff without spamming logs
        return Math.min(times * 5000, 30000);
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', () => {
      // Silently retry in the background
    });
  }
  return redisClient;
}

export function getBullMqRedisClient(): Redis {
  if (!bullMqRedisClient) {
    if (!isRedisConfigured && env.NODE_ENV === 'production') {
      bullMqRedisClient = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: null,
      });
      return bullMqRedisClient;
    }

    bullMqRedisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy(times) {
        return Math.min(times * 5000, 30000);
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

    bullMqRedisClient.on('connect', () => logger.info('BullMQ Redis connected'));
    bullMqRedisClient.on('error', () => {});
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
}

export { redisClient };
