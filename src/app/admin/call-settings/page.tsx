'use client';

/**
 * Call Disposition Settings — the per-tenant master switch for the voicemail-QA
 * feature (post-call disposition prompt + A/C rules) plus the two thresholds.
 * Owner/admin only (ownerAdmin nav + backend role gate). A super-admin (no org)
 * edits the global default; an owner edits their org.
 *
 * @module app/admin/call-settings/page
 */

import React, { useState } from 'react';
import { FiSettings, FiLoader, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useQaSettings, useSaveQaSettings } from '@/lib/hooks/useCallDisposition';
import type { QaSettings } from '@/lib/api';

export default function CallSettingsPage() {
  const { data, isLoading, isError } = useQaSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Call Disposition Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Tune the voicemail audit/lockout thresholds. To turn the whole feature on or off for a
          tenant, use the <span className="font-medium">Dispositions</span> module in Tenant Access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiSettings className="w-4 h-4" /> Voicemail QA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-[var(--muted-foreground)]">
              <FiLoader className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : isError || !data ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--destructive)]">
              <FiAlertTriangle className="w-4 h-4" /> Couldn’t load the settings.
            </div>
          ) : (
            <SettingsForm initial={data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsForm({ initial }: { initial: QaSettings }) {
  const save = useSaveQaSettings();
  const [audit, setAudit] = useState(String(initial.voicemailAuditThresholdSecs));
  const [lockout, setLockout] = useState(String(initial.voicemailLockoutThresholdSecs));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const a = Number(audit);
    const l = Number(lockout);
    if (!Number.isInteger(a) || !Number.isInteger(l) || a < 5 || l < 5) {
      setError('Enter whole-number seconds (5 or more).');
      return;
    }
    if (a >= l) {
      setError('The audit threshold must be below the lockout threshold.');
      return;
    }
    save.mutate(
      { voicemailAuditThresholdSecs: a, voicemailLockoutThresholdSecs: l },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setError(err instanceof Error ? err.message : 'Could not save.'),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--foreground)]">
            Audit threshold (seconds)
          </label>
          <Input
            type="number"
            min={5}
            max={600}
            value={audit}
            onChange={(e) => setAudit(e.target.value)}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            A voicemail longer than this is flagged for audit (feature A).
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--foreground)]">
            Lockout threshold (seconds)
          </label>
          <Input
            type="number"
            min={5}
            max={3600}
            value={lockout}
            onChange={(e) => setLockout(e.target.value)}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            A call longer than this can’t be logged as voicemail without a reason (feature C).
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-2.5 text-xs text-[var(--destructive)]">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saved && !error && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
          <FiCheckCircle className="h-4 w-4" /> Saved.
        </div>
      )}

      <Button type="submit" variant="primary" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save settings'}
      </Button>
    </form>
  );
}
