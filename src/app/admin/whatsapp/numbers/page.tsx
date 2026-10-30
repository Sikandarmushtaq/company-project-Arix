'use client';

/**
 * /admin/whatsapp/numbers — role-aware route, single layout.
 *
 * Renders the right component for the viewer's role inside the SAME admin
 * shell:
 *  - admin → AdminGlobalNumbersManager (legacy platform-wide list)
 *  - manager → OrgWaNumbersManager (their own org's numbers)
 *
 * Manager stays in the admin layout — no cross-shell jump on click.
 *
 * `settingsPath` is passed so the manager's "back to settings" link stays in
 * the admin shell. Org owners use the same component at /org/whatsapp/numbers
 * inside the org shell, with `settingsPath="/org/whatsapp/settings"`.
 */

import { useAuthStore } from '@/lib/stores/auth';
import { AdminGlobalNumbersManager, OrgWaNumbersManager } from '@/components/whatsapp';

export default function AdminWhatsAppNumbersPage() {
  const { user } = useAuthStore();

  if (user?.role === 'manager') {
    return <OrgWaNumbersManager settingsPath="/admin/whatsapp/settings" />;
  }

  return <AdminGlobalNumbersManager />;
}
