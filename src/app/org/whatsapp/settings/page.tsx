'use client';

/**
 * /org/whatsapp/settings — thin route wrapper.
 *
 * The actual UI lives in <OrgWaSettingsForm />, shared with the manager-side
 * route at /admin/whatsapp/settings (which renders the same component when
 * the viewing user is a manager).
 */

import { OrgWaSettingsForm } from '@/components/whatsapp';

export default function OrgWhatsAppSettingsPage() {
  return <OrgWaSettingsForm numbersPath="/org/whatsapp/numbers" />;
}
