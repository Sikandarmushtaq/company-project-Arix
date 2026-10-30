/**
 * WhatsApp Call Manager
 *
 * Manages RTCPeerConnection for WhatsApp calls. SEPARATE from SipCallManager
 * because SDP comes from Meta's Graph API (not Kamailio/rtpengine), and the
 * call lifecycle is different (permission flow for outbound, Meta-specific
 * webhook events).
 *
 * Can run in parallel with SIP calls — an agent can be on a regular SIP call
 * AND a WhatsApp call simultaneously.
 *
 * Includes browser-side call recording via MediaRecorder (the only recording
 * option since the server is not in the media path for WA calls).
 *
 * @module lib/whatsapp-call/WaCallManager
 */

import type {
  WaCallState,
  WaCallIncomingEvent,
  WaCallEndedEvent,
  WaCallSdpAnswerEvent,
} from './types';
import { emptyWaCallState } from './types';
import { waCallService } from '@/lib/api/services/waCall.service';
import { fetchTurnCredentials, FALLBACK_STUN_SERVERS } from '@/lib/sip/config';
import { toast } from '@/lib/stores/toast';

/**
 * Sanitize Meta's SDP for Chrome's strict parser.
 *
 * Meta's WhatsApp calling SDP uses non-standard formatting:
 *   - `a=ssrc:<id> cname:Value` (space before cname) — RFC 5576 expects this
 *     but Chrome sometimes chokes if the line has trailing whitespace or wrong
 *     line endings.
 *   - May use `\n` instead of `\r\n` line endings.
 *
 * This function normalizes the SDP to make Chrome happy.
 */
function sanitizeMetaSdp(sdp: string): string {
  // 1. Normalize line endings to \r\n (RFC 4566 requirement)
  let out = sdp.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');

  // 2. Trim trailing whitespace on each line (Chrome rejects it)
  out = out
    .split('\r\n')
    .map((line) => line.trimEnd())
    .join('\r\n');

  // 3. Ensure SDP ends with \r\n
  if (!out.endsWith('\r\n')) {
    out += '\r\n';
  }

  return out;
}

type WaCallStateListener = (state: WaCallState) => void;

export class WaCallManager {
  private state: WaCallState = emptyWaCallState();
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<WaCallStateListener> = new Set();

  // Outbound no-answer timeout — Meta may take 30-60s to surface a
  // terminate webhook, or may not surface one at all if the customer's
  // device is offline. We enforce our own client-side timeout so the
  // UI never gets stuck on "Calling..." forever.
  private noAnswerTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // RTP-flow poller for OUTBOUND only — Meta's WhatsApp Business Calling API
  // fires the 'connect' webhook (with the customer's SDP answer) when signaling
  // completes between business and Meta's media relay, NOT when the customer
  // actually accepts. ICE establishes immediately to Meta's relay → if we
  // trusted ICE 'connected' as "customer picked up", the duration timer would
  // start while the customer's phone is still ringing. The only authoritative
  // signal that audio is flowing from the customer is bytes arriving on the
  // inbound-rtp stream, so for outbound we poll getStats() until bytesReceived
  // > 0 before transitioning to 'active'. (Inbound is unaffected — the agent
  // pressing Answer already proves human acceptance.)
  private rtpPollIntervalId: ReturnType<typeof setInterval> | null = null;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private onRecordingUploaded: (() => void) | null = null;

  // ---- State management ----

  getState(): WaCallState {
    return { ...this.state };
  }

