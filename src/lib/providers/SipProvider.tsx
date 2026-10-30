'use client';

/**
 * SIP Provider - SINGLE SOURCE OF TRUTH for SIP Connection
 *
 * Provides SIP/WebRTC phone functionality to any part of the application.
 * Handles connection lifecycle, auto-reconnection, and exposes state via context.
 *
 * Usage:
 * 1. Wrap your layout with <SipProvider>
 * 2. Use useSipConnection() hook to access connection state
 * 3. Use useSipStore() for call operations (existing store)
 *
 * NOTE: Phone number switching does NOT require SIP re-registration.
 * SIP credentials (sipUsername/sipPassword) are per-user, not per-phone.
 * The FusionPBX caller ID is updated server-side by switchActivePhone().
 *
 * @module lib/providers/SipProvider
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores';
import { useSipStore } from '@/lib/stores/sip';
import { authApiService } from '@/lib/api';
import { callAudioService } from '@/lib/sip';
import { callEngine } from '@/lib/call/call-engine';
import {
  preloadNotificationSounds,
  unlockNotificationAudio,
  requestNotificationPermission,
} from '@/lib/utils/notifications';
import { useTabLock } from '@/lib/hooks/useTabLock';
import { TabLockOverlay } from '@/components/phone/TabLockOverlay';
import { preWarmTurnCredentials } from '@/lib/sip/config';
import { remoteAudioBoost } from '@/lib/sip/remote-audio-boost';

/**
 * SIP connection status
 */
type SipConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * SIP Provider context value
 */
interface SipContextValue {
  /** Current connection status */
  status: SipConnectionStatus;
  /** Whether SIP is registered and ready */
  isReady: boolean;
  /** Whether currently connecting */
  isConnecting: boolean;
  /** Registration error message if any */
  error: string | null;
  /** Whether audio has been unlocked by user interaction */
  isAudioUnlocked: boolean;
  /** Manual reconnect function */
  reconnect: () => Promise<void>;
  /** Manual disconnect function */
  disconnect: () => Promise<void>;
  /** Manually unlock audio (for programmatic use) */
  unlockAudio: () => void;
}

const SipContext = createContext<SipContextValue | null>(null);

/**
 * SIP Provider Props
 */
interface SipProviderProps {
  children: React.ReactNode;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Enable audio initialization (default: true) */
  initializeAudio?: boolean;
}

/**
 * SIP Provider Component
 *
 * Manages SIP connection lifecycle and provides state to children.
 * Uses the existing useSipStore for actual SIP operations.
 */
