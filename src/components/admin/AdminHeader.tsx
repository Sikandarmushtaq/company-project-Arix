'use client';

/**
 * Admin Header Component
 *
 * Specialized header for admin panel with real-time notifications.
 */

import React, { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiLogOut, FiUser, FiMoon, FiSun, FiWifi, FiWifiOff, FiPhone } from 'react-icons/fi';
import { useAuthStore } from '@/lib/stores';
import { Button } from '@/components/ui';
import { useSocket } from '@/lib/providers/SocketProvider';
import { AdminNotifications } from './AdminNotifications';
import { AdminMonitorPanel } from './AdminMonitorPanel';
import { useAdminRealtimeSync } from '@/lib/hooks/useAdminRealtimeSync';
import { useAdminConnections } from '@/lib/hooks';
import { crossAppHref } from '@/lib/utils/routing';

interface AdminHeaderProps {
  title?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title }) => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { status: socketStatus, isConnected } = useSocket();
  const [isDark, setIsDark] = React.useState(false);

  // Use admin real-time sync to get alerts and audit logs
  const { alerts, recentAuditLogs, dismissAlert } = useAdminRealtimeSync();

  // Get live connections count (real-time via WebSocket events)
  const { data: connections } = useAdminConnections();
  const onlineCount = connections?.length || 0;

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  // Connection status indicator
  const connectionIndicator = useMemo(() => {
    switch (socketStatus) {
      case 'connected':
        return {
          color: 'bg-green-500',
          title: 'Real-time connected',
          icon: <FiWifi className="w-4 h-4" />,
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500 animate-pulse',
          title: 'Connecting...',
          icon: <FiWifi className="w-4 h-4" />,
        };
      case 'error':
      case 'disconnected':
      default:
        return {
          color: 'bg-red-500',
          title: 'Disconnected - updates may be delayed',
          icon: <FiWifiOff className="w-4 h-4" />,
        };
    }
  }, [socketStatus]);

  const toggleTheme = useCallback(() => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  }, [isDark]);

  const handleLogout = useCallback(() => {
    logout();
    router.push('/login');
  }, [logout, router]);

  return (
    <header className="h-16 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-6 sticky top-0 z-40">
      <div>
        {title && <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>}
      </div>

      <div className="flex items-center gap-3">
        {/* Live Connections Count */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          title={`${onlineCount} live connections`}
        >
          <span
            className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
          />
          <span className="text-xs font-medium">{onlineCount} online</span>
        </div>

        {/* Connection Status */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--background)] text-[var(--muted-foreground)]"
          title={connectionIndicator.title}
        >
          <span className={`w-2 h-2 rounded-full ${connectionIndicator.color}`} />
          <span className="text-xs hidden sm:inline">
            {isConnected ? 'Live' : socketStatus === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
        </div>

        {/* Monitor Phone Panel */}
        <AdminMonitorPanel />

        {/* Admin Notifications */}
        <AdminNotifications
          alerts={alerts}
          auditLogs={recentAuditLogs}
          onDismissAlert={dismissAlert}
        />

        {/* Switch to Dialer Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Cross to the dialer's subdomain on arixcall (app.arixcall.com);
            // relative in-app nav on a single host.
            const href = crossAppHref('app', '/phone');
            if (href.startsWith('http')) window.location.assign(href);
            else router.push(href);
          }}
          className="flex items-center gap-2 border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/20"
          title="Open Dialer"
        >
          <FiPhone className="w-4 h-4" />
          <span className="hidden sm:inline">Dialer</span>
        </Button>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
        </Button>

        {/* User Menu */}
        <div className="flex items-center gap-3 pl-3 border-l border-[var(--border)]">
          <div className="text-right">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {user?.fullName || user?.email || 'Admin'}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] capitalize">
              {user?.role || 'Admin'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] flex items-center justify-center">
            <FiUser className="w-5 h-5 text-[var(--foreground)]" />
          </div>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} title="Logout">
            <FiLogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
