'use client';

/**
 * WhatsApp Call History Page
 *
 * Displays WhatsApp call logs with real-time updates via WebSocket.
 * Mirrors the SIP History page pattern — no polling.
 *
 * @module app/phone/whatsapp-calls/page
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  FiPhone,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiPhoneMissed,
  FiPhoneOff,
  FiRefreshCw,
  FiSearch,
  FiX,
  FiLoader,
  FiLock,
  FiFilter,
  FiChevronDown,
} from 'react-icons/fi';
import { useWaStatus, usePagination } from '@/lib/hooks';
import { FaWhatsapp } from 'react-icons/fa';
import { StyledSelect, Pagination } from '@/components/ui';
import { PageTransition } from '@/components/phone';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { waCallService } from '@/lib/api/services/waCall.service';
import { useContactDisplayName } from '@/lib/hooks/useContactName';
import { useAuthStore } from '@/lib/stores';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { WaCallRecord } from '@/lib/whatsapp-call/types';

// ============================================================
// Query keys
// ============================================================
// NOTE: file-local (NOT exported). Next.js 16 disallows arbitrary named
// exports from a page.tsx ("not a valid Page export field") and the webpack
// build errors on it; only this file uses these keys, so keep it local.
const waCallsKeys = {
  all: ['wa-calls'] as const,
  history: (page: number, limit: number, search: string, direction: string, status: string) =>
    ['wa-calls', 'history', page, limit, search, direction, status] as const,
};

// ============================================================
// Helpers
// ============================================================

function formatDuration(secs: number): string {
  if (!secs || secs <= 0) return '-';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getCallIcon(direction: string, status: string) {
  if (status === 'missed')
    return <FiPhoneMissed className="w-3.5 h-3.5 shrink-0 text-[var(--danger)]" />;
  if (status === 'failed' || status === 'rejected')
    return <FiPhoneOff className="w-3.5 h-3.5 shrink-0 text-red-400" />;
  if (direction === 'outbound')
    return <FiPhoneOutgoing className="w-3.5 h-3.5 shrink-0 text-[var(--foreground)]" />;
  return <FiPhoneIncoming className="w-3.5 h-3.5 shrink-0 text-green-600" />;
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    ringing: { label: 'Ringing', color: 'bg-yellow-500/10 text-yellow-600' },
    answered: { label: 'Answered', color: 'bg-green-500/10 text-green-600' },
    ended: { label: 'Completed', color: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
    missed: { label: 'Missed', color: 'bg-red-500/10 text-red-600' },
    rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-500' },
    failed: { label: 'Failed', color: 'bg-red-500/10 text-red-400' },
  };
  const info = map[status] || {
    label: status,
    color: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${info.color}`}>{info.label}</span>
  );
}

// ============================================================
// Call Row
// ============================================================

function CallRow({
  call,
  onRecordingDeleted,
}: {
  call: WaCallRecord;
  onRecordingDeleted: () => void;
}) {
  const displayName = useContactDisplayName(call.customerNumber, call.customerName ?? undefined);
  // Truthy check — TINYINT(1) comes back as number 1, not boolean true.
  const isMasked = useAuthStore((state) => !!state.user?.waPhoneMaskEnabled);

  return (
    <div className="px-5 py-2.5 hover:bg-[var(--muted)]/40 transition-colors border-b border-[var(--border)]/60 last:border-0 space-y-2">
      {/* Top row: call info */}
      <div className="flex items-center gap-3">
        {/* Avatar + WhatsApp channel badge (SSOT avatar treatment) */}
        <span className="relative shrink-0">
          <GenericAvatar name={displayName} number={call.customerNumber} size={40} />
          <span className="absolute -bottom-0.5 -right-0.5 w-[15px] h-[15px] rounded-full bg-white dark:bg-[var(--card)] grid place-items-center">
            <FaWhatsapp className="w-[11px] h-[11px] text-green-500" />
          </span>
        </span>

        {/* Contact info */}
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-bold text-[var(--foreground)] truncate">
            {displayName}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-[var(--muted-foreground)] mt-0.5">
            {/* Direction glyph (missed=red, in=green, out=primary) */}
            {getCallIcon(call.direction, call.status)}
            {/* Phone subtitle hidden in privacy mode — display name above
                already carries the masked stub (Customer ••••1997). */}
            {!isMasked && <span>{formatPhoneNumber(call.customerNumber)}</span>}
            {/* On mobile, duration + time fold into this line; the dedicated
                right-side columns are hidden < sm so the top row can't overflow. */}
            {call.durationSecs > 0 && (
              <span className="sm:hidden font-mono">· {formatDuration(call.durationSecs)}</span>
            )}
            <span className="sm:hidden">· {formatRelativeTime(call.startedAt)}</span>
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0">{getStatusBadge(call.status)}</div>

        {/* Duration — desktop column (folded into the meta line on mobile) */}
        <div className="hidden sm:block shrink-0 w-14 text-right">
          <span className="text-[13px] font-mono text-[var(--muted-foreground)]">
            {formatDuration(call.durationSecs)}
          </span>
        </div>

        {/* Time — desktop column (folded into the meta line on mobile) */}
        <div className="hidden sm:block shrink-0 w-20 text-right">
          <span className="text-[12px] text-[var(--muted-foreground)]">
            {formatRelativeTime(call.startedAt)}
          </span>
        </div>
      </div>

      {/* Bottom row: recording player (aligned under the contact info, past the avatar) */}
      {call.recordingUrl && (
        <div className="pl-[52px]">
          <RecordingPlayer callId={call.callId} onDeleted={onRecordingDeleted} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Recording Player — fetches signed URL on demand
// ============================================================

function RecordingPlayer({ callId, onDeleted }: { callId: string; onDeleted?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // Distinct from isPlaying: the audio element has been told to play
  // (or is mid-seek) but no audio is actually coming out yet because
  // the bytes are still streaming in. For short recordings this state
  // flicks through in milliseconds and the user never sees it; for long
  // recordings on a slow connection it can sit here for several seconds.
  // Without a visible signal the user clicks Play, sees nothing happen,
  // and assumes the player is broken — driving them to retry, which
  // resets the buffer and makes it worse.
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const loadUrl = useCallback(async () => {
    if (url) return;
    setLoading(true);
    setError(false);
    try {
      const signedUrl = await waCallService.getRecordingUrl(callId);
      setUrl(signedUrl);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [callId, url]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Optimistically flip the buffering flag on click — the browser
      // may not emit `waiting` if it starts the network fetch synchronously,
      // so without this the user could click Play and see nothing change
      // until audio actually starts. We clear it once `playing` fires (or
      // the play() call rejects).
      setBuffering(true);
      audioRef.current.play().catch(() => {
        setBuffering(false);
        setError(true);
      });
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // Download through backend proxy (authenticated, no CORS issues)
      const blob = await waCallService.downloadRecording(callId);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `wa-recording-${callId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}.webm`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch (err) {
      console.error('[RecordingPlayer] Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }, [callId, downloading]);

  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      await waCallService.deleteRecording(callId);
      onDeleted?.();
    } catch (err) {
      console.error('[RecordingPlayer] Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  }, [callId, deleting, onDeleted]);

  const fmtTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // WebM from MediaRecorder often has Infinity duration until fully loaded.
  // Fix: seek to a huge value to force the browser to calculate real duration.
  const fixDuration = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || (isFinite(audio.duration) && audio.duration > 0)) return;
    audio.currentTime = 1e10; // Seek to end
    const onSeeked = () => {
      if (audio && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      audio.currentTime = 0; // Seek back to start
      audio.removeEventListener('seeked', onSeeked);
    };
    audio.addEventListener('seeked', onSeeked);
  }, []);

  // Player UI — loaded
  if (url) {
    return (
      <div className="flex items-center gap-2 min-w-[220px]">
        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current) {
              const d = audioRef.current.duration;
              if (isFinite(d) && d > 0) {
                setDuration(d);
              } else {
                fixDuration();
              }
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            setBuffering(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setBuffering(false);
            setCurrentTime(0);
          }}
          // `waiting` fires when the audio needs more data and stalls,
          // `seeking` fires during a user-initiated seek (also stalls).
          // Both should show the spinner so the user knows audio is
          // being fetched, not just stuck.
          onWaiting={() => setBuffering(true)}
          onSeeking={() => setBuffering(true)}
          // `playing` is the authoritative "audio is actually coming out
          // of the speakers" event — clears the spinner regardless of
          // which buffering path put it on the screen.
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onSeeked={() => setBuffering(false)}
          onError={() => {
            setBuffering(false);
            setError(true);
          }}
        />

        {/* Play/Pause — shows a spinner overlay while audio is buffering
            (initial load on long recordings, mid-stream stalls, or after
            a seek). The button stays clickable so the user can cancel by
            pausing — pausing also clears the buffering state. */}
        <button
          onClick={togglePlay}
          className="w-7 h-7 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center flex-shrink-0 transition-colors"
          title={buffering ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
        >
          {buffering ? (
            <FiLoader className="w-3.5 h-3.5 text-white animate-spin" />
          ) : isPlaying ? (
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time + Seek */}
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--border)] accent-green-500"
            style={{ accentColor: '#22c55e' }}
          />
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
              {fmtTime(currentTime)}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
              {duration > 0 ? fmtTime(duration) : '--:--'}
            </span>
          </div>
        </div>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-7 h-7 rounded-lg hover:bg-[var(--muted)] flex items-center justify-center flex-shrink-0 transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
          title="Download recording"
        >
          {downloading ? (
            <FiLoader className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>

        {/* Delete */}
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-0.5 text-[10px] font-medium rounded bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center flex-shrink-0 transition-colors text-[var(--muted-foreground)] hover:text-red-500 disabled:opacity-50"
            title="Delete recording"
          >
            {deleting ? (
              <FiLoader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  }

  if (error) {
    return <span className="text-xs text-red-400">Failed to load</span>;
  }

  // Load button
  return (
    <button
      onClick={loadUrl}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <FiLoader className="w-3 h-3 animate-spin" />
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {loading ? 'Loading...' : 'Play'}
    </button>
  );
}

// ============================================================
// Stat item (compact metrics line)
// ============================================================

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {icon}
      <span className="text-[15px] font-black text-[var(--foreground)] tabular-nums leading-none">
        {value.toLocaleString()}
      </span>
      <span className="text-[12px] text-[var(--muted-foreground)] leading-none">{label}</span>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function WhatsAppCallHistoryPage() {
  const { data: waStatus, isLoading: waStatusLoading } = useWaStatus();

  // Block access if WA is not enabled for this user
  if (waStatusLoading) {
    return (
      <div className="h-[calc(100dvh-8rem)] flex items-center justify-center">
        <FiLoader className="w-6 h-6 animate-spin text-green-500" />
      </div>
    );
  }

  if (!waStatus?.waEnabled) {
    return (
      <div className="h-[calc(100dvh-8rem)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center">
            <FiLock className="w-8 h-8 text-[var(--muted-foreground)]" />
          </div>
          <h2 className="text-xl font-bold mb-2">WhatsApp Calls</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            WhatsApp is not enabled on your account. Contact your administrator to enable this
            feature.
          </p>
        </div>
      </div>
    );
  }

  return <WhatsAppCallHistoryContent />;
}

function WhatsAppCallHistoryContent() {
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Mark all missed calls as read when visiting this page
  useEffect(() => {
    waCallService
      .markMissedAsRead()
      .then(() => {
        // Refresh the bell icon's missed calls query
        queryClient.invalidateQueries({ queryKey: ['wa-calls', 'unread-missed'] });
      })
      .catch(() => {
        // Ignore — mark-read is best-effort
      });
  }, [queryClient]);

  // Debounce search
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(value);
      pagination.firstPage();
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.firstPage is stable
  }, []);

  // Fetch call history
  const { data, isLoading, isFetching } = useQuery({
    queryKey: waCallsKeys.history(
      pagination.page,
      pagination.pageSize,
      debouncedSearch,
      directionFilter,
      statusFilter
    ),
    queryFn: async () => {
      const result = await waCallService.getHistory(
        pagination.pageSize,
        (pagination.page - 1) * pagination.pageSize
      );
      return result;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const calls = data?.calls ?? [];

  // Keep the shared pagination hook in sync with the server total.
  useEffect(() => {
    if (data?.total !== undefined) pagination.setTotalItems(data.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable
  }, [data?.total]);

  // Fetch stats separately (counts ALL calls, not just current page)
  const { data: stats } = useQuery({
    queryKey: [...waCallsKeys.all, 'stats'],
    queryFn: () => waCallService.getStats(),
    staleTime: 30_000,
  });

  // Filter client-side (backend doesn't support filters yet — simple approach)
  const filteredCalls = useMemo(() => {
    let result = calls;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) => c.customerNumber.includes(q) || (c.customerName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (directionFilter !== 'all') {
      result = result.filter((c) => c.direction === directionFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }
    return result;
  }, [calls, debouncedSearch, directionFilter, statusFilter]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: waCallsKeys.all });
  }, [queryClient]);

  const hasFilters = debouncedSearch || directionFilter !== 'all' || statusFilter !== 'all';
  const activeFilterCount = (directionFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-[var(--card)]">
        {/* Unified header region: title + metrics + search/filters */}
        <div className="border-b border-[var(--border)] shrink-0">
          {/* title + refresh */}
          <div className="flex items-center justify-between gap-3 px-5 pt-3.5 pb-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-green-500/10 text-green-500 shrink-0">
                <FaWhatsapp className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-black text-[var(--foreground)] truncate">
                  WhatsApp Calls
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  View and manage your WhatsApp call history
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              title="Refresh"
              aria-label="Refresh"
              className="grid place-items-center w-10 h-10 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 shrink-0"
            >
              <FiRefreshCw className={`w-[18px] h-[18px] ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* compact metrics */}
          <div className="flex items-center gap-5 md:gap-7 px-5 pb-2.5 overflow-x-auto">
            <StatItem
              icon={<FiPhone className="w-4 h-4 text-[var(--foreground)]" />}
              value={stats?.total ?? 0}
              label="Total"
            />
            <span className="w-px h-4 bg-[var(--border)] shrink-0" />
            <StatItem
              icon={<FiPhoneIncoming className="w-4 h-4 text-green-600" />}
              value={stats?.inbound ?? 0}
              label="Inbound"
            />
            <StatItem
              icon={<FiPhoneOutgoing className="w-4 h-4 text-blue-600" />}
              value={stats?.outbound ?? 0}
              label="Outbound"
            />
            <StatItem
              icon={<FiPhoneMissed className="w-4 h-4 text-red-500" />}
              value={stats?.missed ?? 0}
              label="Missed"
            />
          </div>

          {/* search + filter toggle */}
          <div className="border-t border-[var(--border)]">
            <div className="flex items-center gap-2 px-5 py-2.5">
              {/* Search */}
              <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] focus-within:border-green-500 transition-colors text-[var(--muted-foreground)]">
                <FiSearch className="w-4 h-4 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by number or name…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]"
                />
                {search && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearch('');
                      setDebouncedSearch('');
                    }}
                    title="Clear search"
                    aria-label="Clear search"
                    className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter toggle */}
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-label="Toggle filters"
                className={`flex items-center gap-1.5 h-10 px-3 rounded-lg border text-[13px] font-bold shrink-0 transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20'
                    : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <FiFilter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-green-600 text-white text-[11px] font-black leading-none">
                    {activeFilterCount}
                  </span>
                )}
                <FiChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* Collapsible filters */}
            <div
              aria-hidden={!showFilters}
              className={`grid transition-all duration-200 ease-out ${
                showFilters
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-wrap items-end gap-4 px-5 pb-3 pt-3 border-t border-[var(--border)]">
                  <div>
                    <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                      Direction
                    </label>
                    <StyledSelect
                      value={directionFilter}
                      onChange={(v) => {
                        setDirectionFilter(v);
                        pagination.firstPage();
                      }}
                    >
                      <option value="all">All Directions</option>
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </StyledSelect>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--muted-foreground)] mb-1.5 block">
                      Status
                    </label>
                    <StyledSelect
                      value={statusFilter}
                      onChange={(v) => {
                        setStatusFilter(v);
                        pagination.firstPage();
                      }}
                    >
                      <option value="all">All Status</option>
                      <option value="ended">Completed</option>
                      <option value="missed">Missed</option>
                      <option value="rejected">Rejected</option>
                      <option value="failed">Failed</option>
                    </StyledSelect>
                  </div>
                  {hasFilters && (
                    <button
                      onClick={() => {
                        setSearch('');
                        setDebouncedSearch('');
                        setDirectionFilter('all');
                        setStatusFilter('all');
                        pagination.firstPage();
                      }}
                      className="h-10 px-3 text-sm font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
                    >
                      <FiX className="w-4 h-4" /> Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable call list */}
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <FiLoader className="w-6 h-6 animate-spin text-green-500" />
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-16">
              <FaWhatsapp className="w-12 h-12 mx-auto mb-3 text-[var(--muted-foreground)] opacity-30" />
              <p className="text-sm text-[var(--muted-foreground)]">
                {hasFilters ? 'No calls match your filters' : 'No WhatsApp calls yet'}
              </p>
            </div>
          ) : (
            filteredCalls.map((call) => (
              <CallRow key={call.id} call={call} onRecordingDeleted={handleRefresh} />
            ))
          )}

          {/* Pagination — inside the scroll, after the list (identical to History) */}
          {!isLoading && pagination.totalPages > 1 && (
            <div className="px-5 py-3 border-t border-[var(--border)]">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                hasNextPage={pagination.hasNextPage}
                hasPreviousPage={pagination.hasPreviousPage}
                pageRange={pagination.pageRange}
                onPageChange={pagination.goToPage}
                showTotalItems
              />
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
