'use client';

/**
 * SMS Drip Sequences — list, build, enroll, and monitor server-side drips.
 * Gated at the ORG level by the `sms` + `auto_sms` tenant modules, same as the
 * campaign page — enabled for the org ⇒ available to every user in it.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiPlus,
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiUserPlus,
  FiChevronDown,
  FiChevronRight,
  FiPlay,
  FiPause,
  FiSquare,
  FiZap,
} from 'react-icons/fi';
import { Button, Badge } from '@/components/ui';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { toast } from '@/lib/stores/toast';
import {
  useDripSequences,
  useDeleteDripSequence,
  useDripEnrollments,
  useSetEnrollmentStatus,
} from '@/lib/hooks/useSmsDrip';
import type { DripSequence, DripEnrollmentStatus } from '@/lib/api/services/sms-drip.service';
import { SequenceBuilder } from '../_components/SequenceBuilder';
import { EnrollModal } from '../_components/EnrollModal';

const STATUS_TONE: Record<DripEnrollmentStatus, string> = {
  active: 'success',
  sending: 'info',
  paused: 'warning',
  completed: 'secondary',
  stopped: 'danger',
};

function EnrollmentsPanel({ sequenceId }: { sequenceId: number }) {
  const { data, isLoading } = useDripEnrollments(sequenceId);
  const setStatus = useSetEnrollmentStatus();
  const enrollments = data?.enrollments ?? [];

  const change = async (enrollmentId: number, status: DripEnrollmentStatus) => {
    try {
      await setStatus.mutateAsync({ enrollmentId, status });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
    }
  };

  if (isLoading) return <div className="px-4 py-3 text-xs text-[var(--muted-foreground)]">Loading…</div>;
  if (enrollments.length === 0)
    return <div className="px-4 py-3 text-xs text-[var(--muted-foreground)]">No one enrolled yet.</div>;

  return (
    <div className="divide-y divide-[var(--border)]">
      {enrollments.map((e) => (
        <div key={e.id} className="flex items-center gap-2 px-4 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-[var(--foreground)]">{e.contactName || e.recipientPhone}</span>
            <span className="ml-2 text-xs text-[var(--muted-foreground)]">
              step {e.currentStep}
              {e.nextRunAt ? ` · next ${new Date(e.nextRunAt).toLocaleString()}` : ''}
            </span>
          </div>
          <Badge variant={STATUS_TONE[e.status] as 'success'} size="sm">
            {e.status}
          </Badge>
          {(e.status === 'active' || e.status === 'sending') && (
            <button onClick={() => change(e.id, 'paused')} title="Pause" className="text-[var(--muted-foreground)] hover:text-amber-500">
              <FiPause className="h-4 w-4" />
            </button>
          )}
          {e.status === 'paused' && (
            <button onClick={() => change(e.id, 'active')} title="Resume" className="text-[var(--muted-foreground)] hover:text-emerald-500">
              <FiPlay className="h-4 w-4" />
            </button>
          )}
          {e.status !== 'completed' && e.status !== 'stopped' && (
            <button onClick={() => change(e.id, 'stopped')} title="Stop" className="text-[var(--muted-foreground)] hover:text-red-500">
              <FiSquare className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function SequenceCard({
  seq,
  onEdit,
  onEnroll,
  onDelete,
}: {
  seq: DripSequence;
  onEdit: () => void;
  onEnroll: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--muted-foreground)]" aria-label="Toggle enrollments">
          {open ? <FiChevronDown className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-extrabold text-[var(--foreground)]">{seq.name}</span>
            <Badge variant={seq.enabled ? 'success' : 'secondary'} size="sm">
              {seq.enabled ? 'Active' : 'Off'}
            </Badge>
          </div>
          <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {seq.steps?.length ?? 0} step{(seq.steps?.length ?? 0) !== 1 ? 's' : ''} · from {seq.fromPhone}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEnroll}>
          <FiUserPlus className="mr-1 h-3.5 w-3.5" /> Enroll
        </Button>
        <button onClick={onEdit} title="Edit" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <FiEdit2 className="h-4 w-4" />
        </button>
        <button onClick={onDelete} title="Delete" className="text-[var(--muted-foreground)] hover:text-red-500">
          <FiTrash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="border-t border-[var(--border)]">
          <EnrollmentsPanel sequenceId={seq.id} />
        </div>
      )}
    </div>
  );
}

export default function SequencesPage() {
  const router = useRouter();
  const { modules } = usePermissions();
  // Org-level: Auto-SMS enabled for the org ⇒ available to every user in it.
  const hasAccess = modules?.['sms'] !== false && modules?.['auto_sms'] !== false;

  const { data: sequences = [], isLoading } = useDripSequences(hasAccess);
  const del = useDeleteDripSequence();

  const [builderFor, setBuilderFor] = useState<DripSequence | null | 'new'>(null);
  const [enrollFor, setEnrollFor] = useState<DripSequence | null>(null);

  const handleDelete = async (seq: DripSequence) => {
    if (!window.confirm(`Delete the sequence "${seq.name}"? Enrolled contacts will stop receiving it.`)) return;
    try {
      await del.mutateAsync(seq.id);
      toast.success('Sequence deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    }
  };

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
          <FiZap className="mx-auto mb-3 h-8 w-8 text-[var(--primary-600)]" />
          <h2 className="text-lg font-extrabold">Auto-SMS isn’t enabled</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Drip sequences are part of Auto-SMS. Ask your admin to enable it for your number.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <button
              onClick={() => router.push('/phone/bulk-sms')}
              className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <FiArrowLeft className="h-3.5 w-3.5" /> Campaigns
            </button>
            <h1 className="text-2xl font-black tracking-tight">Drip sequences</h1>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              Automated multi-step texts that send over time and pause when someone replies.
            </p>
          </div>
          <Button onClick={() => setBuilderFor('new')}>
            <FiPlus className="mr-1.5 h-4 w-4" /> New sequence
          </Button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">Loading…</div>
        ) : sequences.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
            <h2 className="text-lg font-extrabold">No sequences yet</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Build a sequence of timed messages, then enroll contacts.
            </p>
            <Button className="mt-4" onClick={() => setBuilderFor('new')}>
              <FiPlus className="mr-1.5 h-4 w-4" /> New sequence
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sequences.map((seq) => (
              <SequenceCard
                key={seq.id}
                seq={seq}
                onEdit={() => setBuilderFor(seq)}
                onEnroll={() => setEnrollFor(seq)}
                onDelete={() => handleDelete(seq)}
              />
            ))}
          </div>
        )}
      </div>

      {builderFor !== null && (
        <SequenceBuilder
          sequence={builderFor === 'new' ? null : builderFor}
          onClose={() => setBuilderFor(null)}
        />
      )}
      {enrollFor && (
        <EnrollModal sequenceId={enrollFor.id} sequenceName={enrollFor.name} onClose={() => setEnrollFor(null)} />
      )}
    </div>
  );
}
