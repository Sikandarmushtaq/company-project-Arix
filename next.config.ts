
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3500';

const nextConfig: NextConfig = {
  compress: true,

  output: 'standalone',

  turbopack: { root: process.cwd() },

  serverExternalPackages: ['require-in-the-middle', 'import-in-the-middle'],

  experimental: {
    optimizePackageImports: [
      'react-icons',
      'recharts',
      '@tanstack/react-query',
      'framer-motion',
      'date-fns',
      'sonner',
      'libphonenumber-js',
      '@xyflow/react',
    ],
  },

  async rewrites() {
    return [
      {
        source: '/api/v1/socket.io/:path*',
        destination: `${BACKEND_URL}/api/v1/socket.io/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${BACKEND_URL}/socket.io/:path*`,
      },
      {
        source: '/ws',
        destination: `${BACKEND_URL}/ws`,
      },
      {
        source: '/:section(features|ai-dialer|how-it-works|compare|pricing|legal|faq)',
        destination: '/',
      },
    ];
  },

  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.sentry.io https://static.cloudflareinsights.com https://*.tawk.to https://cdn.jsdelivr.net https://connect.facebook.net https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' https://accounts.google.com https://*.sentry.io https://static.cloudflareinsights.com https://*.tawk.to https://cdn.jsdelivr.net https://connect.facebook.net https://challenges.cloudflare.com";

    return [
      {
        source: '/:path*',
        headers: [
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
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  hideSourceMaps: true,
  transpileClientSDK: false,
};

let config = withBundleAnalyzer(nextConfig);

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  config = withSentryConfig(config, sentryWebpackPluginOptions);
}

export default config;
