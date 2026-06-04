// =============================================================================
// NextAuth API Route Handler — F1 TeamBuilder
// =============================================================================
// Catch-all route for NextAuth.js authentication endpoints.
// Handles: /api/auth/signin, /api/auth/signout, /api/auth/callback, etc.
// =============================================================================

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
