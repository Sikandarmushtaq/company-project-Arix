import type { MetadataRoute } from 'next';

// Auto-generated sitemap covering the public marketing routes. App routes
// (/login, /signup, /admin/*, /phone/*, /org/*) are private and intentionally
// excluded so search engines don't index them.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arixcall.com';
  const now = new Date();

  return [
    { url: `${base}`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/security`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/vs/aircall`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
