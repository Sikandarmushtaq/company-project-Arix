'use client';

/**
 * Recordings Page
 *
 * Thin switcher between admin and manager views based on user role.
 *
 * @module app/admin/recordings/page
 */

import { usePermissions } from '@/lib/hooks/usePermissions';
import { ManagerRecordingsView } from './ManagerRecordingsView';
import { AdminRecordingsView } from './AdminRecordingsView';

export default function RecordingsPage() {
  const { isSuperAdmin } = usePermissions();

  // Only the platform super admin manages org quotas (all tenants). Tenant
  // admins and managers hear their OWN org's team recordings (org-scoped).
  if (!isSuperAdmin) {
    return <ManagerRecordingsView />;
  }

  return <AdminRecordingsView />;
}
