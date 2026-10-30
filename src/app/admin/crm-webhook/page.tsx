'use client';

/**
 * CRM Webhook — admin config for pushing disposition events to the client's CRM
 * (the automatic-audit connection). Owner/admin only (nav `ownerAdmin` + backend
 * role gate). The signing secret is write-only: it's never returned, and a blank
 * field on save keeps the existing one.
 *
 * @module app/admin/crm-webhook/page
 */

import React, { useState } from 'react';
import {
  FiLink,
  FiLoader,
  FiAlertTriangle,
  FiCheckCircle,
  FiKey,
  FiCopy,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiCircle,
  FiExternalLink,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import {
  useCrmWebhookConfig,
  useSaveCrmWebhookConfig,
  useGenerateCrmApiKey,
} from '@/lib/hooks/useCrmWebhook';
import type { CrmWebhookConfig } from '@/lib/api';

/** A strong random signing secret (~38 chars — well above the 16-char minimum). */
function generateSigningSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `whsec_${b64}`;
}

export default function CrmWebhookPage() {
  const { data: config, isLoading, isError } = useCrmWebhookConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">CRM Webhook</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Push call outcomes to your CRM in real time. Each event is signed (HMAC-SHA256) so your
          CRM can verify it came from us.
        </p>
      </div>

      {!isLoading && !isError && <DeveloperHandoffCard config={config ?? null} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiLink className="w-4 h-4" /> Webhook configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-[var(--muted-foreground)]">
              <FiLoader className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--destructive)]">
              <FiAlertTriangle className="w-4 h-4" /> Couldn’t load the configuration.
            </div>
          ) : (
            <CrmWebhookForm initial={config ?? null} />
          )}
        </CardContent>
      </Card>

      {!isLoading && !isError && <ApiKeySection config={config ?? null} />}
    </div>
  );
}

/**
 * Setup summary — the three things a developer needs to connect a CRM (endpoint,
 * signing secret, pull API key), each with a live done/pending state, plus a
 * direct link to the developer docs. Orients the admin so the two-part flow
 * (push config + pull key) is obvious at a glance.
 */
