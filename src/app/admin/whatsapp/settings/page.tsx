'use client';

/**
 * /admin/whatsapp/settings — role-aware route, single layout.
 *
 * Renders the right component for the viewer's role inside the SAME admin
 * shell:
 *  - admin → AdminGlobalSettingsForm (legacy platform-wide config)
 *  - manager → OrgWaSettingsForm (their own org's Meta credentials)
 *
 * Why both render here instead of redirecting managers to /org/whatsapp/*:
 * The manager's home is the admin shell (sidebar with Dashboard, Live Calls,
 * Analytics, etc.). Sending them to /org/* would swap to the org-owner shell
 * mid-session — a layout switch on click that breaks UX continuity.
 *
 * The shared UI component lives in @/components/whatsapp (SSOT). Org owners
 * use the same component at /org/whatsapp/settings inside their org shell.
 *
 * `numbersPath` is passed so the form's "manage numbers" link stays in the
 * admin shell when rendered here — no cross-layout navigation.
 */

import { useAuthStore } from '@/lib/stores/auth';
import { AdminGlobalSettingsForm, OrgWaSettingsForm } from '@/components/whatsapp';

export default function AdminWhatsAppSettingsPage() {
  const { user } = useAuthStore();

  if (user?.role === 'manager') {
    return <OrgWaSettingsForm numbersPath="/admin/whatsapp/numbers" />;
  }

  return <AdminGlobalSettingsForm />;
}
