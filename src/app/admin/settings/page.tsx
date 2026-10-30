'use client';

import React, { useState, useCallback } from 'react';
import {
  FiSave,
  FiServer,
  FiShield,
  FiMail,
  FiDatabase,
  FiLoader,
  FiCheck,
  FiAlertTriangle,
  FiPhone,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  StyledSelect,
} from '@/components/ui';
import { useSettings, useUpdateSettings } from '@/lib/hooks';
import type { SystemSettings } from '@/lib/api/services';

export default function SettingsPage() {
  const { data: fetchedSettings, isLoading, error } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const [settings, setSettings] = useState<SystemSettings>({
    sipServer: '',
    sipPort: '5060',
    sipTransport: 'WSS',
    sipRealm: 'asterisk',
    recordingsEnabled: true,
    recordingsPath: '/var/recordings',
    maxCallDuration: 3600,
    smtpServer: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    sessionTimeout: 24,
    maxLoginAttempts: 5,
    maxLoginSessions: 0,
    banDuration: 24,
    maintenanceMode: false,
    maintenanceMessage: '',
    // FreePBX Server Configuration
    mainServerDomain: 'manual.bitnexdial.com',
    mainServerWssPort: '8089',
    mainServerWssPath: '/ws',
    backupServerDomain: 'bkpmanual.bitnexdial.com',
    backupServerWssPort: '8089',
    backupServerWssPath: '/ws',
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Track fetched settings version to sync local state (avoids setState in effect)
  const [trackedSettingsVersion, setTrackedSettingsVersion] = useState<string | null>(null);
  const currentSettingsVersion = fetchedSettings ? JSON.stringify(fetchedSettings) : null;

  if (currentSettingsVersion && currentSettingsVersion !== trackedSettingsVersion && !hasChanges) {
    setTrackedSettingsVersion(currentSettingsVersion);
    setSettings(fetchedSettings!);
  }

  // PERFORMANCE: useCallback prevents unnecessary re-renders
  const handleChange = useCallback(
    (key: keyof SystemSettings, value: string | boolean | number) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await updateSettingsMutation.mutateAsync(settings);
      setSaveStatus('saved');
      setHasChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [settings, updateSettingsMutation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertTriangle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)]">Failed to load settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Configure system settings</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === 'saving'}
          className={
            saveStatus === 'saved'
              ? 'bg-green-600 hover:bg-green-700'
              : saveStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : ''
          }
        >
          {saveStatus === 'saving' ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <FiCheck className="w-4 h-4" />
              Saved!
            </>
          ) : saveStatus === 'error' ? (
            <>
              <FiAlertTriangle className="w-4 h-4" />
              Failed
            </>
          ) : (
            <>
              <FiSave className="w-4 h-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SIP Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiServer className="w-5 h-5 text-[var(--foreground)]" />
              SIP Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="SIP Server"
              value={settings.sipServer}
              onChange={(e) => handleChange('sipServer', e.target.value)}
              placeholder="sip.example.com"
            />
            <Input
              label="SIP Port"
              value={settings.sipPort}
              onChange={(e) => handleChange('sipPort', e.target.value)}
              placeholder="5060"
            />
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Transport Protocol
              </label>
              <StyledSelect
                value={settings.sipTransport}
                onChange={(v) => handleChange('sipTransport', v)}
              >
                <option value="UDP">UDP</option>
                <option value="TCP">TCP</option>
                <option value="TLS">TLS</option>
                <option value="WSS">WebSocket Secure</option>
              </StyledSelect>
            </div>
            <Input
              label="SIP Realm"
              value={settings.sipRealm}
              onChange={(e) => handleChange('sipRealm', e.target.value)}
              placeholder="asterisk"
            />
            <Input
              label="Max Call Duration (seconds)"
              value={String(settings.maxCallDuration)}
              onChange={(e) => handleChange('maxCallDuration', parseInt(e.target.value, 10) || 0)}
              type="number"
            />
          </CardContent>
        </Card>

        {/* FreePBX Server Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiPhone className="w-5 h-5 text-[var(--foreground)]" />
              FreePBX Server Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Server */}
            <div>
              <h4 className="font-medium text-[var(--foreground)] mb-3">Main Server</h4>
              <div className="space-y-3">
                <Input
                  label="Domain"
                  value={settings.mainServerDomain}
                  onChange={(e) => handleChange('mainServerDomain', e.target.value)}
                  placeholder="manual.bitnexdial.com"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="WSS Port"
                    value={settings.mainServerWssPort}
                    onChange={(e) => handleChange('mainServerWssPort', e.target.value)}
                    placeholder="8089"
                  />
                  <Input
                    label="WSS Path"
                    value={settings.mainServerWssPath}
                    onChange={(e) => handleChange('mainServerWssPath', e.target.value)}
                    placeholder="/ws"
                  />
                </div>
              </div>
            </div>
            {/* Backup Server */}
            <div>
              <h4 className="font-medium text-[var(--foreground)] mb-3">Backup Server</h4>
              <div className="space-y-3">
                <Input
                  label="Domain"
                  value={settings.backupServerDomain}
                  onChange={(e) => handleChange('backupServerDomain', e.target.value)}
                  placeholder="bkpmanual.bitnexdial.com"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="WSS Port"
                    value={settings.backupServerWssPort}
                    onChange={(e) => handleChange('backupServerWssPort', e.target.value)}
                    placeholder="8089"
                  />
                  <Input
                    label="WSS Path"
                    value={settings.backupServerWssPath}
                    onChange={(e) => handleChange('backupServerWssPath', e.target.value)}
                    placeholder="/ws"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recording Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiDatabase className="w-5 h-5 text-[var(--foreground)]" />
              Recording Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">Enable Recordings</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Record all calls automatically
                </p>
              </div>
              <button
                onClick={() => handleChange('recordingsEnabled', !settings.recordingsEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.recordingsEnabled
                    ? 'bg-[var(--primary-600)]'
                    : 'bg-[var(--muted-foreground)]'
                }`}
                role="switch"
                aria-checked={settings.recordingsEnabled}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.recordingsEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <Input
              label="Recordings Path"
              value={settings.recordingsPath}
              onChange={(e) => handleChange('recordingsPath', e.target.value)}
              placeholder="/var/recordings"
            />
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiMail className="w-5 h-5 text-[var(--foreground)]" />
              Email Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="SMTP Server"
              value={settings.smtpServer}
              onChange={(e) => handleChange('smtpServer', e.target.value)}
              placeholder="smtp.example.com"
            />
            <Input
              label="SMTP Port"
              value={settings.smtpPort}
              onChange={(e) => handleChange('smtpPort', e.target.value)}
              placeholder="587"
            />
            <Input
              label="SMTP User"
              value={settings.smtpUser}
              onChange={(e) => handleChange('smtpUser', e.target.value)}
              placeholder="noreply@example.com"
            />
            <Input
              label="SMTP Password"
              value={settings.smtpPassword}
              onChange={(e) => handleChange('smtpPassword', e.target.value)}
              type="password"
              placeholder="Enter password to change"
            />
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiShield className="w-5 h-5 text-[var(--foreground)]" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Session Timeout (hours)"
              value={String(settings.sessionTimeout)}
              onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value, 10) || 0)}
              type="number"
            />
            <Input
              label="Max Login Attempts"
              value={String(settings.maxLoginAttempts)}
              onChange={(e) => handleChange('maxLoginAttempts', parseInt(e.target.value, 10) || 0)}
              type="number"
            />
            <div>
              <Input
                label="Max Logins Per User (devices)"
                value={String(settings.maxLoginSessions)}
                onChange={(e) => handleChange('maxLoginSessions', parseInt(e.target.value, 10) || 0)}
                type="number"
                min={0}
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                0 = unlimited. Applies to every user unless overridden per user.
                A new login past the limit signs out that user&apos;s oldest device.
              </p>
            </div>
            <Input
              label="Ban Duration (hours)"
              value={String(settings.banDuration)}
              onChange={(e) => handleChange('banDuration', parseInt(e.target.value, 10) || 0)}
              type="number"
            />
          </CardContent>
        </Card>

        {/* Maintenance Mode */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiAlertTriangle className="w-5 h-5 text-[var(--warning)]" />
              Maintenance Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]">
              <div>
                <p className="font-medium text-[var(--foreground)]">Enable Maintenance Mode</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  When enabled, users will see a maintenance message and cannot access the system
                </p>
              </div>
              <button
                onClick={() => handleChange('maintenanceMode', !settings.maintenanceMode)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.maintenanceMode ? 'bg-[var(--warning)]' : 'bg-[var(--muted-foreground)]'
                }`}
                role="switch"
                aria-checked={settings.maintenanceMode}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.maintenanceMode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Maintenance Message
              </label>
              <textarea
                value={settings.maintenanceMessage}
                onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
                placeholder="System is under maintenance. Please try again later."
                rows={3}
                className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
