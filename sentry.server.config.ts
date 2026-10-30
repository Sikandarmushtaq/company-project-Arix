/**
 * Sentry Server Configuration
 *
 * This file configures Sentry for the server-side (Node.js).
 * It runs in Next.js server components and API routes.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'],

  // Debug mode (disable in production)
  debug: process.env.NODE_ENV === 'development',
});
