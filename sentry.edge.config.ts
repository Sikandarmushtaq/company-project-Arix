/**
 * Sentry Edge Configuration
 *
 * This file configures Sentry for Edge Runtime (middleware, edge API routes).
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Debug mode (disable in production)
  debug: process.env.NODE_ENV === 'development',
});
