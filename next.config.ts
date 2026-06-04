import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // TODO(security): Configure security headers
  // async headers() {
  //   return [
  //     {
  //       source: '/(.*)',
  //       headers: [
  //         { key: 'X-Frame-Options', value: 'DENY' },
  //         { key: 'X-Content-Type-Options', value: 'nosniff' },
  //         { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  //         { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  //       ],
  //     },
  //   ];
  // },
};

// Wrap with Sentry (no-op if SENTRY_DSN is not set)
export default withSentryConfig(nextConfig, {
  // Sentry build-time options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress logs during build if no Sentry token
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better error tracking
  widenClientFileUpload: true,

  // Disable Sentry telemetry
  disableLogger: true,
});
