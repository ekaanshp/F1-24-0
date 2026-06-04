// =============================================================================
// Redis Client Singleton — F1 TeamBuilder
// =============================================================================
// Uses ioredis with Singleton Pattern to prevent connection exhaustion
// during Next.js hot-reloads in development.
//
// Used for:
//   - Caching HistoricalData (team/era stats that rarely change)
//   - Leaderboard sorted sets (ZADD/ZREVRANGE)
//   - Draft session state (fast read/write during active spins)
// =============================================================================

import Redis from 'ioredis';

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      'REDIS_URL environment variable is not set. ' +
        'Copy .env.example to .env.local and configure your Redis connection.',
    );
  }

  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    // TODO(security): Enable TLS for production Redis connections
    // tls: process.env.NODE_ENV === 'production' ? {} : undefined,
  });
}

// ---------------------------------------------------------------------------
// Singleton Pattern
// ---------------------------------------------------------------------------

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export default redis;
