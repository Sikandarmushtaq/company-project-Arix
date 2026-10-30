'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FiLogOut, FiUser, FiMoon, FiSun, FiWifi, FiWifiOff, FiGrid } from 'react-icons/fi';
import { useAuthStore } from '@/lib/stores';
import { Button } from '@/components/ui';
import { useSocket } from '@/lib/providers/SocketProvider';
import { NotificationDropdown } from './NotificationDropdown';
import { PhoneSelector } from '@/components/phone';
import { useDndStatus } from '@/lib/hooks/useUserSettings';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { status: socketStatus, isConnected } = useSocket();
  const { data: dndStatus } = useDndStatus();
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  // Connection status indicator
  const getConnectionIndicator = () => {
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
  };

  const connectionIndicator = getConnectionIndicator();

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      <div className="min-w-0">
        {title && (
          <h1 className="truncate text-lg md:text-xl font-semibold text-[var(--foreground)]">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Connection Status */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--background)] text-[var(--muted-foreground)]"
          role="status"
          aria-label={connectionIndicator.title}
        >
          <span
            className={`w-2 h-2 rounded-full ${connectionIndicator.color}`}
            aria-hidden="true"
          />
          <span className="text-xs hidden sm:inline" aria-hidden="true">
            {isConnected ? 'Live' : socketStatus === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
        </div>

        {/* DND Indicator */}
        {dndStatus?.enabled && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50"
            role="status"
            aria-label="Do Not Disturb is active"
          >
            <FiMoon className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-xs font-medium hidden sm:inline">DND</span>
          </div>
        )}

        {/* Active Phone Number Selector (multi-number) */}
        <PhoneSelector />

        {/* Notifications */}
        <NotificationDropdown />

        {/* Manager/Admin Panel Button */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/20"
            title={user?.role === 'admin' ? 'Admin Panel' : 'Manager Panel'}
          >
            <FiGrid className="w-4 h-4" />
            <span className="hidden sm:inline">{user?.role === 'admin' ? 'Admin' : 'Manager'}</span>
          </Button>
        )}

        {/* Theme Toggle — desktop only (keeps the mobile header from overflowing) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDark}
          className="hidden md:inline-flex"
        >
          {isDark ? (
            <FiSun className="w-5 h-5" aria-hidden="true" />
          ) : (
            <FiMoon className="w-5 h-5" aria-hidden="true" />
          )}
        </Button>

        {/* User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 sm:pl-3 sm:border-l border-[var(--border)]">
          {/* Name/role + avatar are decorative — hidden on mobile to stop the
              header overflowing; the logout button stays. */}
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {user?.fullName || user?.email || 'User'}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] capitalize">
              {user?.role || 'User'}
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] items-center justify-center">
            <FiUser className="w-5 h-5 text-[var(--foreground)]" />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleLogout}
            aria-label="Log out of your account"
          >
            <FiLogOut className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
};
