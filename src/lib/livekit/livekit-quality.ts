/**
 * LiveKit Quality Monitor — the LiveKit engine's equivalent of SipQualityManager.
 *
 * Polls the active call's WebRTC stats (via livekit-client's per-track
 * `getReceiverStats()` / `getSenderStats()`) on a fixed interval, computes a
 * `CallStats` snapshot using the SHARED MOS math (`lib/call/mos`), and hands it
 * back through a callback. LiveKitManager forwards that as a `callStatsUpdate`
 * event — the exact event the SIP engine emits — so the existing MOS pill,
 * "poor connection" banner and signal bars light up for LiveKit calls with no
 * UI changes and scores directly comparable to SIP.
 *
 * Scope: measurement only. It never touches call control — a stats hiccup is
 * swallowed, never surfaced as a call failure. (Automatic path-switching is the
 * separate multipath-resilience layer.)
 *
 * @module lib/livekit/livekit-quality
 */

import { Track, type Room, type RemoteAudioTrack, type LocalAudioTrack } from 'livekit-client';
import type { CallStats } from '../sip/types';
import { calculateMOS } from '../call/mos';

/** Poll cadence — matches livekit-client's own monitorFrequency and the SIP ~2s. */
const DEFAULT_POLL_MS = 2000;

export class LiveKitQualityMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Previous cumulative counters, for delta-based packet-loss (as SIP does). */
  private prev: { packetsReceived: number; packetsLost: number } | null = null;

  constructor(
    private readonly room: Room,
    private readonly onStats: (stats: CallStats) => void,
    private readonly pollMs: number = DEFAULT_POLL_MS
  ) {}

  /** Begin polling. First sample fires almost immediately so quality shows fast. */
  start(): void {
    if (this.timer) return;
    setTimeout(() => void this.poll(), 150);
    this.timer = setInterval(() => void this.poll(), this.pollMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.prev = null;
  }

  /** The remote PSTN leg's audio track (either direction) — has getReceiverStats. */
  private remoteAudioTrack(): RemoteAudioTrack | undefined {
    for (const p of this.room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        const t = pub.audioTrack;
        if (t && 'getReceiverStats' in t) return t as RemoteAudioTrack;
      }
    }
    return undefined;
  }

  /** Our own published mic track — has getSenderStats. */
  private localAudioTrack(): LocalAudioTrack | undefined {
    const pub = this.room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (pub?.audioTrack) return pub.audioTrack;
    for (const p of this.room.localParticipant.audioTrackPublications.values()) {
      if (p.audioTrack) return p.audioTrack;
    }
    return undefined;
  }

  /** Worst-case snapshot when the browser is offline (mirrors SIP behavior). */
  private offlineStats(): CallStats {
    return {
      packetsReceived: 0,
      packetsSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      jitter: 100,
      roundTripTime: 1000,
      packetLoss: 100,
      mosScore: 1.0,
      timestamp: new Date(),
    };
  }

  private async poll(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.onStats(this.offlineStats());
        return;
      }

      const recvTrack = this.remoteAudioTrack();
      const sendTrack = this.localAudioTrack();
      const [recv, send] = await Promise.all([
        recvTrack ? recvTrack.getReceiverStats() : Promise.resolve(undefined),
        sendTrack ? sendTrack.getSenderStats() : Promise.resolve(undefined),
      ]);
      // Nothing published yet (still connecting) — wait for the next tick.
      if (!recv && !send) return;

      const packetsReceived = recv?.packetsReceived ?? 0;
      const packetsLostTotal = recv?.packetsLost ?? 0;
      const bytesReceived = recv?.bytesReceived ?? 0;
      const packetsSent = send?.packetsSent ?? 0;
      const bytesSent = send?.bytesSent ?? 0;
      // livekit-client reports jitter/RTT in seconds (RTCStats convention) → ms.
      const jitterMs = (recv?.jitter ?? 0) * 1000;
      const rttMs = (send?.roundTripTime ?? 0) * 1000;

      // Delta-based loss over the interval — same method the SIP engine uses, so
      // a momentary early-call spike doesn't dominate the whole-call average.
      let packetLoss = 0;
      if (this.prev) {
        const dRecv = packetsReceived - this.prev.packetsReceived;
        const dLost = packetsLostTotal - this.prev.packetsLost;
        const total = dRecv + dLost;
        if (total > 0) packetLoss = (dLost / total) * 100;
      }
      this.prev = { packetsReceived, packetsLost: packetsLostTotal };

      const mosScore = calculateMOS(jitterMs, packetLoss, rttMs);
      this.onStats({
        packetsReceived,
        packetsSent,
        bytesReceived,
        bytesSent,
        jitter: jitterMs,
        roundTripTime: rttMs,
        packetLoss,
        mosScore,
        timestamp: new Date(),
      });
    } catch {
      // Quality is a hint — never disrupt the call over a stats read.
    }
  }
}
