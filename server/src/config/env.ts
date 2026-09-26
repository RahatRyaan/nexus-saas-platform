import { z } from 'zod';
import fs from 'fs';
import path from 'path';

function loadRootEnv() {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["'](.*)["']$/, '$1');
          if (key && process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      });
      break;
    }
  }
}

loadRootEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().default('mongodb://syncboard_admin:syncboard_secret_password@localhost:27017/nexus?authSource=admin'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32).default('2a6fafc431788ad3c8514b57fe8cf34cd80dff5b78e0bce422bc4f55ef96f3b6'),
  JWT_REFRESH_SECRET: z.string().min(32).default('cbb22df05389803bccde5a416e4c5503091918257eafcd34090896d1fbef52cd'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SSLCOMMERZ_STORE_ID: z.string().optional(),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),
  SSLCOMMERZ_IS_SANDBOX: z.coerce.boolean().default(true),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_FREE_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('http://localhost:20128/v1'),
  OPENAI_MODEL: z.string().default('auto'),
  GEMINI_API_KEY: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  CLIENT_URL: z.string().default('http://localhost:3001'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@nexus.app'),
});

const parsed = envSchema.safeParse(process.env);

export const env = parsed.success ? parsed.data : envSchema.parse({});
export type Env = typeof env;
