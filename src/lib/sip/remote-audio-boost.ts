/**
 * Remote Audio Boost + GTCRN Noise Suppression
 *
 * Processes the REMOTE party's call audio in the browser before it reaches the
 * speaker. Two independent, opt-in stages sit on the received WebRTC stream:
 *
 *   remote stream → [GTCRN denoise?] → [center] → [gain] → [limiter] → speaker
 *
 * - **Volume Boost** amplifies past the `<audio>` element's 100% ceiling via a
 *   `GainNode`, feeding the result back into the SAME element through a
 *   `MediaStreamDestination` (preserves `setSinkId` + per-element volume).
 * - **Noise Suppression** runs GTCRN (ICASSP-2024 ultra-light model, ~48K
 *   params — outperforms RNNoise at similar cost) as a WASM AudioWorklet, off
 *   the main thread, to strip the far end's background noise. Free
 *   (BSD/Apache-2.0), single-threaded (no SharedArrayBuffer / COOP-COEP), 48 kHz
 *   — the context is pinned accordingly. The worklet + wasm are served as static
 *   assets from `public/gtcrn/`.
 *
 * GTCRN is a fixed neural model — it has no strength dial. Its ONLY telephony
 * weakness is over-suppression: on 8 kHz PCMU upsampled to 48 kHz it drives
 * noise bands toward silence with no floor (−23 to −34 dB measured), past the
 * ~15 dB safe ceiling, which reads as "underwater/choppy". Every serious NS caps
 * attenuation instead (WebRTC's aggressive mode = 15 dB; RNNoise's author =
 * ~15 dB). We enforce that ceiling by blending a small, fixed fraction of the
 * DRY (original) signal back under the denoised (wet) one — a hard attenuation
 * floor of 20·log10(DRY_MIX) dB with natural residual room tone. That is the one
 * "best-practice spec" GTCRN needs; there is nothing else to tune.
 *
 * Design goals:
 * - **Zero-risk default.** With both stages off, the raw stream is attached to
 *   the element directly — byte-for-byte the previous behaviour.
 * - **Never break audio.** Every Web Audio call is guarded; on ANY failure we
 *   fall back to the raw stream so the call is always audible. If the model
 *   fails to load, we run gain + limiter (or passthrough) — audio never drops.
 * - **Live + persistent.** Toggles apply to active calls immediately and are
 *   remembered across sessions via localStorage.
 *
 * @module lib/sip/remote-audio-boost
 */

import { sipLogger as logger } from './logger';

// NOTE: `@sapphi-red/web-noise-suppressor` declares `class extends
// AudioWorkletNode` at module top level (a browser-only global). Importing it
// statically would crash Next's server render/build. So it is loaded via a
// client-only dynamic import inside ensureDenoise(), never at module scope.
type DenoiseCtor = new (
  ctx: AudioContext,
  opts: { maxChannels: number; wasmBinary: ArrayBuffer }
) => AudioWorkletNode;

export interface VolumeBoostSettings {
  /** Whether boosting is engaged. When false, no gain is applied. */
  enabled: boolean;
  /** Amplification multiplier applied to remote audio (1.0 = 100%, no boost). */
  gain: number;
  /** Whether GTCRN noise suppression is engaged on the remote audio. */
  noiseSuppression: boolean;
}

/** Boost range. 1.0 = no boost; MAX kept moderate to avoid clipping/distortion. */
export const BOOST_MIN = 1.0;
export const BOOST_MAX = 4.0;
export const BOOST_DEFAULT_GAIN = 2.0;

const DEFAULT_SETTINGS: VolumeBoostSettings = {
  enabled: false,
  gain: BOOST_DEFAULT_GAIN,
  noiseSuppression: false,
};
const STORAGE_KEY = 'arixcall.volumeBoost';

/** GTCRN static assets (worklet module + wasm), served from public/. */
const GTCRN_WORKLET_URL = '/gtcrn/gtcrnWorklet.js';
const GTCRN_WASM_URL = '/gtcrn/gtcrn.wasm';

/**
 * The one GTCRN telephony spec: fraction of the DRY (original) signal blended
 * back under the denoised (wet) one. Enforces a hard attenuation floor of
 * 20·log10(0.15) ≈ −16.5 dB — matching WebRTC's "aggressive" 15 dB cap and
 * RNNoise's author's recommendation — so noise is suppressed to a natural floor
 * instead of a dead/pumping silence. During speech wet≈dry so the voice is
 * fully preserved; during noise wet≈0 so the sum settles at the floor.
 */
const DRY_MIX = 0.15;

/** GTCRN algorithmic latency = one 768-sample frame @48 kHz = 16 ms. The dry
 *  leg is delayed by this so the wet/dry sum stays time-coherent (no comb echo). */
const GTCRN_LATENCY_SEC = 768 / 48000;

