// =============================================================================
// Prisma Client Singleton — F1 TeamBuilder
// =============================================================================
// Uses the Singleton Pattern to prevent exhausting database connections
// during Next.js hot-reloads in development.
//
// Uses Neon's serverless driver with Prisma's driver adapter for optimized
// connection pooling via Neon's -pooler endpoint.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
        'Copy .env.example to .env.local and configure your Neon connection string.',
    );
  }

  // Create a PrismaNeon adapter with the pooled connection string
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// ---------------------------------------------------------------------------
// Singleton Pattern
// ---------------------------------------------------------------------------
// In development, Next.js clears the Node.js module cache on every edit,
// which would create a new PrismaClient instance each time. We store the
// client on `globalThis` to reuse it across hot reloads.
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export default db;
