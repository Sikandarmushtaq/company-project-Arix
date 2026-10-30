'use client';

/**
 * Call Preferences
 *
 * Do Not Disturb toggle and auto-mark-as-read notification settings.
 *
 * @module app/phone/settings/CallPreferences
 */

import React, { useCallback } from 'react';
import { FiBell, FiMoon, FiEye, FiMousePointer } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useNotificationSettings } from '@/lib/stores/notificationSettings';
import { useDndStatus, useToggleDnd } from '@/lib/hooks';

// Reusable Toggle Switch Component
function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-[var(--primary-600)]' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// Setting Row Component
function SettingRow({
  icon,
  iconBg,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${iconBg}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
          <p className="text-xs text-[var(--muted-foreground)] truncate">{description}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function CallPreferences() {
  const { autoMarkOnView, autoMarkOnScroll, setSetting } = useNotificationSettings();
  const { data: dndStatus, isLoading: dndLoading } = useDndStatus();
  const toggleDnd = useToggleDnd();

  const handleToggleDnd = useCallback(async () => {
    if (dndStatus) {
      await toggleDnd.mutateAsync(!dndStatus.enabled);
    }
  }, [dndStatus, toggleDnd]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FiBell className="w-4 h-4 text-[var(--foreground)]" />
          Call Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        {/* DND */}
        {dndLoading ? (
          <div className="flex items-center justify-center py-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : (
          <SettingRow
            icon={
              <FiMoon
                className={`w-4 h-4 ${dndStatus?.enabled ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
              />
            }
            iconBg={
              dndStatus?.enabled
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
            }
            label="Do Not Disturb"
            description={
              dndStatus?.enabled
                ? 'All incoming calls are blocked'
                : 'Calls will ring normally'
            }
          >
            <ToggleSwitch
              enabled={dndStatus?.enabled ?? false}
              onChange={handleToggleDnd}
              disabled={toggleDnd.isPending}
            />
          </SettingRow>
        )}

        <div className="border-t border-[var(--border)]" />

        {/* Auto-mark on view */}
        <SettingRow
          icon={<FiEye className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          label="Mark Read on View"
          description="Mark all as read when opening History"
        >
          <ToggleSwitch
            enabled={autoMarkOnView}
            onChange={() => setSetting('autoMarkOnView', !autoMarkOnView)}
          />
        </SettingRow>

        {/* Auto-mark on scroll */}
        <SettingRow
          icon={<FiMousePointer className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          label="Mark Read on Scroll"
          description="Mark as read when scrolling into view"
        >
          <ToggleSwitch
            enabled={autoMarkOnScroll}
            onChange={() => setSetting('autoMarkOnScroll', !autoMarkOnScroll)}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
