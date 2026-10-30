/**
 * LiveKit Manager — the LiveKit call engine (Phase 3, step 3b-1).
 *
 * A second call engine that sits BESIDE the SIP.js engine behind the shared
 * `ICallEngine` contract, so the Zustand store and all call UI drive it exactly
 * like SIP.js (see ../call/call-engine). SIP.js stays the fallback.
 *
 * SCOPE of 3b-1 (this file): the outbound call path end-to-end —
 *   dial → join per-call room → publish mic → subscribe to the PSTN leg
 *   (participant identity `phone`) → established → mute / DTMF / end —
 * with events mapped onto the existing `SipEvent`/`CallLine` model.
 *
 * DEFERRED (throw a clear, typed error until their phase lands, so nothing
 * fails silently and 3c can gate the UI by capability):
 *   - inbound answer/reject          → 3d (webhook→socket signaling)
 *   - hold / transfer / conference   → 3e (needs backend /livekit/hold,
 *     /livekit/transfer)
 *   - recording controls             → 3e
 * The 3-leg adaptive multipath switcher (the resilience layer) lands in 3b-2.
 *
 * SIP-isms in `ICallEngine` that LiveKit has no equivalent for (registration,
 * backup SIP server, re-register suppression) are stubbed here — the interface
 * is deliberately SIP-shaped so the store/UI stay unchanged.
 *
 * @module lib/livekit/livekit-manager
 */

import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type Participant,
  type RemoteTrack,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from 'livekit-client';

import { apiClient } from '@/lib/api/client';
import { LiveKitQualityMonitor } from './livekit-quality';
import {
  LiveKitMultipathSession,
  type MultipathLeg,
  PK_FAST_RECONNECT,
  PK_CONNECT_OPTIONS,
} from './livekit-multipath';
import { fetchTurnCredentials, type IceServer } from '../sip/config';
import { installOpusRcProfile, setOpusRcProfileEnabled } from './opus-rc-profile';
import { callAudioService } from '@/lib/sip/call-audio-service';
// Reused, engine-agnostic call logging (same service the SIP engine uses) — this
// is what gives LiveKit calls a callRecordId, so the post-call disposition prompt
// and frontend call history work identically to SIP (gap 3).
import { callsService } from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';
import { CallStatus, getUnansweredStatus } from '@/lib/constants/call-status';
import type { ApiResponse } from '@/lib/types/common';
import type { CallEngineCapabilities, ICallEngine } from '../call/types';
import type {
  SipEvent,
  SipEventHandler,
  SipConnectionState,
  CallLine,
  CallState,
  CallStats,
  MakeCallOptions,
  DTMFTone,
  SipCredentials,
  ServerInfo,
} from '../sip/types';

/**
 * The remote PSTN leg's participant identity differs by direction:
 *   - OUTBOUND: the backend bridge names its leg `phone`.
 *   - INBOUND:  livekit-sip names the caller `sip_<caller>` (see the server
 *     webhook's `identity.startsWith('sip_')` check).
 * Both must be recognized, or an answered INBOUND call attaches no audio (agent
 * can't hear the caller) and never tears down when the caller hangs up.
 */
const PHONE_IDENTITY = 'phone';

/** True if this participant is the remote PSTN leg (either direction). */
function isPstnLeg(identity: string | undefined): boolean {
  return (
    identity === PHONE_IDENTITY || (typeof identity === 'string' && identity.startsWith('sip_'))
  );
}

/**
 * 3b-1 handles a single concurrent LiveKit call, always on this line id. The
 * SIP engine uses lines 1..maxLines; multi-line LiveKit is a later concern.
 */
const LK_LINE_ID = 1;

/** The consult call during an attended transfer rides on this second line. */
const LK_CONSULT_LINE_ID = 2;

/**
 * After a call resumes from hold, suppress quality emits for this long. The RTP
 * inter-arrival gap across the hold period registers as a one-off jitter spike in
 * getStats (MOS drops even though packet loss is ~0), which would flash a false
 * "very poor audio quality" on the banner for a tick before it re-stabilizes.
 * ~1s of audio clears the jitter EWMA; 2s is a safe margin.
 */
const STATS_SETTLE_MS = 2_000;

/**
 * Give up an outbound call the PSTN side never answered after this long, so the
 * UI can't get stuck in `dialing` forever (gap 1). Matched to a typical PSTN
 * ring-timeout ceiling.
 */
const DIAL_TIMEOUT_MS = 45_000;

/** Shape returned by `POST /api/v1/livekit/dial` (see server livekit.controller). */
interface LiveKitDialData {
  room: string;
  from: string;
  call: { participantId: string; sipCallId: string; room: string };
  token: string;
  url: string;
  /** Multipath leg tokens (present when the backend mints them). */
  legs?: MultipathLeg[];
  /** Server flag: run this call as client-side multipath (needs legs.length > 1). */
  multipath?: boolean;
  /** Same-region box coturn ICE (Singapore) — the multipath relay leg pins these. */
  boxTurn?: IceServer[];
}

/** DTMF digit → RFC 2833 event code. */
const DTMF_CODE: Record<DTMFTone, number> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '*': 10,
  '#': 11,
};

