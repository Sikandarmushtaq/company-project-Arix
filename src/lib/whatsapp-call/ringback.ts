/**
 * WhatsApp Outbound Call Ringback Tone
 *
 * Plays a locally-generated US-standard ringback tone (350 + 440 Hz dual
 * sine, 2 s on / 4 s off) while an outbound WhatsApp call is in the
 * `connecting` state. Meta's Cloud Calling API does NOT send early-media
 * RTP — by spec the calling client is responsible for its own ringback,
 * same as every other VoIP softphone. Without this the agent hears
 * silence between pressing Call and the customer picking up, which the
 * support team correctly flagged as unprofessional.
 *
 * Why a fresh AudioContext instead of reusing the shared SIP
 * `callAudioService`: the SIP audio service is owned by the SIP store,
 * which stops the shared ringback whenever no SIP line is in a calling
 * state — that would cut WA ringback short the moment the agent's
 * idle SIP UA does anything. WA owns its own oscillator.
 *
 * Cadence implementation: rather than baking an 18 s WAV data URI like
 * the SIP side, we keep a single AudioContext + GainNode alive, schedule
 * each 2 s tone-on burst on the audio clock, and use setTimeout to
 * arm the next cycle 6 s later (2 s on + 4 s off). This is sample-accurate
 * for the tone duration and trivially stoppable mid-cycle — `stop()` just
 * ramps the gain to zero and cancels the pending timer.
 *
 * @module lib/whatsapp-call/ringback
 */

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class WaRingbackTone {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  start(): void {
    if (this.playing) return;
    this.playing = true;

    if (!this.ensureContext()) {
      // No Web Audio support, or autoplay blocked before user gesture —
      // silently no-op. The call still works; the agent just won't hear
      // the ringback. Matches the best-effort posture of `playWaRingtone`.
      this.playing = false;
      return;
    }

    // Some browsers leave the context suspended until a user gesture
    // touches it. The Call button click is a user gesture, so resume()
    // here should succeed in practice; ignore failures to stay tolerant.
    if (this.ctx!.state === 'suspended') {
      this.ctx!.resume().catch(() => {});
    }

    this.armCycle(0);
  }

  stop(): void {
    if (!this.playing && !this.nextCycleTimer && !this.ctx) return;
    this.playing = false;

    if (this.nextCycleTimer !== null) {
      clearTimeout(this.nextCycleTimer);
      this.nextCycleTimer = null;
    }

    if (this.ctx && this.gainNode) {
      const now = this.ctx.currentTime;
      // Short fade to avoid an audible click on cutoff.
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + 0.04);
    }
  }

  private ensureContext(): boolean {
    if (this.ctx && this.gainNode) return true;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0;
      this.gainNode.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      this.gainNode = null;
      return false;
    }
  }

  private playOneBurst(): void {
    if (!this.ctx || !this.gainNode) return;
    const now = this.ctx.currentTime;
    // US PSTN precise tone: 440 + 480 Hz mixed.
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = 440;
    osc2.frequency.value = 480;
    osc1.connect(this.gainNode);
    osc2.connect(this.gainNode);

    // Tone envelope: 50 ms ramp-in, 1.95 s hold at 0.3 gain, 50 ms ramp-out.
    const peak = 0.3;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(0, now);
    this.gainNode.gain.linearRampToValueAtTime(peak, now + 0.05);
    this.gainNode.gain.setValueAtTime(peak, now + 1.95);
    this.gainNode.gain.linearRampToValueAtTime(0, now + 2.0);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.05);
    osc2.stop(now + 2.05);
  }

  private armCycle(delayMs: number): void {
    this.nextCycleTimer = setTimeout(() => {
      this.nextCycleTimer = null;
      if (!this.playing) return;
      this.playOneBurst();
      // 2 s tone-on + 4 s tone-off = 6 s period (US standard cadence).
      this.armCycle(6000);
    }, delayMs);
  }
}

// Module-scoped singleton. WA only has one outbound call at a time, and
// the React provider's lifecycle owns the start/stop calls.
let instance: WaRingbackTone | null = null;

function get(): WaRingbackTone {
  if (!instance) instance = new WaRingbackTone();
  return instance;
}

export function playWaRingback(): void {
  get().start();
}

export function stopWaRingback(): void {
  get().stop();
}
