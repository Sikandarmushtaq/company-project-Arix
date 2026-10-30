/**
 * Apply a RingCentral-style Opus voice profile to LiveKit audio.
 *
 * Why
 * ---
 * A RingCentral webrtc-internals capture on the SAME PK connection showed their
 * working call is NOT RED — it's plain **mono Opus + in-band FEC**, tuned for
 * voice: `stereo=0; useinbandfec=1; usedtx=0; maxaveragebitrate=64000;
 * maxplaybackrate=16000; sprop-maxcapturerate=16000`. RED and DRED are only
 * *offered* as fallbacks; the active codec is mono Opus+FEC. Our legs were
 * negotiating `stereo=1`, which doubles the audio payload for mono phone audio
 * and is wasteful on exactly the lossy networks we care about.
 *
 * So we match RingCentral: mono, wideband (16 kHz), FEC on, DTX off, bitrate
 * capped — opus stays primary; RED is left in the m-line as a fallback, never
 * forced.
 *
 * How
 * ---
 * Opus fmtp parameters aren't reachable via setCodecPreferences, so this munges
 * the SDP in a wrapped `setLocalDescription`. It runs AFTER livekit-client's own
 * munge and is best-effort: any error falls back to the original SDP so a codec
 * tweak can never break a call. Only AUDIO opus lines are touched; RED (pt 63)
 * and every other codec are left as-is. Gated behind {@link setOpusRcProfileEnabled}
 * so it only affects the LiveKit engine, never the SIP.js path.
 */

let enabled = false;
let installed = false;

/** RingCentral-matched Opus fmtp: mono, wideband, FEC on, DTX off, 64 kbps. */
const OPUS_PROFILE =
  'minptime=10;useinbandfec=1;usedtx=0;maxaveragebitrate=64000;maxplaybackrate=16000;sprop-maxcapturerate=16000;stereo=0;sprop-stereo=0';

/** Rewrite every audio Opus fmtp to the voice profile; leave RED/others alone. */
function applyOpusProfile(sdp: string): string {
  const pts = new Set<string>();
  for (const m of sdp.matchAll(/^a=rtpmap:(\d+)\s+opus\/48000/gim)) pts.add(m[1]);
  if (pts.size === 0) return sdp;

  let out = sdp;
  for (const pt of pts) {
    const hasFmtp = new RegExp(`^a=fmtp:${pt} `, 'im').test(out);
    if (hasFmtp) {
      out = out.replace(new RegExp(`^a=fmtp:${pt} .*$`, 'gim'), `a=fmtp:${pt} ${OPUS_PROFILE}`);
    } else {
      // No fmtp line for this Opus PT — insert one right after its rtpmap.
      out = out.replace(
        new RegExp(`^(a=rtpmap:${pt}\\s+opus/48000[^\\n]*)$`, 'gim'),
        `$1\r\na=fmtp:${pt} ${OPUS_PROFILE}`
      );
    }
  }
  return out;
}

/**
 * Idempotently wrap RTCPeerConnection.setLocalDescription so LiveKit audio uses
 * the RingCentral voice profile. Runs after livekit-client's own SDP munge.
 */
export function installOpusRcProfile(): void {
  if (installed || typeof RTCPeerConnection === 'undefined') return;
  installed = true;

  const proto = RTCPeerConnection.prototype;
  const orig = proto.setLocalDescription;
  proto.setLocalDescription = function (
    this: RTCPeerConnection,
    description?: RTCLocalSessionDescriptionInit
  ): Promise<void> {
    let d = description;
    try {
      if (enabled && d && d.sdp) {
        const munged = applyOpusProfile(d.sdp);
        if (munged !== d.sdp) d = { type: d.type, sdp: munged };
      }
    } catch {
      /* fall back to the original description — never block a call */
    }
    return (
      orig as (
        this: RTCPeerConnection,
        description?: RTCLocalSessionDescriptionInit
      ) => Promise<void>
    ).call(this, d);
  };
}

/** Enable/disable the profile (on only while the LiveKit engine is active). */
export function setOpusRcProfileEnabled(on: boolean): void {
  enabled = on;
}
