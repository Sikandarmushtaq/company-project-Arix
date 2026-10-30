'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiPause, FiUser } from 'react-icons/fi';
import { formatDuration } from '@/lib/utils/formatting';
import { formatPhoneUS } from '@/lib/utils/phone';
import { useContactDisplayName } from '@/lib/hooks';
import { CallQualityIndicator } from './CallQualityIndicator';
import { callEngine } from '@/lib/call/call-engine';
import type { CallLine, CallStats } from '@/lib/sip/types';

/**
 * Get human-readable call state text
 */
export function getCallStateText(state: CallLine['state']): string {
  switch (state) {
    case 'dialing':
      return 'Dialing';
    case 'ringing':
      return 'Ringing';
    case 'connecting':
      return 'Connecting';
    case 'established':
      return 'Connected';
    case 'holding':
    case 'held':
      return 'On Hold';
    case 'transferring':
      return 'Transferring';
    case 'ended':
      return 'Call Ended';
    case 'error':
      return 'Error';
    default:
      return '';
  }
}

interface CallDisplayProps {
  activeLine: CallLine;
  callDuration: number;
  callStats: CallStats | undefined;
  dtmfDigits?: string;
  /** Compact layout (smaller avatar, tighter spacing) — used when the multi-call
   *  strip is on top, so the strip + controls + End Call fit without a scroll. */
  compact?: boolean;
  /** The agent's own outbound number — shown as "My caller ID" under the party,
   *  matching RingCentral (moved off the top bar). */
  userPhoneNumber?: string;
}

/** Get initials from a display name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Derive a consistent gradient from a string */
function getGradient(str: string): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
    'from-fuchsia-500 to-pink-600',
    'from-teal-500 to-emerald-600',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

const BAR_COUNT = 12;

/** Live audio waveform — uses Web Audio AnalyserNode on the remote MediaStream.
 *  Uses createMediaStreamSource (not createMediaElementSource) so it never
 *  interferes with audio playback. Retries every 500ms until the stream is available. */
