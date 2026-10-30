/**
 * LiveKit Multipath Session — the client-side adaptive "link monitor" that gives
 * a LiveKit call carrier-grade resilience on poor networks (the productionized
 * port of the PoC at `livekit-resilience/web/test/index.html`).
 *
 * HOW IT WORKS (mute-swap multipath):
 *   - Connects N legs (distinct agent identities, same room) each pinned to a
 *     different transport: leg 0 = direct-preferred, leg 1 = relay/UDP,
 *     leg 2 = relay/TLS. All legs SUBSCRIBE to the single PSTN participant, so
 *     the caller's audio arrives over N independent paths at once.
 *   - Exactly ONE leg is "active": its speaker is audible AND its mic is unmuted.
 *     The others are warm standby — subscribed (downlink flowing for scoring) but
 *     mic muted, so the PSTN side only ever receives one uplink.
 *   - A ~400ms watchdog scores every leg by downlink concealment ratio
 *     (concealedSamples/totalSamplesReceived) + uplink fractionLost, and switches
 *     to a better leg when the active one degrades — make-before-break on the mic
 *     with a ~30ms speaker fade so the swap is near-seamless.
 *
 * This is measurement + switching only; it never blocks call control. All private
 * client internals are reached behind feature-detected helpers so a livekit-client
 * upgrade can't break the call — the core loop runs on public APIs.
 *
 * @module lib/livekit/livekit-multipath
 */

import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type RemoteTrack,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type LocalTrackPublication,
  type ReconnectPolicy,
  type ReconnectContext,
} from 'livekit-client';
import type { CallStats } from '../sip/types';
import type { DTMFTone } from '../sip/types';
import { calculateMOS } from '../call/mos';
import { isClientDebugEnabled } from '../clientDebug';
import { installOpusRcProfile, setOpusRcProfileEnabled } from './opus-rc-profile';

/**
 * Faster reconnect than the SDK default (300ms → 10s exponential backoff). PK
 * networks drop briefly and often, so retry quickly and persistently: near-
 * immediate first attempt, growing to a 4s cap, up to 20 tries before giving up.
 * Shared by every LiveKit Room (single-leg + each multipath leg) so recovery is
 * uniform. Also used as the delay between INITIAL-connect retries (PK_CONNECT_
 * OPTIONS.maxRetries), which is why the jitter matters — see below.
 *
 * The ±35% JITTER is deliberate: without it, N multipath legs that dropped
 * together retry in lockstep, and their synchronised bursts amplify loss on a
 * congested uplink (this was part of the connect-storm that failed calls at
 * ~10% packet loss). Jitter decorrelates the legs so they probe at different
 * instants.
 */
export const PK_FAST_RECONNECT: ReconnectPolicy = {
  nextRetryDelayInMs(ctx: ReconnectContext): number | null {
    if (ctx.retryCount >= 20) return null;
    const base = Math.min(250 + ctx.retryCount * 350, 4000);
    const jitter = base * 0.35 * (Math.random() * 2 - 1);
    return Math.max(150, Math.round(base + jitter));
  },
};

/**
 * Room.connect() options tuned for poor / lossy uplinks (Pakistan). The LiveKit
 * signalling join is a WebSocket/TLS handshake over TCP and — unlike the UDP
 * media, which shrugs off loss via FEC — it is fragile to packet loss: a single
 * dropped packet during the TLS/WS upgrade otherwise fails the leg with NO retry
 * (SDK default maxRetries is effectively one shot). On a lossy link every leg
 * loses that race and the CALL NEVER CONNECTS. So: give each attempt time, and
 * retry the join. The SDK reuses the same Room (and its wired listeners) across
 * these retries and applies PK_FAST_RECONNECT (jittered) as the inter-attempt
 * delay. An overall wall-clock cap lives in LiveKitMultipathSession.connect()
 * (CONNECT_BUDGET_MS) so a truly-dead link fails the dial cleanly.
 */
export const PK_CONNECT_OPTIONS = {
  websocketTimeout: 12_000, // per WS/TLS upgrade attempt (SDK default 15s): abandon a black-holed attempt and retry fresh
  peerConnectionTimeout: 15_000, // per ICE/DTLS establishment (SDK default 15s) — slack for high-RTT + loss
  maxRetries: 5, // SDK default ≈ one attempt; retry the join on a flaky link
} as const;

/** One leg's join credentials (minted by the backend, one identity each). */
export interface MultipathLeg {
  token: string;
  identity: string;
}

/** Generic ICE server shape (matches the backend /auth/turn-credentials entries). */
export interface IceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MultipathCallbacks {
  /** Active-leg quality snapshot, once per tick — feeds the same UI as SIP. */
  onStats?: (stats: CallStats) => void;
  /** The PSTN participant appeared (call is up / answered). */
  onRemoteJoined?: () => void;
  /** The PSTN participant left (remote hung up / call failed). */
  onRemoteLeft?: () => void;
  /** A path switch happened (for logging/telemetry). */
  onSwitch?: (fromLabel: string, toLabel: string, reason: string) => void;
}

// ---- Tuned decision ladder (from the PoC, see project memory) --------------
const QBAD = 0.25; // quality-bad concealment threshold (Phase 1: 0.30→0.25 to escape a degrading leg sooner; still clears the 8–16% natural-jitter band, protected by the 6s sustain + 3% margin)
const GOOD = 0.01; // "clean" threshold for return-home
const MARGIN = 0.03; // target must be >3% better than active to switch (anti-flap)
const ESCAPE_SUSTAIN_MS = 6_000; // quality lane: bad must persist this long (tuned 12s→6s, snappier)
const RETURN_STABLE_MS = 40_000; // return-home: higher-priority leg clean this long (tuned 60s→40s)
const DWELL_MS = 5_000; // min time on a leg before a calm-lane switch (tuned 8s→5s)
const COOLDOWN_MS = 30_000; // a leg that went bad is penalized this long (tuned 40s→30s)
const CATASTROPHIC = 0.85; // ~total loss → fast-escape lane
const FAST_ESCAPE_MS = 600; // catastrophic must persist this long (tuned 1s→0.6s, snappier)
const TICK_MS = 400;
// Poor-network connect hardening (PK). Overall wall-clock to bring up >=1 leg;
// if exceeded the dial FAILS cleanly (manager tears down + surfaces the error)
// rather than hanging while legs burn their retries. LEG_STAGGER_MS spaces the
// legs' handshakes so N fragile WS/TCP joins don't burst into a lossy uplink at
// once (part of the ~10%-loss connect storm).
// 15s (was 35s): Promise.any resolves the instant ANY leg is up, so a healthy
// PK connect is unaffected — this cap only bites when EVERY leg is dead, which
// is exactly when the engine router should fail over to the independent SIP.js
// path (see call-engine makeCall fallback). A shorter cap makes that fallback
// timely instead of a 35s hang.
const CONNECT_BUDGET_MS = 15_000;
const LEG_STAGGER_MS = 250;
const JB_TARGET_MS = 100; // playout jitter buffer per leg (initial; adapted at runtime)
const JB_MIN_MS = 40; // adaptive jitter buffer floor when clean (low mouth-to-ear latency)
const JB_MAX_MS = 180; // adaptive jitter buffer ceiling when jittery/lossy (absorb bursts, no dropout)
const BR_HI = 32_000;
const BR_MID = 20_000;
const BR_LO = 12_000;

