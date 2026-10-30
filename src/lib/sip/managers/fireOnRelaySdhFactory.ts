/**
 * Prefer-UDP-relay SessionDescriptionHandler factory.
 *
 * WHY THIS EXISTS
 * ---------------
 * SIP.js's default SDH sends the offer/answer only after ICE gathering reaches
 * `iceGatheringState === 'complete'` OR the `iceGatheringTimeout` elapses. On a
 * lossy network the 'complete' event can NEVER fire — a TURN allocation stalls
 * when its handshake packets are dropped — so the browser waited the full fixed
 * timeout and then sent the INVITE with `c=IN IP4 0.0.0.0` and ZERO
 * `a=candidate` lines → dead call, no audio (observed at 30–50% loss, the
 * poor-Pakistani-line case this whole effort targets).
 *
 * A first fix ("fire on the first relay candidate") removed the empty-offer
 * problem but exposed a subtler one: under loss the FIRST relay to allocate is
 * usually the **TCP/TLS** one (TCP retransmits, so it sets up reliably), while
 * the **UDP** allocation errors out and retries. Firing on that first relay
 * therefore shipped a **TCP-relayed** media path (`relayProtocol=tls`), and
 * TCP-relayed media head-of-line-blocks under loss exactly like WSS signaling
 * does → the call connects but the audio is "extreme cut" (observed 30%,
 * 2026-07-18: `relayProtocol=tls`, `iceState=failed`, ~100% concealed samples).
 *
 * WHAT IT DOES  (prefer UDP, keep a fallback)
 * -------------------------------------------
 * Via `peerConnectionDelegate.onicecandidate` (which SIP.js calls IN ADDITION to
 * its own handler) we run a small per-call gathering policy that PREFERS a UDP
 * relay and only settles for TCP as a last resort:
 *
 *   - A **UDP** relay candidate arrives  → best path. Wait a short settle
 *     (FALLBACK_SETTLE_MS) to also capture a second/fallback relay for ICE
 *     failover, then resolve gathering (`iceGatheringComplete()`).
 *   - Only **TCP/TLS** (or unlabeled) relays so far → do NOT fire on them; hold
 *     out for a UDP relay. Arm a last-resort timer (UDP_PREFERENCE_MS) so that
 *     if UDP never allocates we still ship the (TCP) candidate rather than an
 *     empty offer.
 *   - Nothing at all → the SDH's own `iceGatheringTimeout` ceiling still applies.
 *
 * Net effect:
 *   - clean line : UDP relay in ~1 s → fire ~1.8 s (fast dial, + a fallback)
 *   - lossy line : hold ~UDP_PREFERENCE_MS for the UDP relay instead of shipping
 *                  the fragile TCP one; ship UDP + fallback so ICE can fail over
 *   - Because both relays end up in the offer, WebRTC's own candidate priority
 *     (UDP relay outranks TCP relay) makes ICE try UDP first automatically.
 *
 * SAFETY
 * ------
 * This changes only *when* the SDP is emitted and *which* relay we hold out for.
 * It does not touch media stream creation, hold/unhold, transfer, add-call/merge,
 * or DTMF — those all flow through the unchanged `getDescription()` path.
 * `iceGatheringComplete()` is fully guarded (clears its timer, resolves the
 * promise only if present), so calling it early or multiple times is a no-op.
 *
 * @module lib/sip/managers/fireOnRelaySdhFactory
 */

import {
  SessionDescriptionHandler,
  defaultMediaStreamFactory,
  defaultPeerConnectionConfiguration,
  type MediaStreamFactory,
  type SessionDescriptionHandlerFactory,
  type SessionDescriptionHandlerFactoryOptions,
} from 'sip.js/lib/platform/web';

/** Default ICE gathering timeout (ms) if the caller doesn't pass one. */
const DEFAULT_ICE_GATHERING_TIMEOUT = 5000;

/**
 * After the preferred (UDP) relay is gathered, wait this long to also capture a
 * second/fallback relay candidate before firing — gives ICE a backup path to
 * fail over to when the primary relay degrades mid-call.
 */
const FALLBACK_SETTLE_MS = 800;

/**
 * When only a TCP/TLS relay has allocated, hold out THIS long for a UDP relay
 * before settling for the (loss-fragile) TCP one. Bounds the extra dial delay on
 * a lossy line while giving the UDP TURN allocation time to retry-succeed.
 *
 * Kept short (1.5 s) so that even in the worst case — a browser where we can't
 * classify any relay as UDP — dialing is capped at ~1.5 s instead of feeling
 * like a hang. (Was 4 s, which added ~4 s of silent "dialing" to EVERY call when
 * the UDP fast-path didn't trigger — see the priority fallback in relayTransportOf.)
 */
const UDP_PREFERENCE_MS = 1500;

/**
 * True when an ICE candidate is a TURN relay candidate. Prefers the parsed
 * `.type` but falls back to the SDP candidate string, because some engines
 * leave `RTCIceCandidate.type` undefined (same reason SipTelemetryManager
 * parses `typ relay` out of the string).
 */
function isRelayCandidate(candidate: RTCIceCandidate | null): boolean {
  if (!candidate) return false;
  if (candidate.type === 'relay') return true;
  return / typ relay/.test(candidate.candidate || '');
}

