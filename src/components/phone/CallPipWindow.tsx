'use client';

/**
 * Call Picture-in-Picture window
 *
 * When a call is active and the user switches away from the dialer tab, this
 * opens a floating always-on-top mini call window (like Google Meet's web app)
 * with the caller, duration and mute/hang-up controls. It closes when the user
 * returns to the tab or the call ends.
 *
 * Uses the Document Picture-in-Picture API (Chrome/Edge 116+). On browsers
 * without support (Firefox/Safari) it is a silent no-op. The auto-open on
 * tab-hide is permitted without a click because the dialer is actively
 * capturing the microphone during a call.
 *
 * The PiP UI renders in its OWN React root inside the PiP window. React's
 * synthetic event system does not cross window boundaries through a portal, so
 * a portal's buttons wouldn't be clickable — a separate root fixes that. State
 * is shared because the SIP store (Zustand) is a module singleton, so the PiP
 * root subscribes to the same call state and its controls drive the real call.
 *
 * @module components/phone/CallPipWindow
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FiMic, FiMicOff, FiPhone, FiPhoneOff } from 'react-icons/fi';
import { useSipStore } from '@/lib/stores/sip';
import { formatPhoneNumber } from '@/lib/utils/formatting';

const ACTIVE_STATES = ['dialing', 'ringing', 'connecting', 'established', 'holding', 'held'];

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
    : `${m}:${String(x).padStart(2, '0')}`;
}

/** Find the line that represents the current call (active line, else any active-state line). */
function useActiveCallLine() {
  const lines = useSipStore((s) => s.lines);
  const activeLineId = useSipStore((s) => s.activeLineId);
  const active = lines.find((l) => l.id === activeLineId);
  if (active && ACTIVE_STATES.includes(active.state)) return active;
  return lines.find((l) => ACTIVE_STATES.includes(l.state)) ?? null;
}

/** UI rendered INSIDE the PiP window (its own root — uses the shared Zustand store). */
function PipCallContent() {
  const line = useActiveCallLine();
  const endCall = useSipStore((s) => s.endCall);
  const muteCall = useSipStore((s) => s.muteCall);
  const unmuteCall = useSipStore((s) => s.unmuteCall);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    if (!line || line.state !== 'established') {
      setDur(0);
      return;
    }
    const iv = setInterval(() => setDur((d) => d + 1), 1000);
    return () => clearInterval(iv);
  }, [line?.state, line?.id]);

  if (!line) return null;

  const caller = line.remoteName || formatPhoneNumber(line.remoteNumber) || line.remoteNumber;
  const initial = (line.remoteName?.trim()?.[0] || '').toUpperCase();
  const status =
    line.state === 'established'
      ? fmtDuration(dur)
      : ['ringing', 'dialing', 'connecting'].includes(line.state)
        ? 'Calling…'
        : ['held', 'holding'].includes(line.state)
          ? 'On hold'
          : line.state;

  // Dark "call screen" look — consistent and premium regardless of app theme
  // (like Google Meet / Zoom PiP windows). Background is inline so it renders
  // even before Tailwind utilities finish copying into the PiP document.
  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-between p-4 font-sans text-white"
      style={{ background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)' }}
    >
      <div className="flex w-full flex-col items-center gap-1.5 px-2 pt-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
          {initial || <FiPhone className="h-5 w-5 text-white/80" />}
        </div>
        <p className="max-w-full truncate text-base font-semibold leading-tight">{caller}</p>
        <p className="text-xs tabular-nums text-slate-300">{status}</p>
      </div>
      <div className="flex items-center gap-5 pb-0.5">
        <button
          type="button"
          onClick={() => (line.isMuted ? unmuteCall(line.id) : muteCall(line.id))}
          title={line.isMuted ? 'Unmute' : 'Mute'}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            line.isMuted ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
        >
          {line.isMuted ? <FiMicOff className="h-5 w-5" /> : <FiMic className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => endCall(line.id)}
          title="Hang up"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-600"
        >
          <FiPhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** Copy the app's compiled styles + theme into the PiP window so it matches the app. */
function copyStyles(pip: Window) {
  // Clone every stylesheet <link> and <style> node (covers prod <link> bundles
  // and dev <style> injection alike).
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    pip.document.head.appendChild(node.cloneNode(true));
  });
  // Plus any constructable/adopted stylesheets some bundlers use for HMR.
  try {
    const adopted = (document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] })
      .adoptedStyleSheets;
    for (const sheet of adopted ?? []) {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('');
      const style = pip.document.createElement('style');
      style.textContent = css;
      pip.document.head.appendChild(style);
    }
  } catch {
    /* ignore */
  }
  // Carry the theme class so Tailwind `dark:` utilities resolve too.
  if (document.documentElement.classList.contains('dark')) {
    pip.document.documentElement.classList.add('dark');
  }

  // Bulletproof the colors: copy the CURRENTLY-COMPUTED design tokens onto the
  // PiP root so var(--card)/var(--foreground)/etc. resolve to the active theme
  // even if the .dark cascade doesn't carry into the PiP document. Without this
  // the PiP can show a white background while the app is in dark mode.
  const cs = getComputedStyle(document.documentElement);
  const tokens = [
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--border',
    '--input',
    '--ring',
    '--muted',
    '--muted-foreground',
    '--primary-50',
    '--primary-400',
    '--primary-600',
    '--primary-700',
    '--primary-900',
  ];
  const decls = tokens.map((t) => `${t}:${cs.getPropertyValue(t).trim()};`).join('');
  const themeStyle = pip.document.createElement('style');
  themeStyle.textContent = `:root{${decls}}`;
  pip.document.head.appendChild(themeStyle);

  pip.document.body.style.margin = '0';
  // The PiP call screen is intentionally dark regardless of app theme — set the
  // body to match so there's no white flash behind it before React renders.
  pip.document.body.style.background = '#0f172a';
  pip.document.body.style.color = '#ffffff';
}

