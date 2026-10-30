/**
 * SIP Quality Manager
 *
 * Handles call quality statistics collection, MOS score calculation,
 * and quality level tracking with delta-based real-time accuracy.
 *
 * @module lib/sip/managers/SipQualityManager
 */

import type { CallStats } from '../types';
import type { SipManagerContext } from './types';
import { sipLogger as logger } from '../logger';
import { applyJitterBufferTarget, JITTER_BUFFER_BASE_MS } from '../media-tuning';
import { calculateMOS, getQualityLevel } from '../../call/mos';

/**
 * Grace window after ICE goes 'disconnected' before triggering a restart.
 * 'disconnected' is frequently a transient blip that self-heals back to
 * 'connected'; this window lets a healthy call recover WITHOUT a restart, so
 * only a genuinely stuck connection triggers one. ('failed' is terminal and
 * restarts immediately — a healthy call never reaches it.)
 */
const ICE_DISCONNECT_GRACE_MS = 2500;

/**
 * Initial-connection watchdog. On a lossy link the browser's ICE agent can sit
 * in 'checking' for ~30s before it finally declares 'failed' — during that time
 * neither the 'failed' nor 'disconnected' handler fires, so a stalled INITIAL
 * connect just hangs and the user stares at "connecting". Production telemetry
 * (2026-07-20): the first ICE candidate arrives in <1.5s and ~96% of healthy
 * calls reach connected within 6s, yet restart-driven calls took 14–54s because
 * the proactive restart only kicked in after the browser's slow default. Timed
 * from when ICE enters 'checking' (connectivity checks begin), NOT call setup,
 * so ring time doesn't consume it. If checks haven't reached connected within
 * this window we trigger the SAME guarded, once-per-line restart the media /
 * ICE-state paths use — cutting that tail toward ~10s. Set above the healthy-
 * connect ceiling (~6s) to avoid restarting a slow-but-healthy call; tune
 * during staging validation.
 */
const INITIAL_CONNECT_WATCHDOG_MS = 8000;

/**
 * Adaptive browser playout jitter buffer. The base floor is set at media setup
 * (SipCallManager); here we RAISE the remote audio receiver's target on lossy /
 * jittery links — a deeper buffer gives Opus in-band FEC time to reconstruct lost
 * packets and absorbs reordering — then LOWER it back once the link is clean, to
 * avoid needless mouth-to-ear latency. Two-level with hysteresis to prevent
 * thrash: raise immediately, lower only after a sustained clean window.
 * NOTE: this is the BROWSER's own playout buffer, NOT the FreeSWITCH server
 * jitter buffer (A/B-tested net-negative on this stack twice — do not confuse).
 */
const JB_HIGH_MS = 350;
const JB_RAISE_LOSS_PCT = 5;
const JB_RAISE_JITTER_MS = 30;
const JB_CLEAR_LOSS_PCT = 2;
const JB_CLEAR_JITTER_MS = 20;
const JB_CLEAR_INTERVALS = 5; // sustained clean polls before lowering (~10s @ 2s)

export class SipQualityManager {
  private ctx: SipManagerContext;

  // Stats polling intervals per line
  private statsIntervals: Map<number, ReturnType<typeof setInterval>> = new Map();

  // Previous stats for delta calculation
  private lastStatsData: Map<
    number,
    {
      packetsReceived: number;
      packetsLost: number;
      packetsSent: number;
      bytesReceived: number;
      bytesSent: number;
      timestamp: number;
    }
  > = new Map();

  // Track consecutive no-data intervals to detect stale connections
  private noDataIntervals: Map<number, number> = new Map();

  // Track last quality level for change detection
  private lastQualityLevel: Map<number, 'excellent' | 'good' | 'fair' | 'poor'> = new Map();

  // Adaptive jitter-buffer state per line: current applied target (ms) + count of
  // consecutive clean polls (hysteresis before lowering back to the base floor).
  private jbState: Map<number, { target: number; cleanCount: number }> = new Map();

