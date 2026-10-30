/**
 * Support Inbox Ring Tone
 *
 * A DISTINCT looping alert for a new/unclaimed support request in the super-admin
 * inbox — deliberately NOT the phone ringtone, so an admin never confuses a
 * support ping with an incoming call. It's a two-note chirp (D5 + G5) with a
 * snappy 0.9 s on / 0.9 s off cadence.
 *
 * Locally generated via Web Audio (no asset). Keeps a single AudioContext + gain
 * alive, schedules each burst on the audio clock, and re-arms with setTimeout so
 * it loops until stopped. Autoplay-policy tolerant: if the context can't start
 * (no user gesture yet) it silently no-ops.
 *
 * @module lib/support-ring
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

class SupportRingTone {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  start(): void {
    if (this.playing) return;
    this.playing = true;
    if (!this.ensureContext()) {
      this.playing = false;
      return;
    }
    if (this.ctx!.state === 'suspended') {
      this.ctx!.resume().catch(() => {});
    }
    this.armCycle(0);
  }

  stop(): void {
    if (!this.playing && !this.timer && !this.ctx) return;
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.gainNode) {
      const now = this.ctx.currentTime;
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

  /** A short two-note chirp: D5 (587 Hz) → G5 (784 Hz), ~0.9 s total. */
  private playOneBurst(): void {
    if (!this.ctx || !this.gainNode) return;
    const now = this.ctx.currentTime;
    const peak = 0.22;

    const note = (freq: number, at: number, dur: number) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(this.gainNode!);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.05);
    };

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(0, now);
    // note 1
    this.gainNode.gain.linearRampToValueAtTime(peak, now + 0.04);
    this.gainNode.gain.setValueAtTime(peak, now + 0.34);
    this.gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
    // note 2 (higher)
    this.gainNode.gain.setValueAtTime(0, now + 0.45);
    this.gainNode.gain.linearRampToValueAtTime(peak, now + 0.49);
    this.gainNode.gain.setValueAtTime(peak, now + 0.84);
    this.gainNode.gain.linearRampToValueAtTime(0, now + 0.9);

    note(587, 0, 0.4);
    note(784, 0.45, 0.45);
  }

  private armCycle(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.playing) return;
      this.playOneBurst();
      // 0.9 s chirp + 0.9 s silence ≈ 1.8 s period — brisk, attention-getting.
      this.armCycle(1800);
    }, delayMs);
  }
}

let instance: SupportRingTone | null = null;
function get(): SupportRingTone {
  if (!instance) instance = new SupportRingTone();
  return instance;
}

export function playSupportRing(): void {
  get().start();
}

export function stopSupportRing(): void {
  get().stop();
}
