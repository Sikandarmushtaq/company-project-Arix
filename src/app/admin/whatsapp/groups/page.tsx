'use client';

/**
 * /admin/whatsapp/groups — role-aware route, single layout.
 *
 * Managers in the admin shell render WaAgentGroupsManager scoped to their
 * own org. Platform admins don't have agent groups (they manage the
 * legacy global config); we redirect them to numbers.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { WaAgentGroupsManager } from '@/components/whatsapp';

export default function AdminWhatsAppGroupsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== 'manager') {
      router.replace('/admin/whatsapp/numbers');
    }
  }, [user, router]);

  if (!user || user.role !== 'manager') {
    return null;
  }

  return <WaAgentGroupsManager numbersPath="/admin/whatsapp/numbers" />;
}
