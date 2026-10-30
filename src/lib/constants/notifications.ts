/**
 * Notification Constants - SINGLE SOURCE OF TRUTH
 *
 * All notification-related configuration in one place.
 * Used by: notification manager, settings, UI components
 *
 * @module lib/constants/notifications
 */

/**
 * Notification sound paths (relative to /public)
 * Empty string = use short generated beep (better for quick notifications)
 * CALL is not here - incoming calls use callAudioService.playRingtone() with configurable ringtones
 */
export const NOTIFICATION_SOUNDS = {
  SMS: '', // Short beep - not annoying for frequent messages
  VOICEMAIL: '', // Short beep - just needs attention grab
  MISSED_CALL: '', // Short beep - info notification
} as const;

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  /** Enable notification sounds */
  soundEnabled: true,
  /** Sound volume (0.0 - 1.0) */
  soundVolume: 0.5,
  /** Enable browser push notifications */
  browserNotificationsEnabled: true,
  /** Enable in-app toast notifications */
  toastEnabled: true,
  /** Auto-dismiss toast duration in ms */
  toastDuration: 6000,
  /** Auto-mark calls as read when viewing History tab (after delay) */
  autoMarkOnView: true,
  /** Auto-mark calls as read when scrolling into view */
  autoMarkOnScroll: true,
  /** Delay before auto-marking as read (ms) */
  autoMarkDelay: 1500,
};

/**
 * Toast duration by type (ms)
 */
export const TOAST_DURATION = {
  SMS: 6000,
  CALL: 10000,
  MISSED_CALL: 8000,
  VOICEMAIL: 8000,
  ERROR: 8000,
  SUCCESS: 5000,
  INFO: 5000,
  WARNING: 6000,
} as const;

/**
 * Browser notification options
 */
export const BROWSER_NOTIFICATION = {
  /** App icon path for notifications */
  ICON: '/arix-icon-192.png',
  /** Badge icon path */
  BADGE: '/arix-icon-192.png',
  /** Auto-close timeout in ms (0 = don't auto-close for calls) */
  AUTO_CLOSE_MS: 10000,
} as const;

export type NotificationSoundType = keyof typeof NOTIFICATION_SOUNDS;
export type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS;