/** Per-line Web Audio graph + the pieces needed to rebuild/tear it down. */
interface LinePipeline {
  audioElement: HTMLAudioElement;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode | null;
  /** GTCRN denoise node (AudioWorklet), when noise suppression is engaged. */
  denoise: AudioWorkletNode | null;
  /** Wet (denoised) and dry (original) mix legs + their summing node. The dry
   *  leg enforces the attenuation floor (see DRY_MIX). */
  wetGain: GainNode | null;
  dryGain: GainNode | null;
  mixNode: GainNode | null;
  /** Delay on the dry leg that aligns it to GTCRN's ~16 ms latency so the mix
   *  is time-coherent (no comb-filter echo). */
  dryDelay: DelayNode | null;
  /** Channel normaliser: duplicates channel 0 to both L+R so mono phone audio
   *  (or a worklet that only writes ch0) is centered, not stuck in one ear. */
  splitter: ChannelSplitterNode | null;
  merger: ChannelMergerNode | null;
  gainNode: GainNode | null;
  /** Transparent safety limiter after the gain — soft knee, gentle ratio, so it
   *  protects peaks without the pumping/distortion of a brick-wall limiter. */
  limiter: DynamicsCompressorNode | null;
  destination: MediaStreamAudioDestinationNode | null;
  /** Muted element kept attached to the RAW stream so the MediaStreamAudioSource
   *  keeps producing samples on browsers that silence a source whose stream is
   *  not attached to any media element. Muted → never adds audible output. */
  pump: HTMLAudioElement | null;
  /** The stream the booster last assigned to the element — used to detect when
   *  another owner (e.g. the conference mixer) has taken over the element. */
  lastSet: MediaStream | null;
}

class RemoteAudioBoost {
  private settings: VolumeBoostSettings;
  private audioContext: AudioContext | null = null;
  private readonly lines = new Map<number, LinePipeline>();
  private readonly listeners = new Set<(s: VolumeBoostSettings) => void>();

  // GTCRN loading state. `wasm` is context-independent (reusable); the worklet
  // MODULE is per-AudioContext, so `workletAdded`/`ready` reset when the context
  // is (re)created. `loading` de-dupes concurrent load attempts.
  private denoiseWasm: ArrayBuffer | null = null;
  private workletAdded = false;
  private denoiseReady = false;
  private denoiseLoading: Promise<void> | null = null;
  /** Worklet node constructor (GTCRN), from the client-only dynamic import. */
  private DenoiseNodeCtor: DenoiseCtor | null = null;

  constructor() {
    this.settings = this.load();
  }

  // ── public state ─────────────────────────────────────────────────────────

  getSettings(): VolumeBoostSettings {
    return { ...this.settings };
  }

