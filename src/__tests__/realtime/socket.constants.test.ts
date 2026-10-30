/**
 * Socket Constants SSOT Tests - Frontend
 *
 * Validates that frontend socket configuration matches backend.
 * Keep in sync with: server/src/__tests__/socket.constants.test.ts
 */

import { describe, it, expect } from 'vitest';
import { SOCKET_CONFIG, ROOM_PREFIXES, SPECIAL_ROOMS } from '@/lib/constants/socket';

describe('SOCKET_CONFIG - Frontend Mirror', () => {
  describe('Path Configuration', () => {
    it('should have PATH defined', () => {
      expect(SOCKET_CONFIG.PATH).toBeDefined();
      expect(typeof SOCKET_CONFIG.PATH).toBe('string');
    });

    it('should use /api/v1/socket.io path (must match backend)', () => {
      // This path must match:
      // 1. Backend: server/src/core/websocket/socket.constants.ts
      // 2. Apache: bitnex-ssl.conf RewriteRule
      expect(SOCKET_CONFIG.PATH).toBe('/api/v1/socket.io');
    });

    it('should start with /api/v1 for API versioning', () => {
      expect(SOCKET_CONFIG.PATH).toMatch(/^\/api\/v1\//);
    });
  });

  describe('Ping Configuration', () => {
    it('should have PING_TIMEOUT matching backend (60000)', () => {
      expect(SOCKET_CONFIG.PING_TIMEOUT).toBe(60000);
    });

    it('should have PING_INTERVAL matching backend (25000)', () => {
      expect(SOCKET_CONFIG.PING_INTERVAL).toBe(25000);
    });

    it('should have PING_TIMEOUT greater than PING_INTERVAL', () => {
      expect(SOCKET_CONFIG.PING_TIMEOUT).toBeGreaterThan(SOCKET_CONFIG.PING_INTERVAL);
    });
  });

  describe('Transport Configuration', () => {
    it('should have TRANSPORTS defined', () => {
      expect(SOCKET_CONFIG.TRANSPORTS).toBeDefined();
      expect(Array.isArray(SOCKET_CONFIG.TRANSPORTS)).toBe(true);
    });

    it('should support websocket transport', () => {
      expect(SOCKET_CONFIG.TRANSPORTS).toContain('websocket');
    });

    it('should support polling transport as fallback', () => {
      expect(SOCKET_CONFIG.TRANSPORTS).toContain('polling');
    });

    it('should match backend transport order [websocket, polling]', () => {
      expect(SOCKET_CONFIG.TRANSPORTS).toEqual(['websocket', 'polling']);
    });
  });
});

describe('ROOM_PREFIXES - Frontend Mirror', () => {
  it('should have USER prefix matching backend', () => {
    expect(ROOM_PREFIXES.USER).toBe('user');
  });

  it('should have PHONE prefix matching backend', () => {
    expect(ROOM_PREFIXES.PHONE).toBe('phone');
  });

  it('should have ADMIN prefix matching backend', () => {
    expect(ROOM_PREFIXES.ADMIN).toBe('admin');
  });

  it('should have EXTENSION prefix matching backend', () => {
    expect(ROOM_PREFIXES.EXTENSION).toBe('extension');
  });

  it('should have exactly 4 room prefixes (same as backend)', () => {
    expect(Object.keys(ROOM_PREFIXES)).toHaveLength(4);
  });
});

describe('SPECIAL_ROOMS - Frontend Mirror', () => {
  it('should have ADMIN_DASHBOARD matching backend', () => {
    expect(SPECIAL_ROOMS.ADMIN_DASHBOARD).toBe('admin:dashboard');
  });
});

describe('SSOT Alignment Verification', () => {
  /**
   * These tests document the expected values that MUST match the backend.
   * If any of these fail, check server/src/core/websocket/socket.constants.ts
   */

  describe('Critical Values (Must Match Backend)', () => {
    it('SOCKET_CONFIG.PATH must be /api/v1/socket.io', () => {
      expect(SOCKET_CONFIG.PATH).toBe('/api/v1/socket.io');
    });

    it('SOCKET_CONFIG.PING_TIMEOUT must be 60000', () => {
      expect(SOCKET_CONFIG.PING_TIMEOUT).toBe(60000);
    });

    it('SOCKET_CONFIG.PING_INTERVAL must be 25000', () => {
      expect(SOCKET_CONFIG.PING_INTERVAL).toBe(25000);
    });

    it('SOCKET_CONFIG.TRANSPORTS must be [websocket, polling]', () => {
      expect(SOCKET_CONFIG.TRANSPORTS).toEqual(['websocket', 'polling']);
    });

    it('ROOM_PREFIXES must match exactly', () => {
      expect(ROOM_PREFIXES).toEqual({
        USER: 'user',
        PHONE: 'phone',
        ADMIN: 'admin',
        EXTENSION: 'extension',
      });
    });

    it('SPECIAL_ROOMS must match exactly', () => {
      expect(SPECIAL_ROOMS).toEqual({
        ADMIN_DASHBOARD: 'admin:dashboard',
      });
    });
  });
});
