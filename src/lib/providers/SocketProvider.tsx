'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/stores';
import { SOCKET_CONFIG } from '@/lib/constants/socket';
import { REALTIME_EVENTS } from '@/lib/constants/events';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// After this many CONSECUTIVE auth-type handshake rejections, re-validate the
// session (via the cookie-backed BFF) instead of silently reconnect-looping
// forever. A valid-but-stale session gets refreshed; a truly dead one is logged
// out and the loop stops. Reset to 0 on any successful connect.
const AUTH_ERROR_REVALIDATE_THRESHOLD = 3;

/** True when a connect_error came from the server's auth middleware. */
function isAuthError(message: string): boolean {
  return /auth|expired|session|required|unauthor/i.test(message);
}

interface SocketContextValue {
  socket: Socket | null;
  status: ConnectionStatus;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// Get Socket.IO server URL
// In production, set NEXT_PUBLIC_SOCKET_URL to your backend URL (e.g., https://manual.bitnexdial.com)
// In development, it uses the current origin with Next.js rewrite
function getSocketUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (envUrl) {
    return envUrl;
  }

  // Use current origin (works with Next.js rewrite in dev)
  return undefined; // Socket.IO will use current origin
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const authErrorCountRef = useRef(0);
  const revalidatingRef = useRef(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  const connect = useCallback(() => {
    // Connect whenever the session is authenticated — even with NO localStorage
    // `token`. In the BFF/cookie architecture a valid session (e.g. arrived via
    // the cross-subdomain SSO cookie, or a token never persisted on this origin)
    // has `isAuthenticated: true` but `token: null` (checkAuth sets auth without
    // a token). Requiring a token here meant the socket was NEVER created for
    // those sessions → no realtime at all. The handshake authenticates via the
    // HttpOnly `arix_session` cookie (withCredentials) when no token is present.
    if (!isAuthenticated) {
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setStatus('connecting');

    const socketUrl = getSocketUrl();

    // Connect to Socket.IO server
    // Path configured via SOCKET_CONFIG constant (SSOT)
    const newSocket = io(socketUrl, {
      path: SOCKET_CONFIG.PATH,
      // token may be null for a cookie-only session — then auth carries nothing
      // and the server authenticates off the arix_session cookie (withCredentials).
      auth: token ? { token } : {},
      // Send the HttpOnly `arix_session` cookie on the (cross-origin) handshake
      // so the server can authenticate off it when the localStorage Bearer is
      // stale/absent — the BFF made that cookie the source of truth. CORS on the
      // backend already sets `credentials: true` with an explicit origin list.
      withCredentials: true,
      transports: [...SOCKET_CONFIG.TRANSPORTS],
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying (legit transient drops on mobile/lossy networks)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
      // Force new connection on each auth change
      forceNew: true,
    });

    newSocket.on('connect', () => {
      authErrorCountRef.current = 0;
      setStatus('connected');
    });

    newSocket.on('disconnect', (reason) => {
      // Only set disconnected if not reconnecting
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        setStatus('disconnected');
      }
      console.log('[Socket.IO] Disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      // Don't set error status during reconnection attempts
      if (!newSocket.active) {
        setStatus('error');
      }
      console.error('[Socket.IO] Connection error:', error.message);

      // An auth rejection is permanent for the CURRENT credential — retrying it
      // unchanged just loops. After a few, re-validate the session through the
      // cookie-backed BFF: a stale-but-valid session is refreshed (which re-runs
      // connect() with fresh creds), a dead one is logged out (which stops the
      // loop). Guarded so we trigger at most one revalidation per storm.
      if (isAuthError(error.message)) {
        authErrorCountRef.current += 1;
        if (
          authErrorCountRef.current >= AUTH_ERROR_REVALIDATE_THRESHOLD &&
          !revalidatingRef.current
        ) {
          revalidatingRef.current = true;
          authErrorCountRef.current = 0;
          void useAuthStore
            .getState()
            .checkAuth({ silent: true })
            .finally(() => {
              revalidatingRef.current = false;
            });
        }
      }
    });

    // Socket.IO v4: the `reconnect*` family is emitted by the MANAGER (socket.io),
    // NOT the Socket — so `newSocket.on('reconnect'…)` never fires. Bind on the
    // Manager so reconnect status is actually reflected. (Torn down with the socket
    // on the next connect(), which disconnects the old socket + its Manager.)
    newSocket.io.on('reconnect', (attemptNumber) => {
      setStatus('connected');
      console.log('[Socket.IO] Reconnected after', attemptNumber, 'attempts');
    });

    newSocket.io.on('reconnect_attempt', (attemptNumber) => {
      setStatus('connecting');
      console.log('[Socket.IO] Reconnection attempt', attemptNumber);
    });

    // A session of THIS user was terminated server-side — either evicted by the
    // per-user device limit, or an admin force-logout. Re-validate immediately so
    // the affected device logs out AT ONCE on EVERY surface (the portal included,
    // not just the phone), instead of lingering until it next happens to call the
    // API. This is the authoritative check: `/auth/me` 401s ONLY the dead/evicted
    // token → checkAuth tears down + the route guard redirects to login; the
    // SURVIVING (newest) device re-validates fine and stays — the backend decides,
    // so this can never false-logout the valid device. Mirrors the connect_error
    // re-validation path and is guarded against concurrent runs.
    const revalidateOnTerminate = (payload?: { reason?: string }) => {
      if (revalidatingRef.current) return;
      revalidatingRef.current = true;
      const wasAuthed = useAuthStore.getState().isAuthenticated;
      // Device-limit eviction gets a specific message; anything else (admin
      // force-logout / log-out-all) gets a neutral one.
      const notice = payload?.reason === 'device_limit' ? 'device_limit' : 'signed_out';
      void useAuthStore
        .getState()
        .checkAuth({ silent: true })
        .finally(() => {
          revalidatingRef.current = false;
          // THIS device's session was the evicted one iff re-validation flipped us
          // from authed → signed-out. Hard-redirect it to login so the logout is
          // immediate and consistent on EVERY surface (replace() so Back can't
          // return to the now-dead authed view), leaving a reason the login page
          // shows so the sign-out is never a mystery. The surviving device
          // re-validated fine (still authed) → this is a no-op for it.
          if (
            wasAuthed &&
            !useAuthStore.getState().isAuthenticated &&
            typeof window !== 'undefined' &&
            !window.location.pathname.startsWith('/login')
          ) {
            try {
              sessionStorage.setItem('arix:logout_reason', notice);
            } catch {
              /* sessionStorage unavailable — redirect without the banner */
            }
            window.location.replace('/login');
          }
        });
    };
    newSocket.on(REALTIME_EVENTS.ADMIN_SESSION_TERMINATED, revalidateOnTerminate);
    newSocket.on(REALTIME_EVENTS.ADMIN_SESSION_ALL_TERMINATED, revalidateOnTerminate);

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, [isAuthenticated, token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  const value: SocketContextValue = {
    socket,
    status,
    isConnected: status === 'connected',
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Hook to access socket connection.
 * Returns null values if used outside SocketProvider (safe to use anywhere).
 */
export const useSocket = () => {
  const context = useContext(SocketContext);

  // Return safe defaults if used outside provider
  if (!context) {
    return {
      socket: null,
      status: 'disconnected' as const,
      isConnected: false,
    };
  }

  return context;
};

export const useSocketEvent = <T = unknown,>(
  event: string,
  callback: (data: T) => void,
  deps: React.DependencyList = []
) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event, ...deps]);
};
