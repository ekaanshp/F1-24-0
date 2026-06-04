// =============================================================================
// Sentry — Client-Side Configuration
// =============================================================================
// Initialize Sentry for browser-side error tracking.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
// =============================================================================

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring sample rate (adjust for production)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Set to false in production for cleaner console
  debug: false,

  // Replay configuration for session replays (optional)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
});
