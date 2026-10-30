import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arixcall.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/contact', '/security', '/vs/', '/privacy', '/terms'],
        disallow: [
          '/admin/',
          '/phone/',
          '/org/',
          '/login',
          '/signup/',
          '/forgot-password',
          '/reset-password',
          '/api/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
