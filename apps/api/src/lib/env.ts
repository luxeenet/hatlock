// Environment configuration with validation
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  APP_VERSION: z.string().default('1.0.0'),
  API_BASE_URL: z.string().default('https://api.luxeenet.com'),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT (ES256 key pair)
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),

  // Refresh token secret
  REFRESH_TOKEN_SECRET: z.string().min(32),

  // CORS
  CORS_ORIGINS: z.string().default('https://admin.luxeenet.com,https://portal.luxeenet.com,http://localhost:3000,http://localhost:3001,http://localhost:3002'),

  // Device command signing (ECDSA P-256)
  COMMAND_SIGNING_PRIVATE_KEY: z.string().min(1),
  COMMAND_SIGNING_PUBLIC_KEY: z.string().min(1),

  // HatPesa
  HATPESA_BASE_URL: z.string().url().default('https://api.hatpesa.com'),
  HATPESA_API_KEY: z.string().default(''),
  HATPESA_WEBHOOK_SECRET: z.string().default(''),
  HATPESA_TEST_MODE: z.coerce.boolean().default(true),

  // SonicPesa
  SONICPESA_BASE_URL: z.string().url().default('https://api.sonicpesa.com/api/v1'),
  SONICPESA_API_KEY: z.string().default(''),
  SONICPESA_API_SECRET: z.string().default(''),
  SONICPESA_WEBHOOK_SECRET: z.string().default(''),
  SONICPESA_TEST_MODE: z.coerce.boolean().default(true),

  // Email (Nodemailer)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@hatlock.luxeenet.com'),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  AWS_BUCKET: z.string().default(''),
  AWS_REGION: z.string().default('af-south-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),

  // Luxeenet super-admin
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@luxeenet.com'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32)  // 32-byte hex key for AES-256
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
