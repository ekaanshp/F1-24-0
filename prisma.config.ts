// =============================================================================
// Prisma Config — F1 TeamBuilder (Prisma 7+)
// =============================================================================
// In Prisma 7, connection URLs are configured here instead of schema.prisma.
// See: https://pris.ly/d/config-datasource
// =============================================================================

import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  // Datasource connection for migrations and introspection
  // Uses the DIRECT (non-pooled) Neon connection string
  datasource: {
    url: process.env.DIRECT_DATABASE_URL,
  },
});
