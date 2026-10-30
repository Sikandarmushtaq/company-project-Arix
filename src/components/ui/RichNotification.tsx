'use client';

/**
 * Rich Notification Component - Professional notifications
 *
 * Clean, modern design inspired by Google/Slack notifications.
 * Positioned at bottom-right with slide-up animation.
 *
 * @module components/ui/RichNotification
 */

import { useEffect, useState } from 'react';
import { FiX, FiPhone, FiMessageSquare, FiVoicemail, FiPhoneMissed } from 'react-icons/fi';
import {
  useRichNotificationStore,
  type RichNotification,
  type RichNotificationType,
} from '@/lib/stores/richNotification';

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: RichNotificationType) {
  switch (type) {
    case 'call':
      return <FiPhone className="w-3.5 h-3.5" />;
    case 'missed_call':
      return <FiPhoneMissed className="w-3.5 h-3.5" />;
    case 'sms':
      return <FiMessageSquare className="w-3.5 h-3.5" />;
    case 'voicemail':
      return <FiVoicemail className="w-3.5 h-3.5" />;
  }
}

/**
 * Get colors for notification type
 */
function getTypeColors(type: RichNotificationType) {
  switch (type) {
    case 'call':
      return {
        bg: 'bg-green-500',
        ring: 'ring-green-500/20',
        primary: 'bg-green-500 hover:bg-green-600',
      };
    case 'missed_call':
      return {
        bg: 'bg-red-500',
        ring: 'ring-red-500/20',
        primary: 'bg-blue-500 hover:bg-blue-600',
      };
    case 'sms':
      return {
        bg: 'bg-blue-500',
        ring: 'ring-blue-500/20',
        primary: 'bg-blue-500 hover:bg-blue-600',
      };
    case 'voicemail':
      return {
        bg: 'bg-violet-500',
        ring: 'ring-violet-500/20',
        primary: 'bg-violet-500 hover:bg-violet-600',
      };
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return 'now';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h`;
  return date.toLocaleDateString();
}

/**
 * Avatar component with fallback initials
 */
function Avatar({
  src,
  initials,
  type,
}: {
  src?: string;
  initials?: string;
  type: RichNotificationType;
}) {
  const colors = getTypeColors(type);

  if (src) {
    return (
      <div className="relative flex-shrink-0">
        <img src={src} alt="" className="w-10 h-10 rounded-full object-cover" />
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${colors.bg} flex items-center justify-center text-white ring-2 ring-white dark:ring-gray-800`}
        >
          {getNotificationIcon(type)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center text-white font-medium text-sm`}
      >
        {initials || '?'}
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-white ring-2 ring-white dark:ring-gray-800">
        {getNotificationIcon(type)}
      </div>
    </div>
  );
}

/**
 * Single notification item
 */
function NotificationItem({
  notification,
  onRemove,
}: {
  notification: RichNotification;
  onRemove: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const colors = getTypeColors(notification.type);
  const isCall = notification.type === 'call';

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Handle removal with animation
  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(onRemove, 200);
  };

  const handleActionClick = (onClick: () => void) => {
    onClick();
    handleRemove();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        w-80 bg-white dark:bg-gray-800 rounded-xl
        shadow-lg shadow-black/10 dark:shadow-black/30
        border border-gray-200/80 dark:border-gray-700/80
        overflow-hidden
        transform transition-all duration-200 ease-out
        ${isCall ? `ring-2 ${colors.ring}` : ''}
        ${isVisible && !isExiting ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
    >
      {/* Main content */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar
            src={notification.avatar}
            initials={notification.initials}
            type={notification.type}
          />

          {/* Text content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {notification.title}
              </h4>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatRelativeTime(notification.timestamp)}
                </span>
                <button
                  onClick={handleRemove}
                  className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Dismiss"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {notification.body && (
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {notification.body}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="mt-3 flex gap-2">
            {notification.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleActionClick(action.onClick)}
                className={`
                  flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors
                  ${
                    action.primary
                      ? `${colors.primary} text-white`
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Incoming call indicator */}
      {isCall && (
        <div className="h-0.5 bg-gradient-to-r from-green-400 via-green-500 to-green-400 animate-pulse" />
      )}
    </div>
  );
}

/**
 * Rich Notification Container
 *
 * Place this once at the app root level.
 */
export function RichNotificationContainer() {
  const notifications = useRichNotificationStore((state) => state.notifications);
  const removeNotification = useRichNotificationStore((state) => state.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem
            notification={notification}
            onRemove={() => removeNotification(notification.id)}
          />
        </div>
      ))}
    </div>
  );
}