  subscribe(listener: WaCallStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Register a callback for when a recording upload completes */
  setOnRecordingUploaded(cb: (() => void) | null): void {
    this.onRecordingUploaded = cb;
  }

  private setState(updates: Partial<WaCallState>): void {
    const prevStatus = this.state.status;
    const prevCallId = this.state.callId;
    Object.assign(this.state, updates);
    const snapshot = { ...this.state };

    // Debug: track state transitions
    if (updates.status || updates.callId !== undefined) {
      console.log('[WaCallManager] setState:', {
        prev: { status: prevStatus, callId: prevCallId },
        updates: Object.keys(updates),
        new: { status: this.state.status, callId: this.state.callId },
        trace: new Error().stack
          ?.split('\n')
          .slice(1, 4)
          .map((l) => l.trim()),
      });
    }

    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {
        // Swallow listener errors
      }
    });
  }

  // ---- Inbound call flow ----

  /**
   * Handle incoming WhatsApp call notification from WebSocket.
   * Shows the incoming call UI. Agent must call answerCall() to proceed.
   */
  handleIncomingCall(event: WaCallIncomingEvent): void {
    console.log('[WaCallManager] handleIncomingCall:', {
      callId: event.callId,
      hasSdp: !!event.sdpOffer,
      currentStatus: this.state.status,
      currentCallId: this.state.callId,
    });
    this.setState({
      status: 'incoming',
      callId: event.callId,
      direction: 'inbound',
      customerNumber: event.customerNumber,
      customerName: event.customerName,
      phoneNumberId: event.phoneNumberId,
      startTime: new Date(event.timestamp * 1000),
    });
  }

  /**
   * Agent answers the incoming call.
   * Creates RTCPeerConnection, generates SDP answer, sends to Meta via API.
   */
  async answerCall(sdpOffer: string, callIdOverride?: string): Promise<void> {
    const callId = callIdOverride || this.state.callId;
    if (!callId) {
      console.error('[WaCallManager] answerCall: no callId available', {
        stateCallId: this.state.callId,
        override: callIdOverride,
        status: this.state.status,
      });
      throw new Error('No active incoming call');
    }

    // Ensure state has the callId (may have been lost due to hot-reload or race)
    if (!this.state.callId) {
      this.state.callId = callId;
      this.state.status = 'incoming';
    }

    this.setState({ status: 'connecting' });

    try {
      // Get microphone
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Create peer connection with same TURN servers as the regular dialer.
      // Uses pre-warmed Twilio TURN credentials for reliability on bad networks.
      const iceServers = await fetchTurnCredentials().catch(() => FALLBACK_STUN_SERVERS);
      this.pc = new RTCPeerConnection({
        iceServers,
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
      });

      // Add local audio track
      for (const track of this.localStream.getAudioTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      // Handle remote audio
      this.pc.ontrack = (event) => {
        if (!this.remoteAudio) {
          this.remoteAudio = new Audio();
          this.remoteAudio.autoplay = true;
        }
        this.remoteAudio.srcObject = event.streams[0] || new MediaStream([event.track]);
      };

      // Monitor ICE state
      this.pc.oniceconnectionstatechange = () => {
        if (!this.pc) return;
        if (
          this.pc.iceConnectionState === 'connected' ||
          this.pc.iceConnectionState === 'completed'
        ) {
          this.setState({
            status: 'active',
            answerTime: new Date(),
          });
          this.startDurationTimer();
          this.autoStartRecording();
        } else if (
          this.pc.iceConnectionState === 'failed' ||
          this.pc.iceConnectionState === 'closed'
        ) {
          this.endCallLocally('ICE failed');
        }
      };

      // Set remote SDP (Meta's offer) — sanitize for Chrome's strict parser
      const cleanSdp = sanitizeMetaSdp(sdpOffer);
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: cleanSdp })
      );

      // Create answer
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      // Wait for ICE gathering to complete (or timeout)
      const sdpAnswer = await this.waitForIceGathering(this.pc, 3000);

      // Send SDP answer to Meta via backend API
      await waCallService.answerCall(callId, sdpAnswer);
    } catch (error) {
      console.error('[WaCallManager] Answer failed:', error);
      this.endCallLocally('answer_failed');
      throw error;
    }
  }

  /**
   * Agent rejects the incoming call.
   */
  async rejectCall(): Promise<void> {
    if (!this.state.callId) return;

    try {
      await waCallService.rejectCall(this.state.callId);
    } catch (error) {
      console.error('[WaCallManager] Reject failed:', error);
    }

    this.cleanup();
    this.setState(emptyWaCallState());
  }

  // ---- Outbound call flow ----

  /**
   * Initiate an outbound WhatsApp call.
   * Requires prior permission from the customer.
   */
  async initiateCall(
    phoneNumberId: string,
    customerNumber: string,
    customerName?: string
  ): Promise<void> {
    // Pre-flight FIRST — refuse before touching the mic, WebRTC, or the call
    // UI when the org can't place calls (e.g. prepaid wallet at $0). Without
    // this the agent saw a "Calling…" panel + mic prompt for ~3s before the
    // server rejected, with the reason only in the console. Mirrors how SMS
    // surfaces a block: a clear toast, no half-started call. Best-effort — if
    // the check itself errors (network), fall through and let the
    // authoritative server-side gate on /initiate handle it.
    try {
      const pf = await waCallService.preflight();
      if (!pf.canCall) {
        toast.error(pf.reason || 'Calls are not available right now.');
        return;
      }
    } catch {
      /* preflight unavailable — proceed; /initiate still enforces the block */
    }

    this.setState({
      status: 'connecting',
      direction: 'outbound',
      customerNumber,
      customerName: customerName ?? null,
      phoneNumberId,
      startTime: new Date(),
    });

    try {
      // Get microphone
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Create peer connection with same TURN servers as the regular dialer.
      // Uses pre-warmed Twilio TURN credentials for reliability on bad networks.
      const iceServers = await fetchTurnCredentials().catch(() => FALLBACK_STUN_SERVERS);
      this.pc = new RTCPeerConnection({
        iceServers,
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
      });

      // Add local audio
      for (const track of this.localStream.getAudioTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      // Handle remote audio
      this.pc.ontrack = (event) => {
        if (!this.remoteAudio) {
          this.remoteAudio = new Audio();
          this.remoteAudio.autoplay = true;
        }
        this.remoteAudio.srcObject = event.streams[0] || new MediaStream([event.track]);
      };

      // Monitor ICE state — outbound is RTP-gated, NOT ICE-gated, because
      // Meta's media relay accepts ICE before the customer actually picks
      // up (see rtpPollIntervalId comment above). On 'connected' we only
      // arm the inbound-RTP poller; the actual transition to 'active'
      // happens when bytesReceived > 0.
      this.pc.oniceconnectionstatechange = () => {
        if (!this.pc) return;
        if (
          this.pc.iceConnectionState === 'connected' ||
          this.pc.iceConnectionState === 'completed'
        ) {
          this.startOutboundRtpWatch();
        } else if (
          this.pc.iceConnectionState === 'failed' ||
          this.pc.iceConnectionState === 'closed'
        ) {
          this.endCallLocally('ICE failed');
        }
      };

      // Create offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const sdpOffer = await this.waitForIceGathering(this.pc, 3000);

      // Send to Meta via API — returns callId. phoneNumberId auto-resolved by backend if empty.
      const { callId } = await waCallService.initiateCall(
        phoneNumberId || undefined,
        customerNumber,
        sdpOffer
      );

      this.setState({ callId });

      // No-answer timeout — if customer doesn't pick up within 45s, end
      // the call. This avoids the UI getting stuck on "Calling..." when
      // Meta hasn't yet emitted a terminate webhook (or never will,
      // because the customer's device is offline). 45s matches Twilio's
      // default ringing timeout and gives a real customer enough time
      // to grab their phone.
      this.clearNoAnswerTimeout();
      this.noAnswerTimeoutId = setTimeout(() => {
        // Only fire if we're STILL in 'connecting' for THIS call. If the
        // call was answered or ended via another path, this is a no-op.
        if (this.state.status === 'connecting' && this.state.callId === callId) {
          console.log('[WaCallManager] Outbound no-answer timeout — ending call', { callId });
          // Tell the user WHY the call ended — without this the panel
          // just disappears and the agent doesn't know if it failed,
          // was rejected, or genuinely went unanswered.
          const who = this.state.customerName || this.state.customerNumber || 'Customer';
          toast.info(`${who} didn’t answer`);
          // Use endCall (not endCallLocally) so backend tells Meta to
          // hang up the ringing call. Errors are swallowed — UI must
          // recover regardless of whether Meta acks the hangup.
          this.endCall().catch((err) => {
            console.error('[WaCallManager] No-answer endCall failed:', err);
            this.endCallLocally('no_answer');
          });
        }
      }, 45000);
    } catch (error) {
      console.error('[WaCallManager] Initiate failed:', error);
      // Surface the reason to the agent (e.g. balance exhausted, mic denied)
      // and tear the half-started call down. Covers the race where credit runs
      // out between preflight and /initiate. Handled here — no rethrow, so the
      // click handler doesn't produce an uncaught rejection.
      const msg = error instanceof Error ? error.message : 'Could not place the call.';
      toast.error(msg);
      this.endCallLocally('initiate_failed');
    }
  }

  /**
   * Cancel the pending no-answer timeout. Called whenever we leave the
   * 'connecting' state — answered, ended remotely, or aborted by user.
   */
  private clearNoAnswerTimeout(): void {
    if (this.noAnswerTimeoutId !== null) {
      clearTimeout(this.noAnswerTimeoutId);
      this.noAnswerTimeoutId = null;
    }
  }

  /**
   * Stop the inbound-RTP poller. Idempotent.
   */
  private stopRtpWatch(): void {
    if (this.rtpPollIntervalId !== null) {
      clearInterval(this.rtpPollIntervalId);
      this.rtpPollIntervalId = null;
    }
  }

  /**
   * Watch the outbound RTCPeerConnection for the FIRST inbound-RTP bytes,
   * which is the only authoritative "customer picked up" signal we have.
   *
   * Meta's WhatsApp Business Calling API surfaces the 'connect' webhook
   * (carrying the customer's SDP answer) the moment Meta's media relay has
   * a path to the customer's device — but the customer's app is still
   * ringing at that point. ICE then establishes near-instantly between us
   * and Meta's relay. Audio packets only start flowing AFTER the customer
   * actually accepts the call on their phone — so we poll getStats() at
   * 250ms cadence and look for `inbound-rtp.bytesReceived > 0`.
   *
   * This is the same technique used by sip.js / Twilio Voice's "in-call
   * answer detection" — RTP flow is the cross-vendor source of truth.
   *
   * Once bytes flow we transition to 'active', start the duration timer,
   * and kick off recording. The poller self-stops via stopRtpWatch().
   *
   * Idempotent — multiple ICE state-change events are safe.
   */
  private startOutboundRtpWatch(): void {
    // Already polling, or already past 'connecting' → no-op.
    if (this.rtpPollIntervalId !== null) return;
    if (!this.pc) return;
    if (this.state.status !== 'connecting') return;
    if (this.state.direction !== 'outbound') return;

    const startedAt = Date.now();
    // Hard ceiling: if RTP genuinely hasn't started after 60s post-ICE we
    // assume something pathological is happening (Meta relay broken, NAT
    // killed UDP, customer side silently dead) and let the no-answer
    // timeout handle the eventual end. We do NOT auto-promote to 'active'
    // on this fallback — the user would see 0:00 → garbage. Better to let
    // the connecting state hold so the agent knows audio never started,
    // matching how a SIP softphone behaves on no-RTP.
    const HARD_CEILING_MS = 60_000;

    this.rtpPollIntervalId = setInterval(async () => {
      const pc = this.pc;
      if (!pc) {
        this.stopRtpWatch();
        return;
      }

      // Status changed underneath us (call ended, etc.) → stop polling.
      if (this.state.status !== 'connecting') {
        this.stopRtpWatch();
        return;
      }

      try {
        const stats = await pc.getStats();
        let inboundBytes = 0;
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            const r = report as RTCStatsReport & { bytesReceived?: number };
            inboundBytes += Number(r.bytesReceived ?? 0);
          }
        });

        if (inboundBytes > 0) {
          // Customer picked up — audio is flowing. Promote.
          this.stopRtpWatch();
          this.clearNoAnswerTimeout();
          this.setState({
            status: 'active',
            answerTime: new Date(),
          });
          this.startDurationTimer();
          this.autoStartRecording();
          console.log('[WaCallManager] Outbound active — RTP audio detected', { inboundBytes });

          // Tell the backend the REAL pickup moment so the call_log duration
          // matches the user's experience. Without this, the chat-thread call
          // entry over-counts by the customer's ring time (Meta's `connect`
          // webhook fires before the customer accepts). Fire-and-forget — the
          // server is idempotent and a network hiccup here shouldn't block
          // the active call. We capture callId locally because endCallLocally
          // can clear state.callId between now and the response.
          const callIdSnapshot = this.state.callId;
          if (callIdSnapshot) {
            waCallService.markAudioStarted(callIdSnapshot).catch((err) => {
              console.warn('[WaCallManager] markAudioStarted failed (non-fatal):', err);
            });
          }
        } else if (Date.now() - startedAt > HARD_CEILING_MS) {
          // Sanity ceiling — stop polling but stay in 'connecting' so the
          // existing no-answer timeout can wind the call down cleanly.
          this.stopRtpWatch();
          console.warn(
            '[WaCallManager] Outbound RTP watch hit ceiling without audio — not promoting'
          );
        }
      } catch (err) {
        // getStats() shouldn't throw on a live PC; log + continue.
        console.warn('[WaCallManager] getStats() failed during RTP watch:', err);
      }
    }, 250);
  }

  /**
   * Customer ACCEPTED the outbound call — the provider's authoritative pickup
   * signal (via WebSocket). Promotes 'connecting' → 'active' deterministically,
   * instead of waiting on inbound-RTP detection. Guarded so a stale event
   * (after the call was ended or already active) is a no-op — which also
   * prevents the "click End during Calling… → flips to Connected" race.
   */
  handleOutboundAnswered(callId: string): void {
    if (this.state.callId !== callId) return;
    if (this.state.direction !== 'outbound') return;
    if (this.state.status !== 'connecting') return;
    this.clearNoAnswerTimeout();
    this.stopRtpWatch();
    this.setState({ status: 'active', answerTime: new Date() });
    this.startDurationTimer();
    this.autoStartRecording();
  }

  /**
   * Handle SDP answer from the provider for an outbound call (via WebSocket).
   */
  async handleSdpAnswer(event: WaCallSdpAnswerEvent): Promise<void> {
    if (!this.pc || this.state.callId !== event.callId) return;

    // Idempotency: only apply a remote ANSWER when a local OFFER is pending
    // ('have-local-offer'). Providers (YCloud) can redeliver the connect
    // webhook, so a second SDP answer can arrive after we're already 'stable';
    // applying it then throws InvalidStateError. Ignore the duplicate instead
    // — this is the canonical WebRTC way to handle a redundant answer.
    if (this.pc.signalingState !== 'have-local-offer') {
      console.log('[WaCallManager] Ignoring duplicate/stale SDP answer', {
        signalingState: this.pc.signalingState,
        callId: event.callId,
      });
      return;
    }

    try {
      const cleanSdp = sanitizeMetaSdp(event.sdpAnswer);
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: cleanSdp })
      );
    } catch (error) {
      console.error('[WaCallManager] SDP answer failed:', error);
      // Only tear down while still establishing — a late/odd error on an
      // already-active call must never kill a working call.
      if (this.state.status !== 'active') {
        this.endCallLocally('sdp_error');
      }
    }
  }

  // ---- Call control ----

  /**
   * End the active call.
   */
  async endCall(): Promise<void> {
    // ALWAYS clean up local state (mic, peer connection, timers, recorder).
    // The backend-side hangup only runs if we have a callId — i.e. Meta
    // has actually placed the call and there's something to terminate.
    // Cancel-during-early-connecting (before /initiate returns) hits this
    // path with callId=null: skip the API call but still tear down local
    // resources, otherwise the mic stays hot and the UI stays stuck.
    this.setState({ status: 'ending' });

    if (this.state.callId) {
      try {
        await waCallService.endCall(this.state.callId);
      } catch (error) {
        console.error('[WaCallManager] End call API failed:', error);
      }
    }

    this.endCallLocally('agent_hangup');
  }

  /**
   * Handle call ended event from WebSocket (remote hangup).
   */
  handleCallEnded(event: WaCallEndedEvent): void {
    console.log('[WaCallManager] handleCallEnded:', {
      eventCallId: event.callId,
      stateCallId: this.state.callId,
      stateStatus: this.state.status,
      match: this.state.callId === event.callId,
    });
    if (this.state.callId !== event.callId) return;
    this.endCallLocally(event.reason);
  }

  /**
   * Handle 'call answered on another device' event from WebSocket.
   *
   * Multi-device scenario: same user is signed in on web + Android (or two
   * web tabs). An incoming WA call rings everywhere. One device picks up →
   * the server emits WA_CALL_ANSWERED to every socket the user has. The
   * answering device has already moved past 'incoming' so it no-ops; every
   * other device tears down its ringing UI here.
   *
   * Status semantics:
   *  - 'incoming'  → ringing UI, no mic acquired yet. Just tear down state.
   *  - 'connecting' → we ALSO clicked Answer (rare double-click race). The
   *                   losing tab's WebRTC will time out on ICE failure
   *                   anyway, but we don't proactively tear it down here
   *                   because we can't distinguish "I'm the answerer mid-
   *                   handshake" from "I lost the race". ICE-failure path
   *                   handles the latter naturally.
   *  - 'active'/'ended'/'idle' → already past, no-op.
   */
  handleAnsweredElsewhere(callId: string): void {
    if (this.state.callId !== callId) return;
    if (this.state.status !== 'incoming') return;
    console.log('[WaCallManager] handleAnsweredElsewhere — tearing down ringing UI', {
      callId,
    });
    this.endCallLocally('answered_elsewhere');
  }

  /**
   * Handle 'call rejected on another device' event from WebSocket.
   *
   * Same shape as {@link handleAnsweredElsewhere}. Distinct event from
   * generic call-ended because the receiver should NOT log a missed call:
   * the user actively declined, just from a different device.
   */
  handleRejectedElsewhere(callId: string): void {
    if (this.state.callId !== callId) return;
    if (this.state.status !== 'incoming') return;
    console.log('[WaCallManager] handleRejectedElsewhere — tearing down ringing UI', {
      callId,
    });
    this.endCallLocally('rejected_elsewhere');
  }

  /**
   * Toggle mute.
   */
  toggleMute(): void {
    if (!this.localStream) return;
    const newMuted = !this.state.isMuted;
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !newMuted;
    });
    this.setState({ isMuted: newMuted });
  }

  // ---- Recording (browser-side only) ----

  /**
   * Start recording the call. Captures both local + remote audio
   * via MediaRecorder on a mixed MediaStream.
   */
  startRecording(): void {
    if (!this.pc || this.state.isRecording) return;

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Mix local audio
      if (this.localStream) {
        const localSource = audioContext.createMediaStreamSource(this.localStream);
        localSource.connect(destination);
      }

      // Mix remote audio
      const remoteStream = this.remoteAudio?.srcObject as MediaStream | null;
      if (remoteStream) {
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(destination);
      }

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.setState({ isRecording: true });
    } catch (error) {
      console.error('[WaCallManager] Recording failed to start:', error);
    }
  }

  /**
   * Stop recording and return the audio blob.
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.mediaRecorder || !this.state.isRecording) return null;

    return new Promise<Blob>((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.recordedChunks = [];
        this.setState({ isRecording: false });
        resolve(blob);
      };
      this.mediaRecorder!.stop();
    });
  }

  // ---- Internal helpers ----

  /**
   * Wait for ICE gathering to complete or timeout.
   * Returns the final SDP string.
   */
  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve(pc.localDescription?.sdp || '');
        return;
      }

      const timer = setTimeout(() => {
        resolve(pc.localDescription?.sdp || '');
      }, timeoutMs);

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve(pc.localDescription?.sdp || '');
        }
      };
    });
  }

  /**
   * Auto-start recording when call becomes active.
   * Called from ICE connected handler. Silent — no user interaction needed.
   */
  private autoStartRecording(): void {
    if (this.state.isRecording || this.mediaRecorder) return; // Already recording
    // Small delay to ensure remote audio track is flowing
    setTimeout(() => {
      if (this.state.status === 'active' && this.pc) {
        this.startRecording();
        console.log('[WaCallManager] Auto-recording started');
      }
    }, 500);
  }

  /**
   * End call locally — grab recording chunks, cleanup WebRTC, upload in background.
   *
   * IMPORTANT: We collect recorded chunks BEFORE cleanup() destroys the audio sources.
   * stopRecording() is async (waits for MediaRecorder.onstop) but cleanup() would
   * destroy the tracks before onstop fires — corrupting the recording.
   * Instead, we grab the chunks we already have (collected every 1s via ondataavailable).
   */
  private endCallLocally(reason: string): void {
    // Cancel any pending no-answer timeout — we're terminating now,
    // whatever path we got here from (answered, remote-hangup, agent-
    // hangup, ICE failure, no-answer timeout itself). Self-clear is
    // safe because clearTimeout(null) is a no-op.
    this.clearNoAnswerTimeout();
    // Same for the outbound RTP-flow watcher — it polls getStats() on a
    // peer connection we're about to close. Stop it explicitly so we
    // don't leave a 250ms interval running against a dead pc handle.
    this.stopRtpWatch();

    const callId = this.state.callId;

    // Grab recording data BEFORE cleanup destroys audio sources
    let recordingBlob: Blob | null = null;
    if (this.mediaRecorder && this.state.isRecording) {
      try {
        // Request final data chunk
        this.mediaRecorder.requestData();
      } catch {
        // Ignore — might throw if recorder is in wrong state
      }
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
      // Build blob from accumulated chunks (collected every 1s)
      if (this.recordedChunks.length > 0) {
        recordingBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      }
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.setState({ isRecording: false });
    }

    // NOW cleanup WebRTC (safe — recording data already captured)
    this.cleanup();
    this.setState({
      ...emptyWaCallState(),
    });

    // Upload recording in background
    if (recordingBlob && recordingBlob.size > 0 && callId) {
      console.log(
        `[WaCallManager] Uploading recording for ${callId} (${recordingBlob.size} bytes)`
      );
      waCallService
        .uploadRecording(callId, recordingBlob)
        .then(() => {
          console.log(`[WaCallManager] Recording uploaded successfully for ${callId}`);
          this.onRecordingUploaded?.();
        })
        .catch((err) => {
          console.error('[WaCallManager] Recording upload failed:', err);
        });
    }
  }

  /**
   * Release all WebRTC resources.
   */
  private cleanup(): void {
    this.stopDurationTimer();

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onicegatheringstatechange = null;
      try {
        this.pc.close();
      } catch {
        // Ignore
      }
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }

    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  private startDurationTimer(): void {
    this.stopDurationTimer();
    this.durationTimer = setInterval(() => {
      if (this.state.answerTime) {
        const secs = Math.floor((Date.now() - this.state.answerTime.getTime()) / 1000);
        this.setState({ duration: secs });
      }
    }, 1000);
  }

  private stopDurationTimer(): void {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  /**
   * Full teardown.
   */
  destroy(): void {
    this.cleanup();
    this.listeners.clear();
    this.setState(emptyWaCallState());
  }
}

/** Singleton instance */
export const waCallManager = new WaCallManager();