/** libwebrtc bumps a TURN/UDP relay's type-preference so its candidate priority
 * lands above 2^24, while TURN/TCP and TURN/TLS relays keep type-preference 0
 * (priority < 2^24). This lets us recover the relay transport from `priority`
 * alone when `relayProtocol` isn't available. */
const UDP_RELAY_PRIORITY_FLOOR = 2 ** 24; // 16_777_216

/**
 * Transport of the browser↔TURN-server leg for a relay candidate:
 *   - 'udp'     : allocated over UDP — the loss-resilient path we want
 *   - 'tcp'     : allocated over TCP/TLS — reliable to set up, fragile for media
 *   - 'unknown' : couldn't determine (no relayProtocol AND no usable priority)
 *
 * PREFERS `RTCIceCandidate.relayProtocol`, but that only exists in Chrome 124+
 * and is not always populated on the live `onicecandidate` object (it's a stats
 * field first). When it's missing we FALL BACK to decoding the candidate
 * `priority`: TURN/UDP relays sit above 2^24, TURN/TCP·TLS relays below it. This
 * fallback is what keeps the UDP fast-path firing (≈1 s dial) instead of always
 * timing out to the last-resort. `relayProtocol` isn't in the TS lib types yet.
 */
function relayTransportOf(candidate: RTCIceCandidate | null): 'udp' | 'tcp' | 'unknown' {
  if (!candidate) return 'unknown';

  const proto = (candidate as RTCIceCandidate & { relayProtocol?: string }).relayProtocol;
  if (proto === 'udp') return 'udp';
  if (proto === 'tcp' || proto === 'tls') return 'tcp';

  // relayProtocol unavailable → decode from priority.
  const priority = typeof candidate.priority === 'number' ? candidate.priority : 0;
  if (priority >= UDP_RELAY_PRIORITY_FLOOR) return 'udp';
  if (priority > 0) return 'tcp';
  return 'unknown';
}

/**
 * Build a SessionDescriptionHandlerFactory that prefers a UDP relay and keeps a
 * fallback candidate. Drop-in replacement for
 * `defaultSessionDescriptionHandlerFactory` — mirrors its construction so all
 * existing factory options (iceGatheringTimeout, peerConnectionConfiguration)
 * keep working.
 *
 * @param providedMediaStreamFactory - optional; defaults to SIP.js's own.
 */
export function createFireOnRelaySdhFactory(
  providedMediaStreamFactory?: MediaStreamFactory
): SessionDescriptionHandlerFactory {
  const mediaStreamFactory = providedMediaStreamFactory ?? defaultMediaStreamFactory();

  return (session, options) => {
    // The base factory interface widens `options` to `object`; narrow it back
    // to the real config shape (SIP.js does the same access untyped in JS).
    const opts = options as SessionDescriptionHandlerFactoryOptions | undefined;

    // Allow `0` (disables the timeout) to pass through, matching SIP.js.
    const iceGatheringTimeout =
      opts?.iceGatheringTimeout !== undefined
        ? opts.iceGatheringTimeout
        : DEFAULT_ICE_GATHERING_TIMEOUT;

    const sessionDescriptionHandlerConfiguration = {
      iceGatheringTimeout,
      peerConnectionConfiguration: {
        ...defaultPeerConnectionConfiguration(),
        ...opts?.peerConnectionConfiguration,
      },
    };

    const logger = session.userAgent.getLogger('sip.SessionDescriptionHandler');
    const sdh = new SessionDescriptionHandler(
      logger,
      mediaStreamFactory,
      sessionDescriptionHandlerConfiguration
    );

    // Per-call gathering state for the prefer-UDP policy.
    let fired = false;
    let udpSettleTimer: ReturnType<typeof setTimeout> | undefined;
    let tcpLastResortTimer: ReturnType<typeof setTimeout> | undefined;

    const fire = () => {
      if (fired) return;
      fired = true;
      if (udpSettleTimer) clearTimeout(udpSettleTimer);
      if (tcpLastResortTimer) clearTimeout(tcpLastResortTimer);
      // Resolve the SDH's ICE-gathering wait → the offer/answer is sent with the
      // candidates gathered so far (a UDP relay + whatever fallback arrived).
      sdh.iceGatheringComplete();
    };

    sdh.peerConnectionDelegate = {
      onicecandidate: (event) => {
        const candidate = event.candidate;
        if (fired || !isRelayCandidate(candidate)) return;

        if (relayTransportOf(candidate) === 'udp') {
          // Preferred path found. Short settle to also grab a fallback relay,
          // then fire. (If a fallback already arrived, we still fire promptly.)
          if (!udpSettleTimer) udpSettleTimer = setTimeout(fire, FALLBACK_SETTLE_MS);
        } else {
          // TCP/TLS (or unlabeled) relay — loss-fragile. Don't fire on it; hold
          // out for UDP, but arm a bounded last-resort so we never ship empty.
          if (!tcpLastResortTimer) tcpLastResortTimer = setTimeout(fire, UDP_PREFERENCE_MS);
        }
      },
    };

    return sdh;
  };
}
