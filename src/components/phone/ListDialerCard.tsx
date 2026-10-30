'use client';

/**
 * List Dialer Card
 *
 * The full UI for the Excel-list sequential dialer mode. Rendered at
 * the top of /phone when a list session exists. Has five visual modes
 * keyed off the store status:
 *
 *   - idle               → drag/drop upload card
 *   - ready              → big "Start calling" button + current contact preview
 *   - calling            → live call view (contact details + duration)
 *   - awaiting_disposition → disposition picker + free-text note
 *   - completed          → results summary + download button
 *
 * The actual call placement (makeCall / endCall on the SIP store)
 * happens here, NOT in the store — keeping the listDialer store free
 * of SIP coupling makes it trivially testable and means a future
 * server-backed version of the store wouldn't need SIP wiring.
 *
 * @module components/phone/ListDialerCard
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiUpload,
  FiPhone,
  FiPhoneOff,
  FiSkipForward,
  FiPause,
  FiPlay,
  FiDownload,
  FiX,
  FiCheck,
  FiAlertCircle,
} from 'react-icons/fi';
import { Card, CardContent, Button, Modal, ConfirmModal } from '@/components/ui';
import { useSipStore } from '@/lib/stores/sip';
import { toast } from '@/lib/stores/toast';
import {
  useListDialerStore,
  selectCurrentEntry,
  type ListDialerEntry,
  type ListDialerStats,
} from '@/lib/stores/listDialer';
import {
  parseListDialerFile,
  exportListDialerResults,
  LIST_DIALER_DISPOSITIONS,
  type DispositionTone,
} from '@/lib/utils/listDialerExcel';

const AUTO_DIAL_DELAY_MS = 1500;

/**
 * Compute campaign stats from the entries array. Pulled out of the
 * store as a selector deliberately — Zustand v5 punishes selectors
 * that return new object references with "Maximum update depth"
 * loops, so consumers subscribe to `entries` (stable reference until
 * any entry is mutated) and `useMemo` the derived stats.
 */
function computeStats(entries: ListDialerEntry[]): ListDialerStats {
  let called = 0;
  let skipped = 0;
  for (const e of entries) {
    if (e.status === 'called') called++;
    else if (e.status === 'skipped') skipped++;
  }
  return {
    total: entries.length,
    called,
    skipped,
    pending: entries.length - called - skipped,
  };
}

/**
 * Renders the campaign UI when a list is loaded — returns null when
 * the store is in 'idle'. Upload happens via <ListDialerUploadModal/>
 * (header-launched on /phone), so the page is quiet when not in use.
 */
export function ListDialerCard() {
  const status = useListDialerStore((s) => s.status);
  if (status === 'idle') return null;
  if (status === 'completed') return <CompletionCard />;
  return <ActiveCampaignCard />;
}

/**
 * Modal launcher for the upload UI. The page renders this once and
 * controls open/close from a header button.
 */
export function ListDialerUploadModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="List Dialer" size="md">
      <UploadInline
        onLoaded={() => {
          // Close as soon as the list lands in the store — the page
          // immediately renders the campaign card, no extra click
          // needed to "Start campaign."
          onClose();
        }}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Upload UI (used inside the modal)
// ---------------------------------------------------------------------------