function DeveloperHandoffCard({ config }: { config: CrmWebhookConfig | null }) {
  const steps = [
    {
      label: 'Webhook endpoint',
      done: !!config?.endpointUrl,
      detail: config?.endpointUrl || 'Not set yet',
      // Show real data (the URL) in monospace; the "not set" hint stays prose.
      mono: !!config?.endpointUrl,
    },
    {
      label: 'Signing secret',
      done: !!config?.hasSecret,
      detail: config?.hasSecret ? 'Set' : 'Not set yet',
      mono: false,
    },
    {
      label: 'Pull API key',
      done: !!config?.hasApiKey,
      detail: config?.hasApiKey ? `${config.apiKeyPrefix}…` : 'Generate it below',
      mono: !!config?.hasApiKey,
    },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              What your developer needs
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {remaining === 0
                ? 'All set — hand these three things to your developer.'
                : `${remaining} of 3 still to set up. Give your developer all three once done.`}
            </p>
          </div>
          <a
            href="/crm-integration-api.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <FiExternalLink className="h-3.5 w-3.5" /> Developer docs
          </a>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border p-3 transition-colors ${
                s.done
                  ? 'border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                  : 'border-[var(--border)] bg-[var(--muted)]/20'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {s.done ? (
                  <FiCheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                ) : (
                  <FiCircle className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
                )}
                <span className="text-xs font-medium text-[var(--foreground)]">{s.label}</span>
              </div>
              <p
                className={`mt-1.5 truncate text-xs text-[var(--muted-foreground)] ${
                  s.mono ? 'font-mono' : ''
                }`}
                title={s.detail}
              >
                {s.detail}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ApiKeySection({ config }: { config: CrmWebhookConfig | null }) {
  const gen = useGenerateCrmApiKey();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = () => {
    setError(null);
    setRevealed(null);
    gen.mutate(undefined, {
      onSuccess: (data) => setRevealed(data.apiKey),
      onError: (err) => setError(err instanceof Error ? err.message : 'Could not generate a key.'),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FiKey className="w-4 h-4" /> Pull API key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          Your CRM can poll <code>GET /api/v1/crm/dispositions</code> to reconcile — send the key as
          the <code>X-Api-Key</code> header. Supports <code>?flagged=true</code>,{' '}
          <code>?since=&lt;ISO&gt;</code>, and paging.
        </p>

        {!config ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Save the webhook configuration above first.
          </p>
        ) : (
          <>
            <div className="text-sm text-[var(--foreground)]">
              {config.hasApiKey ? (
                <>
                  Current key: <code className="font-mono">{config.apiKeyPrefix}…</code>
                </>
              ) : (
                'No key generated yet.'
              )}
            </div>

            {revealed && (
              <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  Copy this key now — it won’t be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-[var(--background)] px-2 py-1 font-mono text-xs text-[var(--foreground)]">
                    {revealed}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(revealed)}
                    aria-label="Copy API key"
                  >
                    <FiCopy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onGenerate} disabled={gen.isPending}>
                {gen.isPending ? 'Generating…' : config.hasApiKey ? 'Rotate key' : 'Generate key'}
              </Button>
              {config.hasApiKey && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  Rotating immediately invalidates the old key.
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CrmWebhookForm({ initial }: { initial: CrmWebhookConfig | null }) {
  const save = useSaveCrmWebhookConfig();
  const [endpointUrl, setEndpointUrl] = useState(initial?.endpointUrl ?? '');
  const [signingSecret, setSigningSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [flaggedOnly, setFlaggedOnly] = useState(initial?.flaggedOnly ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    save.mutate(
      { endpointUrl, signingSecret: signingSecret || undefined, enabled, flaggedOnly },
      {
        onSuccess: () => {
          setSaved(true);
          setSigningSecret('');
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Could not save.'),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-xl">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--foreground)]">Endpoint URL</label>
        <Input
          type="url"
          placeholder="https://your-crm.example.com/webhooks/arixcall"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          required
        />
        <p className="text-xs text-[var(--muted-foreground)]">Must be an https URL on a public host.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--foreground)]">Signing secret</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showSecret ? 'text' : 'password'}
              placeholder={
                initial?.hasSecret
                  ? '•••••••• (leave blank to keep current)'
                  : 'At least 16 characters'
              }
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
              autoComplete="new-password"
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
              title={showSecret ? 'Hide' : 'Show'}
            >
              {showSecret ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSigningSecret(generateSigningSecret());
              setShowSecret(true);
            }}
            title="Generate a strong secret"
          >
            <FiRefreshCw className="mr-1.5 h-4 w-4" /> Generate
          </Button>
          {signingSecret && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(signingSecret)}
              aria-label="Copy signing secret"
              title="Copy"
            >
              <FiCopy className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          At least 16 characters — click <span className="font-medium">Generate</span> for a strong
          one. Shared with your CRM to verify the <code>X-ArixCall-Signature</code> header. Stored
          securely and never shown again, so copy it now and give it to your developer.
        </p>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[var(--primary-600)]"
        />
        Enabled — deliver events to this endpoint
      </label>

      <label className="flex items-center gap-2.5 text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          checked={flaggedOnly}
          onChange={(e) => setFlaggedOnly(e.target.checked)}
          className="h-4 w-4 accent-[var(--primary-600)]"
        />
        Only send audit-flagged voicemails (instead of every disposition)
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-2.5 text-xs text-[var(--destructive)]">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saved && !error && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
          <FiCheckCircle className="h-4 w-4" /> Saved.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={save.isPending || !endpointUrl}>
          {save.isPending ? 'Saving…' : 'Save configuration'}
        </Button>
        {initial?.updatedAt && (
          <span className="text-xs text-[var(--muted-foreground)]">
            Last updated {new Date(initial.updatedAt).toLocaleString()}
          </span>
        )}
      </div>
    </form>
  );
}
