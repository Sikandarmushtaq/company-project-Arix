'use client';

import React, { useState } from 'react';
import { FiPlay, FiPause, FiDownload, FiLoader } from 'react-icons/fi';
import { useAudioStore } from '@/lib/stores/audioPlayer';

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const RATES = [1, 1.5, 2] as const;

export interface AudioPlayerProps {
  /** Stable unique id for this clip (voicemail id, recording id, …). SSOT key. */
  id: string;
  /** Audio source URL. */
  url: string;
  /** Known total length (seconds) — shows the full time before playback starts. */
  durationSeconds?: number;
  /** Suggested download filename. */
  filename?: string;
  className?: string;
  /** Hide the speed control (compact contexts). */
  hideRate?: boolean;
  /** Hide the download button. */
  hideDownload?: boolean;
  /** External loading (e.g. the audio blob is still being fetched) — shows the
   *  spinner in the play/pause slot and disables controls until ready. */
  loading?: boolean;
  /** Lazy load: when set and no `url` is present yet, clicking play calls this
   *  instead of toggling — the parent fetches the source, sets `url`, and starts
   *  playback. Lets the bar (seek + duration) render before the audio loads. */
  onPlayRequest?: () => void;
}

/**
 * SSOT audio player. Every instance shares one HTMLAudioElement via the audio
 * store, so only one clip can ever play and stress-clicking cannot glitch.
 * Drop this in anywhere a clip needs to play (voicemail, recordings, …).
 */
export function AudioPlayer({
  id,
  url,
  durationSeconds,
  filename,
  className,
  hideRate,
  hideDownload,
  loading,
  onPlayRequest,
}: AudioPlayerProps) {
  // Selector-guarded: inactive players return a stable value (false / 0) so
  // zustand's Object.is bail-out skips their re-render on every timeupdate tick.
  const isActive = useAudioStore((s) => s.activeId === id);
  const isPlaying = useAudioStore((s) => s.activeId === id && s.playing);
  const isWaiting = useAudioStore((s) => s.activeId === id && s.waiting);
  const t = useAudioStore((s) => (s.activeId === id ? s.currentTime : 0));
  const activeDuration = useAudioStore((s) => (s.activeId === id ? s.duration : 0));
  const rate = useAudioStore((s) => s.rate);
  const toggle = useAudioStore((s) => s.toggle);
  const seek = useAudioStore((s) => s.seek);
  const setRate = useAudioStore((s) => s.setRate);

  const [downloading, setDownloading] = useState(false);

  const d = activeDuration > 0 ? activeDuration : durationSeconds || 0;
  const pct = d > 0 ? Math.min(100, (t / d) * 100) : 0;
  // Spinner while the blob is being fetched (loading prop) or the media is
  // buffering after a play intent (isWaiting). Controls are inert until ready.
  const busy = !!loading || isWaiting;
  const disabled = !!loading || !url;
  // The play button stays live when the parent can lazily supply a URL, even
  // before one exists — clicking it asks the parent to load + play.
  const playDisabled = !!loading || (!url && !onPlayRequest);
  const handlePlay = () => {
    if (busy) return;
    if (!url) {
      onPlayRequest?.();
      return;
    }
    toggle(id, url);
  };

  const cycleRate = () => setRate(RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length]);

  const onRange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (isActive) seek(Number(e.target.value));
    else toggle(id, url); // not loaded yet — start it; user can scrub once active
  };

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename || 'audio';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      window.open(url, '_blank'); // cross-origin without CORS → let the browser handle it
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <button
        type="button"
        onClick={handlePlay}
        disabled={playDisabled}
        aria-label={busy ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
        aria-busy={busy}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary-600)] text-white transition-colors hover:bg-[var(--primary-700)] active:scale-95 disabled:opacity-70 disabled:active:scale-100"
      >
        {busy ? (
          <FiLoader className="h-5 w-5 animate-spin" />
        ) : isPlaying ? (
          <FiPause className="h-5 w-5" />
        ) : (
          <FiPlay className="h-5 w-5 translate-x-[1px]" />
        )}
      </button>

      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--muted-foreground)]">
        {fmt(t)}
      </span>

      <input
        type="range"
        min={0}
        max={d || 0}
        step="any"
        value={Math.min(t, d || 0)}
        onChange={onRange}
        disabled={disabled}
        aria-label="Seek"
        className="nx-audio-range flex-1 disabled:cursor-default disabled:opacity-60"
        style={{
          background: `linear-gradient(to right, var(--primary-600) ${pct}%, var(--border) ${pct}%)`,
        }}
      />

      <span className="w-10 shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">{fmt(d)}</span>

      {!hideRate && (
        <button
          type="button"
          onClick={cycleRate}
          disabled={disabled}
          aria-label={`Playback speed ${rate}x`}
          className="w-9 shrink-0 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
        >
          {rate}×
        </button>
      )}

      {!hideDownload && (
        <button
          type="button"
          onClick={download}
          disabled={downloading || disabled}
          aria-label="Download"
          title="Download"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          <FiDownload className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default AudioPlayer;