function UploadInline({ onLoaded }: { onLoaded?: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadList = useListDialerStore((s) => s.loadList);

  const handleFile = useCallback(
    async (file: File) => {
      setIsParsing(true);
      try {
        const result = await parseListDialerFile(file);
        if (result.rows.length === 0) {
          toast.error('No usable phone numbers found in that file.');
          return;
        }
        loadList({
          fileName: file.name,
          phoneColumnHeader: result.phoneColumnHeader,
          extraHeaders: result.extraHeaders,
          rows: result.rows,
        });
        const skipped =
          result.skippedRowCount > 0 ? ` (${result.skippedRowCount} rows skipped)` : '';
        toast.success(`Loaded ${result.rows.length} numbers from ${file.name}${skipped}`);
        onLoaded?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to parse the file.');
      } finally {
        setIsParsing(false);
      }
    },
    [loadList, onLoaded]
  );

  return (
    <div>
      <p className="text-sm text-[var(--muted-foreground)] mb-4">
        Upload an Excel or CSV with phone numbers. The dialer walks the list one row at a time — you
        talk, end the call, pick an outcome, the next number dials automatically.
      </p>
      <label
        htmlFor="list-dialer-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[var(--border)] bg-[var(--primary-600)]/5'
            : 'border-[var(--border)] hover:border-[var(--border)]/50 hover:bg-[var(--muted)]/30'
        }`}
      >
        <FiUpload className="w-10 h-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="text-sm font-medium text-[var(--foreground)]">
          {isParsing ? 'Parsing file…' : 'Drop a file here or click to browse'}
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          .xlsx, .xls, or .csv — phone column auto-detected
        </p>
        <input
          ref={inputRef}
          id="list-dialer-upload"
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={isParsing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active campaign — covers ready / calling / awaiting_disposition / paused
// ---------------------------------------------------------------------------

function ActiveCampaignCard() {
  const status = useListDialerStore((s) => s.status);
  const fileName = useListDialerStore((s) => s.fileName);
  const currentEntry = useListDialerStore(selectCurrentEntry);
  const entries = useListDialerStore((s) => s.entries);
  const stats = useMemo(() => computeStats(entries), [entries]);
  const startCalling = useListDialerStore((s) => s.startCalling);
  const recordCallEnded = useListDialerStore((s) => s.recordCallEnded);
  const skipCurrent = useListDialerStore((s) => s.skipCurrent);
  const pause = useListDialerStore((s) => s.pause);
  const resume = useListDialerStore((s) => s.resume);
  const resetCampaign = useListDialerStore((s) => s.resetCampaign);
  const recordDisposition = useListDialerStore((s) => s.recordDisposition);
  const currentLineId = useListDialerStore((s) => s.currentLineId);

  const isRegistered = useSipStore((s) => s.isRegistered);
  const makeCall = useSipStore((s) => s.makeCall);
  const endCall = useSipStore((s) => s.endCall);
  const lines = useSipStore((s) => s.lines);

  // Detect when the SIP line we created has gone away — that's our
  // signal to move to the disposition picker. We can't just listen
  // for `activeLineId === null` because the SIP store reuses
  // activeLineId across calls and could briefly null between a
  // dropped call and an answered one. Watching for OUR lineId
  // disappearing from the lines array is unambiguous.
  //
  // Race guard: between makeCall returning a lineId and the lines[]
  // array updating from the SIP event stream there's a one-frame
  // window where stillExists would be false even though the call is
  // about to come up. We track "have we ever seen this lineId in the
  // array" in a ref and only fire recordCallEnded after we've seen
  // it at least once. Without this, every call would instantly
  // teleport to the disposition picker without dialing.
  const hasSeenLineRef = useRef(false);
  useEffect(() => {
    hasSeenLineRef.current = false;
  }, [currentLineId]);
  useEffect(() => {
    if (status !== 'calling' || currentLineId === null) return;
    const stillExists = lines.some((l) => l.id === currentLineId);
    if (stillExists) {
      hasSeenLineRef.current = true;
      return;
    }
    if (hasSeenLineRef.current) {
      recordCallEnded();
    }
  }, [status, currentLineId, lines, recordCallEnded]);

  // Auto-dial: after a disposition is recorded and we move back to
  // 'ready', wait a beat then place the next call. Done with a
  // useEffect rather than inside `recordDisposition` so the timer is
  // attached to component lifecycle and gets cancelled on unmount.
  const wasAwaitingDisposition = useRef(false);
  useEffect(() => {
    if (status === 'awaiting_disposition') {
      wasAwaitingDisposition.current = true;
      return;
    }
    if (status === 'ready' && wasAwaitingDisposition.current) {
      wasAwaitingDisposition.current = false;
      const t = setTimeout(() => {
        // Re-check status — the user may have hit Pause during the delay.
        const fresh = useListDialerStore.getState().status;
        if (fresh === 'ready') {
          void placeCurrentCall();
        }
      }, AUTO_DIAL_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeCurrentCall = useCallback(async () => {
    const entry = useListDialerStore.getState();
    const current =
      entry.currentIndex < entry.entries.length ? entry.entries[entry.currentIndex] : null;
    if (!current) return;
    if (!isRegistered) {
      toast.error('Phone line is not connected. Try again once you see the green status.');
      return;
    }
    try {
      const lineId = await makeCall(current.phoneNumber);
      startCalling(lineId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dial.');
    }
  }, [isRegistered, makeCall, startCalling]);

  const handleHangup = useCallback(async () => {
    if (currentLineId === null) return;
    try {
      await endCall(currentLineId);
    } catch {
      // SIP store may have already cleared the line by the time we
      // get here — recordCallEnded gets called by the lines-watching
      // effect either way. Swallow the race.
    }
  }, [currentLineId, endCall]);

  if (!currentEntry) {
    // Out of rows — should normally land on 'completed'. Treat any
    // mismatch as a "campaign finished" hint.
    return <CompletionCard />;
  }

  // When the disposition picker is up, the contact details panel
  // becomes redundant — the user JUST hung up with that person and
  // doesn't need the full address/notes box to pick an outcome. We
  // collapse it to a one-line summary so the whole card fits the
  // viewport without internal scrolling.
  const compactContactMode = status === 'awaiting_disposition';

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <CampaignHeader
          fileName={fileName ?? ''}
          stats={stats}
          status={status}
          onReset={resetCampaign}
        />

        {compactContactMode ? (
          <ContactSummaryLine entry={currentEntry} />
        ) : (
          <ContactDetails entry={currentEntry} />
        )}

        {status === 'ready' && (
          <ReadyControls
            onStart={placeCurrentCall}
            onSkip={skipCurrent}
            onPause={pause}
            isRegistered={isRegistered}
          />
        )}

        {status === 'calling' && (
          <CallingControls phoneNumber={currentEntry.phoneNumber} onHangup={handleHangup} />
        )}

        {status === 'awaiting_disposition' && (
          <DispositionPicker onSubmit={(d, n) => recordDisposition(d, n)} onPause={pause} />
        )}

        {status === 'paused' && <PausedControls onResume={resume} onReset={resetCampaign} />}
      </CardContent>
    </Card>
  );
}

/**
 * Compact one-line "Just called: Name · Phone" used when the disposition
 * picker is visible. Saves ~120px of vertical space vs. the full
 * ContactDetails panel.
 */
function ContactSummaryLine({ entry }: { entry: ListDialerEntry }) {
  // Match the same conservative rule as ContactDetails — only treat a
  // column as the "name" when its header explicitly looks like one.
  const nameCol = useMemo(() => {
    const lcMatch = ['name', 'full name', 'fullname', 'contact', 'company', 'business'];
    return (
      entry.extraColumns.find((c) => c.value && lcMatch.includes(c.header.trim().toLowerCase())) ??
      null
    );
  }, [entry]);

  return (
    <div className="bg-[var(--muted)]/40 border border-[var(--border)] rounded-lg px-3 py-2 mb-3 flex items-center gap-2 min-w-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] flex-shrink-0">
        Just called
      </span>
      <span className="text-sm text-[var(--foreground)] truncate min-w-0">
        {nameCol ? <span className="font-semibold">{nameCol.value} · </span> : null}
        <span className="font-mono">{entry.phoneNumberRaw || entry.phoneNumber}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-pieces of the active campaign card
// ---------------------------------------------------------------------------

function CampaignHeader({
  fileName,
  stats,
  status,
  onReset,
}: {
  fileName: string;
  stats: ListDialerStats;
  status: string;
  onReset: () => void;
}) {
  const pct =
    stats.total === 0 ? 0 : Math.round(((stats.called + stats.skipped) / stats.total) * 100);
  // In-app confirm modal — the browser's native confirm() looks like a
  // Chrome system dialog (unstyled, says "localhost says…") which feels
  // unprofessional in a customer-facing product.
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
            List Dialer
          </span>
          <span className="text-xs text-[var(--muted-foreground)] truncate" title={fileName}>
            · {fileName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1"
        >
          <FiX className="w-3 h-3" /> Cancel campaign
        </button>
      </div>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onReset();
        }}
        title="Cancel campaign?"
        message="Your progress will be lost and the file will need to be re-uploaded."
        confirmText="Cancel campaign"
        cancelText="Keep going"
        variant="danger"
      />
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary-600)] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[var(--muted-foreground)] tabular-nums">
          {stats.called + stats.skipped} / {stats.total}
        </span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">
        {status === 'paused'
          ? 'Paused'
          : `${stats.called} called · ${stats.skipped} skipped · ${stats.pending} remaining`}
      </p>
    </div>
  );
}

function ContactDetails({ entry }: { entry: ListDialerEntry }) {
  // Only headline a column as a "name" when the column header explicitly
  // says so (name / contact / company / business). Earlier we fell back
  // to the first non-empty extra column, but that made an unlabeled
  // "Address" value like "ufjahsfc" look like a person's name, which is
  // confusing. With no name column, the headline is just the phone
  // number and every extra column shows clearly labeled below.
  const nameCol = useMemo(() => {
    const lcMatch = ['name', 'full name', 'fullname', 'contact', 'company', 'business'];
    return (
      entry.extraColumns.find((c) => c.value && lcMatch.includes(c.header.trim().toLowerCase())) ??
      null
    );
  }, [entry]);

  return (
    <div className="bg-[var(--muted)]/40 border border-[var(--border)] rounded-xl p-4 mb-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
        Now dialing
      </p>
      {nameCol ? (
        <p className="text-xl font-semibold text-[var(--foreground)] mb-1">{nameCol.value}</p>
      ) : null}
      <p className="text-lg font-mono text-[var(--foreground)] mb-3">
        {entry.phoneNumberRaw || entry.phoneNumber}
      </p>
      {entry.extraColumns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {entry.extraColumns
            .filter((c) => c.value && c !== nameCol)
            .map((c) => (
              <div key={c.header} className="text-sm min-w-0">
                <span className="text-[var(--muted-foreground)]">{c.header}:</span>{' '}
                <span className="text-[var(--foreground)] break-words">{c.value}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ReadyControls({
  onStart,
  onSkip,
  onPause,
  isRegistered,
}: {
  onStart: () => void;
  onSkip: () => void;
  onPause: () => void;
  isRegistered: boolean;
}) {
  return (
    <div className="space-y-3">
      {!isRegistered && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Phone line not connected — calling is disabled until the green status returns.
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onStart} disabled={!isRegistered} className="flex-1 min-w-[160px]">
          <FiPhone className="w-4 h-4 mr-2" /> Call this number
        </Button>
        <Button variant="outline" onClick={onSkip}>
          <FiSkipForward className="w-4 h-4 mr-2" /> Skip
        </Button>
        <Button variant="outline" onClick={onPause}>
          <FiPause className="w-4 h-4 mr-2" /> Pause
        </Button>
      </div>
    </div>
  );
}

function CallingControls({ phoneNumber, onHangup }: { phoneNumber: string; onHangup: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
        <span className="relative inline-flex w-2 h-2">
          <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-green-500" />
        </span>
        <span className="font-medium">On a call with {phoneNumber}</span>
      </div>
      <Button onClick={onHangup} className="w-full bg-red-600 hover:bg-red-700 text-white">
        <FiPhoneOff className="w-4 h-4 mr-2" /> End call
      </Button>
      <p className="text-xs text-[var(--muted-foreground)] text-center">
        After the call ends, you&apos;ll record an outcome — then the next number dials
        automatically.
      </p>
    </div>
  );
}

function DispositionPicker({
  onSubmit,
  onPause,
}: {
  onSubmit: (disposition: string, note: string) => void;
  onPause: () => void;
}) {
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const toneClasses: Record<DispositionTone, string> = {
    positive:
      'border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
    neutral: 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/50',
    negative:
      'border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
  };
  const selectedToneClasses: Record<DispositionTone, string> = {
    positive: 'border-green-500 bg-green-50 dark:bg-green-900/30 ring-2 ring-green-500/20',
    neutral:
      'border-[var(--border)] bg-[var(--primary-600)]/10 ring-2 ring-[var(--primary-600)]/20',
    negative: 'border-red-500 bg-red-50 dark:bg-red-900/30 ring-2 ring-red-500/20',
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--foreground)]">How did that call go?</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {LIST_DIALER_DISPOSITIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setSelected(d.value)}
            className={`text-sm font-medium border rounded-lg px-2 py-2 transition-colors ${
              selected === d.value ? selectedToneClasses[d.tone] : toneClasses[d.tone]
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g., asked to call back Thursday morning)"
        rows={2}
        className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]/30"
      />
      <div className="flex gap-2">
        <Button
          onClick={() => selected && onSubmit(selected, note)}
          disabled={!selected}
          className="flex-1"
        >
          <FiCheck className="w-4 h-4 mr-2" /> Save & dial next
        </Button>
        <Button variant="outline" onClick={onPause}>
          <FiPause className="w-4 h-4 mr-2" /> Pause
        </Button>
      </div>
    </div>
  );
}

