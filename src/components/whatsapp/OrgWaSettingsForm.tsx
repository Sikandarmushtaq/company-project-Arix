'use client';

/**
 * Shared per-org WhatsApp Settings form.
 *
 * Single source of truth for the Meta-credentials entry / "connected" summary
 * UI, used by:
 *  - /org/whatsapp/settings (org owner portal)
 *  - /admin/whatsapp/settings (admin layout, when the viewing user is a manager)
 *
 * Both routes pass the same `numbersPath` so navigation stays inside whichever
 * shell rendered the form — owner stays in /org/*, manager stays in /admin/*.
 *
 * The page-route files become thin wrappers around this component. Do NOT
 * import one route file from another; route files are not components.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  FiSave,
  FiCheck,
  FiCopy,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiInfo,
  FiArrowRight,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useMyWaConfig, useSaveMyWaConfig, waOrgKeys } from '@/lib/hooks/useWaOrg';
import { getMyNumbers, getManagedConnectConfig } from '@/lib/api/services/whatsapp-org.api';
import type { SaveWaOrgConfigResponse } from '@/lib/api/services/whatsapp-org.api';
import { WaErrorBanner } from './WaErrorBanner';
import { EmbeddedSignupButton } from './EmbeddedSignupButton';
import { ManagedConnectButton } from './ManagedConnectButton';

interface Props {
  /** Where the "manage numbers" links should navigate (per host route). */
  numbersPath: string;
}

