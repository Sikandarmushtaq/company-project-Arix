'use client';

/**
 * /org/whatsapp/templates — thin route wrapper.
 *
 * Per-org template sync for owners/managers (provider-aware: YCloud or Meta).
 * The admin has its own global templates page; this is the org-scoped version.
 */

import { OrgWaTemplatesManager } from '@/components/whatsapp';

export default function OrgWhatsAppTemplatesPage() {
  return <OrgWaTemplatesManager />;
}