function PausedControls({ onResume, onReset }: { onResume: () => void; onReset: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        Campaign paused. Pick up where you left off or download what you have so far.
      </p>
      <div className="space-y-2">
        {/* Top row: primary actions side by side. */}
        <div className="flex gap-2">
          <Button onClick={onResume} className="flex-1 min-w-[140px]">
            <FiPlay className="w-4 h-4 mr-2" /> Resume
          </Button>
          <DownloadButton variant="outline" />
        </div>
        {/* Cancel on its own row, horizontally centered so the three
            buttons form a T (Resume + Download on top, Cancel below
            in the middle). */}
        <div className="flex justify-center">
          <Button variant="outline" onClick={onReset}>
            <FiX className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completion mode
// ---------------------------------------------------------------------------

function CompletionCard() {
  const entries = useListDialerStore((s) => s.entries);
  const stats = useMemo(() => computeStats(entries), [entries]);
  const fileName = useListDialerStore((s) => s.fileName);
  const resetCampaign = useListDialerStore((s) => s.resetCampaign);

  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Campaign complete</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{fileName}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <Stat label="Called" value={stats.called} tone="positive" />
          <Stat label="Skipped" value={stats.skipped} tone="neutral" />
          <Stat label="Total" value={stats.total} tone="neutral" />
        </div>

        <div className="flex flex-wrap gap-2">
          <DownloadButton />
          <Button variant="outline" onClick={resetCampaign}>
            <FiUpload className="w-4 h-4 mr-2" /> Start a new list
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'positive' | 'neutral';
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        tone === 'positive'
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
          : 'border-[var(--border)] bg-[var(--muted)]/30'
      }`}
    >
      <p className="text-xs text-[var(--muted-foreground)] mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
    </div>
  );
}

function DownloadButton({ variant }: { variant?: 'outline' }) {
  // Subscribe to specific fields rather than the whole store. The
  // store-wide subscription (useListDialerStore() with no selector)
  // returns a new state object on every action and triggers the
  // Zustand v5 infinite-render check.
  const fileName = useListDialerStore((s) => s.fileName);
  const phoneColumnHeader = useListDialerStore((s) => s.phoneColumnHeader);
  const extraHeaders = useListDialerStore((s) => s.extraHeaders);
  const entries = useListDialerStore((s) => s.entries);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await exportListDialerResults({
        fileName: fileName ?? 'call-list.xlsx',
        phoneColumnHeader,
        extraHeaders,
        rows: entries.map((e) => ({
          ...e,
          status: e.status === 'pending' ? 'pending' : e.status,
          outcome: e.outcome,
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Strip whatever extension came in and stamp the date so a sales
      // rep doing multiple lists doesn't end up overwriting their last
      // download.
      const base = (fileName ?? 'call-list').replace(/\.(xlsx|xls|csv)$/i, '');
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `${base}-results-${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate export.');
    } finally {
      setDownloading(false);
    }
  }, [fileName, phoneColumnHeader, extraHeaders, entries]);

  return (
    <Button
      variant={variant}
      onClick={handleDownload}
      disabled={downloading}
      className={variant ? undefined : 'flex-1 min-w-[180px]'}
    >
      <FiDownload className="w-4 h-4 mr-2" />
      {downloading ? 'Preparing…' : 'Download results'}
    </Button>
  );
}
