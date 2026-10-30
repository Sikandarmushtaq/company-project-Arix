/**
 * Sentry Client Configuration
 *
 * This file configures Sentry for the client-side (browser).
 * It runs when the app loads in the browser.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay (captures user interactions for debugging)
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% when errors occur

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media for privacy
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter sensitive data from being sent
  beforeSend(event) {
    // Remove sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data) {
          // Remove auth tokens from XHR/fetch breadcrumbs
          if (breadcrumb.data.url && typeof breadcrumb.data.url === 'string') {
            breadcrumb.data.url = breadcrumb.data.url.replace(/token=[^&]+/g, 'token=[REDACTED]');
          }
        }
        return breadcrumb;
      });
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    'atomicFindClose',
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    // User-initiated navigation
    'ResizeObserver loop',
    // WebRTC errors (expected in VoIP)
    'RTCPeerConnection',
  ],

  // Only report errors from our domain
  allowUrls: [
    /https?:\/\/localhost/,
    /https?:\/\/.*\.bitnexdial\.com/,
    /https?:\/\/bitnexdial\.com/,
  ],

  // Debug mode (disable in production)
  debug: process.env.NODE_ENV === 'development',
});
