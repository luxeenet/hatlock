import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Singleton in dev to prevent connection pool exhaustion during hot reload
export const prisma = globalThis.__prisma ?? new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
