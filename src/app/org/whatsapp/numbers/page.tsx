'use client';

/**
 * /org/whatsapp/numbers — renders inside the WhatsApp tabbed layout.
 */

import { OrgWaNumbersManager } from '@/components/whatsapp';

export default function OrgWhatsAppNumbersPage() {
  return <OrgWaNumbersManager settingsPath="/org/whatsapp/settings" />;
}