  // ICE connection-state watchers per line — the cautious, authoritative
  // restart trigger (reacts to the browser's own ICE agent, not a stats proxy).
  private iceStateWatchers: Map<
    number,
    { pc: RTCPeerConnection; handler: () => void; cleanup: () => void }
  > = new Map();

  constructor(ctx: SipManagerContext) {
    this.ctx = ctx;
  }

  /**
   * Get call statistics for a line
   * Uses delta calculations for real-time accuracy
   */
  async getCallStats(lineId: number): Promise<CallStats | null> {
    const session = this.ctx.sessions.get(lineId);
    if (!session) return null;

    const pc = this.ctx.getPeerConnection(session);
    if (!pc) return null;

    // If network is offline, return poor quality immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
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

    try {
      const stats = await pc.getStats();
      const now = Date.now();

      let packetsReceived = 0;
      let packetsSent = 0;
      let bytesReceived = 0;
      let bytesSent = 0;
      let jitter = 0;
      let roundTripTime = 0;
      let packetsLost = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          packetsReceived = report.packetsReceived || 0;
          bytesReceived = report.bytesReceived || 0;
          jitter = (report.jitter || 0) * 1000;
          packetsLost = report.packetsLost || 0;
        } else if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          packetsSent = report.packetsSent || 0;
          bytesSent = report.bytesSent || 0;
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          roundTripTime = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
        }
      });

      // Media is only EXPECTED once the call is answered ('established'). During
      // ringing / connecting / early media there is no RTP by design, so absence
      // of packets is normal — NOT a fault. Gating the no-media detection on the
      // answered state (rather than "has media started") is deliberate: a call
      // that answers but never delivers inbound audio (the "audio is missing"
      // case) MUST still trip 'noMediaFlow' so ICE-restart auto-recovery fires.
      // This mirrors attemptIceRestart(), which itself only acts when
      // established, so we emit exactly when the consumer can act — no phantom
      // 'noMediaFlow' during ringing (which was polluting call-health telemetry
      // via markIceRestarted and driving the false "check your internet" banner).
      const callAnswered = this.ctx.lineStates.get(lineId)?.state === 'established';

      // Get previous stats for delta calculation
      const prevStats = this.lastStatsData.get(lineId);
      let deltaPacketLoss = 0;
      let isMediaFlowing = true;

      if (prevStats) {
        const deltaTime = (now - prevStats.timestamp) / 1000;
        const deltaPacketsReceived = packetsReceived - prevStats.packetsReceived;
        const deltaPacketsLost = packetsLost - prevStats.packetsLost;
        const deltaBytesReceived = bytesReceived - prevStats.bytesReceived;

        // Only treat "no packets this interval" as a fault once the call is
        // answered. Before answer (or while held/transferring) this branch is
        // expected and benign, so we keep the counter reset and stay silent. A
        // genuine media STOP or a never-arrives-after-answer stream still trips
        // the exact same detection it always did.
        if (deltaPacketsReceived === 0 && deltaBytesReceived === 0 && deltaTime > 1) {
          if (!callAnswered) {
            this.noDataIntervals.set(lineId, 0);
          } else {
            const noDataCount = (this.noDataIntervals.get(lineId) || 0) + 1;
            this.noDataIntervals.set(lineId, noDataCount);

            // Fire after 2 no-data intervals (~4s) instead of 3 (~6s) — recover
            // from real mid-call dead air sooner. The ICE-restart it triggers is
            // capped + cooldown-guarded (SipCallManager), so a flaky link can't
            // restart-storm; and this only runs once the call is answered.
            const NO_MEDIA_INTERVALS = 2;
            if (noDataCount >= NO_MEDIA_INTERVALS) {
              isMediaFlowing = false;
              logger.warn(`No media flow detected for line ${lineId} (${noDataCount} intervals)`);
              // Emit once, on the transition, so SipCallManager can trigger ICE restart.
              if (noDataCount === NO_MEDIA_INTERVALS) {
                this.ctx.emit({ type: 'noMediaFlow', lineId });
              }
            }
          }
        } else {
          this.noDataIntervals.set(lineId, 0);
        }

        const totalDeltaPackets = deltaPacketsReceived + deltaPacketsLost;
        if (totalDeltaPackets > 0) {
          deltaPacketLoss = (deltaPacketsLost / totalDeltaPackets) * 100;
        } else if (!isMediaFlowing) {
          deltaPacketLoss = 100;
        }
      }

      this.lastStatsData.set(lineId, {
        packetsReceived,
        packetsLost,
        packetsSent,
        bytesReceived,
        bytesSent,
        timestamp: now,
      });

      const effectiveJitter = isMediaFlowing ? jitter : 150;
      const effectiveRtt = isMediaFlowing ? roundTripTime : 500;
      const effectivePacketLoss = isMediaFlowing ? deltaPacketLoss : 100;

      const mosScore = this.calculateMOS(effectiveJitter, effectivePacketLoss, effectiveRtt);

      return {
        packetsReceived,
        packetsSent,
        bytesReceived,
        bytesSent,
        jitter: effectiveJitter,
        roundTripTime: effectiveRtt,
        packetLoss: effectivePacketLoss,
        mosScore,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get call stats:', error);
      return null;
    }
  }

  /**
   * Calculate MOS score using simplified E-Model (ITU-T G.107).
   * Delegates to the shared SSOT (`lib/call/mos`) so SIP and LiveKit score
   * identically; kept as a thin private method to avoid churning call sites.
   */
  private calculateMOS(jitter: number, packetLoss: number, rtt: number): number {
    return calculateMOS(jitter, packetLoss, rtt);
  }

  /**
   * Get quality level from MOS score (delegates to the shared SSOT).
   */
  private getQualityLevel(mosScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
    return getQualityLevel(mosScore);
  }

  /**
   * Adapt the browser playout jitter buffer to current link conditions. Called
   * each stats poll while the call is established. Raises the remote audio
   * receiver's target to JB_HIGH_MS on loss / jitter (more time for Opus in-band
   * FEC + reordering), and lowers it back to the base floor after a sustained
   * clean window. Two-level with hysteresis so it can't thrash. Best-effort —
   * feature-detected and non-throwing, never affects call control.
   */
  private adaptJitterBuffer(lineId: number, packetLoss: number, jitter: number): void {
    try {
      const session = this.ctx.sessions.get(lineId);
      if (!session) return;
      const pc = this.ctx.getPeerConnection(session);
      if (!pc) return;

      const st = this.jbState.get(lineId) ?? { target: JITTER_BUFFER_BASE_MS, cleanCount: 0 };
      let target = st.target;
      let cleanCount = st.cleanCount;

      const lossy = packetLoss >= JB_RAISE_LOSS_PCT || jitter >= JB_RAISE_JITTER_MS;
      const clean = packetLoss <= JB_CLEAR_LOSS_PCT && jitter <= JB_CLEAR_JITTER_MS;

      if (lossy) {
        target = JB_HIGH_MS;
        cleanCount = 0;
      } else if (clean) {
        cleanCount += 1;
        if (cleanCount >= JB_CLEAR_INTERVALS) {
          target = JITTER_BUFFER_BASE_MS;
          cleanCount = 0;
        }
      } else {
        cleanCount = 0; // middling — hold the current target
      }

      if (target !== st.target) {
        for (const receiver of pc.getReceivers()) {
          if (receiver.track?.kind === 'audio') applyJitterBufferTarget(receiver, target);
        }
        logger.debug(
          `Adaptive JB line ${lineId}: ${st.target}->${target}ms (loss ${packetLoss.toFixed(1)}%, jitter ${jitter.toFixed(0)}ms)`
        );
      }
      this.jbState.set(lineId, { target, cleanCount });
    } catch {
      // quality hint only — never disrupt the call
    }
  }

  /**
   * Forget the adaptive jitter-buffer state for a line. Call this whenever the
   * receiver's target is externally reset to the base floor — notably when
   * setupRemoteAudio re-runs after an ICE restart, which sets the (possibly new)
   * receiver back to the base. Without this, jbState could still read JB_HIGH_MS
   * while the receiver is actually at base, and the "re-apply only on change"
   * guard would then never re-raise on a still-lossy link (the exact PK scenario
   * an ICE restart is for). Deleting resets to base on the next adapt poll.
   */
  resetJitterBufferState(lineId: number): void {
    this.jbState.delete(lineId);
  }

  /**
   * Start stats polling for a call
   */
  startStatsPolling(lineId: number): void {
    const config = this.ctx.getConfig();
    if (!config.stats.enabled) return;
    if (this.statsIntervals.has(lineId)) {
      logger.debug(`Stats polling already active for line ${lineId}`);
      return;
    }

    logger.debug(`Starting stats polling for line ${lineId}`);

    // Run first poll immediately so MOS/quality data is available within
    // ~100ms of call connecting, not after a 2s wait. This lets the
    // ConnectionQualityBanner show poor connection instantly.
    const pollOnce = async () => {
      try {
        if (!this.ctx.sessions.has(lineId)) return;
        const stats = await this.getCallStats(lineId);
        if (stats) {
          this.lastQualityLevel.set(lineId, this.getQualityLevel(stats.mosScore));
          this.ctx.emit({ type: 'callStatsUpdate', lineId, stats });
        }
      } catch {
        // Ignore — regular interval will retry
      }
    };
    setTimeout(pollOnce, 100);

    const interval = setInterval(async () => {
      try {
        if (!this.ctx.sessions.has(lineId)) {
          this.stopStatsPolling(lineId);
          return;
        }

        const stats = await this.getCallStats(lineId);
        if (stats) {
          const currentQuality = this.getQualityLevel(stats.mosScore);
          const previousQuality = this.lastQualityLevel.get(lineId);

          if (previousQuality && previousQuality !== currentQuality) {
            logger.info(
              `Call quality changed on line ${lineId}: ${previousQuality} -> ${currentQuality} (MOS: ${stats.mosScore.toFixed(2)})`
            );
          }

          this.lastQualityLevel.set(lineId, currentQuality);
          this.ctx.emit({ type: 'callStatsUpdate', lineId, stats });

          // Adapt the browser playout jitter buffer once the call is answered
          // (media is only expected then; before answer stats are placeholders).
          if (this.ctx.lineStates.get(lineId)?.state === 'established') {
            this.adaptJitterBuffer(lineId, stats.packetLoss, stats.jitter);
          }
        }
      } catch (error) {
        logger.debug(`Stats polling error for line ${lineId}:`, error);
      }
    }, config.stats.pollingInterval);

    this.statsIntervals.set(lineId, interval);

    // Cautious ICE-restart trigger — act on the browser's own ICE state the
    // moment it clearly stalls, instead of only inferring it from ~6s of
    // missing media stats. Reuses the guarded 'noMediaFlow' path.
    this.setupIceStateWatch(lineId);
  }

  /**
   * Watch the PeerConnection's ICE connection state and trigger a (guarded,
   * once-per-line via SipCallManager) restart the moment it CLEARLY stalls:
   *   - initial connect stuck → if not 'connected'/'completed' within
   *     INITIAL_CONNECT_WATCHDOG_MS, restart (the browser would otherwise sit
   *     in 'checking' ~30s before it ever reaches 'failed').
   *   - 'failed'       → terminal/authoritative → restart immediately.
   *   - 'disconnected' → may self-heal → restart only if STILL disconnected
   *                      after ICE_DISCONNECT_GRACE_MS.
   * A healthy call reaches 'connected'/'completed' and clears every timer, so
   * this cannot restart a working call. It emits the existing 'noMediaFlow'
   * signal so it funnels through the same once-per-line guard as the media check.
   */
  private setupIceStateWatch(lineId: number): void {
    if (this.iceStateWatchers.has(lineId)) return;
    const session = this.ctx.sessions.get(lineId);
    if (!session) return;
    const pc = this.ctx.getPeerConnection(session);
    if (!pc) return;

    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const clearGrace = () => {
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = undefined;
      }
    };

    // Initial-connection watchdog — armed only while the call has not yet
    // connected. Cleared the moment ICE reaches 'connected'/'completed' (or the
    // line is torn down), so a healthy call never fires it.
    let connectWatchdog: ReturnType<typeof setTimeout> | undefined;
    const clearConnectWatchdog = () => {
      if (connectWatchdog) {
        clearTimeout(connectWatchdog);
        connectWatchdog = undefined;
      }
    };

    const isConnected = (): boolean => {
      const s = pc.iceConnectionState;
      return s === 'connected' || s === 'completed';
    };

    // Arm the initial-connect watchdog the moment ICE connectivity checks begin
    // ('checking'), so the window measures ACTUAL connect progress rather than
    // ring time — an outbound call can sit in Establishing for many seconds
    // before the remote answer delivers the candidates ICE needs, and timing
    // from call-setup would burn the watchdog during ringing. Idempotent.
    const armConnectWatchdog = () => {
      if (connectWatchdog || isConnected()) return;
      connectWatchdog = setTimeout(() => {
        connectWatchdog = undefined;
        if (!isConnected()) {
          logger.warn(
            `ICE stuck in '${pc.iceConnectionState}' ${INITIAL_CONNECT_WATCHDOG_MS}ms after checks began on line ${lineId} — triggering initial-connect restart`
          );
          this.ctx.emit({ type: 'noMediaFlow', lineId });
        }
      }, INITIAL_CONNECT_WATCHDOG_MS);
    };

    const handler = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed') {
        clearGrace();
        clearConnectWatchdog();
        logger.warn(`ICE 'failed' on line ${lineId} — triggering restart`);
        this.ctx.emit({ type: 'noMediaFlow', lineId });
      } else if (state === 'disconnected') {
        if (graceTimer) return; // grace already running
        graceTimer = setTimeout(() => {
          graceTimer = undefined;
          if (pc.iceConnectionState === 'disconnected') {
            logger.warn(
              `ICE still 'disconnected' after ${ICE_DISCONNECT_GRACE_MS}ms on line ${lineId} — triggering restart`
            );
            this.ctx.emit({ type: 'noMediaFlow', lineId });
          }
        }, ICE_DISCONNECT_GRACE_MS);
      } else if (state === 'checking') {
        armConnectWatchdog(); // connectivity checks started — start the clock
      } else if (state === 'connected' || state === 'completed') {
        clearGrace(); // self-healed — cancel any pending restart
        clearConnectWatchdog(); // connected in time — disarm the watchdog
      }
    };

    pc.addEventListener('iceconnectionstatechange', handler);

    // If checks are already underway when we attach (stats polling can start
    // after the ICE state has advanced), arm now; otherwise the 'checking'
    // branch above arms it on transition. A call still in 'new' hasn't begun
    // connecting yet, so we deliberately wait.
    if (pc.iceConnectionState === 'checking') armConnectWatchdog();

    const cleanup = () => {
      clearGrace();
      clearConnectWatchdog();
    };
    this.iceStateWatchers.set(lineId, { pc, handler, cleanup });
  }

  /**
   * Stop stats polling for a call and clean up associated data
   */
  stopStatsPolling(lineId: number): void {
    const watcher = this.iceStateWatchers.get(lineId);
    if (watcher) {
      watcher.pc.removeEventListener('iceconnectionstatechange', watcher.handler);
      watcher.cleanup();
      this.iceStateWatchers.delete(lineId);
    }
    const interval = this.statsIntervals.get(lineId);
    if (interval) {
      clearInterval(interval);
      this.statsIntervals.delete(lineId);
      this.lastStatsData.delete(lineId);
      this.noDataIntervals.delete(lineId);
      this.lastQualityLevel.delete(lineId);
      this.jbState.delete(lineId);
      logger.debug(`Stopped stats polling for line ${lineId}`);
    }
  }

  /**
   * Stop all stats polling
   */
  stopAllStatsPolling(): void {
    for (const lineId of this.statsIntervals.keys()) {
      this.stopStatsPolling(lineId);
    }
  }

  /**
   * Clear all stored stats data (for disconnect cleanup)
   */
  clearAll(): void {
    this.stopAllStatsPolling();
    this.lastStatsData.clear();
    this.noDataIntervals.clear();
    this.lastQualityLevel.clear();
    this.jbState.clear();
  }
}