export function OrgWaSettingsForm({ numbersPath }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: existingConfig, isLoading, isError, error, refetch } = useMyWaConfig();
  const saveMutation = useSaveMyWaConfig();

  // Warm the numbers cache so navigating to /whatsapp/numbers feels instant.
  // Only fires when the user is configured — there's nothing to fetch otherwise.
  useEffect(() => {
    if (existingConfig) {
      queryClient.prefetchQuery({
        queryKey: waOrgKeys.numbers,
        queryFn: () => getMyNumbers(),
        staleTime: 30_000,
      });
    }
  }, [existingConfig, queryClient]);

  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveWaOrgConfigResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // When the managed (BSP-backed) connect is available, it's the only path we
  // surface — the Meta-direct popup and the manual access-token form are
  // hidden (the token form moves behind an "Advanced" toggle so it's never
  // lost). Keeps the page to a single, clear "Connect WhatsApp" action.
  const [managedActive, setManagedActive] = useState(false);
  useEffect(() => {
    getManagedConnectConfig()
      .then((c) => setManagedActive(c.enabled))
      .catch(() => setManagedActive(false));
  }, []);

  // Prefill non-secret fields. Secrets stay empty until the user explicitly
  // enters new values so we never round-trip masked tokens back to the server.
  useEffect(() => {
    if (existingConfig && !editMode && !saveResult) {
      setWabaId(existingConfig.wabaId);
    }
  }, [existingConfig, editMode, saveResult]);

  const isConfigured = !!existingConfig;
  const showForm = !isConfigured || editMode;

  const canSubmit = accessToken.length >= 20 && wabaId.length > 0 && !saveMutation.isPending;

  function handleSave() {
    setSaveResult(null);
    saveMutation.mutate(
      {
        accessToken: accessToken.trim(),
        wabaId: wabaId.trim(),
        appSecret: appSecret.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          setSaveResult(result);
          setAccessToken('');
          setAppSecret('');
          setEditMode(false);
        },
      }
    );
  }

  async function copyToClipboard(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API can fail in non-HTTPS contexts; surface a no-op
    }
  }

  // The manual Meta access-token form. Rendered directly when there's no
  // managed backend, or behind an "Advanced" toggle when managed connect is
  // the primary path.
  const metaCredentialForm = (
    <>
      <FormField
        id="accessToken"
        label="Access Token"
        hint="Permanent System User token from Meta Business Manager → System Users."
      >
        <div className="relative">
          <Input
            id="accessToken"
            type={showSecrets ? 'text' : 'password'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="EAAxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowSecrets((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label={showSecrets ? 'Hide secrets' : 'Show secrets'}
          >
            {showSecrets ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
          </button>
        </div>
      </FormField>

      <FormField
        id="wabaId"
        label="WhatsApp Business Account ID (WABA ID)"
        hint="Found in Meta Business Manager → WhatsApp Accounts."
      >
        <Input
          id="wabaId"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
          placeholder="1444659373798393"
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>

      <FormField
        id="appSecret"
        label="App Secret"
        hint="Optional — used to verify Meta webhook signatures. Find it in Meta App Dashboard → Settings → Basic."
        optional
      >
        <Input
          id="appSecret"
          type={showSecrets ? 'text' : 'password'}
          value={appSecret}
          onChange={(e) => setAppSecret(e.target.value)}
          placeholder="Optional"
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>

      {saveMutation.isError && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-300">
            {(saveMutation.error as Error).message ||
              'Failed to save. Check your credentials and try again.'}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={!canSubmit} loading={saveMutation.isPending}>
          <FiSave className="w-4 h-4" /> {isConfigured ? 'Update credentials' : 'Connect WhatsApp'}
        </Button>
        {editMode && (
          <Button
            variant="outline"
            onClick={() => {
              setEditMode(false);
              setAccessToken('');
              setAppSecret('');
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-[var(--muted-foreground)]">
        Connect your Meta WhatsApp Business account so your team can send and receive messages.
      </p>

      {isLoading && <SettingsSkeleton />}

      {!isLoading && isError && (
        <WaErrorBanner error={error} context="WhatsApp settings" onRetry={() => refetch()} />
      )}

      {!isLoading && saveResult && (
        <Card className="border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  WhatsApp connected successfully
                </h3>
                <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                  We synced <strong>{saveResult.numbersSynced}</strong> phone number
                  {saveResult.numbersSynced === 1 ? '' : 's'} from your WABA. Complete the webhook
                  setup below, then assign numbers to your team.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-[var(--background)] p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2 text-[var(--foreground)]">
                <FiInfo className="w-4 h-4" /> One-time webhook setup in Meta
              </h4>
              <p className="text-xs text-[var(--muted-foreground)]">
                In Meta App Dashboard → WhatsApp → Configuration → Webhooks, paste these two values:
              </p>

              <div className="space-y-2">
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">Callback URL</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-[var(--muted)] px-3 py-2 rounded break-all">
                      {saveResult.webhookCallbackUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(saveResult.webhookCallbackUrl, 'callback')}
                    >
                      {copiedField === 'callback' ? (
                        <FiCheck className="w-4 h-4" />
                      ) : (
                        <FiCopy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">Verify Token</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-[var(--muted)] px-3 py-2 rounded break-all">
                      {saveResult.verifyToken}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(saveResult.verifyToken, 'verify')}
                    >
                      {copiedField === 'verify' ? (
                        <FiCheck className="w-4 h-4" />
                      ) : (
                        <FiCopy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Save this token now — it won&apos;t be shown again.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={() => router.push(numbersPath)}>
              Assign numbers to your team <FiArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && isConfigured && !showForm && !saveResult && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Connected to Meta</CardTitle>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Your WhatsApp Business account is active.
              </p>
            </div>
            <Button variant="outline" onClick={() => setEditMode(true)}>
              Update credentials
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow label="WABA ID" value={existingConfig.wabaId} mono />
            <SummaryRow label="Access Token" value={existingConfig.accessToken} mono />
            <SummaryRow label="Display Phone" value={existingConfig.displayPhone || '—'} mono />
            <SummaryRow label="API Version" value={existingConfig.apiVersion} mono />
            <SummaryRow
              label="Status"
              value={
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    existingConfig.enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {existingConfig.enabled ? 'Enabled' : 'Disabled'}
                </span>
              }
            />

            {!existingConfig.enabled && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                WhatsApp is currently disabled at the platform level. Contact your administrator to
                re-enable.
              </div>
            )}

            <div className="pt-2">
              <Button variant="outline" onClick={() => router.push(numbersPath)}>
                Manage numbers <FiArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {managedActive
                ? isConfigured
                  ? 'Manage WhatsApp connection'
                  : 'Connect WhatsApp'
                : isConfigured
                  ? 'Update Meta credentials'
                  : 'Connect your Meta account'}
            </CardTitle>
            {!managedActive && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                You only need to enter <strong>3 values</strong>. We&apos;ll discover your phone
                numbers automatically and generate a webhook verify token for you.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {/* One-step managed connect (BSP-backed). Preferred path — no
                token/webhook setup. Self-hides when the managed backend isn't
                configured on the server. */}
            <ManagedConnectButton onConnected={() => refetch()} />

            {/* Meta Tech Provider popup — only shown when there's NO managed
                backend (otherwise it's redundant with the managed connect). */}
            {!managedActive && (
              <EmbeddedSignupButton
                onConnected={(result) => {
                  setSaveResult(result);
                  setEditMode(false);
                  refetch();
                }}
              />
            )}

            {managedActive ? (
              // Managed is primary — keep the legacy Meta-token form available
              // but collapsed, so it never clutters the page.
              <details className="rounded-lg border border-[var(--border)] p-3">
                <summary className="text-sm text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]">
                  Advanced: connect with a Meta access token instead
                </summary>
                <div className="space-y-5 pt-4">{metaCredentialForm}</div>
              </details>
            ) : (
              metaCredentialForm
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FormField({
  id,
  label,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--foreground)] mb-1">
        {label}
        {optional && (
          <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
            (optional)
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--muted-foreground)] mt-1">{hint}</p>}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className={mono ? 'font-mono text-[var(--foreground)]' : 'text-[var(--foreground)]'}>
        {value}
      </span>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="h-5 bg-[var(--muted)] rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-[var(--muted)] rounded w-2/3 animate-pulse" />
        <div className="space-y-3 pt-4">
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonField() {
  return (
    <div className="space-y-2">
      <div className="h-3.5 bg-[var(--muted)] rounded w-32 animate-pulse" />
      <div className="h-9 bg-[var(--muted)] rounded animate-pulse" />
    </div>
  );
}
