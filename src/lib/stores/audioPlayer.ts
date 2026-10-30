import { create } from 'zustand';

/**
 * SSOT audio player.
 *
 * A SINGLE shared HTMLAudioElement drives every <AudioPlayer/> in the app.
 * Because only one element ever exists:
 *   • Only one clip can ever play — clicking B while A plays swaps the source,
 *     which stops A instantly (an element can hold one source at a time).
 *   • Rapid clicking can't spawn "ghost" / overlapping audio — there is nothing
 *     to overlap. Toggle decisions read the element's real `.paused` (not lagged
 *     React state), and superseded play() promise rejections are ignored via a
 *     monotonic token, so stress-clicking never glitches.
 *
 * Components subscribe to reactive state (activeId/playing/time/duration/rate)
 * and call the actions; they never touch the element directly.
 */
interface AudioState {
  activeId: string | null;
  activeUrl: string | null;
  playing: boolean;
  /** Buffering — set between a play intent and actual playback (spinner). */
  waiting: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  toggle: (id: string, url: string) => void;
  play: (id: string, url: string) => void;
  pause: () => void;
  seek: (time: number) => void;
  setRate: (rate: number) => void;
  stop: () => void;
}

let audioEl: HTMLAudioElement | null = null;
// Monotonic token: each play()/source-swap bumps it. An in-flight play() whose
// token is stale (a newer action superseded it) ignores its own rejection.
let playToken = 0;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (audioEl) return audioEl;

  const el = new Audio();
  el.preload = 'metadata';

  const set = useAudioStore.setState;
  el.addEventListener('timeupdate', () => set({ currentTime: el.currentTime }));
  el.addEventListener('durationchange', () =>
    set({ duration: Number.isFinite(el.duration) ? el.duration : 0 })
  );
  el.addEventListener('loadedmetadata', () => {
    // Some browsers reset playbackRate when a fresh source loads — reassert it.
    el.playbackRate = useAudioStore.getState().rate;
    set({ duration: Number.isFinite(el.duration) ? el.duration : 0 });
  });
  el.addEventListener('play', () => set({ playing: true }));
  el.addEventListener('playing', () => set({ playing: true, waiting: false }));
  el.addEventListener('waiting', () => set({ waiting: true }));
  el.addEventListener('canplay', () => set({ waiting: false }));
  el.addEventListener('pause', () => set({ playing: false, waiting: false }));
  el.addEventListener('ended', () => {
    el.currentTime = 0; // reset so the same clip can be replayed cleanly
    set({ playing: false, waiting: false, currentTime: 0 });
  });

  audioEl = el;
  return el;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  activeId: null,
  activeUrl: null,
  playing: false,
  waiting: false,
  currentTime: 0,
  duration: 0,
  rate: 1,

  play: async (id, url) => {
    const el = getAudio();
    if (!el) return;
    const token = ++playToken;

    // New clip OR a fresh URL for the same id (object URLs regenerate) → swap
    // source (this stops whatever was playing) and reset counters.
    if (get().activeId !== id || get().activeUrl !== url) {
      el.src = url;
      el.playbackRate = get().rate;
      set({ activeId: id, activeUrl: url, currentTime: 0, duration: 0, waiting: false });
    } else if (el.ended) {
      el.currentTime = 0;
    }

    // Show the spinner immediately if the media isn't ready to play through
    // (readyState < HAVE_FUTURE_DATA); the 'playing'/'canplay' events clear it.
    if (el.readyState < 3) set({ waiting: true });

    try {
      await el.play();
    } catch {
      // AbortError: a newer play()/pause()/source-swap interrupted this one.
      // If we've been superseded, stay silent — the newer action owns state.
      if (token !== playToken) return;
    }
  },

  pause: () => {
    getAudio()?.pause();
  },

  // Toggle off the element's real state, not (possibly lagged) React state —
  // this is what makes stress-clicking glitch-free.
  toggle: (id, url) => {
    const el = getAudio();
    if (!el) return;
    if (get().activeId === id && !el.paused) {
      get().pause();
    } else {
      get().play(id, url);
    }
  },

  seek: (time) => {
    const el = getAudio();
    if (!el) return;
    const t = Math.max(0, Math.min(time, el.duration || time));
    el.currentTime = t;
    set({ currentTime: t });
  },

  setRate: (rate) => {
    const el = getAudio();
    if (el) el.playbackRate = rate;
    set({ rate });
  },

  stop: () => {
    const el = getAudio();
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    set({ activeId: null, activeUrl: null, playing: false, waiting: false, currentTime: 0, duration: 0 });
  },
}));
