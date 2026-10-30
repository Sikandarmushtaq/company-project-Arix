'use client';

/**
 * Embedded Signup ("Connect WhatsApp") button — Meta Tech Provider flow.
 *
 * Loads Facebook's JS SDK, opens the Facebook-Login-for-Business popup with our
 * Embedded Signup configuration, and on completion captures:
 *   - `code`     from FB.login's authResponse (exchanged for a token server-side)
 *   - `waba_id`  from the embedded-signup `message` event posted by Meta's iframe
 * then POSTs both to /whatsapp/org/embedded-signup/exchange, which exchanges the
 * code (app secret stays server-side) and saves the org's WA config.
 *
 * The two halves arrive on independent channels and in ANY order (the message
 * event and the FB.login callback are not ordered), so we stash both and fire
 * the exchange once we hold the pair — with a timeout so a half-finished flow
 * never spins forever, and explicit handling of Meta's CANCEL/ERROR events.
 *
 * The button hides itself when the server hasn't configured Embedded Signup
 * (missing App ID / Config ID / App Secret) — the manual token form still works.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiLoader } from 'react-icons/fi';
import { Button } from '@/components/ui';
import {
  getEmbeddedSignupConfig,
  exchangeEmbeddedSignup,
  type EmbeddedSignupConfig,
  type SaveWaOrgConfigResponse,
} from '@/lib/api/services/whatsapp-org.api';

// Minimal typings for the global FB SDK we inject at runtime.
declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (resp: { authResponse?: { code?: string } | null }) => void,
        opts: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const FB_SDK_ID = 'facebook-jssdk';
// How long to wait for BOTH the code (FB.login) and the waba_id (message event)
// before giving up. Meta normally delivers both within a second, in any order.
const COMPLETE_TIMEOUT_MS = 12000;

/** Inject + initialise the Facebook SDK once; resolves when FB.init has run. */
function loadFbSdk(appId: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('not in browser'));
      return;
    }
    if (window.FB) {
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve();
    };
    if (document.getElementById(FB_SDK_ID)) return; // already injected; fbAsyncInit will fire
    const js = document.createElement('script');
    js.id = FB_SDK_ID;
    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    js.async = true;
    js.defer = true;
    js.crossOrigin = 'anonymous';
    js.onerror = () => reject(new Error('Failed to load the Facebook SDK'));
    document.body.appendChild(js);
  });
}

interface Props {
  /** Called with the saved config (verifyToken + webhookCallbackUrl) on success. */
  onConnected: (result: SaveWaOrgConfigResponse) => void;
}

