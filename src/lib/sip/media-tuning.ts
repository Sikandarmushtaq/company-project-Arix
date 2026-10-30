/**
 * Shared browser-side media tuning helpers for the WebRTC receive path.
 *
 * @module lib/sip/media-tuning
 */

/**
 * Base playout jitter-buffer target (ms) applied to a remote audio receiver at
 * media setup. A floor the browser still adapts ABOVE; the adaptive controller
 * (SipQualityManager) raises it further on lossy links and lowers it back when
 * the link is clean. Distinct from the FreeSWITCH server jitter buffer (proven
 * net-negative on this stack twice) — this is the browser's OWN playout buffer.
 */
export const JITTER_BUFFER_BASE_MS = 200;

/**
 * Set a remote audio receiver's playout jitter-buffer target, in milliseconds.
 * Feature-detected: `jitterBufferTarget` (ms, newer spec) or `playoutDelayHint`
 * (seconds, older Chromium). Progressive enhancement — a missing API or a throw
 * never affects audio, so callers can fire-and-forget.
 */
export function applyJitterBufferTarget(receiver: RTCRtpReceiver, targetMs: number): void {
  try {
    // Neither prop is in the standard lib DOM types yet — cast to an index type.
    const r = receiver as unknown as Record<string, unknown>;
    if (typeof r.jitterBufferTarget !== 'undefined') {
      r.jitterBufferTarget = targetMs; // newer spec, milliseconds
    } else if (typeof r.playoutDelayHint !== 'undefined') {
      r.playoutDelayHint = targetMs / 1000; // older Chromium, seconds
    }
  } catch {
    // never block the call for a quality hint
  }
}
