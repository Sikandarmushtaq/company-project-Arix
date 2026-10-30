'use client';

/**
 * Admin Alert Toast Component
 *
 * Displays real-time toast notifications for admin alerts.
 * Appears in the bottom-right corner of the screen.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi';
import type { AdminAlert } from '@/lib/hooks/useAdminRealtimeSync';

interface AdminAlertToastProps {
  alerts: AdminAlert[];
  onDismiss: (alertId: string) => void;
  maxToasts?: number;
  autoDismissMs?: number;
}

/**
 * Get icon and styles for alert type
 */
function getAlertStyles(type: AdminAlert['type']) {
  switch (type) {
    case 'success':
      return {
        icon: FiCheckCircle,
        bgColor: 'bg-green-50 dark:bg-green-900/30',
        borderColor: 'border-green-200 dark:border-green-800',
        iconColor: 'text-green-500',
        textColor: 'text-green-800 dark:text-green-200',
      };
    case 'warning':
      return {
        icon: FiAlertTriangle,
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        iconColor: 'text-yellow-500',
        textColor: 'text-yellow-800 dark:text-yellow-200',
      };
    case 'error':
      return {
        icon: FiAlertCircle,
        bgColor: 'bg-red-50 dark:bg-red-900/30',
        borderColor: 'border-red-200 dark:border-red-800',
        iconColor: 'text-red-500',
        textColor: 'text-red-800 dark:text-red-200',
      };
    case 'info':
    default:
      return {
        icon: FiInfo,
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        iconColor: 'text-blue-500',
        textColor: 'text-blue-800 dark:text-blue-200',
      };
  }
}

interface ToastItemProps {
  alert: AdminAlert;
  onDismiss: (alertId: string) => void;
  autoDismissMs: number;
}

const ToastItem: React.FC<ToastItemProps> = ({ alert, onDismiss, autoDismissMs }) => {
  const [isExiting, setIsExiting] = useState(false);
  const styles = getAlertStyles(alert.type);
  const Icon = styles.icon;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(alert.id), 300);
  }, [alert.id, onDismiss]);

  // Auto-dismiss after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs, handleDismiss]);

  return (
    <div
      className={`transform transition-all duration-300 ${
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${styles.bgColor} ${styles.borderColor} max-w-sm`}
      >
        <Icon className={`w-5 h-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${styles.textColor}`}>{alert.title}</p>
          <p className={`text-sm mt-0.5 opacity-90 ${styles.textColor}`}>{alert.message}</p>
          {alert.action && (
            <button
              className={`text-sm mt-2 font-medium underline ${styles.textColor} hover:opacity-80`}
              onClick={() => {
                // Handle action if needed
                handleDismiss();
              }}
            >
              {alert.action}
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className={`p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded ${styles.textColor}`}
          aria-label="Dismiss notification"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const AdminAlertToast: React.FC<AdminAlertToastProps> = ({
  alerts,
  onDismiss,
  maxToasts = 5,
  autoDismissMs = 8000,
}) => {
  // Track which alerts have been shown as toasts
  const [shownAlertIds, setShownAlertIds] = useState<Set<string>>(new Set());
  const [visibleToasts, setVisibleToasts] = useState<AdminAlert[]>([]);

  // When new alerts come in, add them to visible toasts
  useEffect(() => {
    const newAlerts = alerts.filter((a) => !shownAlertIds.has(a.id));

    if (newAlerts.length > 0) {
      setShownAlertIds((prev) => {
        const next = new Set(prev);
        newAlerts.forEach((a) => next.add(a.id));
        return next;
      });

      setVisibleToasts((prev) => {
        const combined = [...newAlerts, ...prev];
        return combined.slice(0, maxToasts);
      });
    }
  }, [alerts, shownAlertIds, maxToasts]);

  const handleDismiss = useCallback(
    (alertId: string) => {
      setVisibleToasts((prev) => prev.filter((a) => a.id !== alertId));
      onDismiss(alertId);
    },
    [onDismiss]
  );

  if (visibleToasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
      aria-label="Notifications"
    >
      {visibleToasts.map((alert) => (
        <ToastItem
          key={alert.id}
          alert={alert}
          onDismiss={handleDismiss}
          autoDismissMs={autoDismissMs}
        />
      ))}
    </div>
  );
};
