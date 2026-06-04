// =============================================================================
// Sentry — Edge Runtime Configuration
// =============================================================================
// Initialize Sentry for Edge Runtime (middleware, edge API routes).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
// =============================================================================

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  debug: false,
});
