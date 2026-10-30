'use client';

/**
 * Recording Export hook (Phase 4).
 *
 * Drives the async server-side export from the recordings page: start a job,
 * follow live progress over WebSocket (no polling), reconcile on reconnect/
 * reload, and hand off the one-click resumable download. Scoped to this page —
 * NOT part of the global realtime-sync — so it only runs where it's used.
 *
 * @module app/admin/recordings/useRecordingExport
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import {
  recordingsService,
  type BulkOperationFilter,
  type RecordingExportJob,
  type RecordingExportStatus,
} from '@/lib/api';
import { toast } from '@/lib/stores/toast';

const TERMINAL: ReadonlySet<RecordingExportStatus> = new Set([
  'ready',
  'failed',
  'cancelled',
  'expired',
]);

/** The WS payload shape emitted by the backend progress bridge. */
interface ExportProgressEvent {
  jobId: string;
  status: string;
  processed?: number;
  total?: number;
  pct?: number;
  artifactBytes?: number;
  errorCode?: string;
}

export interface ExportProgress {
  pct: number;
  processed: number;
  total: number;
}

export interface UseRecordingExportReturn {
  activeJob: RecordingExportJob | null;
  progress: ExportProgress | null;
  isStarting: boolean;
  recentExports: RecordingExportJob[];
  startExport: (filter: BulkOperationFilter) => Promise<void>;
  cancelExport: () => Promise<void>;
  downloadReady: () => Promise<void>;
  dismiss: () => void;
}

const IN_FLIGHT = new Set(['pending', 'building']);

