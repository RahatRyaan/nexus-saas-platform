import http from 'http';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { getRedisClient, disconnectRedis } from './config/redis';
import { initPgVector, disconnectPg } from './config/postgres';
import { initSocketServer } from './socket';
import { initEmbeddingWorker } from './jobs/embedding.worker';
import { logger } from './utils/logger';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  try {
    // Connect databases
    await connectDB();
    getRedisClient();

    if (env.POSTGRES_URL) {
      await initPgVector().catch((err) => {
        logger.warn('pgvector initialization failed, semantic search may be unavailable', { err });
      });
    }

    // Initialize BullMQ Workers
    initEmbeddingWorker();

    const app = createApp();
    const server = http.createServer(app);

    // Initialize Socket.io
    initSocketServer(server);

    server.listen(env.PORT, () => {
      logger.info(`🚀 Nexus Server running on http://localhost:${env.PORT}`);
      logger.info(`📚 Swagger docs available at http://localhost:${env.PORT}/api-docs`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        await disconnectDB();
        await disconnectRedis();
        await disconnectPg();
        logger.info('Graceful shutdown completed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start Nexus server', { err });
    process.exit(1);
  }
}

bootstrap();
