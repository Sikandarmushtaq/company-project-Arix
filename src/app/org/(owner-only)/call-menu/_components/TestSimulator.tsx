'use client';

/**
 * "Test call" — walks the call-flow in the browser (no telephony) so an owner can
 * hear and step through exactly what a caller experiences. Greeting/menu prompts
 * are spoken in the SAME Piper voice callers hear (rendered by the backend
 * `/ivr/preview-audio`, cached per prompt), key presses play real DTMF tones, and
 * ring/voicemail steps get an audible cue. If the server can't render audio we
 * fall back to the device voice. Each menu key shows where it routes, and the
 * menu explains what happens for keys that aren't set up.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiPhone, FiPhoneCall, FiRotateCcw, FiX, FiVolume2, FiLoader, FiPlay } from 'react-icons/fi';
import { Modal, Button } from '@/components/ui';
import type { IvrFlow, IvrNode } from '@/lib/api/services/ivr.api';
import { ivrApi } from '@/lib/api/services/ivr.api';
import { NODE_META } from './ivrNodes';

interface Step {
  nodeId: string;
  note: string;
}

/** Standard DTMF dual-tone frequencies (Hz) per key. */
const DTMF: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

export function TestSimulator({ flow, onClose }: { flow: IvrFlow; onClose: () => void }) {
  const byId = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n])), [flow.nodes]);
  const entry = useMemo(() => flow.nodes.find((n) => n.type === 'entry'), [flow.nodes]);

  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<IvrNode | null>(null);
  const [log, setLog] = useState<Step[]>([]);
  const [ended, setEnded] = useState(false);

  // Audio plumbing — all lazily created inside user gestures (SSR-safe, and so
  // autoplay restrictions never bite: the call only starts on a click).
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map()); // prompt key → data URI ('' = use device voice)
  const playGenRef = useRef(0); // bumped on every stop/navigation so a late async render can't play over the current step
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [audioMode, setAudioMode] = useState<'piper' | 'device' | 'none'>('none');

  const firstAfterEntry = useCallback((): IvrNode | null => {
    if (!entry) return null;
    const e = flow.edges.find((x) => x.source === entry.id);
    return e ? (byId.get(e.target) ?? null) : null;
  }, [entry, flow.edges, byId]);

  const getAudioCtx = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  };

  /** Stop any in-flight prompt audio or device speech, and supersede pending renders. */
  const stopAudio = useCallback(() => {
    playGenRef.current += 1;
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setAudioState((s) => (s === 'loading' ? s : 'idle'));
  }, []);

  /** A short two-tone beep (DTMF or a generic cue). */
  const playTones = useCallback((f1: number, f2: number | null, ms: number) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const freqs = f2 ? [f1, f2] : [f1];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + ms / 1000);
    }
    // Gentle release to avoid a click.
    gain.gain.setValueAtTime(0.12, now + ms / 1000 - 0.02);
    gain.gain.linearRampToValueAtTime(0, now + ms / 1000);
  }, []);

  const playDtmf = useCallback((key: string) => {
    const pair = DTMF[key];
    if (pair) playTones(pair[0], pair[1], 160);
  }, [playTones]);

  /** US ringback cadence cue (440 + 480 Hz), one short burst. */
  const playRingback = useCallback(() => {
    playTones(440, 480, 900);
  }, [playTones]);

  /** Speak with the device voice as a fallback when server TTS is unavailable. */
  const deviceSpeak = useCallback((text: string, voice?: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setAudioMode('none');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    // Best-effort: match the Piper voice's gender hint (…-ryan-…/…-joe-… = male).
    const male = /-(ryan|joe)-/.test(voice ?? '');
    const voices = window.speechSynthesis.getVoices();
    const pick = voices.find((v) => v.lang.startsWith('en') && (male ? /male/i.test(v.name) && !/female/i.test(v.name) : /female|samantha|zira|google us/i.test(v.name)))
      ?? voices.find((v) => v.lang.startsWith('en'));
    if (pick) u.voice = pick;
    u.onstart = () => setAudioState('playing');
    u.onend = () => setAudioState('idle');
    setAudioMode('device');
    window.speechSynthesis.speak(u);
  }, []);

  /** Play a node's prompt — Piper (exact caller voice) with device-voice fallback. */
  const playPrompt = useCallback(async (node: IvrNode) => {
    stopAudio();
    const text = node.data.prompt?.text?.trim();
    if (!text) {
      // An uploaded recording (audioKey) or an empty prompt — nothing to synthesize here.
      setAudioMode('none');
      setAudioState('idle');
      return;
    }
    const voice = node.data.prompt?.voice;
    const key = `${voice ?? 'default'}|${text}`;
    const gen = playGenRef.current; // stopAudio() above bumped it; this is now the live render
    try {
      let uri = cacheRef.current.get(key);
      if (uri === undefined) {
        setAudioState('loading');
        const res = await ivrApi.previewAudio(text, voice);
        uri = res.audio ?? ''; // '' → server can't render; use device voice
        cacheRef.current.set(key, uri);
      }
      // A newer step was entered while we were fetching — drop this stale render.
      if (gen !== playGenRef.current) return;
      if (uri) {
        if (!audioElRef.current) audioElRef.current = new Audio();
        const el = audioElRef.current;
        el.src = uri;
        el.onplay = () => setAudioState('playing');
        el.onended = () => setAudioState('idle');
        el.onerror = () => deviceSpeak(text, voice);
        setAudioMode('piper');
        await el.play().catch(() => deviceSpeak(text, voice));
      } else {
        deviceSpeak(text, voice);
      }
    } catch {
      if (gen === playGenRef.current) deviceSpeak(text, voice);
    }
  }, [stopAudio, deviceSpeak]);

  /** Cue the audio appropriate to a newly-entered node. */
  const cueFor = useCallback((node: IvrNode | null) => {
    if (!node) return;
    if (node.type === 'greeting' || node.type === 'menu') {
      void playPrompt(node);
    } else if (node.type === 'ring_user' || node.type === 'ring_group') {
      stopAudio();
      playRingback();
    } else {
      stopAudio();
    }
  }, [playPrompt, stopAudio, playRingback]);

  const landsImmediately = (n: IvrNode) =>
    n.type === 'voicemail' || n.type === 'hangup' || n.type === 'transfer';

  const goto = useCallback((node: IvrNode | null, note: string) => {
    setLog((l) => [...l, { nodeId: current?.id ?? 'entry', note }]);
    if (!node) {
      stopAudio();
      setEnded(true);
      setCurrent(null);
      return;
    }
    if (landsImmediately(node)) {
      setLog((l) => [...l, { nodeId: node.id, note: endNote(node) }]);
      if (node.type === 'voicemail') playTones(480, null, 500); // voicemail "leave a message" beep
      else stopAudio();
      setEnded(true);
      setCurrent(node);
      return;
    }
    setCurrent(node);
    cueFor(node);
  }, [current, stopAudio, cueFor, playTones]);

  const follow = (sourceHandle?: string) => {
    if (!current) return;
    if (current.type === 'menu' && sourceHandle) playDtmf(sourceHandle);

    // Ring steps are terminal in what we actually publish: on no answer the call
    // goes to the person's OWN voicemail (ring_user → `transfer *99<ext>`) or the
    // team's OWN no-answer setting (ring_group → the FusionPBX ring group). A step
    // wired AFTER a ring is NOT published (same limitation the publish dialog warns
    // about), so don't follow it here — that would show a path the caller never
    // takes.
    if (current.type === 'ring_user' || current.type === 'ring_group') {
      const landed =
        current.type === 'ring_user'
          ? 'No answer — went to voicemail; caller leaves a message.'
          : 'No answer — followed the team’s own no-answer setting.';
      setLog((l) => [
        ...l,
        { nodeId: current.id, note: describeChoice(current, sourceHandle) },
        { nodeId: current.id, note: landed },
      ]);
      stopAudio();
      if (current.type === 'ring_user') playTones(480, null, 500);
      setEnded(true);
      return;
    }

    const e = flow.edges.find(
      (x) => x.source === current.id && (sourceHandle ? x.sourceHandle === sourceHandle : true)
    );
    goto(e ? (byId.get(e.target) ?? null) : null, describeChoice(current, sourceHandle));
  };

  const begin = useCallback(() => {
    const first = firstAfterEntry();
    setStarted(true);
    setLog([]);
    setEnded(false);
    if (first && landsImmediately(first)) {
      setLog([{ nodeId: first.id, note: endNote(first) }]);
      setEnded(true);
      setCurrent(first);
      if (first.type === 'voicemail') playTones(480, null, 500);
      return;
    }
    setCurrent(first);
    cueFor(first);
  }, [firstAfterEntry, cueFor, playTones]);

  const restart = () => {
    stopAudio();
    begin();
  };

  // Stop audio and release the WebAudio context when the modal unmounts.
  useEffect(
    () => () => {
      stopAudio();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    },
    [stopAudio]
  );

  const hasFlow = !!entry && !!firstAfterEntry();

  return (
    <Modal isOpen onClose={onClose} title="Test call" size="md">
      <div className="space-y-4">
        {/* Phone-style screen */}
        <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--muted)]/40 to-[var(--muted)]/10 p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1.5">
              <FiPhone className="h-3.5 w-3.5" /> Simulated call — no real number is dialed
            </span>
            {started && <AudioBadge state={audioState} mode={audioMode} />}
          </div>

          {!hasFlow ? (
            <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
              Connect the start step to something to test the flow.
            </p>
          ) : !started ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <FiPhoneCall className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Ready to test</div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                You’ll hear exactly what a caller hears and can press keys to route the call.
              </div>
              <Button className="mt-3" onClick={begin}>
                <FiPhoneCall className="mr-1.5 h-4 w-4" /> Start test call
              </Button>
            </div>
          ) : ended || !current ? (
            <div className="py-6 text-center">
              <div className="text-sm font-semibold text-[var(--foreground)]">Call ended</div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                {log[log.length - 1]?.note ?? 'The call finished.'}
              </div>
            </div>
          ) : (
            <ActiveStep
              node={current}
              flow={flow}
              byId={byId}
              audioState={audioState}
              onReplay={() => playPrompt(current)}
              onContinue={follow}
            />
          )}
        </div>

        {/* Path log */}
        {log.length > 0 && (
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-[var(--muted-foreground)]">Call path</div>
            {log.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-[var(--foreground)]">
                <span className="text-[var(--muted-foreground)]">{i + 1}.</span> {s.note}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={restart} disabled={!hasFlow}>
            <FiRotateCcw className="mr-1.5 h-4 w-4" /> Restart
          </Button>
          <Button variant="outline" onClick={onClose}>
            <FiX className="mr-1.5 h-4 w-4" /> Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AudioBadge({ state, mode }: { state: 'idle' | 'loading' | 'playing'; mode: 'piper' | 'device' | 'none' }) {
  if (state === 'loading')
    return (
      <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
        <FiLoader className="h-3 w-3 animate-spin" /> loading voice…
      </span>
    );
  if (state === 'playing')
    return (
      <span className="flex items-center gap-1 text-emerald-500">
        <FiVolume2 className="h-3 w-3 animate-pulse" />
        {mode === 'device' ? 'device voice' : 'playing'}
      </span>
    );
  return null;
}

/**
 * Which business-hours branch the CURRENT time would take, evaluated in the node's
 * timezone — a hint for the tester (they can still explore any branch by clicking).
 */
function hoursBranchNow(node: IvrNode): 'open' | 'closed' | 'holiday' {
  const tz = node.data.timezone || undefined;
  let wday = 0; // 1=Sun … 7=Sat
  let hhmm = '';
  let mmdd = '';
  let ymd = '';
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const wmap: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
    wday = wmap[get('weekday')] ?? 0;
    const hour = get('hour') === '24' ? '00' : get('hour');
    hhmm = `${hour}:${get('minute')}`;
    mmdd = `${get('month')}-${get('day')}`;
    ymd = `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return 'closed';
  }
  const inRange = (date: string, start: string, end?: string) => {
    const cmp = /^\d{4}-/.test(date) ? ymd : mmdd;
    return end ? cmp >= date && cmp <= end : cmp === date;
  };
  const isHoliday = (node.data.holidays ?? []).some((h) => inRange(h.date, h.date, h.endDate));
  if (isHoliday) return (node.data.holidays?.length ?? 0) > 0 ? 'holiday' : 'closed';
  // Match the compiled dialplan's time-of-day, which is inclusive of the end minute.
  const isOpen = (node.data.hours ?? []).some(
    (iv) => iv.day === wday && hhmm >= iv.start && hhmm <= iv.end
  );
  return isOpen ? 'open' : 'closed';
}

/** Plain-language description of where a menu/hours branch routes the caller. */
function routeLabel(flow: IvrFlow, byId: Map<string, IvrNode>, node: IvrNode, handle: string): string {
  const e = flow.edges.find((x) => x.source === node.id && x.sourceHandle === handle);
  const t = e ? byId.get(e.target) : undefined;
  if (!t) return 'Not set up';
  const name = t.data.label || NODE_META[t.type].label;
  switch (t.type) {
    case 'ring_user':
      return `Rings ${name}`;
    case 'ring_group':
      return `Rings the team${t.data.label ? ` (${t.data.label})` : ''}`;
    case 'voicemail':
      return 'Goes to voicemail';
    case 'transfer':
      return t.data.externalNumber ? `Forwards to ${t.data.externalNumber}` : 'Forwards the call';
    case 'hangup':
      return 'Ends the call';
    case 'menu':
      return `Opens a submenu${t.data.label ? ` (${t.data.label})` : ''}`;
    case 'greeting':
      return `Plays ${name}`;
    case 'hours':
      return 'Checks business hours';
    default:
      return name;
  }
}

function ActiveStep({
  node,
  flow,
  byId,
  audioState,
  onReplay,
  onContinue,
}: {
  node: IvrNode;
  flow: IvrFlow;
  byId: Map<string, IvrNode>;
  audioState: 'idle' | 'loading' | 'playing';
  onReplay: () => void;
  onContinue: (handle?: string) => void;
}) {
  const meta = NODE_META[node.type];
  const hasAudio = !!node.data.prompt?.text?.trim();
  const uploaded = !node.data.prompt?.text?.trim() && !!node.data.prompt?.audioKey;

  const ReplayBtn = hasAudio ? (
    <button
      onClick={onReplay}
      disabled={audioState === 'loading'}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary-600)] hover:text-[var(--foreground)] disabled:opacity-50"
    >
      {audioState === 'loading' ? <FiLoader className="h-3 w-3 animate-spin" /> : <FiPlay className="h-3 w-3" />}
      {audioState === 'playing' ? 'Playing…' : 'Replay'}
    </button>
  ) : null;

  if (node.type === 'greeting') {
    return (
      <div className="text-center">
        <div className="text-sm text-[var(--foreground)]">
          🔊 “{node.data.prompt?.text || (uploaded ? 'Your uploaded recording plays' : '(no message set)')}”
        </div>
        {ReplayBtn}
        <div>
          <Button className="mt-3" onClick={() => onContinue()}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (node.type === 'menu') {
    const options = node.data.options ?? [];
    const retries = node.data.maxRetries ?? 2;
    const hasTimeoutRoute = flow.edges.some((e) => e.source === node.id && e.sourceHandle === 'timeout');
    const hasInvalidRoute = flow.edges.some((e) => e.source === node.id && e.sourceHandle === 'invalid');
    return (
      <div>
        <div className="text-center text-sm text-[var(--foreground)]">
          🔊 “{node.data.prompt?.text || (uploaded ? 'Your uploaded recording plays' : '(no menu prompt set)')}”
        </div>
        <div className="mb-3 text-center">{ReplayBtn}</div>
        <div className="space-y-1.5">
          {options.length === 0 && (
            <p className="text-center text-xs text-[var(--muted-foreground)]">No options to press yet.</p>
          )}
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => onContinue(o.key)}
              className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left transition-colors hover:border-[var(--primary-600)] hover:bg-[var(--primary-600)]/5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-base font-bold text-[var(--foreground)]">
                {o.key}
              </span>
              <span className="min-w-0 flex-1">
                {o.label ? (
                  <span className="block truncate text-sm font-medium text-[var(--foreground)]">{o.label}</span>
                ) : null}
                <span className="block truncate text-xs text-[var(--muted-foreground)]">
                  {routeLabel(flow, byId, node, o.key)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-[var(--muted)]/40 px-3 py-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          A key that isn’t listed here isn’t set up — the caller hears the menu again, up to {retries}{' '}
          {retries === 1 ? 'retry' : 'retries'}, then{' '}
          {hasInvalidRoute || hasTimeoutRoute
            ? 'the call follows your no-input/invalid step.'
            : 'the call ends.'}
        </p>
      </div>
    );
  }

  if (node.type === 'hours') {
    const now = hoursBranchNow(node);
    const branches: { key: 'open' | 'closed' | 'holiday'; label: string; color: string }[] = [
      { key: 'open', label: 'Open', color: '#10b981' },
      { key: 'closed', label: 'Closed', color: '#64748b' },
      ...((node.data.holidays?.length ?? 0) > 0
        ? [{ key: 'holiday' as const, label: 'Holiday', color: '#f59e0b' }]
        : []),
    ];
    return (
      <div>
        <div className="mb-2 text-center text-sm text-[var(--foreground)]">
          🕒 Business hours — right now this is <b>{now}</b>
        </div>
        <div className="space-y-1.5">
          {branches.map((b) => (
            <button
              key={b.key}
              onClick={() => onContinue(b.key)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                b.key === now ? 'border-current' : 'border-[var(--border)] hover:border-[var(--primary-600)]'
              }`}
              style={{ color: b.color }}
            >
              <span className="text-sm font-semibold">
                {b.label}
                {b.key === now ? ' • now' : ''}
              </span>
              <span className="ml-auto truncate text-xs text-[var(--muted-foreground)]">
                {routeLabel(flow, byId, node, b.key)}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--muted-foreground)]">Click a branch to follow it.</p>
      </div>
    );
  }

  // ring_user / ring_group: ringing. On no answer the call goes to the person's own
  // voicemail (ring_user) or the team's own no-answer setting (ring_group). Any step
  // wired after a ring isn't published, so we flag it rather than pretend it routes.
  const isGroup = node.type === 'ring_group';
  const hasDownstream = flow.edges.some((e) => e.source === node.id);
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-2 flex h-12 w-12 animate-pulse items-center justify-center rounded-full"
        style={{ backgroundColor: `${meta.accent}22`, color: meta.accent }}
      >
        <FiPhoneCall className="h-5 w-5" />
      </div>
      <div className="text-sm font-medium" style={{ color: meta.accent }}>
        {meta.label}
        {node.data.label ? ` — ${node.data.label}` : ''}… ringing
      </div>
      <Button className="mt-3" variant="outline" onClick={() => onContinue()}>
        {isGroup ? 'No answer →' : 'No answer → voicemail'}
      </Button>
      {hasDownstream && (
        <p className="mx-auto mt-2 max-w-xs text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
          A step wired after this ring isn’t used yet — on no answer the caller goes to{' '}
          {isGroup ? 'the team’s own no-answer setting' : 'this person’s voicemail'}.
        </p>
      )}
    </div>
  );
}

function describeChoice(node: IvrNode, handle?: string): string {
  const meta = NODE_META[node.type];
  if (node.type === 'menu' && handle) return `Pressed ${handle} at “${node.data.label || meta.label}”`;
  if (node.type === 'hours' && handle) return `Business hours → ${handle}`;
  if (node.type === 'greeting') return `Played greeting`;
  return `${meta.label}: no answer`;
}

function endNote(node: IvrNode): string {
  switch (node.type) {
    case 'voicemail':
      return 'Reached voicemail — caller leaves a message.';
    case 'transfer':
      return node.data.externalNumber
        ? `Forwarded to ${node.data.externalNumber}.`
        : node.data.extension
          ? `Forwarded to ext ${node.data.extension}.`
          : 'Forwarded.';
    case 'hangup':
      return 'Call hung up.';
    default:
      return 'Call ended.';
  }
}
