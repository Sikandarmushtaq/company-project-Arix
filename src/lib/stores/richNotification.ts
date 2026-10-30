'use client';

/**
 * Rich Notification Store - Google-style notifications for calls, SMS, voicemails
 *
 * Features:
 * - Avatar/icon support
 * - Title and body text
 * - Action buttons
 * - Timestamps
 * - Smooth animations
 *
 * @module lib/stores/richNotification
 */

import { create } from 'zustand';

export type RichNotificationType = 'call' | 'sms' | 'voicemail' | 'missed_call';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface RichNotification {
  id: string;
  type: RichNotificationType;
  title: string;
  body?: string;
  avatar?: string;
  initials?: string;
  timestamp: Date;
  duration?: number; // Auto-dismiss after ms (0 = no auto-dismiss)
  actions?: NotificationAction[];
  onDismiss?: () => void;
}

interface RichNotificationStore {
  notifications: RichNotification[];
  addNotification: (notification: Omit<RichNotification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useRichNotificationStore = create<RichNotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = generateId();
    const fullNotification: RichNotification = {
      ...notification,
      id,
      timestamp: new Date(),
    };

    set((state) => ({
      notifications: [...state.notifications, fullNotification],
    }));

    // Auto-remove after duration (default 8 seconds for most, 0 for calls)
    const duration = notification.duration ?? (notification.type === 'call' ? 0 : 8000);
    if (duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }

    return id;
  },

  removeNotification: (id) => {
    const notification = get().notifications.find((n) => n.id === id);
    if (notification?.onDismiss) {
      notification.onDismiss();
    }
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));

/**
 * Helper to get initials from a name or number
 */
export function getInitials(name: string): string {
  if (!name) return '?';

  // If it's a phone number, return phone icon indicator
  if (/^\+?\d+$/.test(name.replace(/[\s-()]/g, ''))) {
    return '#';
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Rich notification helper methods
 */
export const richNotification = {
  /**
   * Show incoming call notification
   */
  incomingCall: (
    from: string,
    options?: {
      contactName?: string | null;
      avatar?: string;
      onAnswer?: () => void;
      onDecline?: () => void;
    }
  ) => {
    const displayName = options?.contactName || from;
    const actions: NotificationAction[] = [];

    if (options?.onAnswer) {
      actions.push({
        label: 'Answer',
        onClick: options.onAnswer,
        primary: true,
      });
    }
    if (options?.onDecline) {
      actions.push({
        label: 'Decline',
        onClick: options.onDecline,
      });
    }

    return useRichNotificationStore.getState().addNotification({
      type: 'call',
      title: 'Incoming Call',
      body: displayName,
      avatar: options?.avatar,
      initials: getInitials(displayName),
      duration: 0, // Don't auto-dismiss calls
      actions,
    });
  },

  /**
   * Show missed call notification
   */
  missedCall: (from: string, options?: { contactName?: string | null; avatar?: string }) => {
    const displayName = options?.contactName || from;

    return useRichNotificationStore.getState().addNotification({
      type: 'missed_call',
      title: 'Missed Call',
      body: displayName,
      avatar: options?.avatar,
      initials: getInitials(displayName),
      duration: 8000,
    });
  },

  /**
   * Show SMS notification
   */
  sms: (
    from: string,
    message: string,
    options?: {
      contactName?: string | null;
      avatar?: string;
      onReply?: () => void;
      onView?: () => void;
    }
  ) => {
    const displayName = options?.contactName || from;
    const preview = message.length > 80 ? message.slice(0, 80) + '...' : message;
    const actions: NotificationAction[] = [];

    if (options?.onView) {
      actions.push({
        label: 'View',
        onClick: options.onView,
        primary: true,
      });
    }
    if (options?.onReply) {
      actions.push({
        label: 'Reply',
        onClick: options.onReply,
      });
    }

    return useRichNotificationStore.getState().addNotification({
      type: 'sms',
      title: displayName,
      body: preview,
      avatar: options?.avatar,
      initials: getInitials(displayName),
      duration: 8000,
      actions,
    });
  },

  /**
   * Show voicemail notification
   */
  voicemail: (
    from: string,
    durationSecs: number,
    options?: {
      contactName?: string | null;
      avatar?: string;
      onPlay?: () => void;
    }
  ) => {
    const displayName = options?.contactName || from;
    const durationStr = `${Math.floor(durationSecs / 60)}:${(durationSecs % 60).toString().padStart(2, '0')}`;
    const actions: NotificationAction[] = [];

    if (options?.onPlay) {
      actions.push({
        label: 'Play',
        onClick: options.onPlay,
        primary: true,
      });
    }

    return useRichNotificationStore.getState().addNotification({
      type: 'voicemail',
      title: 'New Voicemail',
      body: `${displayName} • ${durationStr}`,
      avatar: options?.avatar,
      initials: getInitials(displayName),
      duration: 10000,
      actions,
    });
  },

  /**
   * Dismiss a notification
   */
  dismiss: (id: string) => {
    useRichNotificationStore.getState().removeNotification(id);
  },

  /**
   * Clear all notifications
   */
  clearAll: () => {
    useRichNotificationStore.getState().clearAll();
  },
};
