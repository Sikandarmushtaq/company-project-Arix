'use client';

/**
 * /org/whatsapp/groups — thin route wrapper.
 *
 * The actual UI lives in <WaAgentGroupsManager />, shared with the manager-side
 * admin route variant.
 */

import { WaAgentGroupsManager } from '@/components/whatsapp';

export default function OrgWhatsAppGroupsPage() {
  return <WaAgentGroupsManager numbersPath="/org/whatsapp/numbers" />;
}