export function CallPipWindow() {
  const line = useActiveCallLine();
  const hasCall = !!line;
  const rootRef = useRef<Root | null>(null);
  const winRef = useRef<Window | null>(null);
  const openingRef = useRef(false);

  const supported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const close = useCallback(() => {
    // Capture + clear refs synchronously so re-entrant close() calls are no-ops...
    const root = rootRef.current;
    const win = winRef.current;
    rootRef.current = null;
    winRef.current = null;
    if (!root && !win) return;
    // ...then DEFER the actual unmount/close out of the render phase. close() can
    // fire from an effect during React's commit (e.g. when a call ends), and
    // unmounting a React root synchronously then throws "cannot synchronously
    // unmount a root while React is rendering".
    queueMicrotask(() => {
      try {
        root?.unmount();
      } catch {
        /* ignore */
      }
      try {
        win?.close();
      } catch {
        /* ignore */
      }
    });
  }, []);

  const open = useCallback(async () => {
    if (!supported || openingRef.current || winRef.current) return;
    openingRef.current = true;
    try {
      const pip: Window = await (
        window as unknown as {
          documentPictureInPicture: {
            requestWindow: (o: { width: number; height: number }) => Promise<Window>;
          };
        }
      ).documentPictureInPicture.requestWindow({ width: 320, height: 200 });
      copyStyles(pip);
      pip.addEventListener('pagehide', close);
      winRef.current = pip;
      const root = createRoot(pip.document.body);
      rootRef.current = root;
      root.render(<PipCallContent />);
    } catch {
      // Not allowed (no capture / no support / user cancelled) — silently ignore.
    } finally {
      openingRef.current = false;
    }
  }, [supported, close]);

  // Open the PiP when the tab is hidden during a call; close it on return.
  useEffect(() => {
    if (!supported) return;
    const onVisibility = () => {
      if (document.hidden && hasCall) {
        void open();
      } else if (!document.hidden) {
        close();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [supported, hasCall, open, close]);

  // Close the PiP automatically when the call ends.
  useEffect(() => {
    if (!hasCall) close();
  }, [hasCall, close]);

  // Tear down on unmount.
  useEffect(() => () => close(), [close]);

  return null;
}

export default CallPipWindow;
