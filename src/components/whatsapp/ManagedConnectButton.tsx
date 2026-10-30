'use client';

/**
 * Managed WhatsApp connect — one-click popup (preferred) + manual fallback.
 *
 * Preferred path: a Facebook Login for Business popup (launched under our
 * managed partner app) where the customer creates/selects their WhatsApp
 * Business Account, adds a number, and verifies it. Meta posts a
 * `WA_EMBEDDED_SIGNUP` `FINISH` event carrying the `waba_id`; we hand that to
 * the server, which binds the account to our managed backend, registers the
 * numbers, and syncs them. No access token, no webhook setup — and the OAuth
 * `code` isn't needed because onboarding is keyed by `waba_id`.
 *
 * Fallback: when the popup isn't configured on the server (no app/config id),
 * the customer pastes their WhatsApp Business Account ID instead.
 *
 * The underlying BSP vendor is NEVER surfaced — this is presented as our own
 * managed service. The component hides entirely when managed connect isn't
 * available on the server.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiZap, FiLoader, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import {
  getManagedConnectConfig,
  connectManagedWhatsApp,
  type ManagedConnectConfig,
  type ManagedConnectResponse,
} from '@/lib/api/services/whatsapp-org.api';

// `window.FB` / `window.fbAsyncInit` are declared globally in
// EmbeddedSignupButton.tsx — we reuse that augmentation rather than redeclare
// it with a conflicting shape.

const FB_SDK_ID = 'facebook-jssdk';

/** Inject + initialise the Facebook SDK once; resolves when FB.init has run. */
function loadFbSdk(appId: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('not in browser'));
    if (window.FB) return resolve();
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve();
    };
    if (document.getElementById(FB_SDK_ID)) return; // already injected
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
  /** Called after a successful connect so the parent can refetch + close edit. */
  onConnected: (result: ManagedConnectResponse) => void;
}

