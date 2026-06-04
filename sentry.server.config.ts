// =============================================================================
// Sentry — Server-Side Configuration
// =============================================================================
// Initialize Sentry for Node.js server-side error tracking.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
// =============================================================================

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance monitoring sample rate
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  debug: false,
});
