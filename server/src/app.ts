import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { authRouter } from './modules/auth/auth.routes';
import { workspaceRouter } from './modules/workspace/workspace.routes';
import { boardRouter } from './modules/board/board.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { knowledgeRouter } from './modules/knowledge/knowledge.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { billingRouter } from './modules/billing/billing.routes';

export function createApp(): Express {
  const app = express();

  // Security & standard middlewares
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS allowing Vercel preview & production domains
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow all Vercel domains, localhost, and configured CLIENT_URL
        if (
          !origin ||
          origin.includes('vercel.app') ||
          origin.includes('localhost') ||
          origin === env.CLIENT_URL
        ) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive for preview branches
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(cookieParser());

  // Stripe raw webhook body parsing must come before express.json()
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Root endpoint friendly welcome
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'Nexus SaaS API',
      status: 'online',
      documentation: '/api-docs',
      health: '/health',
    });
  });

  // Swagger docs
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Nexus SaaS API',
        version: '1.0.0',
        description: 'Multi-tenant AI-powered workspace & learning platform API',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: ['./src/modules/**/*.routes.ts'],
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Global rate limiter
  app.use('/api', apiRateLimiter);

  // Module routes
  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspaceRouter);
  app.use('/api/boards', boardRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/billing', billingRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
