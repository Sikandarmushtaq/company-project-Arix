'use client';

/**
 * Desktop notifications (Web Notification API).
 *
 * Used by the super-admin support ring so a new ticket surfaces even when the
 * admin is heads-down in another tab or another app — the OS pop-up appears
 * regardless of which tab is focused, as long as the browser is running (which
 * it always is: super-admins keep the admin tab open indefinitely). This does
 * NOT need a service worker: a service worker is only required for push when
 * the page is closed, and our page is never closed.
 *
 * Permission MUST be requested from a user gesture — auto-prompting on page
 * load is an anti-pattern browsers penalise and users reflexively deny. Callers
 * expose an explicit "Enable desktop alerts" affordance and call
 * `requestNotificationPermission()` from its click handler.
 *
 * @module lib/notifications/desktop-notify
 */

export type NotifyPermission = 'default' | 'granted' | 'denied' | 'unsupported';

/** Whether the Notification API exists in this environment (SSR-safe). */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Current permission, or 'unsupported' when the API is absent. */
export function getNotificationPermission(): NotifyPermission {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission as NotifyPermission;
}

/**
 * Ask the browser for notification permission. Call ONLY from a user gesture.
 * Resolves to the resulting permission; never throws.
 */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result as NotifyPermission;
  } catch {
    return getNotificationPermission();
  }
}

interface ShowOptions {
  body?: string;
  /** De-dupes repeat notifications for the same subject (e.g. one per ticket). */
  tag?: string;
  /** Called when the user clicks the notification (after the window is focused). */
  onClick?: () => void;
}

/**
 * Show a desktop notification if permission is granted. No-ops (and never
 * throws) when unsupported or not granted, so callers can fire it blindly.
 */
export function showDesktopNotification(title: string, options: ShowOptions = {}): void {
  if (getNotificationPermission() !== 'granted') return;
  try {
    const n = new Notification(title, {
      body: options.body,
      tag: options.tag,
      // Coalesce updates to the same tag instead of stacking duplicates.
      renotify: options.tag ? true : undefined,
      icon: '/favicon.ico',
    } as NotificationOptions);
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* focus can be blocked — the click handler below still runs */
      }
      options.onClick?.();
      n.close();
    };
  } catch {
    /* constructing a Notification can throw on some platforms — ignore */
  }
}
