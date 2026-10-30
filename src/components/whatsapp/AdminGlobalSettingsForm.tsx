'use client';

/**
 * Admin Global WhatsApp Settings Form.
 *
 * Platform-wide WhatsApp configuration for super-admins only.
 * Manages the legacy whatsapp_config table row.
 *
 * This is completely separate from per-org WhatsApp settings.
 * Extracted for consistency with the component architecture.
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiCheck, FiAlertCircle, FiEye, FiEyeOff, FiCopy } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { whatsappAdminService } from '@/lib/api/services/whatsapp.service';
import type { WaConfig, UpdateWaConfigRequest } from '@/lib/api/services/whatsapp-types';
import { useSocketEvent } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import { toast } from 'sonner';

export function AdminGlobalSettingsForm() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['wa-config'],
    queryFn: () => whatsappAdminService.getConfig(),
    staleTime: 30000,
  });

  // Real-time config update from other admin sessions
  useSocketEvent(REALTIME_EVENTS.WA_CONFIG_UPDATED, () => {
    queryClient.invalidateQueries({ queryKey: ['wa-config'] });
  });

  const [form, setForm] = useState({
    accessToken: '',
    phoneNumberId: '',
    wabaId: '',
    verifyToken: 'mcp-webhook-verify',
    appSecret: '',
    apiVersion: 'v21.0',
    enabled: true,
  });
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (config) {
      setForm({
        accessToken: '', // Don't prefill masked token
        phoneNumberId: config.phoneNumberId || '',
        wabaId: config.wabaId || '',
        verifyToken: config.verifyToken || 'mcp-webhook-verify',
        appSecret: '', // Don't prefill
        apiVersion: config.apiVersion || 'v21.0',
        enabled: config.enabled,
      });
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateWaConfigRequest) => whatsappAdminService.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-config'] });
      setSaveStatus('saved');
      setHasChanges(false);
      toast.success('WhatsApp configuration saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (err) => {
      setSaveStatus('error');
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    const data: UpdateWaConfigRequest = {};
    if (form.accessToken) data.accessToken = form.accessToken;
    if (form.phoneNumberId) data.phoneNumberId = form.phoneNumberId;
    if (form.wabaId) data.wabaId = form.wabaId;
    if (form.verifyToken) data.verifyToken = form.verifyToken;
    if (form.appSecret) data.appSecret = form.appSecret;
    if (form.apiVersion) data.apiVersion = form.apiVersion;
    data.enabled = form.enabled;
    updateMutation.mutate(data);
  };

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    'https://manual.bitnexdial.com';
  const webhookUrl = `${baseUrl}/api/v1/whatsapp/webhook`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaWhatsapp className="text-green-500" />
            Global WhatsApp Settings
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Platform-wide WhatsApp Business Cloud API configuration (legacy global config)
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saveStatus === 'saved'
              ? 'bg-green-500/20 text-green-400'
              : saveStatus === 'error'
                ? 'bg-red-500/20 text-red-400'
                : hasChanges
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] cursor-not-allowed'
          }`}
        >
          {saveStatus === 'saving' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : saveStatus === 'saved' ? (
            <FiCheck className="w-4 h-4" />
          ) : saveStatus === 'error' ? (
            <FiAlertCircle className="w-4 h-4" />
          ) : (
            <FiSave className="w-4 h-4" />
          )}
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credentials Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">API Credentials</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Access Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={form.accessToken}
                  onChange={(e) => handleChange('accessToken', e.target.value)}
                  placeholder={config?.accessToken || 'Enter your access token'}
                  className="w-full px-3 py-2 pr-10 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {showToken ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
              {config?.accessToken && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Current: {config.accessToken}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Phone Number ID</label>
              <input
                type="text"
                value={form.phoneNumberId}
                onChange={(e) => handleChange('phoneNumberId', e.target.value)}
                placeholder="e.g., 123456789012345"
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Business Account ID (WABA ID)
              </label>
              <input
                type="text"
                value={form.wabaId}
                onChange={(e) => handleChange('wabaId', e.target.value)}
                placeholder="e.g., 123456789012345"
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">API Version</label>
              <input
                type="text"
                value={form.apiVersion}
                onChange={(e) => handleChange('apiVersion', e.target.value)}
                placeholder="v21.0"
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Webhook & Security Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Webhook & Security</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Webhook URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--muted-foreground)]"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success('Webhook URL copied');
                  }}
                  className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--card)]"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Paste this URL in your Meta App Dashboard webhook settings
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Verify Token</label>
              <input
                type="text"
                value={form.verifyToken}
                onChange={(e) => handleChange('verifyToken', e.target.value)}
                placeholder="mcp-webhook-verify"
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Must match the verify token in your Meta App Dashboard
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">App Secret (optional)</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={form.appSecret}
                  onChange={(e) => handleChange('appSecret', e.target.value)}
                  placeholder="For webhook signature validation"
                  className="w-full px-3 py-2 pr-10 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
                />
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {showSecret ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="text-sm font-medium">Enable WhatsApp</label>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Allow users to send and receive WhatsApp messages
                </p>
              </div>
              <button
                onClick={() => handleChange('enabled', !form.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.enabled ? 'bg-green-500' : 'bg-[var(--border)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Setup Instructions</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--muted-foreground)]">
          <li>
            Go to <span className="text-[var(--foreground)]">Meta Developer Portal</span> → your app
            → WhatsApp → API Setup
          </li>
          <li>
            Copy the <span className="text-[var(--foreground)]">Access Token</span> and{' '}
            <span className="text-[var(--foreground)]">Phone Number ID</span>
          </li>
          <li>
            Go to <span className="text-[var(--foreground)]">WhatsApp → Configuration</span> → set
            the Webhook URL and Verify Token above
          </li>
          <li>
            Subscribe to the <span className="text-[var(--foreground)]">messages</span> webhook
            field
          </li>
          <li>For a permanent token, create a System User in Business Settings</li>
        </ol>
      </div>

      {/* Legacy Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-amber-400">Legacy Global Configuration</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              This is the legacy platform-wide WhatsApp configuration. Organizations now have
              per-org WhatsApp settings that take precedence. This global config serves as fallback
              when organizations haven't configured their own settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