export function EmbeddedSignupButton({ onConnected }: Props) {
  const [cfg, setCfg] = useState<EmbeddedSignupConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The two halves of the result arrive independently and in any order.
  const codeRef = useRef<string | null>(null);
  const wabaRef = useRef<string | null>(null);
  const submittedRef = useRef(false); // guards against double-submit / late events
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getEmbeddedSignupConfig()
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);

  // Pre-load the FB SDK as soon as we know the app is configured, so the click
  // handler can open the popup SYNCHRONOUSLY — opening it after an await trips
  // the browser's popup blocker.
  useEffect(() => {
    if (cfg?.enabled && cfg.appId) {
      loadFbSdk(cfg.appId, cfg.graphVersion).catch(() => {});
    }
  }, [cfg]);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    codeRef.current = null;
    wabaRef.current = null;
    submittedRef.current = false;
    clearPendingTimeout();
  }, [clearPendingTimeout]);

  const fail = useCallback(
    (msg: string) => {
      if (submittedRef.current) return; // already completed or failed
      submittedRef.current = true;
      clearPendingTimeout();
      setBusy(false);
      setError(msg);
    },
    [clearPendingTimeout]
  );

  // Fire the exchange exactly once, when both halves are present.
  const complete = useCallback(async () => {
    if (submittedRef.current) return;
    if (!codeRef.current || !wabaRef.current) return;
    submittedRef.current = true;
    clearPendingTimeout();
    try {
      const result = await exchangeEmbeddedSignup({
        code: codeRef.current,
        wabaId: wabaRef.current,
      });
      onConnected(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete connection.');
    } finally {
      setBusy(false);
    }
  }, [onConnected, clearPendingTimeout]);

  // Keep stable refs so the once-mounted message listener calls the latest fns.
  const completeRef = useRef(complete);
  const failRef = useRef(fail);
  useEffect(() => {
    completeRef.current = complete;
    failRef.current = fail;
  }, [complete, fail]);

  // Listen for Meta's embedded-signup events (origin-checked).
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Accept any facebook.com subdomain (www / web / business / staticxx) but
      // nothing that merely ends in "facebook.com" (e.g. notfacebook.com).
      let originHost: string;
      try {
        originHost = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (originHost !== 'facebook.com' && !originHost.endsWith('.facebook.com')) {
        return;
      }
      let payload: { type?: string; event?: string; data?: Record<string, unknown> };
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return; // non-JSON messages aren't ours
      }
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (payload.event === 'CANCEL') {
        failRef.current('WhatsApp connection was cancelled.');
        return;
      }
      if (payload.event === 'ERROR') {
        failRef.current(
          (payload.data?.error_message as string) || 'WhatsApp connection failed. Please try again.'
        );
        return;
      }
      // FINISH (or older versions without an `event` field) carries the waba_id.
      const wabaId = payload.data?.waba_id;
      if (wabaId) {
        wabaRef.current = String(wabaId);
        void completeRef.current();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Clear any pending timeout on unmount.
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  // Open the FB Login for Business popup. MUST run synchronously inside the
  // click handler so the browser doesn't block the popup window.
  const doLogin = useCallback(() => {
    if (!cfg?.configId || !window.FB) {
      fail('Facebook SDK is not ready yet. Please try again in a moment.');
      return;
    }
    window.FB.login(
      (resp) => {
        const code = resp?.authResponse?.code;
        if (!code) {
          fail('Connection was cancelled before it finished. Please try again.');
          return;
        }
        codeRef.current = code;
        void complete();
        // If the waba_id never lands, don't spin forever.
        timeoutRef.current = setTimeout(() => {
          fail('The connection did not complete. Please try again and finish all the steps.');
        }, COMPLETE_TIMEOUT_MS);
      },
      {
        config_id: cfg.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { sessionInfoVersion: '3', version: 'v4' },
      }
    );
  }, [cfg, complete, fail]);

  const launch = useCallback(() => {
    if (!cfg?.appId || !cfg.configId) return;
    setError(null);
    setBusy(true);
    reset();
    // SDK is pre-loaded on mount, so window.FB is normally ready -> open the
    // popup synchronously. Fall back to a lazy load only if pre-load hasn't
    // finished yet (rare).
    if (window.FB) {
      doLogin();
    } else {
      loadFbSdk(cfg.appId, cfg.graphVersion)
        .then(() => doLogin())
        .catch(() => fail('Could not load the Facebook SDK.'));
    }
  }, [cfg, doLogin, fail, reset]);

  // Hidden entirely when the server hasn't wired up Embedded Signup.
  if (!cfg || !cfg.enabled) return null;

  return (
    <div className="space-y-2">
      <Button onClick={launch} disabled={busy} className="w-full sm:w-auto">
        {busy ? (
          <>
            <FiLoader className="w-4 h-4 mr-2 animate-spin" /> Connecting…
          </>
        ) : (
          <>
            <FiMessageCircle className="w-4 h-4 mr-2" /> Connect WhatsApp
          </>
        )}
      </Button>
      <p className="text-xs text-[var(--muted-foreground)]">
        Connect your WhatsApp Business Account in a few clicks — no access token needed.
      </p>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs text-[var(--muted-foreground)]">
          or enter credentials manually
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export default EmbeddedSignupButton;
