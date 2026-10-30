'use client';

/**
 * Call Notification Handlers
 *
 * Handles incoming call, missed call, and call-end notifications.
 *
 * @module lib/utils/notifications-call
 */

import {
  showBrowserNotification,
  areBrowserNotificationsPermitted,
  startTitleFlash,
  stopTitleFlash,
  incrementFaviconBadge,
  playNotificationSound,
  navigateFromNotification,
} from './notifications-shared';
import { richNotification } from '@/lib/stores/richNotification';
import { useNotificationSettings } from '@/lib/stores/notificationSettings';

/**
 * Notify user of incoming call
 * Shows browser notification, title flash, and favicon badge
 * NOTE: Ringtone is played by callAudioService.playRingtone() via SIP events, not here
 * NOTE: In-app call UI is handled by the dialer component, not rich notifications
 */
export function notifyIncomingCall(
  from: string,
  contactName?: string | null,
  _options?: { onAnswer?: () => void; onDecline?: () => void }
): void {
  const displayName = contactName || from;
  const tabFocused = typeof document !== 'undefined' && document.hasFocus();

  console.log('[Notification] Incoming call notification:', {
    from,
    displayName,
    tabFocused,
    browserNotificationsPermitted: areBrowserNotificationsPermitted(),
  });

  // Show browser notification (if tab not focused)
  if (!tabFocused) {
    const notification = showBrowserNotification(`${displayName}`, {
      body: 'Incoming call - Click to view',
      tag: 'incoming-call',
      requireInteraction: true,
      silent: false,
    });

    // Click notification to focus the app (user will see the incoming call UI)
    if (notification) {
      notification.onclick = () => {
        window.focus();
        // Navigate to phone/dialer page where incoming call UI is shown (no page reload)
        navigateFromNotification('/phone');
        notification.close();
      };
    }

    // Flash tab title
    startTitleFlash(`Call from ${displayName}`, '📞');

    // Update favicon badge
    incrementFaviconBadge();
  }
}

/**
 * Stop incoming call notifications (when call is answered or ends)
 * NOTE: Ringtone is stopped by callAudioService.stopRingtone(), not here
 */
export function stopIncomingCallNotification(): void {
  stopTitleFlash();
}

/**
 * Notify user of missed call
 */
export function notifyMissedCall(from: string, contactName?: string | null): void {
  const displayName = contactName || from;
  const settings = useNotificationSettings.getState();

  // Play short notification beep
  playNotificationSound('MISSED_CALL');

  // Show rich notification
  if (settings.toastEnabled) {
    richNotification.missedCall(from, { contactName });
  }

  if (typeof document !== 'undefined' && !document.hasFocus()) {
    const notification = showBrowserNotification('Missed Call', {
      body: `${displayName} tried to call you`,
      tag: 'missed-call',
      silent: false,
    });

    if (notification) {
      notification.onclick = () => {
        window.focus();
        // Navigate to call history page (no page reload)
        navigateFromNotification('/phone/history');
        notification.close();
      };
    }

    startTitleFlash(`Missed call from ${displayName}`, '📵');
    incrementFaviconBadge();
  }
}