  /** Subscribe to settings changes (for UI). Returns an unsubscribe fn. */
  subscribe(fn: (s: VolumeBoostSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setEnabled(enabled: boolean): void {
    if (this.settings.enabled === enabled) return;
    this.settings.enabled = enabled;
    this.persist();
    for (const [lineId] of this.lines) this.rewire(lineId);
    this.notify();
  }

  /** Set the boost multiplier (clamped). Applies live to active calls. */
  setGain(gain: number): void {
    const clamped = Math.min(BOOST_MAX, Math.max(BOOST_MIN, Number.isFinite(gain) ? gain : BOOST_MIN));
    this.settings.gain = clamped;
    this.persist();
    if (this.settings.enabled) {
      for (const pipe of this.lines.values()) this.applyGainValue(pipe);
    }
    this.notify();
  }

  /** Toggle GTCRN noise suppression. Loads the model on first enable, then rewires. */
  setNoiseSuppression(enabled: boolean): void {
    if (this.settings.noiseSuppression === enabled) return;
    this.settings.noiseSuppression = enabled;
    this.persist();
    if (enabled) void this.ensureDenoise();
    for (const [lineId] of this.lines) this.rewire(lineId);
    this.notify();
  }

  /**
   * Eagerly load the GTCRN worklet + wasm so it's ready before the first call
   * (avoids a moment of un-denoised audio). Safe to call anytime; no-op if
   * already loaded or if suppression is off. Call once after login.
   */
  preload(): void {
    if (this.settings.noiseSuppression) void this.ensureDenoise();
  }

  // ── attach / release (called by the SIP media setup) ──────────────────────

  /**
   * Attach a remote stream to its audio element, routing through the processing
   * chain when boost or noise suppression is enabled. REPLACES a direct
   * `audioElement.srcObject = stream`. Safe to call repeatedly (idempotent).
   */
  attach(lineId: number, audioElement: HTMLAudioElement, stream: MediaStream): void {
    const pipe: LinePipeline = {
      audioElement,
      stream,
      source: null,
      denoise: null,
      wetGain: null,
      dryGain: null,
      mixNode: null,
      dryDelay: null,
      splitter: null,
      merger: null,
      gainNode: null,
      limiter: null,
      destination: null,
      pump: null,
      lastSet: null,
    };
    this.lines.set(lineId, pipe);
    // If suppression is on but not yet loaded, this kicks off the load and the
    // line re-wires (adding the denoiser) once it's ready.
    if (this.settings.noiseSuppression && !this.denoiseReady) void this.ensureDenoise();
    this.rewire(lineId);
  }

  /** Tear down the processing graph for a line and forget it. */
  release(lineId: number): void {
    const pipe = this.lines.get(lineId);
    if (!pipe) return;
    this.teardownGraph(pipe);
    this.lines.delete(lineId);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** (Re)build a line's audio path to match the current enabled/gain/NS state. */
  private rewire(lineId: number): void {
    const pipe = this.lines.get(lineId);
    if (!pipe) return;

    // If another owner (e.g. the conference mixer) has swapped this element's
    // srcObject out from under us, don't fight it — yield until the next
    // attach() re-establishes us as the owner.
    if (pipe.lastSet && pipe.audioElement.srcObject !== pipe.lastSet) return;

    // Always drop any prior graph first so we never leak/duplicate nodes.
    this.teardownGraph(pipe);

    const wantNs =
      this.settings.noiseSuppression &&
      this.denoiseReady &&
      !!this.denoiseWasm &&
      !!this.DenoiseNodeCtor;

    const wantGraph = this.settings.enabled || wantNs;

    // No 48 kHz graph needed → attach the raw stream directly (passthrough).
    if (!wantGraph) {
      this.setSrcObject(pipe, pipe.stream);
      return;
    }

    try {
      const ctx = this.getContext();
      const source = ctx.createMediaStreamSource(pipe.stream);
      let head: AudioNode = source;

      // GTCRN denoise first (cleans the far end before we amplify it), blended
      // with a dry leg that enforces the attenuation floor.
      if (wantNs) {
        const Ctor = this.DenoiseNodeCtor as DenoiseCtor;
        const dn = new Ctor(ctx, {
          maxChannels: 1,
          wasmBinary: this.denoiseWasm as ArrayBuffer,
        });

        const wetGain = ctx.createGain();
        const dryGain = ctx.createGain();
        const dryDelay = ctx.createDelay(0.2);
        const mixNode = ctx.createGain();
        wetGain.gain.value = 1 - DRY_MIX;
        dryGain.gain.value = DRY_MIX;
        dryDelay.delayTime.value = GTCRN_LATENCY_SEC;
        mixNode.gain.value = 1;

        head.connect(dn); // wet path: raw → GTCRN → wetGain → mix
        dn.connect(wetGain);
        wetGain.connect(mixNode);

        head.connect(dryDelay); // dry path: raw → delay(≈16ms) → dryGain → mix
        dryDelay.connect(dryGain);
        dryGain.connect(mixNode);

        head = mixNode;

        pipe.denoise = dn;
        pipe.wetGain = wetGain;
        pipe.dryGain = dryGain;
        pipe.dryDelay = dryDelay;
        pipe.mixNode = mixNode;
      }

      // Center the audio: the far end is mono, and the denoise worklet can emit
      // stereo with signal only on channel 0 → sound only in the left ear. Force
      // channel 0 to BOTH output channels so it plays centered at full level.
      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);
      head.connect(splitter);
      splitter.connect(merger, 0, 0); // ch0 → left
      splitter.connect(merger, 0, 1); // ch0 → right
      head = merger;
      pipe.splitter = splitter;
      pipe.merger = merger;

      const gainNode = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      // Transparent safety limiter (not a brick wall): soft knee, gentle ratio,
      // fast attack — protects peaks without pumping/distortion.
      limiter.threshold.value = -3;
      limiter.knee.value = 24;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      const destination = ctx.createMediaStreamDestination();
      head.connect(gainNode);
      gainNode.connect(limiter);
      limiter.connect(destination);

      pipe.source = source;
      pipe.gainNode = gainNode;
      pipe.limiter = limiter;
      pipe.destination = destination;
      this.applyGainValue(pipe);

      // Keep the raw stream flowing to the source node on browsers that would
      // otherwise silence it (muted → contributes no audible output).
      const pump = pipe.pump ?? new Audio();
      pump.muted = true;
      pump.autoplay = true;
      if (pump.srcObject !== pipe.stream) pump.srcObject = pipe.stream;
      pump.play?.().catch(() => {});
      pipe.pump = pump;

      this.setSrcObject(pipe, destination.stream);
    } catch (err) {
      // Web Audio unavailable/failed → never leave the call silent.
      logger.warn('Remote audio processing failed, falling back to direct audio:', err);
      this.teardownGraph(pipe);
      this.setSrcObject(pipe, pipe.stream);
    }
  }

  /**
   * Load GTCRN (wasm binary once, worklet module per-context), then re-wire
   * active lines so denoising engages. Fully guarded: on failure suppression
   * silently stays off and audio is unaffected.
   */
  private async ensureDenoise(): Promise<void> {
    if (this.denoiseReady) return;
    if (this.denoiseLoading) return this.denoiseLoading;
    this.denoiseLoading = (async () => {
      try {
        const ctx = this.getContext();
        // Client-only dynamic import — keeps the browser-global class off the
        // server render/build path.
        const mod = await import('@sapphi-red/web-noise-suppressor');
        this.DenoiseNodeCtor = mod.GtcrnWorkletNode as unknown as DenoiseCtor;
        this.denoiseWasm = await mod.loadGtcrn({ url: GTCRN_WASM_URL });
        if (!this.workletAdded) {
          await ctx.audioWorklet.addModule(GTCRN_WORKLET_URL);
          this.workletAdded = true;
        }
        this.denoiseReady = true;
        // Insert the denoiser into any active line now that it's ready.
        for (const [lineId] of this.lines) this.rewire(lineId);
      } catch (err) {
        logger.warn('GTCRN load failed; continuing without noise suppression:', err);
      } finally {
        this.denoiseLoading = null;
      }
    })();
    return this.denoiseLoading;
  }

  private applyGainValue(pipe: LinePipeline): void {
    if (!pipe.gainNode || !this.audioContext) return;
    const target = this.settings.enabled ? this.settings.gain : 1.0;
    try {
      const now = this.audioContext.currentTime;
      pipe.gainNode.gain.setTargetAtTime(target, now, 0.03);
    } catch {
      pipe.gainNode.gain.value = target;
    }
  }

  private setSrcObject(pipe: LinePipeline, stream: MediaStream): void {
    try {
      if (pipe.audioElement.srcObject !== stream) {
        pipe.audioElement.srcObject = stream;
      }
      pipe.lastSet = stream;
      pipe.audioElement.play?.().catch(() => {});
    } catch (err) {
      logger.warn('Failed to set remote audio srcObject:', err);
    }
  }

  private teardownGraph(pipe: LinePipeline): void {
    for (const n of [
      pipe.source,
      pipe.denoise,
      pipe.wetGain,
      pipe.dryGain,
      pipe.dryDelay,
      pipe.mixNode,
      pipe.splitter,
      pipe.merger,
      pipe.gainNode,
      pipe.limiter,
    ]) {
      try {
        n?.disconnect();
      } catch {
        /* noop */
      }
    }
    if (pipe.pump) {
      try {
        pipe.pump.pause();
        pipe.pump.srcObject = null;
      } catch {
        /* noop */
      }
      pipe.pump = null;
    }
    // A MediaStreamDestination has no explicit teardown; dropping the ref is enough.
    pipe.source = null;
    pipe.denoise = null;
    pipe.wetGain = null;
    pipe.dryGain = null;
    pipe.dryDelay = null;
    pipe.mixNode = null;
    pipe.splitter = null;
    pipe.merger = null;
    pipe.gainNode = null;
    pipe.limiter = null;
    pipe.destination = null;
  }

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      // GTCRN needs 48 kHz; pin it. Fall back to default if the browser rejects
      // the option (older Safari).
      try {
        this.audioContext = new Ctor({ sampleRate: 48000 });
      } catch {
        this.audioContext = new Ctor();
      }
      // The worklet module is per-context — a fresh context must re-add it.
      this.workletAdded = false;
      this.denoiseReady = false;
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  // ── persistence ────────────────────────────────────────────────────────────

  private load(): VolumeBoostSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<VolumeBoostSettings>;
        const gain = Math.min(
          BOOST_MAX,
          Math.max(BOOST_MIN, typeof parsed.gain === 'number' ? parsed.gain : BOOST_DEFAULT_GAIN)
        );
        return {
          enabled: parsed.enabled === true,
          gain,
          noiseSuppression: parsed.noiseSuppression === true,
        };
      }
    } catch {
      /* ignore malformed storage */
    }
    return { ...DEFAULT_SETTINGS };
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }

  private notify(): void {
    const snapshot = this.getSettings();
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {
        /* a bad listener must not break others */
      }
    });
  }
}

// Pin the singleton on globalThis so a dev hot-reload of this module reuses the
// SAME instance. Without this, HMR creates a fresh instance while the active
// call stays attached to the old one. (Prod has no HMR; this is a no-op there.)
const _g = globalThis as unknown as { __remoteAudioBoost?: RemoteAudioBoost };
export const remoteAudioBoost: RemoteAudioBoost =
  _g.__remoteAudioBoost ?? (_g.__remoteAudioBoost = new RemoteAudioBoost());
