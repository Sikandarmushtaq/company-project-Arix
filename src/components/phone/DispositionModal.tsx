'use client';

/**
 * DispositionModal — post-call outcome picker (Phase 0 / voicemail-QA).
 *
 * Pops up after a qualifying call ends (captured as `lastEndedCall` in the SIP
 * store) and asks the agent for an outcome. Submits to /api/v1/call-dispositions,
 * where the server enforces feature A (audit auto-flag) and feature C (voicemail
 * lockout). A feature-C rejection reveals a reason field so the agent can either
 * justify the voicemail or pick an active outcome instead.
 *
 * Mounted globally in the /phone (and /admin) shells. The inner prompt is keyed
 * by callRecordId so each new call gets fresh local state (no reset effect).
 *
 * @module components/phone/DispositionModal
 */

import React, { useState } from 'react';
import { FiPhoneOutgoing, FiPhoneIncoming, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { Modal, Button } from '@/components/ui';
import { useSipStore, type EndedCallSnapshot } from '@/lib/stores/sip';
import { useDispositionCatalog, useSetDisposition } from '@/lib/hooks/useCallDisposition';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { DispositionOutcome } from '@/lib/api';

function formatDuration(secs: number): string {
  if (secs <= 0) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Stable no-op — the prompt is a blocking modal (no backdrop/escape close). */
const NOOP = () => {};

export function DispositionModal() {
  const ended = useSipStore((s) => s.lastEndedCall);
  const clear = useSipStore((s) => s.clearLastEndedCall);
  // Always-mounted, so this pre-warms the catalog+settings cache on app load.
  const { data: catalog } = useDispositionCatalog();
  const { isModuleEnabled, isLoading: permsLoading } = usePermissions();

  if (!ended) return null;
  // Wait for the catalog (outcomes) and entitlements before deciding, so a
  // disabled tenant never even briefly flashes the prompt. The single master
  // switch is the "Dispositions" tenant module (entitlements grid).
  if (!catalog || permsLoading || !isModuleEnabled('dispositions')) {
    return null;
  }
  // Key by callRecordId so a new call remounts with fresh local state.
  return <DispositionPrompt key={ended.callRecordId} ended={ended} onDone={clear} />;
}

function DispositionPrompt({ ended, onDone }: { ended: EndedCallSnapshot; onDone: () => void }) {
  const { data: catalog, isLoading, isError } = useDispositionCatalog();
  const setDisposition = useSetDisposition();

  const [reason, setReason] = useState('');
  const [reasonRequired, setReasonRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const outcomes = catalog?.outcomes ?? [];
  const vmOutcome = outcomes.find((o) => o.isVoicemail);
  const busy = setDisposition.isPending;

  const submit = (outcome: DispositionOutcome, withReason: boolean) => {
    setError(null);
    setPendingCode(outcome.code);
    setDisposition.mutate(
      {
        callId: ended.callRecordId,
        body: {
          outcomeCode: outcome.code,
          reason: withReason && reason.trim() ? reason.trim() : undefined,
          clientDurationSecs: ended.durationSecs,
        },
      },
      {
        onSuccess: () => {
          setPendingCode(null);
          onDone();
        },
        onError: (err) => {
          setPendingCode(null);
          setError(
            err instanceof Error ? err.message : 'Could not save the outcome. Please try again.'
          );
          // The only expected rejection is feature C on a long voicemail —
          // reveal the reason field so the agent can justify it or pick an
          // active outcome instead.
          if (outcome.isVoicemail) setReasonRequired(true);
        },
      }
    );
  };

  return (
    <Modal
      isOpen
      onClose={NOOP}
      title="Call outcome"
      size="sm"
      closeOnBackdrop={false}
      closeOnEscape={false}
      showCloseButton={false}
    >
      <div className="space-y-4">
        {/* Call summary */}
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          {ended.direction === 'outbound' ? (
            <FiPhoneOutgoing className="h-4 w-4" />
          ) : (
            <FiPhoneIncoming className="h-4 w-4" />
          )}
          <span className="font-medium text-[var(--foreground)]">
            {ended.remoteName || ended.remoteNumber}
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <FiClock className="h-3.5 w-3.5" />
            {formatDuration(ended.durationSecs)}
          </span>
        </div>

        {isLoading && (
          <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
            Loading outcomes…
          </p>
        )}

        {isError && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--destructive)]">Couldn’t load call outcomes.</p>
            <Button variant="outline" className="w-full" onClick={onDone}>
              Dismiss
            </Button>
          </div>
        )}

        {!isLoading && !isError && outcomes.length === 0 && (
          <Button variant="outline" className="w-full" onClick={onDone}>
            Dismiss
          </Button>
        )}

        {!isLoading && !isError && outcomes.length > 0 && (
          <>
            <p className="text-sm text-[var(--foreground)]">How did this call end?</p>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {outcomes.map((o) => (
                <Button
                  key={o.code}
                  variant={o.isActiveOutcome ? 'primary' : 'outline'}
                  className="justify-center"
                  disabled={busy}
                  onClick={() => submit(o, false)}
                >
                  {pendingCode === o.code ? 'Saving…' : o.label}
                </Button>
              ))}
            </div>

            {/* Feature C — reason path for a long voicemail. The agent must
                either enter a reason or pick an active outcome; there is
                deliberately no "dismiss without an outcome" escape. */}
            {reasonRequired && vmOutcome && (
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  Reason for logging this as voicemail
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="Explain why this longer call is a voicemail…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]"
                />
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={busy || !reason.trim()}
                  onClick={() => submit(vmOutcome, true)}
                >
                  {pendingCode === vmOutcome.code ? 'Saving…' : 'Log as Voice Mail'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default DispositionModal;
