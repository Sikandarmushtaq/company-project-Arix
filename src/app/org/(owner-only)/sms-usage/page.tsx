'use client';

/**
 * /org/sms-usage — owner-facing SMS usage, org-scoped.
 *
 * Renders the same component as /admin/sms/usage inside the org shell. The
 * usage summary + per-user stats endpoints (/sms/admin/usage*) are org-scoped
 * via injectOrgFilter and now allow the OWNER role, so an owner sees only their
 * own organization's usage. The admin-only actions (reset counters, edit limit)
 * are gated by `isAdmin` inside the page, so they don't render for an owner.
 */

import SmsUsagePage from '@/app/admin/sms/usage/page';

export default function OrgSmsUsagePage() {
  return <SmsUsagePage />;
}
