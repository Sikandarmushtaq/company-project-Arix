import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';

// Bundle analyzer wrapper
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * Backend URL from environment variable
 * Configure via NEXT_PUBLIC_SOCKET_URL in .env.local
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3500';

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,

  // Self-contained server bundle for CI/CD: `next build` emits
  // `.next/standalone/` (minimal server + traced deps) so the target box runs
  // `node server.js` with NO on-box build and NO node_modules install. This is
  // what lets deploys build off-box in CI and ship a small artifact.
  output: 'standalone',

  // Pin Turbopack's workspace root to THIS app. Without it, sibling lockfiles
  // (dialer-ui/, finaldialer/) make Next infer the wrong root and warn — and a
  // wrong root can break module resolution. `process.cwd()` is the app dir
  // because `next dev`/`next build` always run from this package.
  turbopack: { root: process.cwd() },

  // Keep these required-at-runtime by their real names. @sentry/nextjs pulls in
  // the OpenTelemetry instrumentation libs; on a Next 16 (Turbopack) build,
  // withSentryConfig only runs when a Sentry DSN is set (it isn't here), so
  // without this Turbopack auto-externalizes them under a hashed alias that
  // fails at runtime ("Failed to load external module require-in-the-middle-…"),
  // 500-ing every dynamic SSR route (e.g. /admin/signups/[id]).
  serverExternalPackages: ['require-in-the-middle', 'import-in-the-middle'],

  // Experimental features for optimization
  experimental: {
    // Enable optimized package imports
    // optimizePackageImports: ['react-icons', 'recharts', '@tanstack/react-query'],
    optimizePackageImports: ['react-icons','recharts','@tanstack/react-query','framer-motion','date-fns','sonner','libphonenumber-js','@xyflow/react'],
  },

  // API proxying is now handled by /api/proxy route
  // WebSocket/Socket.IO connections use rewrites
  async rewrites() {
    return [
      // Socket.IO at /api/v1/socket.io (matches SOCKET_CONFIG.PATH)
      {
        source: '/api/v1/socket.io/:path*',
        destination: `${BACKEND_URL}/api/v1/socket.io/:path*`,
      },
      // Legacy socket.io path (fallback)
      {
        source: '/socket.io/:path*',
        destination: `${BACKEND_URL}/socket.io/:path*`,
      },
      {
        source: '/ws',
        destination: `${BACKEND_URL}/ws`,
      },
      // Landing section deep-links: /pricing, /features, … are real URL paths
      // (no `#`) that serve the single-page landing (/), so refresh / direct
      // load works and the client scrolls to the section. Keep this alternation
      // in sync with SECTION_PATHS in src/lib/landing/sections.ts. Unknown paths
      // are NOT matched here → they 404 as normal.
      {
        source: '/:section(features|ai-dialer|how-it-works|compare|pricing|faq)',
        destination: '/',
      },
    ];
  },

  // Security headers
  async headers() {
    // Skip strict CSP in development - Next.js dev mode requires inline scripts for HMR
    const isDev = process.env.NODE_ENV === 'development';

    // Build CSP based on environment
    // Production needs 'unsafe-inline' for Next.js hydration scripts
    // Cloudflare injects beacon.min.js for Web Analytics when behind their CDN
    // NOTE: https://challenges.cloudflare.com is required for the Cloudflare
    // Turnstile captcha on the signup form — its api.js (script-src) and the
    // widget iframe (frame-src below) both load from that origin.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.sentry.io https://static.cloudflareinsights.com https://*.tawk.to https://cdn.jsdelivr.net https://connect.facebook.net https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' https://accounts.google.com https://*.sentry.io https://static.cloudflareinsights.com https://*.tawk.to https://cdn.jsdelivr.net https://connect.facebook.net https://challenges.cloudflare.com";

    return [
      {
        source: '/:path*',
        headers: [
          // Content Security Policy
          // SECURITY: Production uses strict CSP, development allows inline for HMR
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com https://*.tawk.to",
              "font-src 'self' https://fonts.gstatic.com https://*.tawk.to",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https: wss: ws: https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self' https://accounts.google.com https://*.tawk.to https://www.facebook.com https://web.facebook.com https://staticxx.facebook.com https://challenges.cloudflare.com",
              "media-src 'self' blob: data: https://voip-new-recording-ha.nyc3.digitaloceanspaces.com https://voip-new-recording-ha.nyc3.cdn.digitaloceanspaces.com https://storage.googleapis.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              ...(isDev ? [] : ['upgrade-insecure-requests']),
            ].join('; '),
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy (restrict browser features)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Organization and project in Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress all logs
  silent: !process.env.CI,

  // Upload source maps for better error tracking
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Hide source maps from clients
  hideSourceMaps: true,

  // Transpile SDK to support IE11
  transpileClientSDK: false,
};

// Apply wrappers in order
let config = withBundleAnalyzer(nextConfig);

// Wrap with Sentry only if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  config = withSentryConfig(config, sentryWebpackPluginOptions);
}

export default config;
