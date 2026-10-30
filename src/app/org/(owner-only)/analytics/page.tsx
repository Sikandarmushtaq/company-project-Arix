'use client';

/**
 * /org/analytics — owner-facing analytics, org-scoped.
 *
 * Renders the same component as /admin/analytics inside the org shell. The
 * analytics API (/admin/analytics/*) is org-scoped for a non-super-admin via
 * injectOrgFilter, and the route now allows the OWNER role — so an owner sees
 * only their own organization's numbers.
 */

import AnalyticsPage from '@/app/admin/analytics/page';

export default function OrgAnalyticsPage() {
  return <AnalyticsPage />;
}