export class LiveKitManager implements ICallEngine {
  private room: Room | null = null;
  private line: CallLine | null = null;
  private audioEl: HTMLAudioElement | null = null;
  // Cached MediaStream wrapping the active remote track for waveform visualization
  // (kept per-track so the visualizer's stream identity is stable across renders).
  private visualizerStream: MediaStream | null = null;
  private visualizerTrack: MediaStreamTrack | null = null;
  /** Room name for the active call — needed to hang up the PSTN leg (gap 2). */
  private roomName: string | null = null;
  /**
   * Stable per-tab id. Sent with inbound answers so the backend's first-answer-wins
   * claim is idempotent, and so this tab ignores its OWN answered-elsewhere broadcast
   * (only the agent's *other* devices should stop ringing).
   */
  private readonly deviceId: string =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `lk-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

  // Attended (consult) transfer: a second call to the target while the main call
  // is held. The main call stays on `line`/`roomName` (held); the consult rides
  // on these until it's completed (bridged) or cancelled.
  private consultRoom: Room | null = null;
  private consultLine: CallLine | null = null;
  private consultRoomName: string | null = null;
  private consultAudioEl: HTMLMediaElement | null = null;
  /** Guards cancelAttendedTransfer against re-entry (button + 2 room events). */
  private consultCancelling = false;
  /** No-answer watchdog for the active outbound call (gap 1). */
  private dialTimer: ReturnType<typeof setTimeout> | null = null;
  /** Live call-quality poller (started on answer, stopped on teardown). */
  private quality: LiveKitQualityMonitor | null = null;
  /** Most recent quality snapshot, served by getCallStats(). */
  private lastStats: CallStats | null = null;

  /** Per-call quality accumulator — one sample per established quality tick (hold
   *  excluded). Summarized + fire-and-forget POSTed at teardown, then reset. Pure
   *  measurement: never awaited, never touches call control. */
  private qMos: number[] = [];
  private qLoss: number[] = [];
  private qJitter: number[] = [];
  private qRtt: number[] = [];
  private qSwitches = 0;
  private qStartedAt = 0;
  /** Per-call switch timeline: {t,from,to} (t = seconds into the call). Answers
   *  "when did the link change". Capped so a flapping call can't grow unbounded. */
  private qSwitchLog: Array<{ t: number; from: string; to: string }> = [];

  /** True from the instant a hold request is sent until it resolves or is undone.
   *  Suppresses quality scoring during the request round-trip: the server stops
   *  media the moment it runs uuid_hold, so without this the round-trip window
   *  would read 100% loss while the line still shows 'established' → a poor-
   *  connection banner flash. Kept separate from the confirm-first 'held' state. */
  private holdPending = false;

  /** True only while a hold/unhold request is actually in flight (NOT the whole
   *  held duration). Drops rapid re-clicks so overlapping hold/unhold requests
   *  can't race at FreeSWITCH (uuid_hold vs uuid_hold off) and drop the channel —
   *  which was ending the call under a hold-button stress test. */
  private holdBusy = false;

  /** Mute state captured at hold time, so unhold doesn't un-mute a call the agent
   *  had muted before holding. */
  private mutedBeforeHold = false;

  /** Until this timestamp, suppress quality emits after a resume (see STATS_SETTLE_MS).
   *  The RTP gap across hold shows up as a one-off jitter spike that would flash a
   *  false "very poor audio" — covers single-leg AND multipath (both emit here). */
  private statsSettleUntil = 0;

  /** Extra PSTN parties added to the current call (FreeSWITCH mixes them into a
   *  conference; the mix arrives on our existing `phone` track). UI state only —
   *  the agent stays on one track. Cleared on teardown. */
  private conferenceParties: string[] = [];

  /** Active multipath session (when the server flags a call as multipath). */
  private multipath: LiveKitMultipathSession | null = null;

  private readonly eventHandlers = new Set<SipEventHandler>();
  private connState: SipConnectionState = 'disconnected';
  private ready = false;
  private intentDisconnected = false;

  // DND / blocked / own-number checkers (set by the phone layout — same as SIP).
  private dndChecker: (() => boolean) | null = null;
  private blockedChecker: ((n: string) => boolean) | null = null;
  private ownNumberChecker: ((n: string) => boolean) | null = null;

  // --- Getters -------------------------------------------------------------

  get connectionState(): SipConnectionState {
    return this.connState;
  }

  /** LiveKit has no SIP registration; "registered" == engine is ready to dial. */
  get isRegistered(): boolean {
    return this.ready;
  }

  get activeLines(): CallLine[] {
    return [this.line, this.consultLine].filter((l): l is CallLine => l !== null);
  }

  get audioDevices(): MediaDeviceInfo[] {
    return [];
  }

  get selectedInputDeviceId(): string | null {
    return null;
  }

  get selectedOutputDeviceId(): string | null {
    return null;
  }

  get isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /** No SIP failover server concept in LiveKit. */
  get currentServer(): ServerInfo | null {
    return null;
  }

  /**
   * 3b-1 single-leg engine: dial/hangup/mute/DTMF work; hold/transfer/conference/
   * recording arrive in 3e. Kept false so the UI DISABLES those controls rather
   * than letting the deferred methods throw in the agent's face.
   */
  get capabilities(): CallEngineCapabilities {
    return {
      hold: true, // FreeSWITCH uuid_hold via /livekit/hold (3e)
      transfer: true, // blind transfer via /livekit/transfer (3e)
      attendedTransfer: true, // consult transfer via /livekit/consult + FreeSWITCH bridge (3e)
      conference: true, // add PSTN party into the same room → SFU-mixed instant conference
      instantConference: true, // add-call forms the conference directly (no hold/merge step)
      recording: true, // client-side manual recording (mic + remote → MediaRecorder → download)
    };
  }

  // --- Events --------------------------------------------------------------

  on(handler: SipEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: SipEvent): void {
    this.eventHandlers.forEach((h) => {
      try {
        h(event);
      } catch (err) {
        console.error('[LiveKit] event handler error', err);
      }
    });
  }

  private setConnState(state: SipConnectionState): void {
    if (this.connState === state) return;
    this.connState = state;
    this.emit({ type: 'connectionStateChanged', state });
  }

  private setLineState(state: CallState, extra?: Partial<CallLine>): void {
    if (!this.line) return;
    this.line = { ...this.line, ...extra, state };
    this.emit({ type: 'callStateChanged', lineId: this.line.id, state });
  }

  // --- Connection lifecycle ------------------------------------------------

  hasActiveCalls(): boolean {
    return this.line !== null;
  }

  getRemoteAudioStream(_lineId: number): MediaStream | null {
    // Multipath: wrap the active leg's remote track (cached per-track so it only
    // re-attaches on a real leg switch). Single-leg: the remote stream is on audioEl.
    if (this.multipath) {
      const track = this.multipath.getActiveRemoteTrack();
      if (!track) return null;
      if (this.visualizerTrack !== track || !this.visualizerStream) {
        this.visualizerTrack = track;
        this.visualizerStream = new MediaStream([track]);
      }
      return this.visualizerStream;
    }
    return (this.audioEl?.srcObject as MediaStream | null) ?? null;
  }

  /**
   * Mark the engine ready. LiveKit dials a fresh room per call (in makeCall),
   * so there's no persistent registration to establish here — `connect` just
   * flips readiness so the UI shows "ready". The `credentials` arg (SIP-shaped)
   * is ignored; LiveKit config/token is resolved server-side per call.
   */
  async connect(_credentials: SipCredentials, _preserveActiveCalls = false): Promise<void> {
    this.intentDisconnected = false;
    // Apply the RingCentral-matched Opus voice profile (mono + FEC, DTX off,
    // wideband, capped bitrate) to this engine's audio. Mono removes the
    // wasteful stereo negotiation; opus stays primary (RED left as a fallback,
    // not forced). See ./opus-rc-profile for the rationale.
    installOpusRcProfile();
    setOpusRcProfileEnabled(true);
    this.setConnState('connecting');
    this.ready = true;
    this.setConnState('registered');
    this.emit({ type: 'registrationStateChanged', isRegistered: true });
  }

  markIntentDisconnected(): void {
    this.intentDisconnected = true;
  }

  async disconnect(): Promise<void> {
    this.intentDisconnected = true;
    await this.teardownCall('disconnect');
    this.ready = false;
    this.setConnState('disconnected');
    this.emit({ type: 'registrationStateChanged', isRegistered: false });
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    this.eventHandlers.clear();
  }

  // --- Outbound call -------------------------------------------------------

  /**
   * Place an outbound PSTN call. The backend (`/livekit/dial`) mints the
   * agent's join token AND places the bridge call; we then join the returned
   * room and publish the mic. The call becomes `established` when the PSTN leg
   * (identity `phone`) publishes audio into the room.
   */
  async makeCall(number: string, _options: MakeCallOptions = {}): Promise<number> {
    if (this.line) {
      throw new Error('LiveKit engine supports one call at a time (3b-1)');
    }

    // Optimistic line so the UI shows dialing immediately.
    this.line = {
      id: LK_LINE_ID,
      state: 'dialing',
      direction: 'outbound',
      remoteNumber: number,
      startTime: new Date(),
      duration: 0,
      isMuted: false,
      isHeld: false,
      wasAnswered: false,
    };
    this.emit({ type: 'callStateChanged', lineId: LK_LINE_ID, state: 'dialing' });

    let dial: LiveKitDialData;
    try {
      // apiClient throws on non-2xx (backend error / disabled overlay), so a
      // resolved response is always the success envelope.
      const res = await apiClient.post<ApiResponse<LiveKitDialData>>('/livekit/dial', {
        to: number,
      });
      if (!res?.data) {
        throw new Error('dial failed');
      }
      dial = res.data;
    } catch (err) {
      this.teardownCall('dial-failed');
      this.emit({ type: 'mediaError', error: err instanceof Error ? err.message : 'dial failed' });
      throw err;
    }

    this.roomName = dial.room;
    if (this.line) this.line = { ...this.line, sipCallId: dial.call.sipCallId };
    // Log the placed call so it gets a callRecordId — this is what makes the
    // post-call disposition prompt and frontend call history fire for LiveKit
    // calls exactly like SIP (gap 3). Best-effort; never blocks the call.
    void this.logCallStart(number);

    // MULTIPATH path: when the server flags it and minted >1 legs, run the
    // adaptive multi-leg session instead of a single Room. Single-leg (below)
    // stays the untouched default when the flag is off.
    if (dial.multipath && dial.legs && dial.legs.length > 1) {
      const ice = await fetchTurnCredentials().catch(() => [] as IceServer[]);
      // Phase 1 fast-connect: for LiveKit, keep ONLY the near box coturn (FIRST —
      // lowest latency, probed first) + Cloudflare (firewall-bypass fallback). Drop
      // the Kamailio coturn (turn.nuxcall.com — a detour for a Singapore-homed SFU)
      // and any Twilio, so ICE gathers across 2 relays instead of ~5 → faster
      // first-audio. Box coturn comes from /livekit/dial (dial.boxTurn).
      const cloudflare = ice.filter((s) => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
        return urls.some((u) => /cloudflare/i.test(u));
      });
      const allIce = [...(dial.boxTurn ?? []), ...cloudflare];
      const session = this.makeMultipathSession(dial.legs, dial.url, allIce);
      this.multipath = session;
      try {
        await session.connect();
      } catch (err) {
        this.teardownCall('connect-failed');
        this.emit({
          type: 'mediaError',
          error: err instanceof Error ? err.message : 'multipath connect failed',
        });
        throw err;
      }
      // If the PSTN answered during connect() (onRemoteJoined already fired),
      // don't arm a stray no-answer watchdog on an established call.
      if (!this.line?.wasAnswered) {
        this.dialTimer = setTimeout(() => this.onDialTimeout(), DIAL_TIMEOUT_MS);
      }
      return LK_LINE_ID;
    }

    const room = new Room({
      reconnectPolicy: PK_FAST_RECONNECT,
      // red: keep RED redundancy (preference forced red-first via
      // red-audio-preference); dtx: OFF for continuous telephony speech.
      publishDefaults: { red: true, dtx: false },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // mono — telephony audio; avoids the stereo path that suppresses RED
      },
    });
    this.room = room;
    this.wireRoomEvents(room);

    try {
      await room.connect(dial.url, dial.token, { ...PK_CONNECT_OPTIONS });
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      this.teardownCall('connect-failed');
      this.emit({
        type: 'mediaError',
        error: err instanceof Error ? err.message : 'room connect failed',
      });
      throw err;
    }

    // The bridge call is placed server-side (in /livekit/dial) BEFORE we join, so
    // the PSTN leg may already be present — even already answered — by the time
    // room.connect() resolves. ParticipantConnected does NOT fire for a
    // pre-existing participant, and ParticipantAttributesChanged only fires on
    // FUTURE changes, so a fast answer set before we subscribed would be missed
    // and the UI would hang on "dialing". Sweep the current participants so an
    // already-active PSTN leg is established immediately (idempotent).
    room.remoteParticipants.forEach((p) => {
      if (isPstnLeg(p.identity)) this.maybeEstablish(p);
    });

    // No-answer watchdog: if the PSTN leg never joins, end the call instead of
    // leaving the UI stuck in `dialing` (gap 1). Cleared on answer / teardown.
    this.dialTimer = setTimeout(() => this.onDialTimeout(), DIAL_TIMEOUT_MS);

    return LK_LINE_ID;
  }

  private wireRoomEvents(room: Room): void {
    // Attach the PSTN audio as soon as it exists so the agent hears ringback AND
    // live audio. NOTE: attaching is NOT "answered" — early media (ringback) can
    // publish audio before the callee picks up. Answered is decided by
    // sip.callStatus in maybeEstablish().
    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio || !isPstnLeg(participant.identity)) return;
        // Drop any prior element first (renegotiation/re-subscribe) so we never leak
        // a detached, still-playing <audio> node.
        if (this.audioEl) {
          try {
            this.audioEl.pause();
            this.audioEl.srcObject = null;
            this.audioEl.remove();
          } catch {
            /* ignore */
          }
        }
        const el = track.attach();
        el.autoplay = true;
        document.body.appendChild(el);
        this.audioEl = el;
        this.maybeEstablish(participant); // in case it's already active
      }
    );

    // The reliable "answered" signal: livekit-sip flips the PSTN participant's
    // `sip.callStatus` attribute to 'active' when the callee actually picks up.
    room.on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
      if (isPstnLeg(participant.identity)) this.maybeEstablish(participant);
    });

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (isPstnLeg(participant.identity)) {
        console.log(
          '[LK-DIAL] PSTN participant connected, callStatus=',
          participant.attributes?.['sip.callStatus']
        );
        this.maybeEstablish(participant);
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (isPstnLeg(participant.identity)) {
        // The PSTN party left (hung up, or the call failed/was rejected).
        console.log(
          `[LK-DIAL] PSTN participant left → teardown (answered=${this.line?.wasAnswered ?? false})`
        );
        this.teardownCall('remote-hangup');
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      this.teardownCall('room-disconnected');
    });

    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      // Surface hard failures; transient 'reconnecting' is handled by LiveKit
      // (and, in 3b-2, by the multipath switcher).
      if (state === ConnectionState.Disconnected && this.line) {
        this.teardownCall('connection-lost');
      }
    });
  }

  /**
   * Mark the call established ONLY when the PSTN leg reports answered
   * (`sip.callStatus === 'active'`). Using this instead of track-subscribe avoids
   * a false "answered" on early-media ringback. Idempotent.
   */
  private maybeEstablish(participant: Participant): void {
    if (!this.line || this.line.wasAnswered) return;
    if (participant.attributes?.['sip.callStatus'] !== 'active') return;
    console.log('[LK-DIAL] established — callee answered');
    this.clearDialTimer();
    this.setLineState('established', { answerTime: new Date(), wasAnswered: true });
    this.startQualityMonitor();
    void this.logCallAnswer();
  }

  /**
   * Begin polling live call quality once the call is answered, emitting the same
   * `callStatsUpdate` events the SIP engine does so the MOS pill / signal bars /
   * poor-connection banner work identically on LiveKit calls. Idempotent.
   */
  private startQualityMonitor(): void {
    if (!this.room || !this.line || this.quality) return;
    const lineId = this.line.id;
    this.quality = new LiveKitQualityMonitor(this.room, (stats) => this.reportStats(stats));
    this.quality.start();
  }

  /**
   * Surface a quality snapshot to the UI — but SUPPRESS it while the call is on
   * hold. During hold there is intentionally no media flowing (the caller hears
   * music-on-hold from FreeSWITCH), so the "100% packet loss / MOS 1" reading is
   * expected, NOT a bad network — emitting it would wrongly trip the "poor
   * connection, check your internet" banner. Mirrors the SIP engine, which only
   * scores quality while established. getCallStats still serves the raw snapshot.
   */
  private reportStats(stats: CallStats): void {
    this.lastStats = stats;
    const state = this.line?.state;
    if (this.holdPending || state === 'held' || state === 'holding') return;
    // Post-resume settle: swallow the jitter-spike tick(s) right after unhold.
    if (Date.now() < this.statsSettleUntil) return;
    // Accumulate ONLY for the answered/established call — not while ringing or
    // connecting (multipath emits stats as soon as its legs connect, before the
    // PSTN answers), so pre-answer ticks don't pollute the call's MOS. Hold/settle
    // are already excluded above. Cost: a few array pushes.
    if (state === 'established') {
      if (this.qStartedAt === 0) this.qStartedAt = Date.now();
      this.qMos.push(stats.mosScore);
      this.qLoss.push(stats.packetLoss);
      this.qJitter.push(stats.jitter);
      this.qRtt.push(stats.roundTripTime);
    }
    this.emit({ type: 'callStatsUpdate', lineId: LK_LINE_ID, stats });
  }

  /**
   * Build a multipath session wired to this manager's line/event model. The
   * session owns the N legs + the switcher and reports up: quality each tick
   * (→ callStatsUpdate, same as single-leg), answered on first PSTN audio, and
   * ended when the PSTN leg leaves every path. In multipath mode the session is
   * also the stats source, so no separate LiveKitQualityMonitor runs.
   */
  private makeMultipathSession(
    legs: MultipathLeg[],
    url: string,
    ice: IceServer[]
  ): LiveKitMultipathSession {
    return new LiveKitMultipathSession(url, legs, ice, {
      onStats: (stats) => this.reportStats(stats),
      onRemoteJoined: () => {
        if (this.line && !this.line.wasAnswered) {
          this.clearDialTimer();
          this.setLineState('established', { answerTime: new Date(), wasAnswered: true });
          void this.logCallAnswer();
        }
      },
      onRemoteLeft: () => this.teardownCall('remote-hangup'),
      onSwitch: (from, to, why) => {
        // Only count/log switches DURING the established call (qStartedAt is set on
        // the first established stats tick). Pre-answer switches are just the legs'
        // initial ICE settling — not a mid-call link change — and would otherwise
        // inflate the count and log noise @0s, inconsistent with the MOS window.
        if (this.qStartedAt > 0) {
          this.qSwitches++;
          if (this.qSwitchLog.length < 100) {
            this.qSwitchLog.push({
              t: Math.round((Date.now() - this.qStartedAt) / 1000),
              from,
              to,
            });
          }
        }
        console.log(`[LK-MULTIPATH] ${from} -> ${to}: ${why}`);
      },
    });
  }

  /** End the current call (if any), clean up media, and emit `callEnded` once. */
  private teardownCall(reason: string): void {
    this.clearDialTimer();
    // Stop the incoming ring on any end path (caller-cancel / decline / hangup /
    // connect-fail). No-op for outbound (no ringtone was playing).
    callAudioService.stopRingtone();
    // If a manual recording is in progress when the call ends, finalize it and
    // emit the blob so the UI auto-downloads it (parity with the SIP.js engine).
    this.finalizeRecording();
    // If a consult is still in flight when the main call ends, drop the target
    // SERVER-SIDE first — teardownConsult only cleans the client, which would
    // leave the target's SIP leg orphaned (and billing) in the consult room.
    // (No-op on the completeAttendedTransfer path: it tears the consult down
    // first, so consultRoomName is already null here.)
    if (this.consultRoomName && this.roomName) {
      void apiClient
        .post('/livekit/consult/cancel', { room: this.roomName, consultRoom: this.consultRoomName })
        .catch(() => {});
    }
    this.teardownConsult(reason);
    if (this.quality) {
      this.quality.stop();
      this.quality = null;
    }
    // Winning path for the quality report — read BEFORE destroy. Time-weighted
    // (the path that carried MOST of the call), not just the final one. Single-leg
    // calls report 'single' (the multipath switcher only runs in multipath mode).
    const qTransport = this.multipath ? this.multipath.getDominantPathLabel() : 'single';
    if (this.multipath) {
      void this.multipath.destroy();
      this.multipath = null;
    }
    this.lastStats = null;
    this.holdPending = false;
    this.holdBusy = false;
    this.statsSettleUntil = 0; // don't let a resume settle-window bleed into the next call
    this.conferenceParties = [];
    const line = this.line;
    const qRoom = this.roomName;
    this.roomName = null;

    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.srcObject = null;
        this.audioEl.remove();
      } catch {
        /* ignore */
      }
      this.audioEl = null;
    }

    if (this.room) {
      const room = this.room;
      this.room = null;
      try {
        room.removeAllListeners();
        void room.disconnect();
      } catch {
        /* ignore */
      }
    }

    if (line) {
      this.line = null;
      // Log the end (talk-time + terminal status) before the line is dropped so
      // LiveKit calls close out their call record like SIP does (gap 3).
      if (line.callRecordId != null) {
        void this.logCallEnd(line, reason);
        // Fire-and-forget the quality summary (measurement only — never awaited).
        this.flushQualityReport(line.callRecordId, qRoom, qTransport);
      }
      this.emit({ type: 'callEnded', lineId: line.id, reason });
    }
    this.resetQualityAccumulator();
  }

  /**
   * Summarize the accumulated quality samples and fire-and-forget POST them for
   * offline analysis (the "LiveKit CDR"). NEVER awaited and always .catch-wrapped:
   * a metrics failure must not affect the call or the next dial. Skips silently if
   * the call never established (no samples). p10 = worst-10% MOS (the tail users
   * actually feel).
   */
  private flushQualityReport(callRecordId: number, room: string | null, transport: string): void {
    const mos = this.qMos;
    if (mos.length === 0) return;
    const avg = (a: number[]): number => a.reduce((s, x) => s + x, 0) / a.length;
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    const sorted = [...mos].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? sorted[0];
    void apiClient
      .post('/livekit/quality', {
        callRecordId,
        room: room ?? '',
        durationSec: Math.round((Date.now() - (this.qStartedAt || Date.now())) / 1000),
        samples: mos.length,
        avgMos: r2(avg(mos)),
        minMos: r2(Math.min(...mos)),
        p10Mos: r2(p10),
        avgLossPct: r2(avg(this.qLoss)),
        maxLossPct: r2(Math.max(...this.qLoss)),
        avgJitterMs: Math.round(avg(this.qJitter)),
        avgRttMs: Math.round(avg(this.qRtt)),
        transport,
        switchCount: this.qSwitches,
        switches: this.qSwitchLog,
      })
      .catch(() => {});
  }

  private resetQualityAccumulator(): void {
    this.qMos = [];
    this.qLoss = [];
    this.qJitter = [];
    this.qRtt = [];
    this.qSwitches = 0;
    this.qStartedAt = 0;
    this.qSwitchLog = [];
  }

  private clearDialTimer(): void {
    if (this.dialTimer) {
      clearTimeout(this.dialTimer);
      this.dialTimer = null;
    }
  }

  /** Watchdog fire: PSTN never answered — end the call and drop the ringing leg. */
  private onDialTimeout(): void {
    if (!this.line || this.line.wasAnswered) return;
    console.log(`[LK-DIAL] dial watchdog fired — no answer within ${DIAL_TIMEOUT_MS}ms, ending`);
    const room = this.roomName;
    this.teardownCall('no-answer');
    void this.hangupRemote(room);
  }

  /** Ask the backend to delete the room, which drops the PSTN bridge leg (gap 2). */
  private async hangupRemote(room: string | null): Promise<void> {
    if (!room) return;
    try {
      await apiClient.post('/livekit/hangup', { room });
    } catch (err) {
      console.warn('[LiveKit] hangup request failed', err);
    }
  }

  // --- Active-call controls ------------------------------------------------

  async endCall(_lineId: number): Promise<void> {
    // Capture the room BEFORE teardown clears it, then drop the PSTN leg
    // server-side after ending locally so the UI closes instantly (gap 2).
    const room = this.roomName;
    this.teardownCall('local-hangup');
    await this.hangupRemote(room);
  }

  muteCall(_lineId: number): void {
    if (!this.line) return;
    if (this.multipath) {
      this.multipath.setMuted(true);
      this.line = { ...this.line, isMuted: true };
      return;
    }
    if (!this.room) return;
    void this.room.localParticipant.setMicrophoneEnabled(false);
    this.line = { ...this.line, isMuted: true };
  }

  unmuteCall(_lineId: number): void {
    if (!this.line) return;
    if (this.multipath) {
      this.multipath.setMuted(false);
      this.line = { ...this.line, isMuted: false };
      return;
    }
    if (!this.room) return;
    void this.room.localParticipant.setMicrophoneEnabled(true);
    this.line = { ...this.line, isMuted: false };
  }

  sendDTMF(_lineId: number, tone: DTMFTone): void {
    const code = DTMF_CODE[tone];
    if (code === undefined) return;
    if (this.multipath) {
      this.multipath.sendDTMF(code, tone);
      return;
    }
    if (!this.room) return;
    void this.room.localParticipant.publishDtmf(code, tone);
  }

  getLineState(lineId: number): CallLine | undefined {
    if (this.line && this.line.id === lineId) return this.line;
    if (this.consultLine && this.consultLine.id === lineId) return this.consultLine;
    return undefined;
  }

  getAllLines(): CallLine[] {
    return [this.line, this.consultLine].filter((l): l is CallLine => l !== null);
  }

  // --- Inbound (3d) --------------------------------------------------------

  /**
   * Called by the inbound socket hook when the server signals an incoming call
   * (LIVEKIT_INCOMING). Rings via the existing IncomingCallModal by emitting an
   * `incomingCall` event; the per-call room is remembered so answer/decline act
   * on it. Single-line: if already on a call, declines the newcomer.
   */
  handleInboundRoom(room: string, caller: string): void {
    console.log(
      '[LK-INBOUND] handleInboundRoom room=',
      room,
      'caller=',
      caller,
      'existingLine=',
      this.line
    );
    if (this.line) {
      // Multi-device: this device is already on a call. Do NOT decline — decline
      // deletes the LiveKit room server-side, which kills the call for EVERY device
      // on this extension, INCLUDING a free one that could have answered (the
      // 2026-08-12 bug: a 2nd inbound to a 2-device ext dropped because the busy
      // device destroyed its room). Just ignore it locally: an idle device on the
      // same extension receives the same `livekit:incoming` and will ring + answer.
      // If EVERY device is busy, the caller rings out to the server no-answer
      // timeout (→ normal voicemail), exactly like a busy phone — never a
      // destructive instant drop.
      console.log(
        '[LK-INBOUND] busy on this device — ignoring room',
        room,
        '(a free device can answer)'
      );
      return;
    }
    this.roomName = room;
    this.line = {
      id: LK_LINE_ID,
      state: 'ringing',
      direction: 'inbound',
      remoteNumber: caller,
      startTime: new Date(),
      duration: 0,
      isMuted: false,
      isHeld: false,
      wasAnswered: false,
    };
    void this.logCallStart(caller, 'inbound');
    this.emit({
      type: 'incomingCall',
      call: { lineId: LK_LINE_ID, callerNumber: caller, timestamp: new Date() },
    });
    // Audible ring — the SIP.js/WA incoming paths call this too; the LiveKit
    // inbound path previously showed the modal silently. Stopped on answer and
    // on any teardown (caller-cancel / decline / hangup / connect-fail).
    callAudioService.playRingtone();
  }

  /** Server signaled the caller gave up before answer — clear the ringing UI. */
  handleInboundEnded(room: string): void {
    if (
      this.line &&
      this.line.direction === 'inbound' &&
      !this.line.wasAnswered &&
      this.roomName === room
    ) {
      this.teardownCall('caller-cancelled');
    }
  }

  /**
   * Multi-device: another of the agent's devices answered this inbound call, so stop
   * ringing here. IGNORED on the device that actually answered (deviceId match) so we
   * never tear down the call we just took. Only touches a still-ringing, unanswered line.
   */
  handleAnsweredElsewhere(room: string, winnerDeviceId?: string): void {
    if (winnerDeviceId && winnerDeviceId === this.deviceId) return; // it was us — keep the call
    if (
      this.line &&
      this.line.direction === 'inbound' &&
      !this.line.wasAnswered &&
      this.roomName === room
    ) {
      this.teardownCall('answered-elsewhere');
    }
  }

  async answerCall(_lineId: number): Promise<void> {
    const room = this.roomName;
    if (!this.line || this.line.direction !== 'inbound' || !room) {
      throw new Error('no inbound call to answer');
    }
    callAudioService.stopRingtone(); // agent answered — stop the incoming ring
    // Join token(s) for THIS inbound room; the backend verifies we're the callee AND
    // enforces first-answer-wins (a lost race → 409 ALREADY_ANSWERED) via our deviceId.
    let res: ApiResponse<{
      token: string;
      url: string;
      room: string;
      legs?: MultipathLeg[];
      multipath?: boolean;
    }>;
    try {
      res = await apiClient.post<
        ApiResponse<{
          token: string;
          url: string;
          room: string;
          legs?: MultipathLeg[];
          multipath?: boolean;
        }>
      >('/livekit/answer', { room, deviceId: this.deviceId });
    } catch (err) {
      // Lost the race (another device answered first → 409) or the answer otherwise
      // failed — stop ringing and reset instead of hanging on a dead ring, then surface it.
      this.teardownCall('answer-failed');
      throw err;
    }
    if (!res?.data) throw new Error('answer failed');

    // MULTIPATH answer: run the adaptive session over the minted legs. Single-leg
    // (below) is the untouched default when the flag is off.
    if (res.data.multipath && res.data.legs && res.data.legs.length > 1) {
      const ice = await fetchTurnCredentials().catch(() => [] as IceServer[]);
      const session = this.makeMultipathSession(res.data.legs, res.data.url, ice);
      this.multipath = session;
      try {
        await session.connect();
      } catch (err) {
        const declineRoom = this.roomName;
        this.teardownCall('answer-connect-failed');
        if (declineRoom) {
          void apiClient.post('/livekit/decline', { room: declineRoom }).catch(() => {
            /* best-effort */
          });
        }
        this.emit({
          type: 'mediaError',
          error: err instanceof Error ? err.message : 'multipath answer failed',
        });
        throw err;
      }
      this.setLineState('established', { answerTime: new Date(), wasAnswered: true });
      void this.logCallAnswer();
      return;
    }

    const rm = new Room({
      reconnectPolicy: PK_FAST_RECONNECT,
      // red: keep RED redundancy (preference forced red-first via
      // red-audio-preference); dtx: OFF for continuous telephony speech.
      publishDefaults: { red: true, dtx: false },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // mono — telephony audio; avoids the stereo path that suppresses RED
      },
    });
    this.room = rm;
    this.wireRoomEvents(rm);
    try {
      await rm.connect(res.data.url, res.data.token, { ...PK_CONNECT_OPTIONS });
      await rm.localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      // Joining the answered room failed — tear down so we don't strand the UI in
      // 'ringing' with a dead room, then drop the still-ringing PSTN leg.
      const declineRoom = this.roomName;
      this.teardownCall('answer-connect-failed');
      if (declineRoom) {
        void apiClient.post('/livekit/decline', { room: declineRoom }).catch(() => {
          /* best-effort */
        });
      }
      this.emit({
        type: 'mediaError',
        error: err instanceof Error ? err.message : 'answer connect failed',
      });
      throw err;
    }
    // We deliberately answered → established. The caller's audio attaches on its
    // TrackSubscribed; maybeEstablish also confirms via sip.callStatus=active.
    this.setLineState('established', { answerTime: new Date(), wasAnswered: true });
    this.startQualityMonitor();
    void this.logCallAnswer();
  }

  async rejectCall(_lineId: number): Promise<void> {
    const room = this.roomName;
    this.teardownCall('rejected');
    if (room) {
      try {
        await apiClient.post('/livekit/decline', { room });
      } catch (err) {
        console.warn('[LiveKit] decline failed', err);
      }
    }
  }

  // --- Deferred: hold / transfer / conference / recording (3e) -------------

  /**
   * Put the call on hold (caller hears music-on-hold). Hold is a FreeSWITCH media
   * op (LiveKit's SFU can't MOH a PSTN leg) — the backend resolves this room's
   * PSTN channel and runs uuid_hold. The LiveKit legs stay up; only FreeSWITCH
   * swaps the caller's audio to MOH. Works single-leg and multipath.
   */
  async holdCall(_lineId: number): Promise<void> {
    if (!this.roomName || !this.line) throw new Error('no active call to hold');
    // Re-entrancy guard: ignore rapid re-clicks while a hold/unhold is in flight,
    // and no-op if already held.
    if (this.holdBusy || this.line.state === 'held') return;
    this.holdBusy = true;
    // Gate quality the instant the request leaves so the hold transition can't flash
    // a poor-connection banner.
    this.holdPending = true;
    // CLIENT-SIDE HOLD: do NOT call FreeSWITCH `uuid_hold` — it parks the livekit-sip
    // leg, whose ~15s media watchdog then closes the SIP call (the "cuts after ~15-20s
    // on hold" bug). Instead keep the media bridge fully live and swap the agent's mic
    // for a looping tone (startHoldMusic) so the REMOTE hears MOH and media never stops.
    // Remember the mute state so unhold doesn't un-mute a pre-muted call.
    this.mutedBeforeHold = this.multipath?.isMuted() ?? false;
    this.multipath?.setHeld(true); // freeze the switcher (scoring is meaningless on hold)
    try {
      await this.multipath?.startHoldMusic();
      this.setLineState('held', { isHeld: true });
    } catch (e) {
      this.holdPending = false;
      this.multipath?.setHeld(false);
      throw e;
    } finally {
      this.holdBusy = false;
    }
  }

  async unholdCall(_lineId: number): Promise<void> {
    if (!this.roomName || !this.line) throw new Error('no active call to unhold');
    // Same guard: drop re-clicks while in flight, and no-op if not actually held.
    if (this.holdBusy || this.line.state !== 'held') return;
    this.holdBusy = true;
    try {
      await this.multipath?.stopHoldMusic(); // restore the mic + speaker (no uuid_hold)
      this.multipath?.setMuted(this.mutedBeforeHold); // don't un-mute a pre-muted call
      this.setLineState('established', { isHeld: false });
      this.holdPending = false; // media resumed — resume quality scoring
      this.statsSettleUntil = Date.now() + STATS_SETTLE_MS; // swallow the resume jitter spike
      this.multipath?.setHeld(false); // resume the switcher
    } finally {
      this.holdBusy = false;
    }
  }

  async switchCalls(): Promise<number | null> {
    return null; // single-line engine for now
  }

  /**
   * Blind-transfer the active call's PSTN party to another number. The backend
   * issues a SIP REFER and the agent leg is dropped, so we end the call locally
   * on success. Works for single-leg and multipath (acts on the shared room's
   * PSTN participant, server-side).
   */
  async transferCall(_lineId: number, target: string): Promise<void> {
    const room = this.roomName;
    if (!room || !this.line) throw new Error('no active call to transfer');
    await apiClient.post('/livekit/transfer', { room, to: normalizePhone(target) });
    this.teardownCall('transferred');
  }

  // --- Client-side manual recording (user-side): mix the agent mic + the call's
  // remote audio into one stream and record it locally with MediaRecorder. No
  // server involvement — stopRecording() returns the blob and the caller
  // downloads it, matching the SIP.js manual-record button.
  private recorder: MediaRecorder | null = null;
  private recordCtx: AudioContext | null = null;
  private recordMic: MediaStream | null = null;
  private recordChunks: Blob[] = [];

  /** Remote (PSTN) audio track of the audible leg — single-leg or multipath. */
  private recordingRemoteTrack(): MediaStreamTrack | null {
    if (this.multipath) return this.multipath.getActiveRemoteTrack();
    const ms = this.audioEl?.srcObject as MediaStream | null;
    return ms?.getAudioTracks?.()[0] ?? null;
  }

  private recordMimeType(): string {
    const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    if (typeof MediaRecorder !== 'undefined') {
      for (const t of prefs) if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return 'audio/webm';
  }

  async startRecording(_lineId: number): Promise<void> {
    if (!this.line || this.recorder) return;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordMic = mic;
      const ctx = new AudioContext();
      this.recordCtx = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(mic).connect(dest);
      const remote = this.recordingRemoteTrack();
      if (remote) ctx.createMediaStreamSource(new MediaStream([remote])).connect(dest);
      this.recordChunks = [];
      const rec = new MediaRecorder(dest.stream, { mimeType: this.recordMimeType() });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordChunks.push(e.data);
      };
      rec.start(1000);
      this.recorder = rec;
      this.line.isRecording = true;
    } catch (err) {
      this.cleanupRecording(); // don't leak the mic / AudioContext on setup failure
      throw err;
    }
  }

  async stopRecording(_lineId: number): Promise<Blob | null> {
    const rec = this.recorder;
    if (!rec) return null;
    const type = rec.mimeType || 'audio/webm';
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(this.recordChunks, { type }));
      try {
        rec.stop();
      } catch {
        resolve(new Blob(this.recordChunks, { type }));
      }
    });
    this.cleanupRecording();
    if (this.line) this.line.isRecording = false;
    return blob;
  }

  isRecording(_lineId: number): boolean {
    return !!this.recorder;
  }

  /** Tear down any in-progress recording (mic, AudioContext, recorder). Called on
   *  stop and whenever the call ends mid-recording so nothing leaks. */
  private cleanupRecording(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      /* ignore */
    }
    this.recorder = null;
    this.recordChunks = [];
    try {
      this.recordMic?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    this.recordMic = null;
    try {
      void this.recordCtx?.close();
    } catch {
      /* ignore */
    }
    this.recordCtx = null;
  }

  /** Call ended while recording: stop the recorder, build the blob, and emit
   *  `recordingStopped` so the store auto-downloads it (matches SIP.js). No-op if
   *  no recording is active (e.g. the agent already pressed Stop). Async because
   *  MediaRecorder flushes its final chunk on `onstop`. */
  private finalizeRecording(): void {
    const rec = this.recorder;
    if (!rec) return;
    this.recorder = null; // claim it so an explicit Stop can't double-handle
    const type = rec.mimeType || 'audio/webm';
    const mic = this.recordMic;
    const ctx = this.recordCtx;
    // Capture the chunks array: the final ondataavailable still pushes to this
    // same ref before onstop, and a later startRecording assigns a fresh array —
    // so onstop can't read a subsequent recording's chunks.
    const chunks = this.recordChunks;
    this.recordMic = null;
    this.recordCtx = null;
    const done = (): void => {
      const blob = new Blob(chunks, { type });
      try {
        mic?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      try {
        void ctx?.close();
      } catch {
        /* ignore */
      }
      if (this.line) this.line.isRecording = false;
      if (blob.size > 0) {
        this.emit({ type: 'recordingStopped', lineId: LK_LINE_ID, recording: blob });
      }
    };
    rec.onstop = done;
    try {
      rec.stop();
    } catch {
      done();
    }
  }

  /**
   * Start an attended transfer: the backend holds the caller and dials the target
   * into a consult room; we join it as a second line so the agent can announce.
   * Returns the consult line id. On join failure it cancels + rethrows.
   */
  async startAttendedTransfer(_lineId: number, target: string): Promise<number> {
    const room = this.roomName;
    if (!room || !this.line) throw new Error('no active call to transfer');
    if (this.consultLine) throw new Error('a consult is already in progress');
    this.consultCancelling = false; // fresh transfer — clear any stale guard

    const res = await apiClient.post<
      ApiResponse<{ consultRoom: string; token: string; url: string }>
    >('/livekit/consult', { room, to: normalizePhone(target) });
    if (!res?.data) throw new Error('consult failed');
    const { consultRoom, token, url } = res.data;

    // Backend has held the caller — reflect it on the main line and freeze the
    // switcher (the held caller sends no media; scoring it would false-switch).
    this.setLineState('held', { isHeld: true });
    this.multipath?.setHeld(true);

    this.consultRoomName = consultRoom;
    this.consultLine = {
      id: LK_CONSULT_LINE_ID,
      state: 'dialing',
      direction: 'outbound',
      remoteNumber: target,
      startTime: new Date(),
      duration: 0,
      isMuted: false,
      isHeld: false,
      wasAnswered: false,
    };
    this.emit({ type: 'callStateChanged', lineId: LK_CONSULT_LINE_ID, state: 'dialing' });

    const rm = new Room({
      reconnectPolicy: PK_FAST_RECONNECT,
      // red: keep RED redundancy (preference forced red-first via
      // red-audio-preference); dtx: OFF for continuous telephony speech.
      publishDefaults: { red: true, dtx: false },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // mono — telephony audio; avoids the stereo path that suppresses RED
      },
    });
    this.consultRoom = rm;
    this.wireConsultRoom(rm);
    try {
      await rm.connect(url, token, { ...PK_CONNECT_OPTIONS });
      await rm.localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      // Couldn't join the consult — cancel server-side (drops target, unholds caller).
      void apiClient.post('/livekit/consult/cancel', { room, consultRoom }).catch(() => {});
      this.teardownConsult('consult-connect-failed');
      this.setLineState('established', { isHeld: false });
      this.statsSettleUntil = Date.now() + STATS_SETTLE_MS;
      this.multipath?.setHeld(false);
      this.emit({
        type: 'mediaError',
        error: err instanceof Error ? err.message : 'consult connect failed',
      });
      throw err;
    }
    return LK_CONSULT_LINE_ID;
  }

  /** Complete the transfer: bridge caller↔target (agent drops out of both). */
  async completeAttendedTransfer(_consultLineId: number): Promise<void> {
    const room = this.roomName;
    const consultRoom = this.consultRoomName;
    if (!room || !consultRoom) throw new Error('no consult to complete');
    const res = await apiClient.post<ApiResponse<{ ok: boolean }>>('/livekit/consult/complete', {
      room,
      consultRoom,
    });
    if (!res?.data?.ok) throw new Error('transfer complete failed');
    // Caller and target are bridged at FreeSWITCH now; the agent leaves both.
    this.teardownConsult('transferred');
    this.teardownCall('transferred');
  }

  /** Cancel the transfer: drop the consult and go back to the (unheld) caller. */
  async cancelAttendedTransfer(_consultLineId: number): Promise<void> {
    const room = this.roomName;
    const consultRoom = this.consultRoomName;
    // Re-entrancy guard: the consult room's ParticipantDisconnected AND
    // Disconnected events AND the user's Cancel button all route here — without
    // this, one cancel fires redundant /consult/cancel calls.
    if (!room || !consultRoom || this.consultCancelling) return;
    this.consultCancelling = true;
    try {
      // Disconnect OUR consult leg cleanly and WAIT for it FIRST, so the backend's
      // room teardown never sends us a mid-flight LEAVE (which makes livekit-client
      // renegotiate on a closing peer connection — the "could not createOffer" noise).
      const rm = this.consultRoom;
      this.teardownConsult('consult-cancelled');
      if (rm) {
        try {
          await rm.disconnect();
        } catch {
          /* ignore */
        }
      }
      const res = await apiClient
        .post<ApiResponse<{ ok: boolean }>>('/livekit/consult/cancel', { room, consultRoom })
        .catch(() => null);
      // Reflect unhold only if the server actually took the caller off hold.
      if (res?.data?.ok) {
        this.setLineState('established', { isHeld: false });
        this.statsSettleUntil = Date.now() + STATS_SETTLE_MS;
        this.multipath?.setHeld(false); // resume switching now the caller is back
      }
    } finally {
      this.consultCancelling = false;
    }
  }

  getAttendedTransferState(): { originalLineId: number; consultLineId: number } | null {
    return this.consultLine
      ? { originalLineId: LK_LINE_ID, consultLineId: LK_CONSULT_LINE_ID }
      : null;
  }

  // --- Consult (attended-transfer) internals -------------------------------

  private setConsultLineState(state: CallState, extra?: Partial<CallLine>): void {
    if (!this.consultLine) return;
    this.consultLine = { ...this.consultLine, ...extra, state };
    this.emit({ type: 'callStateChanged', lineId: this.consultLine.id, state });
  }

  /** Wire the consult room: attach the target's audio + detect answer/leave. */
  private wireConsultRoom(room: Room): void {
    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio || !isPstnLeg(participant.identity)) return;
        if (this.consultAudioEl) {
          try {
            this.consultAudioEl.pause();
            this.consultAudioEl.srcObject = null;
            this.consultAudioEl.remove();
          } catch {
            /* ignore */
          }
        }
        const el = track.attach();
        el.autoplay = true;
        document.body.appendChild(el);
        this.consultAudioEl = el;
        this.maybeEstablishConsult(participant);
      }
    );
    room.on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
      this.maybeEstablishConsult(participant as RemoteParticipant);
    });
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      this.maybeEstablishConsult(participant);
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      // Target hung up the consult before completion — auto-return to the caller
      // (drop the consult server-side + unhold), so they don't sit on MOH.
      if (isPstnLeg(participant.identity)) void this.cancelAttendedTransfer(LK_CONSULT_LINE_ID);
    });
    room.on(RoomEvent.Disconnected, () => {
      // The consult connection itself dropped — same recovery: return to the caller.
      if (this.consultLine) void this.cancelAttendedTransfer(LK_CONSULT_LINE_ID);
    });
  }

  private maybeEstablishConsult(participant: RemoteParticipant): void {
    if (!this.consultLine || this.consultLine.wasAnswered) return;
    if (!isPstnLeg(participant.identity)) return;
    if (participant.attributes?.['sip.callStatus'] !== 'active') return;
    this.setConsultLineState('established', { answerTime: new Date(), wasAnswered: true });
  }

  /** Drop the consult call + line (does NOT touch the main call). */
  private teardownConsult(reason: string): void {
    if (this.consultAudioEl) {
      try {
        this.consultAudioEl.pause();
        this.consultAudioEl.srcObject = null;
        this.consultAudioEl.remove();
      } catch {
        /* ignore */
      }
      this.consultAudioEl = null;
    }
    if (this.consultRoom) {
      const rm = this.consultRoom;
      this.consultRoom = null;
      try {
        rm.removeAllListeners();
        void rm.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.consultRoomName = null;
    if (this.consultLine) {
      const id = this.consultLine.id;
      this.consultLine = null;
      this.emit({ type: 'callEnded', lineId: id, reason });
    }
  }

  /**
   * Add another PSTN party to the active call → instant conference. The backend
   * dials the party in and FreeSWITCH mixes it into the call; the mix comes back
   * over our existing `phone` track, so there's no hold/second-line/merge dance
   * and nothing changes in the client audio or multipath. Just flags
   * `isInConference` for the UI. (mergeLines/splitConference don't apply — this is
   * one mixed call, not two lines being merged/split.)
   */
  async addConferenceParty(number: string): Promise<void> {
    const room = this.roomName;
    if (!room || !this.line) throw new Error('no active call to add a party to');
    const to = normalizePhone(number);
    const res = await apiClient.post<ApiResponse<{ party: { number: string } }>>(
      '/livekit/conference/add',
      { room, to }
    );
    if (!res?.data?.party) throw new Error('failed to add party to the conference');
    this.conferenceParties = [...this.conferenceParties, to];
    // Keep the current state; flag the conference + expose the parties for the UI.
    this.setLineState(this.line.state, {
      isInConference: true,
      conferenceParties: [...this.conferenceParties],
    });
  }

  async mergeLines(_lineId1: number, _lineId2: number): Promise<void> {
    // N/A for LiveKit — its conference is instant (addConferenceParty), not a
    // merge of two separate lines. The UI never shows Merge on a single-line engine.
    throw new Error('LiveKit conferences are formed by adding a party, not merging lines');
  }

  async splitConference(_lineIdToKeep: number): Promise<void> {
    // N/A for LiveKit — parties share one SFU room; there are no separate lines to
    // split back out. To remove everyone, end the call.
    throw new Error('LiveKit conference cannot be split into separate lines');
  }

  isInConference(lineId: number): boolean {
    return this.line?.id === lineId && this.conferenceParties.length > 0;
  }

  getConferencedLines(): number[] {
    return this.conferenceParties.length > 0 && this.line ? [this.line.id] : [];
  }

  // --- Audio devices (minimal for 3b-1) ------------------------------------

  async enumerateAudioDevices(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audio = devices.filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput');
    this.emit({ type: 'audioDevicesChanged', devices: audio });
    return audio;
  }

  async setAudioInputDevice(deviceId: string): Promise<void> {
    if (this.room) {
      try {
        await this.room.switchActiveDevice('audioinput', deviceId);
      } catch {
        /* best-effort */
      }
    }
    this.emit({ type: 'audioInputChanged', deviceId });
  }

  async setAudioOutputDevice(deviceId: string): Promise<void> {
    if (this.audioEl && 'setSinkId' in this.audioEl) {
      try {
        await (
          this.audioEl as HTMLAudioElement & { setSinkId(id: string): Promise<void> }
        ).setSinkId(deviceId);
      } catch {
        /* best-effort */
      }
    }
    this.emit({ type: 'audioOutputChanged', deviceId });
  }

  // --- Quality / failover / checkers ---------------------------------------

  /** Latest live quality snapshot (polled by LiveKitQualityMonitor while answered). */
  async getCallStats(_lineId: number): Promise<CallStats | null> {
    return this.lastStats;
  }

  setBackupServer(_uri: string): void {
    /* no SIP failover server in LiveKit */
  }

  setDndChecker(checker: (() => boolean) | null): void {
    this.dndChecker = checker;
  }

  setBlockedChecker(checker: ((n: string) => boolean) | null): void {
    this.blockedChecker = checker;
  }

  setOwnNumberChecker(checker: ((n: string) => boolean) | null): void {
    this.ownNumberChecker = checker;
  }

  isDndEnabled(): boolean {
    return this.dndChecker ? this.dndChecker() : false;
  }

  isNumberBlocked(n: string): boolean {
    return this.blockedChecker ? this.blockedChecker(n) : false;
  }

  isOwnNumber(n: string): boolean {
    return this.ownNumberChecker ? this.ownNumberChecker(n) : false;
  }

  // --- Call logging (gap 3 — reuses the SIP engine's callsService verbatim) --

  private async logCallStart(
    number: string,
    direction: 'inbound' | 'outbound' = 'outbound'
  ): Promise<void> {
    try {
      const call = await callsService.createCall({
        callee: normalizePhone(number),
        direction,
        startTime: new Date().toISOString(),
        sipCallId: this.line?.sipCallId,
      });
      if (this.line) this.line = { ...this.line, callRecordId: call.id };
    } catch (err) {
      console.warn('[LiveKit] logCallStart failed', err);
    }
  }

  private async logCallAnswer(): Promise<void> {
    const id = this.line?.callRecordId;
    if (id == null) return;
    try {
      await callsService.updateCall(id, {
        answerTime: new Date().toISOString(),
        status: 'answered',
      });
    } catch (err) {
      console.warn('[LiveKit] logCallAnswer failed', err);
    }
  }

  private async logCallEnd(line: CallLine, reason: string): Promise<void> {
    if (line.callRecordId == null) return;
    const now = Date.now();
    const wasAnswered = line.wasAnswered === true;
    const ringTime = line.startTime
      ? Math.floor(((line.answerTime?.getTime() ?? now) - line.startTime.getTime()) / 1000)
      : 0;
    const duration =
      wasAnswered && line.answerTime ? Math.floor((now - line.answerTime.getTime()) / 1000) : 0;
    const status = wasAnswered ? CallStatus.COMPLETED : getUnansweredStatus(line.direction);
    try {
      await callsService.updateCall(line.callRecordId, {
        endTime: new Date().toISOString(),
        duration,
        ringTime,
        status,
        reasonText: reason,
      });
    } catch (err) {
      console.warn('[LiveKit] logCallEnd failed', err);
    }
  }

  // --- helpers -------------------------------------------------------------

  private notReady(feature: string, phase: string): Error {
    return new Error(`LiveKit: ${feature} is not available yet (arrives in ${phase})`);
  }
}

// ============================================================================
// Singleton — persisted on globalThis so it survives Next.js Fast Refresh
// (same pattern as sipManager), preventing duplicate engines/rooms on HMR.
// ============================================================================

const LK_KEY = '__bitnex_livekitManager';

function getLiveKitManager(): LiveKitManager {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>)[LK_KEY]) {
    return (globalThis as Record<string, unknown>)[LK_KEY] as LiveKitManager;
  }
  const instance = new LiveKitManager();
  if (typeof globalThis !== 'undefined') {
    (globalThis as Record<string, unknown>)[LK_KEY] = instance;
  }
  return instance;
}

export const livekitManager = getLiveKitManager();
