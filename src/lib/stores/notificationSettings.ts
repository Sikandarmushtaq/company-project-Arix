'use client';

/**
 * Notification Settings Store - SINGLE SOURCE OF TRUTH
 *
 * Manages user notification preferences with localStorage persistence.
 * Used by: notification manager, settings page
 *
 * @module lib/stores/notificationSettings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/lib/constants/notifications';

interface NotificationSettingsStore extends NotificationSettings {
  /** Update a single setting */
  setSetting: <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => void;
  /** Update multiple settings */
  setSettings: (settings: Partial<NotificationSettings>) => void;
  /** Reset to defaults */
  resetToDefaults: () => void;
}

export const useNotificationSettings = create<NotificationSettingsStore>()(
  persist(
    (set) => ({
      // Default values
      ...DEFAULT_NOTIFICATION_SETTINGS,

      setSetting: (key, value) => {
        set({ [key]: value });
      },

      setSettings: (settings) => {
        set(settings);
      },

      resetToDefaults: () => {
        set(DEFAULT_NOTIFICATION_SETTINGS);
      },
    }),
    {
      name: 'notification-settings',
      // Only persist user-configurable settings
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        browserNotificationsEnabled: state.browserNotificationsEnabled,
        toastEnabled: state.toastEnabled,
        toastDuration: state.toastDuration,
        autoMarkOnView: state.autoMarkOnView,
        autoMarkOnScroll: state.autoMarkOnScroll,
        autoMarkDelay: state.autoMarkDelay,
      }),
    }
  )
);

/**
 * Hook to get notification settings (read-only)
 * Use this in components that only need to read settings
 */
export function useNotificationSettingsReadOnly(): NotificationSettings {
  return useNotificationSettings((state) => ({
    soundEnabled: state.soundEnabled,
    soundVolume: state.soundVolume,
    browserNotificationsEnabled: state.browserNotificationsEnabled,
    toastEnabled: state.toastEnabled,
    toastDuration: state.toastDuration,
    autoMarkOnView: state.autoMarkOnView,
    autoMarkOnScroll: state.autoMarkOnScroll,
    autoMarkDelay: state.autoMarkDelay,
  }));
}
