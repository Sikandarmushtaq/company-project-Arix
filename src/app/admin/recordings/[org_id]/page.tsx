'use client';

import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { ManagerRecordingsView } from '../ManagerRecordingsView';

export default function AdminOrganizationRecordingsPage() {
  const params = useParams<{ org_id: string }>();
  const router = useRouter();
  const { isSuperAdmin, isLoading } = usePermissions();
  const organizationId = Number(params.org_id);

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <FiLoader className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-[var(--danger)]" />
          <p className="font-semibold text-[var(--danger)]">Access Denied</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Only platform administrators can manage recordings for other organizations.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => router.push('/admin/recordings')}>
            Back to recordings
          </Button>
        </div>
      </div>
    );
  }

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-[var(--danger)]" />
          <p className="font-semibold text-[var(--danger)]">Invalid organization ID</p>
          <Button className="mt-4" variant="outline" onClick={() => router.push('/admin/recordings')}>
            Back to recordings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={() => router.push('/admin/recordings')}>
        <FiArrowLeft className="h-4 w-4" />
        Back to organizations
      </Button>
      <ManagerRecordingsView organizationId={organizationId} />
    </div>
  );
}
