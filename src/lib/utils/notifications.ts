'use client';

/**
 * Notification Manager - Barrel Re-export
 *
 * Re-exports all notification sub-modules.
 * All existing imports from '@/lib/utils/notifications' continue to work.
 *
 * @module lib/utils/notifications
 */

// Shared utilities (title flash, favicon, audio, browser notifications, etc.)
export {
  startTitleFlash,
  stopTitleFlash,
  updateFaviconBadge,
  incrementFaviconBadge,
  clearFaviconBadge,
  getFaviconBadgeCount,
  resumeAudioContext,
  stopNotificationSound,
  playNotificationSound,
  requestNotificationPermission,
  areBrowserNotificationsPermitted,
  showBrowserNotification,
  showToast,
  navigateFromNotification,
  preloadNotificationSounds,
  unlockNotificationAudio,
  testBrowserNotification,
} from './notifications-shared';

// Call notification handlers
export {
  notifyIncomingCall,
  stopIncomingCallNotification,
  notifyMissedCall,
} from './notifications-call';

// SMS, WhatsApp & voicemail notification handlers
export { notifyIncomingSms, notifyIncomingWhatsApp, notifyNewVoicemail } from './notifications-sms';
