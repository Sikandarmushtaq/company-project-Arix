/**
 * Socket.IO Configuration Constants - FRONTEND MIRROR
 *
 * IMPORTANT: Keep in sync with server/src/core/websocket/socket.constants.ts
 *
 * This file mirrors the backend Socket.IO configuration to ensure
 * frontend and backend use identical values.
 *
 * @module lib/constants/socket
 */

/**
 * Socket.IO server configuration
 * Must match: server/src/core/websocket/socket.constants.ts
 */
export const SOCKET_CONFIG = {
  /**
   * Socket.IO path - must match backend and Apache proxy configuration
   */
  PATH: '/api/v1/socket.io',

  /**
   * Ping/pong configuration for connection health
   */
  PING_TIMEOUT: 60000,
  PING_INTERVAL: 25000,

  /**
   * Supported transports in priority order
   */
  TRANSPORTS: ['websocket', 'polling'] as const,
} as const;

/**
 * Room prefix constants for consistent naming
 * Used for client-side room subscription logic
 */
export const ROOM_PREFIXES = {
  USER: 'user',
  PHONE: 'phone',
  ADMIN: 'admin',
  EXTENSION: 'extension',
} as const;

/**
 * Special room names
 */
export const SPECIAL_ROOMS = {
  ADMIN_DASHBOARD: 'admin:dashboard',
} as const;

/**
 * Type exports
 */
export type RoomPrefix = (typeof ROOM_PREFIXES)[keyof typeof ROOM_PREFIXES];
export type SpecialRoom = (typeof SPECIAL_ROOMS)[keyof typeof SPECIAL_ROOMS];
export type Transport = (typeof SOCKET_CONFIG.TRANSPORTS)[number];