function LiveAudioWaveform({ lineId, isMuted }: { lineId: number; isMuted: boolean }) {
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(2));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedStreamRef = useRef<MediaStream | null>(null);
  // Latest-callback refs so the self-scheduling loops below (rAF / setTimeout)
  // never reference a callback inside its own initializer — the two are kept in
  // sync at the top of the mount effect.
  const tickRef = useRef<() => void>(() => {});
  const connectRef = useRef<() => void>(() => {});

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
      const newLevels: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = data[i * step] ?? 0;
        newLevels.push(2 + (val / 255) * 18);
      }
      setLevels(newLevels);
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, []);

  const connectToStream = useCallback(() => {
    // Engine-agnostic: pull the remote stream from whichever engine (SIP / LiveKit)
    // is active, so the waveform works regardless of call engine.
    const stream = callEngine.getRemoteAudioStream(lineId);

    if (!stream || stream.getAudioTracks().length === 0) {
      // Stream not ready yet — retry
      retryRef.current = setTimeout(() => connectRef.current(), 500);
      return;
    }

    // Already connected to this stream
    if (connectedStreamRef.current === stream && analyserRef.current) return;

    try {
      // Disconnect previous
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
      } catch {
        /* ignore */
      }

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      // createMediaStreamSource — taps into the stream without rerouting audio
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // DO NOT connect analyser to destination — audio already plays via the <audio> element
      sourceRef.current = source;
      connectedStreamRef.current = stream;
    } catch {
      // Retry on failure
      retryRef.current = setTimeout(() => connectRef.current(), 1000);
    }
  }, [lineId]);

  useEffect(() => {
    // Point the loop refs at the current callbacks before anything schedules.
    tickRef.current = tick;
    connectRef.current = connectToStream;
    connectToStream();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      connectedStreamRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [connectToStream, tick]);

  return (
    <div className="flex items-end justify-center gap-[2px] h-5">
      {levels.map((h, i) => (
        <motion.div
          key={i}
          className={`w-[3px] rounded-full ${
            isMuted ? 'bg-gray-400/40 dark:bg-gray-500/40' : 'bg-green-500/60 dark:bg-green-400/60'
          }`}
          animate={{ height: isMuted ? 2 : h }}
          transition={{ duration: 0.08, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

/** Connecting dots — three bouncing dots */
function ConnectingDots() {
  return (
    <span className="inline-flex gap-1 ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Premium Call Display Component
 * Gradient avatar with initials, live audio waveform, smooth state transitions
 */
export function CallDisplay({
  activeLine,
  callDuration,
  callStats,
  dtmfDigits,
  compact = false,
  userPhoneNumber,
}: CallDisplayProps) {
  const displayName = useContactDisplayName(activeLine.remoteNumber, activeLine.remoteName);
  // A "name" that's only phone-number characters (e.g. "(256) 631-8784") isn't a
  // real contact — show a person silhouette instead of garbage initials like "(2",
  // and don't repeat the number underneath.
  const isNumberName = !displayName || /^[\d\s()+.-]+$/.test(displayName);
  const hasContactName = !isNumberName;

  const isConnecting = ['dialing', 'ringing', 'connecting'].includes(activeLine.state);
  const isOnHold = activeLine.state === 'holding' || activeLine.state === 'held';
  const isEstablished = activeLine.state === 'established';

  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const gradient = useMemo(() => getGradient(displayName), [displayName]);

  const ringColor = isEstablished
    ? 'ring-green-500/40'
    : isOnHold
      ? 'ring-amber-500/40'
      : 'ring-blue-500/40';

  return (
    <div className={`text-center ${compact ? 'py-0.5' : 'py-2'}`}>
      {/* Avatar */}
      <div className={`relative mx-auto ${compact ? 'w-12 h-12 mb-1' : 'w-16 h-16 mb-2'}`}>
        {/* Pulse rings for connecting/ringing */}
        {isConnecting && (
          <>
            {[0, 0.6, 1.2].map((delay) => (
              <motion.div
                key={delay}
                className="absolute inset-0 rounded-full border-2 border-blue-400/30 dark:border-blue-300/20"
                animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay }}
              />
            ))}
          </>
        )}

        {/* Green glow for established */}
        {isEstablished && (
          <motion.div
            className="absolute inset-[-4px] rounded-full bg-green-400/15 dark:bg-green-400/10"
            animate={{ scale: [1, 1.06, 1], opacity: [0.6, 0.3, 0.6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Hold breathing glow */}
        {isOnHold && (
          <motion.div
            className="absolute inset-[-4px] rounded-full bg-amber-400/15"
            animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Avatar circle */}
        <motion.div
          className={`${compact ? 'w-12 h-12 ring-2' : 'w-16 h-16 ring-3'} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center ${ringColor} shadow-xl relative overflow-hidden`}
          animate={isOnHold ? { scale: [1, 0.96, 1] } : {}}
          transition={{ duration: 2.5, repeat: isOnHold ? Infinity : 0, ease: 'easeInOut' }}
        >
          <AnimatePresence mode="wait">
            {isConnecting ? (
              <motion.div
                key="phone-icon"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 30 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <motion.div
                  animate={{ rotate: [0, 12, -12, 8, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
                >
                  <FiPhone className="w-6 h-6 text-white/90" />
                </motion.div>
              </motion.div>
            ) : isOnHold ? (
              <motion.div
                key="hold-icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <FiPause className="w-6 h-6 text-white/80" />
              </motion.div>
            ) : isNumberName ? (
              <motion.div
                key="user-icon"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              >
                <FiUser className="w-8 h-8 text-white/90" />
              </motion.div>
            ) : (
              <motion.span
                key="initials"
                className="text-lg font-bold text-white select-none"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              >
                {initials}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Connected flash */}
          {isEstablished && (
            <motion.div
              className="absolute inset-0 bg-white/20"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
        </motion.div>
      </div>

      {/* Contact Name */}
      <motion.h2
        className={`font-bold text-[var(--foreground)] ${compact ? 'text-[15px] mb-0' : 'text-xl mb-0.5'}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {displayName}
      </motion.h2>

      {/* Phone Number */}
      <AnimatePresence>
        {hasContactName && (
          <motion.p
            className="text-sm text-[var(--muted-foreground)] mb-0.5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {activeLine.remoteNumber}
          </motion.p>
        )}
      </AnimatePresence>

      {/* My caller ID — which of the agent's numbers this call is placed from
          (moved here off the top bar, matching RingCentral). */}
      {userPhoneNumber && (
        <p className="text-[12.5px] text-[var(--muted-foreground)] mb-1">
          My caller ID:{' '}
          <span className="text-[var(--foreground)]/80">{formatPhoneUS(userPhoneNumber)}</span>
        </p>
      )}

      {/* Call state badge — only for NON-established states (Connecting / On Hold).
          Once established, the compact status row below conveys "connected". */}
      {!isEstablished && (
        <motion.div
          className="flex items-center justify-center gap-2 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeLine.state}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                isOnHold
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}
            >
              <span>{getCallStateText(activeLine.state)}</span>
              {isConnecting && <ConnectingDots />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* Established — duration · live level · call quality on ONE slim row, so
          the in-call panel stays compact and never overflows to a page scroll. */}
      {isEstablished && (
        <motion.div
          className="mt-2 flex items-center justify-center gap-2.5"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          <span className="inline-flex items-center gap-1.5 text-base font-mono font-light tracking-wide tabular-nums text-[var(--foreground)]">
            <motion.span
              className="w-2 h-2 rounded-full bg-green-500 shrink-0"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {formatDuration(callDuration)}
          </span>
          {!dtmfDigits && !compact && (
            <LiveAudioWaveform lineId={activeLine.id} isMuted={activeLine.isMuted} />
          )}
          <CallQualityIndicator stats={callStats} />
        </motion.div>
      )}

      {/* DTMF digits display */}
      <AnimatePresence>
        {dtmfDigits && (
          <motion.div
            className="mt-3 flex justify-center"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="inline-flex items-center gap-0.5 px-4 py-1.5 rounded-lg bg-[var(--muted)] text-2xl font-mono tracking-[0.15em] text-[var(--foreground)] select-all">
              {dtmfDigits.split('').map((digit, i) => (
                <motion.span
                  key={`${i}-${digit}`}
                  initial={{ opacity: 0, y: -8, scale: 1.4 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                >
                  {digit}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
