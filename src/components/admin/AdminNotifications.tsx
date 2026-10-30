'use client';

/**
 * Admin Notifications Component
 *
 * Real-time notification dropdown for admin panel.
 * Shows alerts and audit log entries from Socket.IO events.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FiBell,
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiAlertTriangle,
  FiX,
  FiClock,
  FiUser,
  FiSettings,
  FiShield,
  FiMonitor,
  FiActivity,
  FiTrash2,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import type { AuditLogEntry, AdminAlert } from '@/lib/hooks/useAdminRealtimeSync';

interface AdminNotificationsProps {
  alerts: AdminAlert[];
  auditLogs: AuditLogEntry[];
  onDismissAlert: (alertId: string) => void;
  onClearAll?: () => void;
}

/**
 * Get icon and color for alert type
 */
function getAlertIcon(type: AdminAlert['type']) {
  switch (type) {
    case 'success':
      return { icon: FiCheckCircle, color: 'text-green-500' };
    case 'warning':
      return { icon: FiAlertTriangle, color: 'text-yellow-500' };
    case 'error':
      return { icon: FiAlertCircle, color: 'text-red-500' };
    case 'info':
    default:
      return { icon: FiInfo, color: 'text-blue-500' };
  }
}

/**
 * Get icon for audit log target type
 */
function getTargetIcon(targetType: AuditLogEntry['targetType']) {
  switch (targetType) {
    case 'user':
      return FiUser;
    case 'device':
      return FiMonitor;
    case 'session':
      return FiActivity;
    case 'settings':
      return FiSettings;
    case 'recording':
      return FiActivity;
    case 'system':
    default:
      return FiShield;
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Format audit action for display
 */
function formatAuditAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({
  alerts,
  auditLogs,
  onDismissAlert,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'activity'>('alerts');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate total unread count
  const totalCount = alerts.length + auditLogs.length;
  const hasItems = totalCount > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={hasItems ? `${totalCount} notifications` : 'No notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={handleToggle}
      >
        <FiBell className="w-5 h-5" aria-hidden="true" />
        {hasItems && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--danger)] text-white text-xs font-medium rounded-full flex items-center justify-center animate-pulse"
            aria-hidden="true"
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-96 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]">
            <h3 className="font-semibold text-[var(--foreground)]">Notifications</h3>
            {onClearAll && hasItems && (
              <button
                onClick={onClearAll}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1"
              >
                <FiTrash2 className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)]">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'alerts'
                  ? 'text-[var(--foreground)] border-b-2 border-[var(--border)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'activity'
                  ? 'text-[var(--foreground)] border-b-2 border-[var(--border)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Activity ({auditLogs.length})
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {activeTab === 'alerts' ? (
              alerts.length === 0 ? (
                <div className="p-8 text-center text-[var(--muted-foreground)]">
                  <FiBell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No alerts</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {alerts.map((alert) => {
                    const { icon: Icon, color } = getAlertIcon(alert.type);
                    return (
                      <div
                        key={alert.id}
                        className="p-4 hover:bg-[var(--muted)] transition-colors relative group"
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-[var(--foreground)]">
                              {alert.title}
                            </p>
                            <p className="text-sm text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                              {alert.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <FiClock className="w-3 h-3 text-[var(--muted-foreground)]" />
                              <span className="text-xs text-[var(--muted-foreground)]">
                                {formatRelativeTime(alert.timestamp)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => onDismissAlert(alert.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--muted)] rounded transition-opacity"
                            aria-label="Dismiss alert"
                          >
                            <FiX className="w-4 h-4 text-[var(--muted-foreground)]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted-foreground)]">
                <FiActivity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {auditLogs.map((log) => {
                  const Icon = getTargetIcon(log.targetType);
                  return (
                    <div key={log.id} className="p-4 hover:bg-[var(--muted)] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-[var(--foreground)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--foreground)]">
                            <span className="font-medium">{log.adminName}</span>{' '}
                            <span className="text-[var(--muted-foreground)]">
                              {formatAuditAction(log.action)}
                            </span>
                            {log.targetName && (
                              <>
                                {' '}
                                <span className="font-medium">{log.targetName}</span>
                              </>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <FiClock className="w-3 h-3 text-[var(--muted-foreground)]" />
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {formatRelativeTime(log.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - Link to full audit log */}
          {activeTab === 'activity' && auditLogs.length > 0 && (
            <div className="border-t border-[var(--border)] p-2">
              <a
                href="/admin/audit"
                className="block text-center text-sm text-[var(--foreground)] hover:text-[var(--foreground)] py-2"
              >
                View all activity
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