export function ManagedConnectButton({ onConnected }: Props) {
  const [cfg, setCfg] = useState<ManagedConnectConfig | null>(null);
  const [wabaId, setWabaId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManagedConnectResponse | null>(null);

  // Guards the once-only connect when the FINISH event arrives.
  const submittedRef = useRef(false);

  useEffect(() => {
    getManagedConnectConfig()
      .then(setCfg)
      .catch(() => setCfg(null));
  }, []);

  const popupAvailable = Boolean(cfg?.enabled && cfg?.appId && cfg?.configId && cfg?.solutionId);

  // Pre-load the SDK so the click handler can open the popup synchronously
  // (opening it after an await trips the browser's popup blocker).
  useEffect(() => {
    if (popupAvailable && cfg?.appId) {
      loadFbSdk(cfg.appId, cfg.graphVersion).catch(() => {});
    }
  }, [popupAvailable, cfg]);

  // The actual server connect — shared by popup (wabaId from FINISH) and the
  // manual fallback (wabaId from the input).
  const doConnect = useCallback(
    async (id: string) => {
      setError(null);
      setBusy(true);
      try {
        const res = await connectManagedWhatsApp({ wabaId: id });
        setResult(res);
        onConnected(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not connect. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [onConnected]
  );

  // Listen for Meta's embedded-signup events (origin-checked).
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let host: string;
      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return;

      let payload: { type?: string; event?: string; data?: Record<string, unknown> };
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (payload.event === 'CANCEL') {
        setBusy(false);
        setError('WhatsApp connection was cancelled.');
        return;
      }
      if (payload.event === 'ERROR') {
        setBusy(false);
        setError(
          (payload.data?.error_message as string) || 'WhatsApp connection failed. Please try again.'
        );
        return;
      }
      // FINISH carries the waba_id — that's all we need to onboard.
      const wabaFromEvent = payload.data?.waba_id;
      if (wabaFromEvent && !submittedRef.current) {
        submittedRef.current = true;
        void doConnect(String(wabaFromEvent));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [doConnect]);

  // Open the popup — MUST run synchronously inside the click handler.
  const launchPopup = useCallback(() => {
    if (!cfg?.configId || !cfg.solutionId || !window.FB) {
      setError('Still loading — please try again in a moment.');
      return;
    }
    setError(null);
    setBusy(true);
    submittedRef.current = false;
    window.FB.login(
      (resp) => {
        // We rely on the FINISH message for the waba_id; this callback only
        // helps detect an early close. If nothing finished shortly after the
        // popup closed, release the busy state.
        if (!resp?.authResponse) {
          setTimeout(() => {
            if (!submittedRef.current) setBusy(false);
          }, 1500);
        }
      },
      {
        // Matches YCloud's Technical Development Partner Embedded Signup doc.
        config_id: cfg.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          features: [{ name: 'marketing_messages_lite' }],
          setup: { solutionID: cfg.solutionId },
          sessionInfoVersion: '3',
        },
      }
    );
  }, [cfg]);

  // Hidden entirely when managed connect isn't configured on the server.
  if (!cfg || !cfg.enabled) return null;

  // Success state.
  if (result) {
    return (
      <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-2">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
          <FiCheckCircle className="w-5 h-5" />
          WhatsApp connected
        </div>
        <p className="text-sm text-emerald-800/90 dark:text-emerald-300/90">
          {result.numbersSynced === 1
            ? '1 number is now linked and syncing.'
            : `${result.numbersSynced} numbers are now linked and syncing.`}{' '}
          Assign each number to a team member to start messaging.
        </p>
        {!result.paymentMethodAttached && (
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <FiInfo className="w-4 h-4 mt-0.5 shrink-0" />
            We&apos;re finalizing the billing setup for your account — sending will be enabled
            shortly. You don&apos;t need to do anything.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
          <FiZap className="w-4 h-4" />
        </span>
        <div>
          <h4 className="font-medium text-[var(--foreground)]">Connect WhatsApp in one step</h4>
          <p className="text-xs text-[var(--muted-foreground)]">
            We handle hosting, billing, and delivery — no access token or webhook setup needed.
          </p>
        </div>
      </div>

      {popupAvailable ? (
        <>
          <Button onClick={launchPopup} disabled={busy} className="w-full sm:w-auto">
            {busy ? (
              <>
                <FiLoader className="w-4 h-4 mr-2 animate-spin" /> Connecting…
              </>
            ) : (
              <>
                <FiZap className="w-4 h-4 mr-2" /> Connect WhatsApp
              </>
            )}
          </Button>
          <p className="text-xs text-[var(--muted-foreground)]">
            You&apos;ll create or pick your WhatsApp Business Account, add a number, and verify it —
            all in one window.
          </p>

          {/* Manual fallback for anyone who'd rather paste their account ID. */}
          <details className="pt-1">
            <summary className="text-xs text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]">
              Already have a WhatsApp Business Account ID? Enter it manually
            </summary>
            <div className="mt-2 space-y-1.5">
              <Input
                id="managedWabaId"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="1444659373798393"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
              <Button
                variant="outline"
                onClick={() => doConnect(wabaId.trim())}
                disabled={busy || !wabaId.trim()}
              >
                Connect with ID
              </Button>
            </div>
          </details>
        </>
      ) : (
        // Popup not configured — manual WABA-ID path only.
        <div className="space-y-1.5">
          <label htmlFor="managedWabaId" className="text-sm font-medium text-[var(--foreground)]">
            WhatsApp Business Account ID
          </label>
          <Input
            id="managedWabaId"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="1444659373798393"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            Find this in Meta Business Settings → Accounts → WhatsApp Accounts.
          </p>
          <Button
            onClick={() => doConnect(wabaId.trim())}
            disabled={busy || !wabaId.trim()}
            className="w-full sm:w-auto"
          >
            {busy ? (
              <>
                <FiLoader className="w-4 h-4 mr-2 animate-spin" /> Connecting…
              </>
            ) : (
              <>
                <FiZap className="w-4 h-4 mr-2" /> Connect WhatsApp
              </>
            )}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs text-[var(--muted-foreground)]">or connect manually below</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export default ManagedConnectButton;
