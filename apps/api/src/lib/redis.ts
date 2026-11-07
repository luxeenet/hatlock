import RedisPackage from 'ioredis';
import { env } from './env.js';

const RedisConstructor = (RedisPackage as any).default || RedisPackage;

export const redis = new RedisConstructor(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  reconnectOnError: (err: any) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
    return targetErrors.some((e) => err.message.includes(e));
  }
});

redis.on('error', (err: any) => {
  console.error('[Redis] Error:', err.message);
});

redis.on('connect', () => {
  console.info('[Redis] Connected');
});
