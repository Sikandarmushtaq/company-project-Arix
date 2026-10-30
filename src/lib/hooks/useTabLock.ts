'use client';

/**
 * useTabLock
 *
 * Enforces single-tab dialer sessions using the BroadcastChannel API.
 * When a new tab opens the dialer, it broadcasts a takeover message.
 * Older tabs receive it and yield their SIP connection.
 *
 * Pattern matches WhatsApp Web / Google Voice / Telegram Web:
 *   - Newest tab wins
 *   - Older tabs show "active in another tab" overlay
 *   - User can reclaim from the old tab with one click
 *
 * No server changes, no polling, no WebSocket — purely browser-native.
 *
 * @module lib/hooks/useTabLock
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const CHANNEL_NAME = 'nuxcall-dialer-tab-lock';
const MSG_TAKEOVER = 'takeover';
const MSG_RECLAIM = 'reclaim';

/** Generate a short random ID for this tab instance. */
function generateTabId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface TabLockState {
  /** Whether THIS tab is the active dialer tab. */
  isActiveTab: boolean;
  /** Reclaim the dialer session in THIS tab (deactivates the other tab). */
  reclaim: () => void;
}

export function useTabLock(): TabLockState {
  const tabIdRef = useRef(generateTabId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [isActiveTab, setIsActiveTab] = useState(true);

  const reclaim = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    // Broadcast that THIS tab is taking over
    channel.postMessage({ type: MSG_RECLAIM, tabId: tabIdRef.current });
    setIsActiveTab(true);
  }, []);

  useEffect(() => {
    // BroadcastChannel not available (SSR, very old browser) — stay active
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    // Listen for messages from other tabs
    channel.onmessage = (event) => {
      const { type, tabId } = event.data ?? {};

      if (type === MSG_TAKEOVER && tabId !== tabIdRef.current) {
        // Another tab just opened — yield to it
        setIsActiveTab(false);
      }

      if (type === MSG_RECLAIM && tabId !== tabIdRef.current) {
        // Another tab reclaimed — yield to it
        setIsActiveTab(false);
      }
    };

    // Announce this tab as the new active tab
    channel.postMessage({ type: MSG_TAKEOVER, tabId: tabIdRef.current });

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  return { isActiveTab, reclaim };
}