/** Transport pinning per leg index. */
type LegMode = 'direct' | 'relay';

interface LegState {
  readonly index: number;
  readonly label: string;
  readonly mode: LegMode;
  readonly ice: IceServerLike[];
  readonly token: string;
  room: Room | null;
  pub: LocalTrackPublication | null;
  sub: RemoteTrack | null;
  el: HTMLAudioElement | null;
  ready: boolean;
  reconnecting: boolean;
  pathAlive: boolean;
  hasPhone: boolean; // PSTN audio TRACK subscribed (media flowing — early media or answered)
  pstnHere: boolean; // PSTN PARTICIPANT present (may be ringing with no media track yet)
  terminated: boolean; // RoomEvent.Disconnected fired — leg permanently gone
  // scoring state
  health: number | null; // smoothed concealment/loss 0..1 (higher = worse)
  last: { conceal: number; total: number; recv: number } | null;
  up: number | null; // uplink fractionLost
  rtt: number | null; // seconds
  jitter: number; // ms (active-leg CallStats)
  badUntil: number;
  qbadSince: number;
  goodSince: number;
  rawBadSince: number;
}

/** True if a participant is the remote PSTN leg (outbound `phone` or inbound `sip_*`). */
function isPstnLeg(identity: string | undefined): boolean {
  return identity === 'phone' || (typeof identity === 'string' && identity.startsWith('sip_'));
}

function urlList(s: string | string[]): string[] {
  return Array.isArray(s) ? s : [s];
}

/**
 * DEV/TEST loss injector (no-op in production — gated on a normally-unset window
 * global, so zero effect unless a developer sets it from the console):
 *
 *   window.__lkImpair = { leg: 'active', amount: 0.9 }   // force the active leg
 *   // ...watch the switcher escape to another leg, then:
 *   window.__lkImpair = null
 *
 * Reliable where Clumsy/WinDivert can't cleanly isolate one leg (relay legs share
 * Cloudflare's anycast IP; the direct leg may relay-fall-back behind NAT).
 */
function getImpair(): { leg: number | 'active'; amount: number } | null {
  // Dev/test only — compiled OUT of production builds so the hook can never be
  // triggered against real traffic.
  if (process.env.NODE_ENV === 'production') return null;
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __lkImpair?: { leg: number | 'active'; amount: number } | null };
  return w.__lkImpair ?? null;
}

export class LiveKitMultipathSession {
  private readonly legs: LegState[];
  private active = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private switching = false;
  private lastSwitch = 0;
  /** Time-on-path tracking for "which link carried the call". legMs[i] = cumulative
   *  ms leg i was the active/audible path; activeSinceMs marks when the current one
   *  became active. Used by getDominantPathLabel() (time-weighted winner). */
  private legMs: number[] = [];
  private activeSinceMs = 0;
  private curBitrate = 24_000;
  private lastBitrate = 0;
  private curJitterMs = 0; // last-applied adaptive playout delay (ms) on the active leg
  private lastJitterAdapt = 0;
  private muted = false;
  private established = false;
  private paused = false; // set when the PSTN leg leaves — stop switching
  private heldPause = false; // set while the call is on hold — no media by design, freeze switching
  private destroyed = false; // set by destroy() — guards in-flight leg connects
  private phoneGoneTicks = 0; // consecutive ticks with no PSTN leg (hangup grace)
  private pstnEverSeen = false; // the PSTN participant appeared at least once (ringing counts)
  // Client-side hold / music-on-hold state (see startHoldMusic/stopHoldMusic).
  private mohCtx: AudioContext | null = null; // Web Audio graph generating the MOH
  private mohTrack: MediaStreamTrack | null = null; // the MOH track swapped onto the active leg
  private mohRealMic: MediaStreamTrack | null = null; // real mic captured at hold time (restore target)
  private mohLegIndex = -1; // the leg the swap happened on (active at hold time)
  private mohSavedVolumes: Array<number | null> = []; // per-leg speaker volumes to restore on unhold
  private mohMuteFallback = false; // true when the tone swap failed → plain muted (silent) hold
  private mohAudioEl: HTMLAudioElement | null = null; // set when a real /audio/hold-music.mp3 is used
  private mohSchedTimer: ReturnType<typeof setTimeout> | null = null; // ambient-pad chord scheduler

  constructor(
    private readonly url: string,
    legTokens: MultipathLeg[],
    iceServers: IceServerLike[],
    private readonly cb: MultipathCallbacks = {}
  ) {
    this.legs = this.buildLegs(legTokens, iceServers);
  }

  // --- Public surface (consumed by LiveKitManager) -------------------------

