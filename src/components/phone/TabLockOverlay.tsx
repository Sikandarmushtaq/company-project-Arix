'use client';

import React from 'react';
import { FiPhoneOff, FiRefreshCw } from 'react-icons/fi';

interface TabLockOverlayProps {
  onReclaim: () => void;
}

/**
 * Full-screen overlay shown when the dialer is active in another browser tab.
 * Blocks all interaction until the user either switches to the active tab
 * or reclaims the session here.
 */
export function TabLockOverlay({ onReclaim }: TabLockOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="text-center space-y-6 max-w-md px-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <FiPhoneOff className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Phone is active in another tab</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Your dialer session is running in a different browser tab. Only one tab can be connected
            at a time to ensure call quality.
          </p>
        </div>

        <button
          type="button"
          onClick={onReclaim}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <FiRefreshCw className="w-4 h-4" />
          Use phone in this tab
        </button>

        <p className="text-xs text-[var(--muted-foreground)]">
          This will disconnect the other tab&apos;s phone session.
        </p>
      </div>
    </div>
  );
}
