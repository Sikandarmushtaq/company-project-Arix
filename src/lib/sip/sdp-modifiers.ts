/**
 * SDP modifiers + sender tuning for the browser (WebRTC) leg.
 *
 * We keep FEC on (recovers lost packets) but no longer starve the codec: the
 * diagnosed problem is packet LOSS, not bandwidth, so the old hard 32 kbps /
 * 16 kHz cap only limited quality (web Opus averaged MOS ~3.2 vs ~4.0 on uncapped
 * G711) without helping loss. We now set a HIGHER ceiling and let WebRTC's own
 * congestion control adapt BELOW it under real congestion — so good networks get
 * near-transparent fullband voice while bad networks still throttle down.
 *   - useinbandfec=1       : in-band FEC — reconstructs lost packets (kept)
 *   - maxaveragebitrate=48000 : ceiling (WebRTC adapts below it under loss)
 *   - maxplaybackrate=48000 : fullband — crisp "HD" voice (RingCentral-parity)
 *   - stereo=0             : mono (voice)
 * Plus an RTCRtpSender ceiling on the uplink (WebRTC still congestion-controls below it).
 *
 * @module lib/sip/sdp-modifiers
 */

/**
 * Ceiling for the browser Opus leg (bps). Raised 32k → 48k: loss (not bandwidth)
 * is the issue, so 32k only capped quality. WebRTC congestion control still adapts
 * below this on bad links; good links reach near-transparent voice (~4+ MOS).
 */
export const OPUS_MAX_BITRATE = 48000;

/** Opus fmtp params we enforce on the local SDP (merged into any existing fmtp). */
const OPUS_FMTP: Record<string, string> = {
  useinbandfec: '1',
  usedtx: '0',
  maxaveragebitrate: String(OPUS_MAX_BITRATE),
  maxplaybackrate: '48000',
  stereo: '0',
  'sprop-stereo': '0',
  // Keep packetization small so a single lost packet costs less audio and pairs
  // well with in-band FEC. minptime=10 stops the remote negotiating large frames
  // (matches Chrome's own default, made explicit here in case a client omits it).
  minptime: '10',
};

/** Advisory packetization for the Opus leg — one lost packet = less lost audio. */
const OPUS_PTIME_MS = 20;

/**
 * SIP.js SessionDescriptionHandlerModifier: rewrite the local offer/answer to
 * tune Opus for lossy / low-bandwidth networks. Idempotent — merges into an
 * existing Opus fmtp (overriding only our keys) and is a safe no-op when the
 * SDP has no Opus m-line.
 */
export function opusLowBandwidthModifier(
  description: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  if (!description || typeof description.sdp !== 'string') {
    return Promise.resolve(description);
  }
  try {
    return Promise.resolve({ ...description, sdp: tuneOpusSdp(description.sdp) });
  } catch {
    // Quality tuning must never break the SDH modifier chain / call setup —
    // on any unexpected error, pass the original SDP through unmodified.
    return Promise.resolve(description);
  }
}

function tuneOpusSdp(sdp: string): string {
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(/\r\n|\n/);

  // Collect Opus payload types from `a=rtpmap:<pt> opus/48000[/2]`.
  const opusPts = new Set<string>();
  for (const l of lines) {
    const m = /^a=rtpmap:(\d+)\s+opus\/48000/i.exec(l);
    if (m) opusPts.add(m[1]);
  }
  if (opusPts.size === 0) return sdp;

  // Merge into existing Opus fmtp lines.
  const haveFmtp = new Set<string>();
  const out = lines.map((line) => {
    const fm = /^a=fmtp:(\d+)\s+(.*)$/.exec(line);
    if (fm && opusPts.has(fm[1])) {
      haveFmtp.add(fm[1]);
      return `a=fmtp:${fm[1]} ${mergeFmtpParams(fm[2])}`;
    }
    return line;
  });

  // Add an fmtp line for any Opus PT that had an rtpmap but no fmtp.
  let result = out.join(eol);
  for (const pt of opusPts) {
    if (haveFmtp.has(pt)) continue;
    const rtpmapRe = new RegExp(`(a=rtpmap:${pt}\\s+opus/48000[^\\r\\n]*)`);
    result = result.replace(rtpmapRe, `$1${eol}a=fmtp:${pt} ${buildFmtpParams()}`);
  }

  // Pin ptime if none is present. Advisory only, added just once (idempotent) so
  // we never fight an explicitly negotiated value. Anchor after the first
  // a=rtpmap (guaranteed present — opusPts came from one) so the a= line lands
  // among the other a= attributes, after m=/c=/b= per RFC 4566 ordering.
  if (!/^a=ptime:/m.test(result)) {
    result = result.replace(/^(a=rtpmap:[^\r\n]*)/m, `$1${eol}a=ptime:${OPUS_PTIME_MS}`);
  }
  return result;
}

function mergeFmtpParams(existing: string): string {
  const params = new Map<string, string>();
  for (const kv of existing.split(';')) {
    const t = kv.trim();
    if (!t) continue;
    const eq = t.indexOf('=');
    if (eq === -1) params.set(t, '');
    else params.set(t.slice(0, eq), t.slice(eq + 1));
  }
  for (const [k, v] of Object.entries(OPUS_FMTP)) params.set(k, v);
  return [...params.entries()].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(';');
}

function buildFmtpParams(): string {
  return Object.entries(OPUS_FMTP)
    .map(([k, v]) => `${k}=${v}`)
    .join(';');
}

/**
 * Tune the browser's outbound audio RTCRtpSender via setParameters. Two things:
 *
 *  1. Hard-cap the Opus SEND bitrate. The SDP maxaveragebitrate is only a hint the
 *     remote may ignore; this guarantees the uplink (the direction thin upstreams
 *     feel most) stays within budget. WebRTC still congestion-controls below it.
 *  2. Mark voice as high network priority. `networkPriority='high'` makes the
 *     browser stamp DSCP EF (46) on outgoing RTP, so any DiffServ-aware hop
 *     (and the TURN-relay leg) queues our audio ahead of bulk traffic. This
 *     directly targets the diagnosed root cause — packet loss on the agent's
 *     congested last-mile. Best-effort: hops that don't honour DSCP just ignore
 *     the mark, so there is no downside where it's bleached.
 *
 * Best-effort overall — some browsers reject setParameters mid-negotiation; non-fatal.
 */
export async function capAudioSenderBitrate(
  pc: RTCPeerConnection,
  maxBitrate = OPUS_MAX_BITRATE
): Promise<void> {
  try {
    const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
    if (!sender) return;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    for (const enc of params.encodings) {
      enc.maxBitrate = maxBitrate;
      // DSCP EF marking for voice — prioritises RTP on congested/DiffServ paths.
      enc.networkPriority = 'high';
    }
    await sender.setParameters(params);
  } catch {
    // Non-fatal — quality tuning only, never block the call.
  }
}
