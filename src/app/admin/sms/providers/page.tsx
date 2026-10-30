'use client';

import React, { useState, useEffect } from 'react';
import {
  FiSettings,
  FiSave,
  FiAlertTriangle,
  FiUsers,
  FiToggleLeft,
  FiToggleRight,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import {
  useSmsProviders,
  useUpsertSmsProvider,
  useToggleSmsProvider,
} from '@/lib/hooks/useSmsProviders';
import type { SmsProvider } from '@/lib/api/services/admin.service';

interface ProviderFormState {
  displayName: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
}

const emptyForm: ProviderFormState = {
  displayName: '',
  twilioAccountSid: '',
  twilioAuthToken: '',
};

function ProviderCard({
  type,
  provider,
  onSave,
  onToggle,
  isSaving,
  isToggling,
}: {
  type: 'standard' | 'auto';
  provider: SmsProvider | undefined;
  onSave: (type: 'standard' | 'auto', data: ProviderFormState) => void;
  onToggle: (type: 'standard' | 'auto', enabled: boolean) => void;
  isSaving: boolean;
  isToggling: boolean;
}) {
  const [form, setForm] = useState<ProviderFormState>(emptyForm);
  const [showToken, setShowToken] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (provider) {
      setForm({
        displayName: provider.displayName,
        twilioAccountSid: provider.twilioAccountSid,
        twilioAuthToken: '', // Never pre-fill masked token
      });
    }
  }, [provider]);

  const handleChange = (field: keyof ProviderFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(type, form);
    setHasChanges(false);
  };

  const isConfigured = !!provider;
  const title = type === 'standard' ? 'Standard SMS' : 'Auto SMS';
  const description =
    type === 'standard'
      ? 'Regular 1-to-1 SMS messaging for users'
      : 'Automated / bulk SMS messaging';

  const canSave =
    form.displayName.trim() &&
    form.twilioAccountSid.trim().startsWith('AC') &&
    form.twilioAccountSid.trim().length >= 34 &&
    (form.twilioAuthToken.trim().length >= 32 || (isConfigured && !form.twilioAuthToken.trim()));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FiSettings className="w-4 h-4 text-[var(--foreground)]" />
              {title}
            </CardTitle>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{description}</p>
          </div>
          <div className="flex items-center gap-3">
            {isConfigured && (
              <>
                <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <FiUsers className="w-3.5 h-3.5" />
                  {provider.userCount} users
                </span>
                <button
                  onClick={() => onToggle(type, !provider.enabled)}
                  disabled={isToggling}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    provider.enabled
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {provider.enabled ? (
                    <FiToggleRight className="w-3.5 h-3.5" />
                  ) : (
                    <FiToggleLeft className="w-3.5 h-3.5" />
                  )}
                  {provider.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </>
            )}
            {!isConfigured && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 font-medium">
                Not Configured
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <Input
          label="Display Name"
          placeholder={type === 'standard' ? 'Standard SMS Account' : 'Auto SMS Account'}
          value={form.displayName}
          onChange={(e) => handleChange('displayName', e.target.value)}
        />
        <Input
          label="Twilio Account SID"
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          value={form.twilioAccountSid}
          onChange={(e) => handleChange('twilioAccountSid', e.target.value)}
        />
        <div className="relative">
          <Input
            label="Twilio Auth Token"
            placeholder={isConfigured ? 'Leave blank to keep current' : 'Enter auth token'}
            type={showToken ? 'text' : 'password'}
            value={form.twilioAuthToken}
            onChange={(e) => handleChange('twilioAuthToken', e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-8 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {showToken ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
          </button>
        </div>
        {isConfigured && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Current token: {provider.twilioAuthToken}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            loading={isSaving}
          >
            <FiSave className="w-4 h-4 mr-1" /> {isConfigured ? 'Update' : 'Configure'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SmsProvidersPage() {
  const { data: providers, isLoading, error } = useSmsProviders();
  const upsertProvider = useUpsertSmsProvider();
  const toggleProvider = useToggleSmsProvider();

  const standardProvider = providers?.find((p) => p.type === 'standard');
  const autoProvider = providers?.find((p) => p.type === 'auto');

  const handleSave = (type: 'standard' | 'auto', data: ProviderFormState) => {
    // If updating and no new token provided, we need to handle this server-side
    // The backend will keep the existing token if an empty one is sent
    upsertProvider.mutate({ type, data });
  };

  const handleToggle = (type: 'standard' | 'auto', enabled: boolean) => {
    toggleProvider.mutate({ type, enabled });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--border)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">SMS Providers</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Configure Twilio accounts for Standard and Auto SMS messaging
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <FiAlertTriangle className="w-4 h-4 flex-shrink-0" />
          Failed to load providers: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProviderCard
          type="standard"
          provider={standardProvider}
          onSave={handleSave}
          onToggle={handleToggle}
          isSaving={upsertProvider.isPending}
          isToggling={toggleProvider.isPending}
        />
        <ProviderCard
          type="auto"
          provider={autoProvider}
          onSave={handleSave}
          onToggle={handleToggle}
          isSaving={upsertProvider.isPending}
          isToggling={toggleProvider.isPending}
        />
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-3 text-sm text-[var(--muted-foreground)]">
            <FiSettings className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-[var(--foreground)]">How SMS providers work</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>
                  Each user can be assigned to a provider type (Standard or Auto) from the user edit
                  page
                </li>
                <li>
                  Users without a provider assignment use the system default (environment variables)
                </li>
                <li>Disabling a provider blocks all users assigned to it from sending SMS</li>
                <li>Incoming webhooks automatically detect which provider to verify against</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