export function SipProvider({
  children,
  autoConnect = true,
  initializeAudio = true,
}: SipProviderProps) {
  const { user, isAuthenticated } = useAuthStore();
  const { connectionState, isRegistered, registrationError, connect, disconnect } = useSipStore();

  const [status, setStatus] = useState<SipConnectionStatus>('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const lastConnectedUserId = useRef<number | null>(null);
  // Track which SIP username we last registered with for this user. If
  // admin removes the user's extension (Voice capability off) or assigns
  // a different one, this ref differs from `user.sipUsername` and the
  // auto-connect effect knows to disconnect / re-register accordingly.
  const lastConnectedSipUsername = useRef<string | null>(null);
  const isConnectingRef = useRef(false);

  // Mirror reactive SIP state into refs. doConnect needs to read these to
  // decide "already connected? skip", but if we add them to its useCallback
  // deps, doConnect's reference changes on every state transition (4×
  // per connect: disconnected→connecting→connected→registered). Effects
  // that depend on doConnect then re-fire on every transition, which —
  // combined with the multi-tab useTabLock — produced an oscillation
  // storm where the SIP UA was created/destroyed many times per second
  // (observed 2026-05-08 with /phone + /admin tabs both auto-connecting).
  // Refs let us read state inside doConnect without it being a dep.
  const connectionStateRef = useRef(connectionState);
  const isRegisteredRef = useRef(isRegistered);
  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);
  useEffect(() => {
    isRegisteredRef.current = isRegistered;
  }, [isRegistered]);

  // Single-tab enforcement — only one browser tab can hold the SIP connection.
  const { isActiveTab, reclaim } = useTabLock();

  /**
   * Unlock all audio elements and AudioContext
   * Called on first user interaction
   */
  const unlockAudio = useCallback(() => {
    if (isAudioUnlocked) return;

    // Unlock notification audio (includes AudioContext resume)
    unlockNotificationAudio();

    // Unlock call audio service
    // The callAudioService already has its own unlock mechanism,
    // but we trigger it explicitly here
    callAudioService.getSettings(); // Touch the service to ensure it's initialized

    setIsAudioUnlocked(true);
    console.log('[SipProvider] Audio unlocked');
  }, [isAudioUnlocked]);

  /**
   * Connect to SIP server
   */
  const doConnect = useCallback(async () => {
    if (!user || !isAuthenticated) {
      console.log('[SipProvider] Cannot connect - not authenticated');
      return;
    }

    // Voice capability gate. Users created without a SIP extension
    // (WhatsApp-only or SMS-only) have an empty sipUsername — there's
    // no SIP account to register against. Skip silently and stay
    // disconnected; the dialer page renders a benign "disconnected"
    // state and other features (SMS, WhatsApp) work normally.
    if (!user.sipUsername) {
      console.log('[SipProvider] No SIP extension configured for this user — Voice not enabled');
      return;
    }

    if (isConnectingRef.current) {
      console.log('[SipProvider] Already connecting, skipping');
      return;
    }

    // Detect user switch - different user than last connection
    const isUserSwitch =
      lastConnectedUserId.current !== null && lastConnectedUserId.current !== user.id;

    // If same user is already connected, skip
    // NOTE: Phone number changes do NOT require SIP re-registration.
    // SIP credentials are per-user (sipUsername/sipPassword), not per-phone.
    // FusionPBX caller ID is updated server-side by switchActivePhone().
    // Reads via refs so this callback's identity doesn't depend on these
    // reactive values — see ref declarations above.
    if (
      !isUserSwitch &&
      lastConnectedUserId.current === user.id &&
      (connectionStateRef.current === 'connected' || isRegisteredRef.current)
    ) {
      console.log('[SipProvider] Already connected for this user');
      setStatus('connected');
      return;
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    setStatus('connecting');

    try {
      // On user switch, ensure clean disconnect before new connection
      if (isUserSwitch) {
        console.log('[SipProvider] User switch detected, disconnecting previous session');
        try {
          await disconnect();
        } catch {
          // Ignore disconnect errors - proceed with new connection
        }
      }

      // Initialize audio service if enabled
      if (initializeAudio) {
        await callAudioService.initialize();
      }

      // Get SIP credentials from server (includes server config from System Settings)
      const credentials = await authApiService.getSipCredentials();

      if (!credentials.password) {
        console.warn('[SipProvider] SIP password not available');
        setStatus('error');
        return;
      }

      // Log server configuration from System Settings (SSOT)
      console.log('[SipProvider] Server config from System Settings:', {
        primary: credentials.webSocketUri,
        backup: credentials.backupWebSocketUri,
        domain: credentials.domain,
      });

      // Choose the call engine BEFORE connecting: LiveKit overlay if the server
      // enables it for this agent (`/livekit/config`), else SIP.js. Fails safe to
      // SIP.js on any error, so a config hiccup never blocks calling. connect()
      // then routes to whichever engine was selected (model A: one engine active).
      const engine = await callEngine.selectEngine();
      console.log('[SipProvider] Active call engine:', engine);

      // Connect using the store's connect method
      // Credentials include both primary and backup server from System Settings
      await connect(credentials);

      console.log('[SipProvider] Connected successfully');
      lastConnectedUserId.current = user.id;
      lastConnectedSipUsername.current = user.sipUsername;
    } catch (error) {
      console.error('[SipProvider] Connection failed:', error);
      setStatus('error');
      // Reset to allow retry
      lastConnectedUserId.current = null;
    } finally {
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
    // Deps deliberately exclude `connectionState` and `isRegistered` — those
    // are read via refs (connectionStateRef/isRegisteredRef) so SIP state
    // transitions don't recreate doConnect and cascade-trigger downstream
    // effects. See ref declarations earlier in this component.
  }, [user, isAuthenticated, connect, disconnect, initializeAudio]);

  /**
   * Disconnect from SIP server
   */
  const doDisconnect = useCallback(async () => {
    try {
      await disconnect();
      setStatus('disconnected');
      lastConnectedUserId.current = null;
      lastConnectedSipUsername.current = null;
    } catch (error) {
      console.error('[SipProvider] Disconnect failed:', error);
    }
  }, [disconnect]);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(async () => {
    lastConnectedUserId.current = null;
    await doDisconnect();
    await doConnect();
  }, [doConnect, doDisconnect]);

  // Sync status with store state
  // Priority: registered > error > connecting > connected (transport only) > disconnected
  useEffect(() => {
    if (isRegistered) {
      // Fully registered and ready
      setStatus('connected');
    } else if (registrationError) {
      // Registration failed with error
      setStatus('error');
    } else if (connectionState === 'connecting' || isConnecting) {
      // Connecting or reconnecting
      setStatus('connecting');
    } else if (connectionState === 'connected' || connectionState === 'registered') {
      // Transport connected but registration pending - show as connecting
      // This prevents "disconnected" flash during tab resume
      setStatus('connecting');
    } else if (
      connectionState === 'disconnected' &&
      !isConnecting &&
      lastConnectedUserId.current !== null
    ) {
      // Only show disconnected if we were previously connected
      // This prevents showing "disconnected" on initial load
      setStatus('disconnected');
    }
    // If none match and we haven't connected before, leave status unchanged (initial state)
  }, [connectionState, isRegistered, registrationError, isConnecting]);

  // Auto-connect on mount, user change, OR Voice-capability change.
  // Only if this is the active tab — inactive tabs must not auto-connect
  // (they'd create competing registrations against the same SIP account).
  //
  // Voice capability transitions (real-time, no refresh):
  //  - sipUsername was set, now empty → admin disabled Voice → disconnect
  //  - sipUsername was empty, now set → admin enabled Voice → register
  //  - sipUsername changed value within same user → re-register on the
  //    new account (admin reassigned an extension)
  useEffect(() => {
    if (!autoConnect) return;
    if (!isActiveTab) return;

    if (!isAuthenticated || !user) {
      if (!isAuthenticated) doDisconnect();
      return;
    }

    const sipUsername = user.sipUsername || null;
    const userChanged =
      lastConnectedUserId.current !== null && lastConnectedUserId.current !== user.id;
    const sipUsernameChanged =
      lastConnectedUserId.current === user.id && lastConnectedSipUsername.current !== sipUsername;

    // Voice was active and admin just turned it off → tear down the
    // registration. The dialer page's existing "disconnected" UI will
    // handle the rendering.
    if (sipUsernameChanged && !sipUsername) {
      console.log('[SipProvider] Voice capability disabled by admin — disconnecting');
      doDisconnect();
      return;
    }

    const needsConnection =
      lastConnectedUserId.current === null || userChanged || sipUsernameChanged;
    if (needsConnection) {
      doConnect();
    }
  }, [isAuthenticated, user, autoConnect, isActiveTab, doConnect, doDisconnect]);

  // Sync lastConnectedUserId with the actual SIP registration state.
  //
  // Why this exists: doConnect sets the ref AFTER `await connect()`
  // resolves, but `connect()` REJECTS when the primary WSS URL fails its
  // initial attempts — even though the SipFailoverManager will then
  // succeed on the backup URL asynchronously. Without this sync, the
  // ref stays null after a backup-only registration, and the tab-reclaim
  // effect below mistakes "registered but ref is null" for "need to
  // reconnect", which triggers an infinite unregister / reconnect /
  // failover loop. Treating `isRegistered` as the source of truth for
  // "we have a working SIP session" eliminates that loop.
  useEffect(() => {
    if (isRegistered && user) {
      lastConnectedUserId.current = user.id;
      lastConnectedSipUsername.current = user.sipUsername;
    }
  }, [isRegistered, user]);

  // Single-tab enforcement: disconnect SIP when this tab yields to another,
  // reconnect when this tab reclaims. This prevents multiple WebSocket
  // registrations from the same user competing for calls and bandwidth.
  useEffect(() => {
    if (!isActiveTab && isRegistered) {
      console.log('[SipProvider] Tab yielded to another — disconnecting SIP');
      doDisconnect();
    }
    if (
      isActiveTab &&
      isAuthenticated &&
      user &&
      !isRegistered &&
      !isConnectingRef.current &&
      lastConnectedUserId.current === null
    ) {
      console.log('[SipProvider] Tab reclaimed — reconnecting SIP');
      doConnect();
    }
  }, [isActiveTab, isRegistered, isAuthenticated, user, doConnect, doDisconnect]);

  // Pre-warm TURN credentials on mount so they're cached before the user dials.
  // Saves 1-2 seconds of call setup for TURN-dependent users (Pakistan ISPs).
  useEffect(() => {
    if (isAuthenticated) {
      preWarmTurnCredentials();
      // Preload the GTCRN worklet/wasm so AI noise suppression is ready
      // before the first call (avoids a mid-call re-wire glitch). No-op when
      // the setting is off; fully guarded internally.
      remoteAudioBoost.preload();
    }
  }, [isAuthenticated]);

  // Preload notification sounds and unlock audio on first user interaction
  useEffect(() => {
    preloadNotificationSounds();

    const handleUnlock = () => {
      unlockAudio();
      // Request browser notification permission on first interaction
      requestNotificationPermission().then((permission) => {
        console.log('[SipProvider] Browser notification permission:', permission);
      });
    };

    // Listen for any user interaction
    window.addEventListener('click', handleUnlock, { once: true });
    window.addEventListener('keydown', handleUnlock, { once: true });
    window.addEventListener('touchstart', handleUnlock, { once: true });

    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };
  }, [unlockAudio]);

  const value: SipContextValue = {
    status,
    isReady: isRegistered,
    isConnecting,
    error: registrationError,
    isAudioUnlocked,
    reconnect,
    disconnect: doDisconnect,
    unlockAudio,
  };

  return (
    <SipContext.Provider value={value}>
      {children}
      {!isActiveTab && <TabLockOverlay onReclaim={reclaim} />}
    </SipContext.Provider>
  );
}

/**
 * Hook to access SIP connection state
 *
 * Returns safe defaults if used outside SipProvider.
 */
export function useSipConnection(): SipContextValue {
  const context = useContext(SipContext);

  // Return safe defaults if used outside provider
  if (!context) {
    return {
      status: 'disconnected',
      isReady: false,
      isConnecting: false,
      error: null,
      isAudioUnlocked: false,
      reconnect: async () => {
        console.warn('[useSipConnection] Used outside SipProvider');
      },
      disconnect: async () => {
        console.warn('[useSipConnection] Used outside SipProvider');
      },
      unlockAudio: () => {
        console.warn('[useSipConnection] Used outside SipProvider');
      },
    };
  }

  return context;
}

/**
 * Hook to check if SIP is available (inside provider)
 */
export function useSipAvailable(): boolean {
  const context = useContext(SipContext);
  return context !== null;
}
