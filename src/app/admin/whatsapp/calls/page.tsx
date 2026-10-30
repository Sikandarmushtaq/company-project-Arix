'use client';

/**
 * /admin/whatsapp/calls — Manager-only WhatsApp call recordings.
 *
 * Thin route gate: redirects non-managers to /admin and renders the
 * orchestrator view. Server enforces the same role + org isolation via
 * `requireOwnerOrManager` on every endpoint the view calls, so the
 * frontend gate is purely UX.
 *
 * @module app/admin/whatsapp/calls/page
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { WaCallRecordingsView } from './WaCallRecordingsView';

export default function AdminWhatsAppCallsPage() {
  const router = useRouter();
  const { isAdmin, isManager } = usePermissions();

  // Hard route gate — even though the layout hides the tab/sidebar item,
  // a direct URL bookmark from a regular user gets redirected to /admin
  // instead of hitting the API for a 403.
  useEffect(() => {
    if (!isAdmin && !isManager) {
      router.replace('/admin');
    }
  }, [isAdmin, isManager, router]);

  if (!isAdmin && !isManager) {
    // Redirect in flight — render nothing to avoid a flash of the table.
    return null;
  }

  return <WaCallRecordingsView />;
}
