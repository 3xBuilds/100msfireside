import Redis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var __firesideRedis__: Redis | undefined;
}

let client: Redis | undefined = globalThis.__firesideRedis__;

export function getRedisClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not configured');
  }
  client = new Redis(url);
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__firesideRedis__ = client;
  }
  return client;
}