export function useRecordingExport(enabled = true): UseRecordingExportReturn {
  const { socket, isConnected } = useSocket();
  const [activeJob, setActiveJob] = useState<RecordingExportJob | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [recentExports, setRecentExports] = useState<RecordingExportJob[]>([]);

  // Mirror the active id into a ref so the WS handlers (registered once) always
  // see the current job without re-subscribing on every job change.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeJob?.id ?? null;
  }, [activeJob?.id]);

  // Mirror the active job's part count so downloadReady (registered once) can
  // fetch every ZIP part without re-binding on each job change.
  const activePartCountRef = useRef(1);
  useEffect(() => {
    activePartCountRef.current = activeJob?.partCount ?? 1;
  }, [activeJob?.partCount]);

  const refreshList = useCallback(async () => {
    try {
      const list = await recordingsService.listExports();
      setRecentExports(list);
      // Reconnect-after-reload: adopt any in-flight job if we don't have one.
      if (!activeIdRef.current) {
        const inFlight = list.find((j) => IN_FLIGHT.has(j.status));
        if (inFlight) {
          setActiveJob(inFlight);
          setProgress({
            pct: inFlight.manifestCount ? Math.floor((inFlight.processedCount / inFlight.manifestCount) * 100) : 0,
            processed: inFlight.processedCount,
            total: inFlight.manifestCount,
          });
        }
      }
    } catch {
      // Non-fatal — the panel simply won't show history.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return; // true no-op when the feature flag is off
    void refreshList();
  }, [enabled, refreshList]);

  // Re-read the active job and apply it WITHOUT regressing a locally-terminal
  // state (guards against a lagging server response flipping ready→building).
  const reconcileActive = useCallback(() => {
    const id = activeIdRef.current;
    if (!id) return;
    recordingsService
      .getExport(id)
      .then((server) => {
        setActiveJob((local) => {
          if (!local || local.id !== server.id) return server;
          if (TERMINAL.has(local.status) && !TERMINAL.has(server.status)) return local;
          return server;
        });
      })
      .catch(() => {
        // job gone/expired — leave the last known state
      });
  }, []);

  const startExport = useCallback(
    async (filter: BulkOperationFilter) => {
      setIsStarting(true);
      try {
        const res = await recordingsService.createExport(filter);
        if (res.deduped) toast.info('An export is already in progress');
        const job = await recordingsService.getExport(res.jobId).catch(() => null);
        if (job) {
          setActiveJob(job);
          // Seed progress from the job itself — a deduped in-flight job may
          // already be partway through, so don't flash back to 0%.
          setProgress({
            pct: job.manifestCount
              ? Math.floor((job.processedCount / job.manifestCount) * 100)
              : 0,
            processed: job.processedCount,
            total: job.manifestCount,
          });
        }
        void refreshList();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start export');
      } finally {
        setIsStarting(false);
      }
    },
    [refreshList]
  );

  const cancelExport = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    try {
      await recordingsService.cancelExport(id);
      setActiveJob((j) => (j ? { ...j, status: 'cancelled' } : j));
      void refreshList();
    } catch {
      toast.error('Failed to cancel export');
    }
  }, [refreshList]);

  const downloadReady = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    // Authoritative part count from the server — the `ready` WS event doesn't
    // carry it, so the local job may still read 1. A multi-part export must fetch
    // EVERY part, not just part 1.
    let parts = Math.max(1, activePartCountRef.current);
    const fresh = await recordingsService.getExport(id).catch(() => null);
    if (fresh?.partCount) parts = Math.max(1, fresh.partCount);

    const failed: number[] = [];
    for (let part = 1; part <= parts; part += 1) {
      try {
        const url = await recordingsService.getExportDownloadUrl(id, part);
        // Trigger via a transient <a> (not window.location) so it downloads
        // without navigating the page — a rare 404 fails silently instead of
        // replacing the tab. IDM/download-manager friendly + resumable (Range).
        const a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        // Continue with the remaining parts — one part's token-mint failure must
        // NOT abort the whole set (otherwise the user loses every later part too).
        failed.push(part);
      }
      // Stagger so the browser starts each part as its OWN download instead of
      // coalescing/blocking rapid successive navigations; each part resumes
      // independently (HTTP Range) if a lossy link drops it.
      if (part < parts) await new Promise((r) => setTimeout(r, 900));
    }

    if (failed.length > 0) {
      toast.error(
        `${failed.length} of ${parts} part(s) didn't start (part ${failed.join(', ')}). Click Download again to retry.`
      );
    } else if (parts > 1) {
      toast.info(`Downloading ${parts} parts — allow multiple downloads if prompted`);
    }
  }, []);

  const dismiss = useCallback(() => {
    setActiveJob(null);
    setProgress(null);
  }, []);

  // Live progress over WebSocket (registered once; handlers read the ref).
  useEffect(() => {
    if (!enabled || !socket || !isConnected) return;

    const onProgress = (e: ExportProgressEvent) => {
      if (e.jobId !== activeIdRef.current) return;
      // Don't let a late/out-of-order progress event regress a terminal state.
      // (The progress bar itself is only shown while the job isActive, so a
      // stale setProgress on a terminal job is invisible — no extra guard needed.)
      setActiveJob((j) => {
        if (!j || j.id !== e.jobId) return j;
        if (j.status === 'ready' || j.status === 'failed' || j.status === 'cancelled') return j;
        return { ...j, status: 'building', processedCount: e.processed ?? j.processedCount };
      });
      setProgress({ pct: e.pct ?? 0, processed: e.processed ?? 0, total: e.total ?? 0 });
    };
    const onReady = (e: ExportProgressEvent) => {
      if (e.jobId !== activeIdRef.current) return;
      setProgress({ pct: 100, processed: e.processed ?? 0, total: e.total ?? 0 });
      // The `ready` WS event carries NO partCount, and a multi-part export must
      // download EVERY part — refetch the finished job so partCount (hence the
      // panel label and the download loop) reflects the real number of ZIP parts.
      recordingsService
        .getExport(e.jobId)
        .then((server) => setActiveJob((j) => (j && j.id === e.jobId ? server : j)))
        .catch(() =>
          setActiveJob((j) =>
            j && j.id === e.jobId
              ? { ...j, status: 'ready', artifactBytes: e.artifactBytes ?? j.artifactBytes }
              : j
          )
        );
      toast.success('Your export is ready to download');
      void refreshList();
    };
    const onFailed = (e: ExportProgressEvent) => {
      if (e.jobId !== activeIdRef.current) return;
      setActiveJob((j) =>
        j && j.id === e.jobId ? { ...j, status: 'failed', errorCode: e.errorCode ?? 'error' } : j
      );
      toast.error('Export failed — please try again');
      void refreshList();
    };

    socket.on(REALTIME_EVENTS.RECORDING_EXPORT_PROGRESS, onProgress);
    socket.on(REALTIME_EVENTS.RECORDING_EXPORT_READY, onReady);
    socket.on(REALTIME_EVENTS.RECORDING_EXPORT_FAILED, onFailed);
    return () => {
      socket.off(REALTIME_EVENTS.RECORDING_EXPORT_PROGRESS, onProgress);
      socket.off(REALTIME_EVENTS.RECORDING_EXPORT_READY, onReady);
      socket.off(REALTIME_EVENTS.RECORDING_EXPORT_FAILED, onFailed);
    };
  }, [enabled, socket, isConnected, refreshList]);

  // Offline-first reconcile: on socket (re)connect, re-read the active job so a
  // missed event during a blip can't strand the UI.
  useEffect(() => {
    if (!enabled || !isConnected) return;
    reconcileActive();
  }, [enabled, isConnected, reconcileActive]);

  // Backstop for a terminal event dropped WITHOUT a disconnect (rare): reconcile
  // whenever the tab regains focus / becomes visible. Cheap and self-correcting.
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (!document.hidden) reconcileActive();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, reconcileActive]);

  return {
    activeJob,
    progress,
    isStarting,
    recentExports,
    startExport,
    cancelExport,
    downloadReady,
    dismiss,
  };
}
