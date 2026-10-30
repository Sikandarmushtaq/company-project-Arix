/**
 * Client-side hold music for the SIP engine.
 *
 * WHY THIS EXISTS (not a server hold):
 * A SIP re-INVITE hold is unusable here. FreeSWITCH's music-on-hold is PCMU-native,
 * so on hold it re-answers the browser leg switching Opus→PCMU. Chrome refuses a
 * codec swap on an established transceiver → the call drops. Forcing Opus-only on the
 * hold offer instead makes FreeSWITCH answer 488 (it can't render Opus MOH). Proven
 * live 2026-08-12. So we hold WITHOUT any re-INVITE: swap the mic on the existing
 * RTCRtpSender for a music track via `replaceTrack` (no renegotiation, stays Opus) —
 * the remote hears real MOH and the call never renegotiates. Mirrors the LiveKit
 * hold fix. See project_sip_hold_drop_fix / project_livekit_hold_drop_fix.
 *
 * @module lib/sip/hold-music
 */

import { sipLogger as logger } from './logger';

export interface HoldMusicHandle {
  /** Looping music track to feed into an RTCRtpSender via replaceTrack. */
  track: MediaStreamTrack;
  /** Tear down the audio element + graph + context. Idempotent. */
  stop: () => void;
}

/**
 * Build a looping hold-music track from `/audio/hold-music.mp3` (the real PBX MOH,
 * already deployed to the frontend). Returns `null` if the file can't load in time —
 * the caller then falls back to a silent hold (mute the mic), which still works.
 */
export async function createHoldMusicTrack(): Promise<HoldMusicHandle | null> {
  let ctx: AudioContext | null = null;
  let el: HTMLAudioElement | null = null;
  try {
    ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* best-effort */
      }
    }
    const dest = ctx.createMediaStreamDestination();

    el = new Audio('/audio/hold-music.mp3');
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';

    const ready = await new Promise<boolean>((resolve) => {
      const audio = el as HTMLAudioElement;
      const to = setTimeout(() => finish(false), 1500);
      const finish = (ok: boolean) => {
        clearTimeout(to);
        audio.removeEventListener('canplaythrough', onOk);
        audio.removeEventListener('error', onErr);
        resolve(ok);
      };
      const onOk = () => finish(true);
      const onErr = () => finish(false);
      audio.addEventListener('canplaythrough', onOk, { once: true });
      audio.addEventListener('error', onErr, { once: true });
      audio.load();
    });

    if (!ready) {
      logger.warn('Hold music file not ready — falling back to silent hold');
      cleanup(ctx, el);
      return null;
    }

    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    src.connect(gain);
    gain.connect(dest);
    try {
      await el.play();
    } catch {
      /* autoplay may reject; the track is still produced from the graph */
    }

    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
      cleanup(ctx, el);
      return null;
    }

    const boundCtx = ctx;
    const boundEl = el;
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        track.stop();
      } catch {
        /* ignore */
      }
      cleanup(boundCtx, boundEl);
    };

    return { track, stop };
  } catch (err) {
    logger.warn('Failed to build hold music track — silent hold fallback', err);
    cleanup(ctx, el);
    return null;
  }
}

function cleanup(ctx: AudioContext | null, el: HTMLAudioElement | null): void {
  try {
    if (el) {
      el.pause();
      el.srcObject = null;
      el.src = '';
    }
  } catch {
    /* ignore */
  }
  try {
    if (ctx && ctx.state !== 'closed') void ctx.close();
  } catch {
    /* ignore */
  }
}
