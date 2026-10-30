'use client';

/**
 * Publish dialog for the Call Menu. Shows the readiness gate (what must be true
 * before going live), a plain-language preview of what will happen, an
 * attach-to-number picker, and Publish / Take-offline actions. Publishing acts
 * on the SAVED flow, so unsaved changes block it with a clear prompt.
 */

import React, { useState } from 'react';
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiInfo, FiLoader, FiPhone } from 'react-icons/fi';
import { Modal, Button, StyledSelect } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { useIvrReadiness, useIvrPreview, usePublishIvr, useUnpublishIvr } from '@/lib/hooks/useIvr';
import type { IvrFlowRecord } from '@/lib/api/services/ivr.api';

/** 11-digit (no +) → +1 (216) 428-1997 for display. */
function prettyNumber(n?: string | null): string {
  if (!n) return '';
  const d = n.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return n;
}

export function PublishModal({
  record,
  dirty,
  onClose,
}: {
  record: IvrFlowRecord;
  dirty: boolean;
  onClose: () => void;
}) {
  const isPublished = record.status === 'published';
  // A menu LIVE on a number can be edited (which flips status back to 'draft' while
  // it keeps answering calls) — treat "attached to a number" as live so the owner
  // can always take it offline and restore normal calling, not only when published.
  const isLive = isPublished || !!record.attachedNumber;
  const liveWithEdits = isLive && !isPublished;
  const { data: readiness, isLoading: rLoading } = useIvrReadiness(record.id);
  // Preview reflects the SAVED flow — only meaningful when there are no unsaved edits.
  const { data: preview, isLoading: pLoading } = useIvrPreview(record.id, !dirty);
  const publish = usePublishIvr();
  const unpublish = useUnpublishIvr();

  const numbers = readiness?.numbers ?? [];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  // Default to the currently attached number, but only if the org still owns it
  // (it may have been unassigned since publish); otherwise fall back to the first
  // available number so we never submit a stale value the picker can't show.
  const defaultNumber =
    record.attachedNumber && numbers.includes(record.attachedNumber)
      ? record.attachedNumber
      : numbers[0];
  const chosenNumber = picked ?? defaultNumber;

  const previewErrors = preview?.errors ?? [];
  const previewWarnings = preview?.warnings ?? [];
  const busy = publish.isPending || unpublish.isPending;
  const canPublish = !!readiness?.canPublish && previewErrors.length === 0 && !dirty && !!chosenNumber;

  const checks = readiness?.checks ?? [];
  const allChecksOk = checks.length > 0 && checks.every((c) => c.ok);
  // Picking a number only matters when there's a real choice (multiple owned
  // numbers) or when first going live — a menu already live on its single number
  // has nothing to pick, so the status strip alone carries it.
  const showPicker = numbers.length > 1 || (numbers.length === 1 && !isLive);

  const doPublish = () =>
    publish.mutate(
      { id: record.id, number: chosenNumber },
      {
        onSuccess: (rec) => {
          toast.success(`Call menu is live on ${prettyNumber(rec.attachedNumber)}`);
          onClose();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not publish'),
      }
    );

  const doUnpublish = () =>
    unpublish.mutate(record.id, {
      onSuccess: () => {
        toast.success('Call menu taken offline');
        onClose();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not take offline'),
    });

  return (
    <Modal isOpen onClose={onClose} title={isLive ? 'Your call menu' : 'Publish your call menu'} size="md">
      <div className="space-y-4">
        {/* Status strip — the one place the live state + number live. */}
        <div
          className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
            liveWithEdits
              ? 'border-amber-500/30 bg-amber-500/10'
              : isLive
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-[var(--border)] bg-[var(--muted)]/30'
          }`}
        >
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
              liveWithEdits ? 'bg-amber-500' : isLive ? 'bg-emerald-500' : 'bg-slate-400'
            } ${isLive ? 'animate-pulse' : ''}`}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {isLive ? (
                <>
                  Live on {prettyNumber(record.attachedNumber)}
                  {liveWithEdits && (
                    <span className="ml-2 align-middle text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      edits not published
                    </span>
                  )}
                </>
              ) : (
                'Not published yet'
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {liveWithEdits
                ? 'Callers still hear the last published version. Republish to push your latest edits, or take the menu offline.'
                : isLive
                  ? 'Callers hear this menu now. Take it offline to send calls straight to the number’s user again.'
                  : 'Publish to start routing callers through this menu.'}
            </p>
          </div>
        </div>

        {dirty && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            You have unsaved changes. Save them first, then {isLive ? 'republish' : 'publish'} so callers hear the latest version.
          </div>
        )}

        {/* Readiness — compact when all good, detailed only when something's missing. */}
        {rLoading ? (
          <div className="flex items-center gap-2 py-1 text-sm text-[var(--muted-foreground)]">
            <FiLoader className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : allChecksOk ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <FiCheckCircle className="h-4 w-4 shrink-0" />
            Everything’s set — ready to {isLive ? 'republish' : 'go live'}.
          </div>
        ) : (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Before going live
            </div>
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  {c.ok ? (
                    <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <FiXCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <span className={c.ok ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}>
                    {c.label}
                    {!c.ok && c.detail ? (
                      <span className="block text-[11px] text-[var(--muted-foreground)]">{c.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Number picker — only shown when there's a real choice to make. */}
        {showPicker && numbers.length > 0 && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Answer calls to
            </label>
            {numbers.length === 1 ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]">
                <FiPhone className="h-4 w-4 text-[var(--muted-foreground)]" /> {prettyNumber(numbers[0])}
              </div>
            ) : (
              <StyledSelect
                value={chosenNumber}
                onChange={(v) => setPicked(v)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary-600)]"
              >
                {numbers.map((n) => (
                  <option key={n} value={n}>
                    {prettyNumber(n)}
                  </option>
                ))}
              </StyledSelect>
            )}
          </div>
        )}

        {/* What callers experience — errors block publish; warnings are advisory. */}
        {!dirty && (
          <div>
            {pLoading ? (
              <div className="flex items-center gap-2 py-1 text-sm text-[var(--muted-foreground)]">
                <FiLoader className="h-4 w-4 animate-spin" /> Building preview…
              </div>
            ) : previewErrors.length > 0 ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                <div className="mb-1 font-semibold">Fix these before publishing:</div>
                <ul className="space-y-0.5">
                  {previewErrors.map((e, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : preview ? (
              <div className="space-y-1.5">
                <p className="flex items-start gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <FiPhone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {preview.kind === 'menu'
                    ? 'Callers hear your greeting and press a key to be routed.'
                    : 'Callers hear your greeting and are connected.'}
                </p>
                {previewWarnings.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
                    {previewWarnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <FiInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {isLive ? (
            <Button variant="outline" onClick={doUnpublish} loading={unpublish.isPending} disabled={busy}>
              Take offline
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doPublish} loading={publish.isPending} disabled={!canPublish || busy}>
              {isLive ? 'Republish' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