  /**
   * Connect all legs concurrently and resolve as soon as the FIRST one is
   * usable — so a dead or slow-to-ICE leg (e.g. the direct path on a restrictive
   * network, exactly the case this feature exists for) never blocks or kills the
   * call; a relay leg carries it. Rejects only if EVERY leg fails.
   */
  async connect(): Promise<void> {
    // Stagger the legs' handshakes (LEG_STAGGER_MS apart) so we don't fire N
    // fragile WS/TCP joins into a lossy uplink at the same instant — that
    // simultaneous burst was part of what killed connect at ~10% loss. The
    // ordering keeps leg 0 (highest priority) first; Promise.any below still
    // resolves the moment ANY leg is usable, so the stagger never delays a
    // winning relay leg by more than a few hundred ms.
    const attempts = this.legs.map((leg, i) =>
      i === 0
        ? this.connectLeg(leg)
        : new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              if (this.destroyed) reject(new Error('destroyed'));
              else this.connectLeg(leg).then(resolve, reject);
            }, i * LEG_STAGGER_MS);
          })
    );
    // Losing legs may reject later — swallow to avoid unhandled-rejection noise
    // WITHOUT consuming the rejection Promise.any needs.
    attempts.forEach((p) => void p.catch(() => {}));

    // Overall budget: on a truly dead link the dial must FAIL (so the manager
    // tears down + surfaces the error) instead of hanging while each leg burns
    // its full PK_CONNECT_OPTIONS.maxRetries allowance. Races the first-leg-up
    // (Promise.any) against a wall-clock cap.
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    const budget = new Promise<never>((_, reject) => {
      budgetTimer = setTimeout(
        () => reject(new Error('connect budget exceeded')),
        CONNECT_BUDGET_MS
      );
    });
    try {
      await Promise.race([Promise.any(attempts), budget]);
    } catch {
      // Gave up (all legs failed, or budget hit) — stop any still-retrying legs
      // so nothing lingers after the dial is declared failed.
      for (const leg of this.legs) {
        try {
          void leg.room?.disconnect();
        } catch {
          /* ignore */
        }
      }
      throw new Error('all multipath legs failed to connect');
    } finally {
      if (budgetTimer) clearTimeout(budgetTimer);
    }
    if (this.destroyed) return; // torn down mid-connect — don't arm anything
    // Promote the highest-priority ready leg to active + audible.
    const firstUp = this.legs.findIndex((l) => l.ready && l.room);
    this.active = firstUp >= 0 ? firstUp : 0;
    this.legMs = new Array(this.legs.length).fill(0);
    this.activeSinceMs = Date.now();
    const act = this.legs[this.active];
    if (!this.muted && act.pub) {
      try {
        await act.pub.unmute();
      } catch {
        /* ignore */
      }
    }
    if (act.el) act.el.volume = 1;
    if (!this.timer) this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  /** Mute/unmute the CALL (applies to whichever leg is currently active). */
  setMuted(muted: boolean): void {
    this.muted = muted;
    const pub = this.legs[this.active]?.pub;
    if (!pub) return;
    void (muted ? pub.mute() : pub.unmute());
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Client-side HOLD: instead of asking FreeSWITCH to `uuid_hold` (which parks the
   * livekit-sip leg, whose ~15s media watchdog then closes the call — the "cuts
   * after ~15-20s on hold" bug), keep the media bridge fully live and swap the
   * agent's mic for a gently looping tone, so the REMOTE hears music-on-hold and
   * media never stops. The agent's speaker is muted so they're free. FAILS OPEN:
   * on any error we fall back to a plain muted hold, which STILL survives (we
   * never held on FS).
   */
  async startHoldMusic(): Promise<void> {
    try {
      const leg = this.legs[this.active];
      const audio = leg?.pub?.audioTrack;
      if (!leg || !leg.pub || !audio) {
        this.mohMuteFallback = true;
        this.setMuted(true);
        return;
      }
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const dest = ctx.createMediaStreamDestination();
      // Build the MOH audio into `dest`: prefer a real music file
      // (/audio/hold-music.mp3), else a warm, evolving ambient pad. See
      // buildHoldSource — no bell, no tremolo.
      await this.buildHoldSource(ctx, dest);
      const mohTrack = dest.stream.getAudioTracks()[0];
      if (!mohTrack) {
        try {
          void ctx.close();
        } catch {
          /* ignore */
        }
        this.mohMuteFallback = true;
        this.setMuted(true);
        return;
      }
      // Remember the real mic + which leg so unhold restores exactly this.
      this.mohRealMic = audio.mediaStreamTrack;
      this.mohLegIndex = this.active;
      this.mohCtx = ctx;
      this.mohTrack = mohTrack;
      // Swap MOH onto the agent's publication (userProvidedTrack=true → LiveKit
      // never stops our track) and unmute so it reaches the PSTN.
      await audio.replaceTrack(mohTrack, true);
      await leg.pub.unmute();
      // Mute the agent's speaker on every leg — they're free while on hold.
      this.mohSavedVolumes = this.legs.map((l) => (l.el ? l.el.volume : null));
      for (const l of this.legs) if (l.el) l.el.volume = 0;
    } catch {
      // Any failure → plain muted hold. Still survives (we never held on FS).
      // Tear down any partial MOH graph we may have started.
      this.mohMuteFallback = true;
      if (this.mohSchedTimer) {
        clearTimeout(this.mohSchedTimer);
        this.mohSchedTimer = null;
      }
      try {
        this.mohAudioEl?.pause();
      } catch {
        /* ignore */
      }
      this.mohAudioEl = null;
      try {
        void this.mohCtx?.close();
      } catch {
        /* ignore */
      }
      this.mohCtx = null;
      try {
        this.setMuted(true);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Wire an MOH source into `dest`. Prefers a real music file at
   * `/audio/hold-music.mp3` (drop a track there for professional MOH); if that's
   * missing/slow it falls back to a warm, evolving ambient pad — never the old
   * bell tone. Best-effort; on total failure the caller's mute-fallback kicks in.
   */
  private async buildHoldSource(
    ctx: AudioContext,
    dest: MediaStreamAudioDestinationNode
  ): Promise<void> {
    // 1) Real music file, if present.
    try {
      const el = new Audio('/audio/hold-music.mp3');
      el.loop = true;
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      const ready = await new Promise<boolean>((resolve) => {
        const to = setTimeout(() => finish(false), 1200);
        const finish = (ok: boolean) => {
          clearTimeout(to);
          el.removeEventListener('canplaythrough', onOk);
          el.removeEventListener('error', onErr);
          resolve(ok);
        };
        const onOk = () => finish(true);
        const onErr = () => finish(false);
        el.addEventListener('canplaythrough', onOk, { once: true });
        el.addEventListener('error', onErr, { once: true });
        el.load();
      });
      if (ready) {
        const src = ctx.createMediaElementSource(el);
        const g = ctx.createGain();
        g.gain.value = 0.5;
        src.connect(g);
        g.connect(dest);
        await el.play();
        this.mohAudioEl = el;
        return;
      }
      try {
        el.src = '';
      } catch {
        /* ignore */
      }
    } catch {
      /* fall through to the ambient pad */
    }
    // 2) Warm ambient-pad fallback.
    this.buildAmbientPad(ctx, dest);
  }

  /**
   * A soft, warm ambient pad: a slow maj7/m7 chord progression low-passed for
   * warmth, each chord dipping-then-swelling so it evolves smoothly (no clicks,
   * no tremolo, no bell). Loops on the AudioContext clock via a re-armed timer.
   */
  private buildAmbientPad(ctx: AudioContext, dest: MediaStreamAudioDestinationNode): void {
    const master = ctx.createGain();
    master.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 820; // warmth
    lp.Q.value = 0.7;
    master.connect(lp);
    lp.connect(dest);

    // Cmaj7 → Am7 → Fmaj7 → Gadd — low/mid octave voicings (Hz).
    const chords: number[][] = [
      [130.81, 164.81, 196.0, 246.94], // Cmaj7  C3 E3 G3 B3
      [110.0, 130.81, 164.81, 196.0], // Am7    A2 C3 E3 G3
      [174.61, 220.0, 261.63, 329.63], // Fmaj7  F3 A3 C4 E4
      [196.0, 246.94, 293.66, 174.61], // Gadd   G3 B3 D4 F3
    ];
    const chordDur = 4.5; // seconds per chord

    const voices = Array.from({ length: 4 }, () => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g);
      g.connect(master);
      osc.start();
      return { osc, g };
    });

    let idx = 0;
    const playChord = (): void => {
      if (ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const chord = chords[idx % chords.length];
      voices.forEach((v, i) => {
        const f = chord[i % chord.length];
        try {
          v.g.gain.cancelScheduledValues(now);
          v.g.gain.setValueAtTime(v.g.gain.value, now);
          v.g.gain.linearRampToValueAtTime(0.02, now + 0.12); // dip
          v.osc.frequency.setValueAtTime(f, now + 0.12); // retune at the dip (no click)
          v.g.gain.linearRampToValueAtTime(0.22, now + 1.4); // swell in
          v.g.gain.linearRampToValueAtTime(0.16, now + chordDur - 0.1); // gentle decay
        } catch {
          /* ignore per-voice scheduling errors */
        }
      });
      idx += 1;
      this.mohSchedTimer = setTimeout(playChord, chordDur * 1000);
    };
    playChord();
  }

  /** Resume from a client-side hold: restore the real mic + speaker. Best-effort. */
  async stopHoldMusic(): Promise<void> {
    const wasFallback = this.mohMuteFallback;
    this.mohMuteFallback = false;
    try {
      if (wasFallback) {
        this.setMuted(false);
      } else {
        const leg = this.legs[this.mohLegIndex] ?? this.legs[this.active];
        const audio = leg?.pub?.audioTrack;
        if (audio) {
          // Prefer the original mic if still live; else capture a fresh one.
          let mic = this.mohRealMic;
          if (!mic || mic.readyState === 'ended') {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            mic = stream.getAudioTracks()[0] ?? null;
          }
          if (mic) await audio.replaceTrack(mic, true);
        }
        // Restore per-leg speaker volumes.
        this.legs.forEach((l, i) => {
          const v = this.mohSavedVolumes[i];
          if (l.el && typeof v === 'number') l.el.volume = v;
        });
      }
    } catch {
      /* best-effort */
    } finally {
      if (this.mohSchedTimer) {
        clearTimeout(this.mohSchedTimer);
        this.mohSchedTimer = null;
      }
      try {
        this.mohAudioEl?.pause();
        if (this.mohAudioEl) this.mohAudioEl.src = '';
      } catch {
        /* ignore */
      }
      this.mohAudioEl = null;
      try {
        this.mohTrack?.stop();
      } catch {
        /* ignore */
      }
      try {
        void this.mohCtx?.close();
      } catch {
        /* ignore */
      }
      this.mohTrack = null;
      this.mohCtx = null;
      this.mohRealMic = null;
      this.mohLegIndex = -1;
      this.mohSavedVolumes = [];
    }
  }

  /** Send DTMF on the active leg. */
  sendDTMF(code: number, tone: DTMFTone): void {
    const room = this.legs[this.active]?.room;
    if (room) void room.localParticipant.publishDtmf(code, tone);
  }

  isEstablished(): boolean {
    return this.established;
  }

  /** Label of the currently-active path (direct / box-relay / CF-TLS) — for quality
   *  reporting. Measurement only; does not affect switching. */
  getActivePathLabel(): string {
    return this.legs[this.active]?.label ?? 'direct';
  }

  /** The active leg's remote (PSTN) audio MediaStreamTrack — for client-side
   *  manual recording. Reflects the currently-audible leg. */
  getActiveRemoteTrack(): MediaStreamTrack | null {
    return this.legs[this.active]?.sub?.mediaStreamTrack ?? null;
  }

  /** Label of the path that carried the MOST call time (time-weighted) — the
   *  honest "which link was used", vs getActivePathLabel()'s FINAL path. Flushes
   *  the current segment before comparing. Measurement only. */
  getDominantPathLabel(): string {
    if (this.legMs.length !== this.legs.length) return this.getActivePathLabel();
    const ms = [...this.legMs];
    ms[this.active] = (ms[this.active] ?? 0) + (Date.now() - (this.activeSinceMs || Date.now()));
    let best = 0;
    for (let i = 1; i < ms.length; i++) if ((ms[i] ?? 0) > (ms[best] ?? 0)) best = i;
    return this.legs[best]?.label ?? this.getActivePathLabel();
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const leg of this.legs) {
      if (leg.el) {
        try {
          leg.el.pause();
          leg.el.srcObject = null;
          leg.el.remove();
        } catch {
          /* ignore */
        }
        leg.el = null;
      }
      if (leg.room) {
        const room = leg.room;
        leg.room = null;
        try {
          room.removeAllListeners();
          void room.disconnect();
        } catch {
          /* ignore */
        }
      }
      leg.sub = null;
      leg.pub = null;
    }
  }

  // --- Setup ---------------------------------------------------------------

  private buildLegs(tokens: MultipathLeg[], ice: IceServerLike[]): LegState[] {
    const all = ice.slice();
    // Collect every Cloudflare TURN url across the provided entries (they share
    // one credential), so we can PIN a leg to a single transport regardless of
    // whether the backend returns CF as one multi-url entry or several.
    const cfUrls: string[] = [];
    let cfUser: string | undefined;
    let cfCred: string | undefined;
    for (const s of ice) {
      for (const u of urlList(s.urls)) {
        if (/cloudflare/i.test(u)) {
          cfUrls.push(u);
          cfUser = s.username;
          cfCred = s.credential;
        }
      }
    }
    const pin = (pred: (u: string) => boolean): IceServerLike[] | null => {
      const urls = cfUrls.filter(pred);
      return urls.length ? [{ urls, username: cfUser, credential: cfCred }] : null;
    };
    // CF-TLS is the last-resort firewall-bypass leg (Cloudflare TURN/TLS on :443).
    // If that transport isn't present, fall back to the full provided list on a
    // relay policy — still a distinct forced-relay path.
    const cfTls = pin((u) => /^turns:/i.test(u)) ?? all;
    // Box coturn (Singapore) entries — same-region relay with EXPLICIT REST creds
    // (turn:3478 udp/tcp + turns:5349 tls), served from /livekit/dial. These are
    // reachable on the real ports (unlike LiveKit's built-in TURN, which advertised
    // an unreachable :443). Falls back to server-advertised ICE ([]) if the backend
    // didn't send them (old build / no shared secret).
    const boxIce = ice.filter((s) => urlList(s.urls).some((u) => /rtc\.nuxcall\.com/i.test(u)));
    // Leg plan (index = switch priority: direct > box-relay > CF-TLS):
    //   leg0 direct    — host/srflx straight to the SFU (post-Singapore ~31ms).
    //   leg1 box-relay — pinned to the box coturn + relay policy. Reaches it over
    //     UDP 3478 (fast) or, on UDP-blocked networks, TCP 3478 / TLS 5349 — a ~31ms
    //     relay instead of Cloudflare's ~291-469ms. Falls back to server-advertised
    //     ([]) → Cloudflare if the box creds are absent.
    //   leg2 CF-TLS    — Cloudflare TURN/TLS :443, last resort for the strictest
    //     firewalls (443-only, where even the box's 3478/5349 are blocked).
    const plan: Array<{ label: string; mode: LegMode; ice: IceServerLike[] }> = [
      { label: 'direct', mode: 'direct', ice: all },
      { label: 'box-relay', mode: 'relay', ice: boxIce.length ? boxIce : [] },
      { label: 'CF-TLS', mode: 'relay', ice: cfTls },
    ];
    return tokens.slice(0, plan.length).map(
      (tok, i): LegState => ({
        index: i,
        label: plan[i].label,
        mode: plan[i].mode,
        ice: plan[i].ice,
        token: tok.token,
        room: null,
        pub: null,
        sub: null,
        el: null,
        ready: false,
        reconnecting: false,
        pathAlive: true,
        hasPhone: false,
        pstnHere: false,
        terminated: false,
        health: null,
        last: null,
        up: null,
        rtt: null,
        jitter: 0,
        badUntil: 0,
        qbadSince: 0,
        goodSince: 0,
        rawBadSince: 0,
      })
    );
  }

  private async connectLeg(leg: LegState): Promise<void> {
    const token = leg.token;
    if (!token) return;
    // Apply the RingCentral-matched Opus voice profile (mono + FEC) to this
    // leg's audio (idempotent; the engine also enables it on connect). See
    // ./opus-rc-profile.
    installOpusRcProfile();
    setOpusRcProfileEnabled(true);
    const room = new Room({
      reconnectPolicy: PK_FAST_RECONNECT,
      // red: keep RED redundancy (forced red-first via red-audio-preference);
      // dtx: OFF for continuous telephony speech.
      publishDefaults: { red: true, dtx: false },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // mono — telephony; avoids the stereo path that suppresses RED
      },
    });
    leg.room = room;

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio || !isPstnLeg(participant.identity)) return;
        leg.sub = track;
        leg.hasPhone = true;
        leg.pstnHere = true;
        this.pstnEverSeen = true;
        // Fresh receiver → reset the delta baseline, else the new track's near-zero
        // cumulative counters vs the old track's large ones score it as ~100% bad.
        leg.last = null;
        try {
          track.setPlayoutDelay(JB_TARGET_MS / 1000);
        } catch {
          /* optional */
        }
        // Drop any prior element on this leg before attaching a fresh one.
        if (leg.el) {
          try {
            leg.el.pause();
            leg.el.srcObject = null;
            leg.el.remove();
          } catch {
            /* ignore */
          }
        }
        const el = track.attach();
        el.autoplay = true;
        el.volume = this.legs[this.active] === leg ? 1 : 0;
        document.body.appendChild(el);
        leg.el = el;
        // Answered ONLY when the PSTN leg reports active — not on ringback/early
        // media (mirrors the single-leg engine's maybeEstablish).
        this.maybeEstablish(participant);
      }
    );

    room.on(RoomEvent.TrackUnsubscribed, (_t, _pub, participant: RemoteParticipant) => {
      if (!isPstnLeg(participant.identity)) return;
      // This leg's caller audio is gone. Drop the stale track and mark the leg
      // bad so the switcher moves off it — otherwise scoreLeg keeps the last
      // (good) health and the user hears silence on the active leg while a
      // healthy standby has the audio.
      leg.hasPhone = false;
      leg.sub = null;
      leg.health = 1;
      // Backdate the fast-escape clock so the NEXT tick switches away (~400ms)
      // rather than waiting a full second of silence on the active leg.
      leg.rawBadSince = leg.rawBadSince || Date.now() - FAST_ESCAPE_MS;
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (isPstnLeg(participant.identity)) {
        leg.hasPhone = false;
        leg.pstnHere = false;
        leg.sub = null;
        leg.health = 1;
        if (!this.established) {
          console.log(
            `[LK-DIAL] PSTN participant left before answer (leg ${leg.label}) — ring ended: no-answer/rejected`
          );
        }
      }
    });

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (isPstnLeg(participant.identity)) {
        leg.pstnHere = true;
        this.pstnEverSeen = true;
      }
      this.maybeEstablish(participant);
    });

    room.on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
      this.maybeEstablish(participant as RemoteParticipant);
    });

    // Terminal disconnect — LiveKit gave up reconnecting this leg. If EVERY leg
    // reaches this, the call is over even if no per-track signaling arrived
    // (abrupt client network loss), so the tick can end it instead of hanging
    // "established" forever. (destroy() removes listeners before disconnecting,
    // so our own teardown won't trip this.)
    room.on(RoomEvent.Disconnected, () => {
      leg.terminated = true;
      leg.reconnecting = true;
      leg.pathAlive = false;
    });

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === 'connected') {
        leg.ready = true;
        leg.reconnecting = false;
        leg.pathAlive = true;
        leg.terminated = false;
      } else if (state === 'reconnecting' || state === 'disconnected') {
        leg.reconnecting = true;
        leg.pathAlive = false;
        // INSTANT lane: if the ACTIVE leg's transport drops, switch now.
        if (this.timer && this.legs[this.active] === leg && !this.paused && !this.heldPause) {
          try {
            this.decide();
          } catch {
            /* ignore */
          }
        }
      }
    });

    // Empty leg.ice = use the ICE servers the SERVER advertised in the join
    // response (which include the SFU's built-in TURN). The SDK adopts server
    // iceServers ONLY when the client leaves them unset (livekit-client 2.21
    // applies serverResponse.iceServers when !rtcConfig.iceServers). With
    // iceTransportPolicy 'relay' this pins the leg to a relay served by the near
    // box TURN rather than distant Cloudflare.
    const rtcConfig: RTCConfiguration = leg.ice.length
      ? { iceServers: leg.ice as RTCIceServer[] }
      : {};
    if (leg.mode === 'relay') rtcConfig.iceTransportPolicy = 'relay';
    await room.connect(this.url, token, { rtcConfig, ...PK_CONNECT_OPTIONS });
    // The call may have ended while this (possibly background) leg was connecting —
    // don't leave a ghost participant in a torn-down room.
    if (this.destroyed) {
      try {
        void room.disconnect();
      } catch {
        /* ignore */
      }
      leg.room = null;
      return;
    }
    // Publish a PRE-MUTED mic track so there is never an unmuted-mic window — a
    // standby leg (or a muted call) must never leak a second uplink to the PSTN.
    // connect() unmutes the ONE chosen active leg afterward.
    const track = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    await track.mute();
    if (this.destroyed) {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
      try {
        void room.disconnect();
      } catch {
        /* ignore */
      }
      leg.room = null;
      return;
    }
    leg.pub = await room.localParticipant.publishTrack(track, { red: true, dtx: false });
    leg.ready = true;
    // A PSTN leg that appeared before this leg finished connecting won't fire
    // ParticipantConnected (pre-existing) or ParticipantAttributesChanged (only
    // future changes), so sweep current participants to (a) mark the PSTN present
    // so a later hangup can end the call, and (b) catch an already-active answer
    // (idempotent; maybeEstablish no-ops on non-PSTN / not-yet-active).
    room.remoteParticipants.forEach((p) => {
      if (isPstnLeg(p.identity)) {
        leg.pstnHere = true;
        this.pstnEverSeen = true;
      }
      this.maybeEstablish(p);
    });
    this.attachIceDiag(leg);
  }

  /** TEMP dev-only diagnostic (compiled OUT of prod): logs each leg's relay
   *  candidates + any TURN allocation error, so we can see WHY the box relay isn't
   *  gathered (e.g. box TURN 401 Unauthorized). Remove once box-relay is fixed. */
  private attachIceDiag(leg: LegState): void {
    // Gated on the app's debug flag (?debug=1 / localStorage nuxcall_debug=1) — the
    // same flag that un-silences the console — so it's silent for normal users but
    // active for any browser that opts in, even on prod. TEMP: remove with the flag.
    if (!isClientDebugEnabled()) return;
    const pc = this.pcOf(leg, 'publisher');
    console.log(
      `[LK-DIAG] ${leg.label}: mode=${leg.mode} ice=${leg.ice.length ? 'client-provided' : 'server-advertised'} pc=${pc ? 'ok' : 'MISSING'}`
    );
    if (!pc) return;
    pc.addEventListener('icecandidateerror', (e) => {
      console.log(
        `[LK-DIAG] ${leg.label} ICE-ERROR url=${e.url} code=${e.errorCode} "${e.errorText}"`
      );
    });
    pc.addEventListener('icecandidate', (e) => {
      const c = e.candidate;
      if (c && c.type === 'relay') {
        console.log(
          `[LK-DIAG] ${leg.label} RELAY ${c.address}:${c.port} via ${(c as unknown as { url?: string }).url ?? '?'}`
        );
      }
    });
  }

  /**
   * Mark the call answered ONLY when a PSTN leg reports `sip.callStatus=active` —
   * never on ringback / early media (which can publish audio before the callee
   * picks up). Mirrors the single-leg engine's maybeEstablish so both engines
   * agree on "answered". Idempotent.
   */
  private maybeEstablish(participant: RemoteParticipant): void {
    if (this.established) return;
    if (!isPstnLeg(participant.identity)) return;
    if (participant.attributes?.['sip.callStatus'] !== 'active') return;
    this.established = true;
    this.cb.onRemoteJoined?.();
  }

  /**
   * Pause/resume switching for hold. While held there is no media by design (the
   * caller hears music-on-hold), so the loss/concealment signal is meaningless —
   * freezing the switcher stops it from reading hold-silence as a dead link and
   * bouncing across legs. Called on the hold REQUEST (before the server confirms),
   * so the media-stop round-trip window is covered too.
   */
  setHeld(held: boolean): void {
    if (!held) {
      // Resuming — wipe each leg's loss clocks + delta baseline so neither a
      // pre-hold degradation nor the media-less hold window makes the switcher
      // fast-escape the instant the call comes back. Done BEFORE unpausing (and
      // while scoring is still frozen), so the next tick re-learns from scratch.
      for (const leg of this.legs) {
        leg.rawBadSince = 0;
        leg.qbadSince = 0;
        leg.goodSince = 0;
        leg.health = null;
        leg.last = null;
      }
    }
    this.heldPause = held;
  }

  // --- Scoring + decision (per tick) ---------------------------------------

  private async tick(): Promise<void> {
    await Promise.all(this.legs.map((leg) => this.scoreLeg(leg)));
    // The call is over when the PSTN leg is gone from EVERY path, OR when every
    // leg's transport is terminally disconnected (abrupt client network loss,
    // where no TrackUnsubscribed/ParticipantDisconnected ever arrives so hasPhone
    // stays stale-true). The latter mirrors the single-leg RoomEvent.Disconnected
    // guard so a dropped call can't hang "established" forever.
    const trackUp = this.legs.some((l) => l.hasPhone); // PSTN media flowing (early media or answered)
    const pstnPresent = this.legs.some((l) => l.pstnHere); // PSTN participant present (ringing counts)
    const allDead = this.legs.every((l) => l.terminated);
    if (pstnPresent && !allDead) {
      this.phoneGoneTicks = 0;
      // Score/switch/emit only while media actually flows — a ringing-but-silent
      // participant (no early media yet) has nothing to score. Also skip while
      // held (no media by design; scoring/emitting on it is meaningless).
      if (trackUp && !this.paused && !this.heldPause) {
        this.decide();
        this.adaptBitrate();
        this.adaptJitterBuffer();
        this.emitActiveStats();
      }
    } else if ((this.established || this.pstnEverSeen) && !this.paused) {
      // End the call once the PSTN participant is gone from EVERY leg. This now
      // fires even if the call was NEVER answered (`pstnEverSeen`): a callee who
      // rings then rejects / doesn't answer makes the PSTN leg leave DURING
      // ringing — before `established` — and the old `established`-only guard left
      // the UI hung on "dialing" until the 45s watchdog (callee saw only a missed
      // call). The >=3 tick (~1.2s) grace still absorbs a transient simultaneous
      // reconnect blip. (allDead — abrupt client network loss — also lands here.)
      this.phoneGoneTicks += 1;
      if (this.phoneGoneTicks >= 3) {
        this.paused = true;
        if (!this.established) {
          console.log(
            '[LK-DIAL] ring ended with no answer — ending call (was stuck until watchdog before fix)'
          );
        }
        this.cb.onRemoteLeft?.();
      }
    }
  }

  private async scoreLeg(leg: LegState): Promise<void> {
    if (!leg.sub) return;
    // On hold there is no media by design — don't score it (which would otherwise
    // accumulate "dead audio" and fast-escape the instant the call resumes).
    if (this.heldPause) return;
    const now = Date.now();
    // Optional candidate-pair liveness/RTT via private internals (best-effort).
    // Track liveness in BOTH directions so a transient "dead" blip under packet
    // loss recovers next tick (else a healthy leg is excluded from pickBest
    // forever). When the private read is unavailable (null), leave pathAlive to
    // the authoritative public ConnectionStateChanged signal.
    const live = await this.readTransport(leg);
    if (live.rtt != null) leg.rtt = live.rtt;
    if (live.alive !== null && !leg.reconnecting) leg.pathAlive = live.alive;

    try {
      const rep = await leg.sub.getRTCStatsReport();
      let conceal = 0;
      let total = 0;
      let recv = 0;
      let have = false;
      let jitterMs = 0;
      rep?.forEach((r: unknown) => {
        const s = r as {
          type?: string;
          concealedSamples?: number;
          totalSamplesReceived?: number;
          packetsReceived?: number;
          jitter?: number;
        };
        if (s.type === 'inbound-rtp') {
          conceal += s.concealedSamples ?? 0;
          total += s.totalSamplesReceived ?? 0;
          recv += s.packetsReceived ?? 0;
          jitterMs = (s.jitter ?? 0) * 1000;
          have = true;
        }
      });
      leg.jitter = jitterMs;

      if (!have) {
        if (leg.pathAlive === false) {
          leg.health = 1;
          leg.rawBadSince = leg.rawBadSince || now;
          leg.badUntil = now + COOLDOWN_MS;
        }
        return;
      }

      let ratio = 0;
      if (leg.last) {
        const dc = conceal - leg.last.conceal;
        const dt = total - leg.last.total;
        const dr = recv - leg.last.recv;
        if (dt > 0) ratio = Math.min(1, dc / dt);
        else if (dr <= 0) {
          // No new samples AND no new packets this tick. Ambiguous: either the
          // media is intentionally silent (hold, or the far end just isn't
          // talking) OR the transport died. Only score it as dead audio when the
          // TRANSPORT also looks unhealthy — a silent-but-healthy link must NOT be
          // read as 100% loss and trigger a needless switch. This is the "internet
          // AND audio both dropped" rule, not audio alone.
          ratio = leg.pathAlive === false || leg.reconnecting ? 1 : 0;
        }
      }
      // Uplink loss (public: remote-inbound-rtp fractionLost on our mic sender).
      leg.up = await this.readUplinkLoss(leg);
      let raw = leg.up != null ? Math.max(ratio, leg.up) : ratio;
      // DEV/TEST injector (no-op unless window.__lkImpair is set) — force this leg
      // to score high loss so the switcher can be exercised deterministically.
      const imp = getImpair();
      if (imp && imp.amount > 0) {
        const target = imp.leg === 'active' ? this.active : imp.leg;
        if (leg.index === target) raw = Math.max(raw, Math.min(1, imp.amount));
      }

      leg.health = leg.health == null ? raw : 0.6 * leg.health + 0.4 * raw;
      if (leg.health >= QBAD) {
        leg.qbadSince = leg.qbadSince || now;
        leg.goodSince = 0;
        leg.badUntil = now + COOLDOWN_MS;
      } else {
        leg.qbadSince = 0;
        if (leg.health < GOOD) leg.goodSince = leg.goodSince || now;
        else leg.goodSince = 0;
      }
      leg.rawBadSince = raw >= CATASTROPHIC ? leg.rawBadSince || now : 0;
      leg.last = { conceal, total, recv };
    } catch {
      /* a stats read hiccup is not a call fault */
    }
  }

  /** Pick the best switch target: highest-priority "good enough" leg, else least-bad. */
  private pickBest(): number {
    const accept: number[] = [];
    let lowestIdx = -1;
    let lowestH = Number.POSITIVE_INFINITY;
    for (const leg of this.legs) {
      if (
        leg.index === this.active ||
        leg.health == null ||
        !leg.ready ||
        leg.pathAlive === false ||
        leg.reconnecting
      ) {
        continue;
      }
      if (leg.health < lowestH) {
        lowestH = leg.health;
        lowestIdx = leg.index;
      }
      if (leg.health < QBAD) accept.push(leg.index);
    }
    if (accept.length) return accept[0]; // lowest index = highest priority (direct>UDP>TLS)
    return lowestIdx;
  }

  private decide(): void {
    if (this.switching) return;
    const now = Date.now();
    const act = this.legs[this.active];
    const actH = act.reconnecting || act.pathAlive === false ? 1 : act.health;

    // INSTANT lane: genuine connection loss AND audio already degrading.
    if (act.reconnecting && act.health != null && act.health >= QBAD) {
      const t = this.pickBest();
      if (t >= 0 && (this.legs[t].health ?? 1) < (actH ?? 1) - MARGIN) {
        this.crossfadeTo(t, `INSTANT: ${act.label} connection lost`);
        return;
      }
    }
    if (act.health == null) return;

    // FAST-LOSS lane: transport up but ~100% concealment sustained ~1s.
    if (act.rawBadSince && now - act.rawBadSince >= FAST_ESCAPE_MS) {
      const t = this.pickBest();
      if (t >= 0 && (this.legs[t].health ?? 1) < act.health - MARGIN) {
        this.crossfadeTo(t, `FAST escape: ${act.label} audio lost`);
        return;
      }
    }

    // CALM lane: moderate degradation, anti-flap (dwell + 12s sustain).
    if (now - this.lastSwitch < DWELL_MS) return;
    if (act.health >= QBAD && act.qbadSince && now - act.qbadSince >= ESCAPE_SUSTAIN_MS) {
      const t = this.pickBest();
      if (t >= 0 && (this.legs[t].health ?? 1) < act.health - MARGIN) {
        this.crossfadeTo(t, `quality escape: ${act.label} bad >${ESCAPE_SUSTAIN_MS / 1000}s`);
        return;
      }
    }

    // Return-home: a higher-priority leg has been clean for 60s → go back.
    for (let j = 0; j < this.active; j++) {
      const leg = this.legs[j];
      if (
        leg.health != null &&
        leg.ready &&
        leg.pathAlive !== false &&
        !leg.reconnecting &&
        leg.health < GOOD &&
        leg.goodSince &&
        now - leg.goodSince >= RETURN_STABLE_MS &&
        now > leg.badUntil
      ) {
        this.crossfadeTo(j, `return home: ${leg.label} clean 60s`);
        return;
      }
    }
  }

  /** Make-before-break: unmute target mic, fade speakers, then mute the old mic. */
  private crossfadeTo(target: number, reason: string): void {
    if (this.switching || target === this.active || target < 0) return;
    this.switching = true;
    this.lastSwitch = Date.now();
    const from = this.legs[this.active];
    const to = this.legs[target];

    // Uplink make-before-break: only unmute the target if the CALL isn't muted.
    if (!this.muted && to.pub) {
      try {
        void to.pub.unmute();
      } catch {
        /* ignore */
      }
    }
    // Speaker: cut the old leg instantly (kills the choppy tail), fade the new in.
    if (from.el) from.el.volume = 0;
    const el = to.el;
    if (el) {
      el.volume = 0;
      let i = 0;
      const steps = 6;
      const iv = setInterval(() => {
        i += 1;
        if (el) el.volume = Math.min(1, i / steps);
        if (i >= steps) clearInterval(iv);
      }, 5);
    }
    // After the fade, mute the old mic and commit the switch.
    setTimeout(() => {
      if (this.destroyed) return; // torn down mid-crossfade — nothing to commit
      if (from.pub) {
        try {
          void from.pub.mute();
        } catch {
          /* ignore */
        }
      }
      // Credit the time the outgoing leg was active, then commit the switch.
      this.legMs[this.active] = (this.legMs[this.active] ?? 0) + (Date.now() - this.activeSinceMs);
      this.activeSinceMs = Date.now();
      this.active = target;
      this.switching = false;
      this.curBitrate = 0;
      this.lastBitrate = 0;
      this.curJitterMs = 0; // re-adapt the jitter buffer for the newly-active leg
      // Reconcile mute: a setMuted(true) that raced this swap muted the OLD leg,
      // so ensure the now-active mic honors the current mute state — never leave
      // a live mic to the PSTN after the user muted.
      if (to.pub) {
        try {
          void (this.muted ? to.pub.mute() : to.pub.unmute());
        } catch {
          /* ignore */
        }
      }
      this.cb.onSwitch?.(from.label, to.label, reason);
    }, 45);
  }

  private adaptBitrate(): void {
    const leg = this.legs[this.active];
    if (leg.health == null || !leg.room) return;
    const target = leg.health < 0.02 ? BR_HI : leg.health < 0.06 ? BR_MID : BR_LO;
    if (target === this.curBitrate) return;
    if (Date.now() - this.lastBitrate < 3000) return;
    const pc = this.publisherPc(leg);
    if (!pc) return;
    try {
      let applied = false;
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind === 'audio') {
          const p = sender.getParameters();
          if (!p.encodings || !p.encodings.length) p.encodings = [{}];
          p.encodings[0].maxBitrate = target;
          void sender.setParameters(p).catch(() => {});
          applied = true;
        }
      }
      if (applied) {
        this.curBitrate = target;
        this.lastBitrate = Date.now();
      }
    } catch {
      /* best-effort */
    }
  }

  /**
   * Adaptive jitter buffer on the ACTIVE leg: lower the playout floor when the path
   * is clean (low mouth-to-ear latency) and raise it when jitter/loss spikes (absorb
   * the burst without a dropout). The browser's NetEQ still adapts on top — this
   * just sets the minimum. Throttled to avoid churn. (Phase 2, point 4.)
   */
  private adaptJitterBuffer(): void {
    const leg = this.legs[this.active];
    if (!leg.sub) return;
    if (Date.now() - this.lastJitterAdapt < 2000) return;
    const h = leg.health ?? 0;
    const j = leg.jitter;
    let target = JB_MIN_MS; // clean → low latency
    if (h >= 0.08 || j >= 40)
      target = JB_MAX_MS; // jittery/lossy → absorb
    else if (h >= 0.02 || j >= 18) target = 90; // moderate
    if (target === this.curJitterMs) return;
    try {
      leg.sub.setPlayoutDelay(target / 1000);
      this.curJitterMs = target;
      this.lastJitterAdapt = Date.now();
    } catch {
      /* setPlayoutDelay is best-effort / optional */
    }
  }

  /** Build + emit a CallStats snapshot for the active leg (feeds the shared UI). */
  private emitActiveStats(): void {
    if (!this.cb.onStats) return;
    const leg = this.legs[this.active];
    if (leg.health == null) return;
    const packetLoss = Math.min(100, Math.max(0, leg.health * 100));
    const rttMs = (leg.rtt ?? 0) * 1000;
    const mosScore = calculateMOS(leg.jitter, packetLoss, rttMs);
    this.cb.onStats({
      packetsReceived: 0,
      packetsSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      jitter: leg.jitter,
      roundTripTime: rttMs,
      packetLoss,
      mosScore,
      timestamp: new Date(),
    });
  }

  // --- Private-internals helpers (feature-detected, never required) --------

  private publisherPc(leg: LegState): RTCPeerConnection | null {
    return this.pcOf(leg, 'publisher');
  }

  private pcWarned = false;

  private pcOf(leg: LegState, which: 'publisher' | 'subscriber'): RTCPeerConnection | null {
    try {
      const mgr = (leg.room as unknown as { engine?: { pcManager?: Record<string, unknown> } })
        ?.engine?.pcManager;
      if (!mgr) {
        // A connected room with no reachable pcManager means livekit-client's
        // internals changed — warn ONCE so the regression is visible rather than
        // silently degrading (adaptive bitrate + candidate-pair RTT go no-op).
        if (leg.room && !this.pcWarned) {
          this.pcWarned = true;
          console.warn(
            '[LK-MULTIPATH] engine.pcManager unavailable — adaptive bitrate + candidate-pair liveness disabled (livekit-client internals changed?). Core switching still runs on public APIs.'
          );
        }
        return null;
      }
      const t = mgr[which] as
        | { getPC?: () => RTCPeerConnection; _pc?: RTCPeerConnection }
        | undefined;
      if (!t) return null;
      return t.getPC ? t.getPC() : (t._pc ?? null);
    } catch {
      return null;
    }
  }

  private async readTransport(
    leg: LegState
  ): Promise<{ alive: boolean | null; rtt: number | null }> {
    const pc = this.pcOf(leg, 'publisher');
    if (!pc) return { alive: null, rtt: null };
    try {
      const rep = await pc.getStats();
      let alive = false;
      let rtt: number | null = null;
      rep.forEach((r: unknown) => {
        const s = r as { type?: string; state?: string; currentRoundTripTime?: number };
        if (s.type === 'candidate-pair' && s.state === 'succeeded') {
          alive = true;
          if (typeof s.currentRoundTripTime === 'number') rtt = s.currentRoundTripTime;
        }
      });
      return { alive, rtt };
    } catch {
      return { alive: null, rtt: null };
    }
  }

  private async readUplinkLoss(leg: LegState): Promise<number | null> {
    const pub = leg.pub;
    if (!pub || pub.isMuted) return null;
    const track = pub.audioTrack;
    if (!track) return null;
    try {
      const rep = await track.getRTCStatsReport();
      let loss: number | null = null;
      rep?.forEach((r: unknown) => {
        const s = r as { type?: string; fractionLost?: number };
        if (s.type === 'remote-inbound-rtp') {
          loss = Math.max(loss ?? 0, s.fractionLost ?? 0);
        }
      });
      return loss;
    } catch {
      return null;
    }
  }
}
