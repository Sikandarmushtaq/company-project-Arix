'use client';

/**
 * SMS Notification Handlers
 *
 * Handles incoming SMS and voicemail notifications.
 *
 * @module lib/utils/notifications-sms
 */

import {
  showBrowserNotification,
  startTitleFlash,
  incrementFaviconBadge,
  playNotificationSound,
  navigateFromNotification,
} from './notifications-shared';
import { richNotification } from '@/lib/stores/richNotification';
import { useNotificationSettings } from '@/lib/stores/notificationSettings';

/**
 * Notify user of incoming SMS
 * Plays sound, shows rich notification, browser notification, title flash, and favicon badge
 */
export function notifyIncomingSms(
  from: string,
  body: string,
  contactName?: string | null,
  options?: { onView?: () => void; onReply?: () => void }
): void {
  const displayName = contactName || from;
  const settings = useNotificationSettings.getState();

  // 1. Play notification sound
  playNotificationSound('SMS');

  // 2. Show rich in-app notification
  if (settings.toastEnabled) {
    richNotification.sms(from, body, {
      contactName,
      onView: options?.onView,
      onReply: options?.onReply,
    });
  }

  // 3. Show browser notification (if tab not focused)
  if (typeof document !== 'undefined' && !document.hasFocus()) {
    const preview = body.length > 100 ? body.slice(0, 100) + '...' : body;
    const notification = showBrowserNotification(displayName, {
      body: preview,
      tag: `sms-${from}`,
      silent: false,
    });

    // Click notification to open the specific conversation
    if (notification) {
      notification.onclick = () => {
        window.focus();
        // Navigate to messages page with phone parameter to open specific chat (no page reload)
        const encodedPhone = encodeURIComponent(from);
        navigateFromNotification(`/phone/messages?phone=${encodedPhone}`);
        notification.close();
      };
    }

    // 4. Flash tab title
    startTitleFlash(`New message from ${displayName}`, '💬');

    // 5. Update favicon badge
    incrementFaviconBadge();
  }
}

/**
 * Notify user of incoming WhatsApp message
 * Same pattern as SMS but with WhatsApp branding and navigation
 */
export function notifyIncomingWhatsApp(
  from: string,
  body: string,
  contactName?: string | null
): void {
  const displayName = contactName || from;
  const settings = useNotificationSettings.getState();

  // 1. Play notification sound
  playNotificationSound('SMS');

  // 2. Show rich in-app notification
  if (settings.toastEnabled) {
    richNotification.sms(from, body, { contactName });
  }

  // 3. Show browser notification (if tab not focused)
  if (typeof document !== 'undefined' && !document.hasFocus()) {
    const preview = body.length > 100 ? body.slice(0, 100) + '...' : body;
    const notification = showBrowserNotification(`WhatsApp: ${displayName}`, {
      body: preview,
      tag: `wa-${from}`,
      silent: false,
    });

    if (notification) {
      notification.onclick = () => {
        window.focus();
        const encodedPhone = encodeURIComponent(from);
        navigateFromNotification(`/phone/whatsapp?phone=${encodedPhone}`);
        notification.close();
      };
    }

    // 4. Flash tab title
    startTitleFlash(`WhatsApp from ${displayName}`, '💬');

    // 5. Update favicon badge
    incrementFaviconBadge();
  }
}

/**
 * Notify user of new voicemail
 */
export function notifyNewVoicemail(
  from: string,
  duration: number,
  contactName?: string | null,
  options?: { onPlay?: () => void }
): void {
  const displayName = contactName || from;
  const settings = useNotificationSettings.getState();
  const durationStr = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

  playNotificationSound('VOICEMAIL');

  // Show rich notification
  if (settings.toastEnabled) {
    richNotification.voicemail(from, duration, {
      contactName,
      onPlay: options?.onPlay,
    });
  }

  if (typeof document !== 'undefined' && !document.hasFocus()) {
    const notification = showBrowserNotification('New Voicemail', {
      body: `${displayName} left a ${durationStr} message`,
      tag: 'voicemail',
      silent: false,
    });

    if (notification) {
      notification.onclick = () => {
        window.focus();
        // Navigate to voicemail page (no page reload)
        navigateFromNotification('/phone/voicemail');
        notification.close();
      };
    }

    startTitleFlash(`Voicemail from ${displayName}`, '📩');
    incrementFaviconBadge();
  }
}
