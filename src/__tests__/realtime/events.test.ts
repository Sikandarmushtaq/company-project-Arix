/**
 * Comprehensive Events Constants Tests
 * Location: frontend/src/__tests__/realtime/events.test.ts
 *
 * Tests for the centralized event constants - validates sync with backend.
 */

import { describe, it, expect } from 'vitest';
import { REALTIME_EVENTS, type RealtimeEvent } from '@/lib/constants/events';

describe('REALTIME_EVENTS constants', () => {
  describe('Connection events', () => {
    it('should have all connection events defined', () => {
      expect(REALTIME_EVENTS.CONNECT).toBe('connect');
      expect(REALTIME_EVENTS.DISCONNECT).toBe('disconnect');
      expect(REALTIME_EVENTS.ERROR).toBe('error');
    });
  });

  describe('Call events', () => {
    it('should have all call events defined', () => {
      expect(REALTIME_EVENTS.CALL_INCOMING).toBe('call:incoming');
      expect(REALTIME_EVENTS.CALL_STARTED).toBe('call:started');
      expect(REALTIME_EVENTS.CALL_UPDATED).toBe('call:updated');
      expect(REALTIME_EVENTS.CALL_ENDED).toBe('call:ended');
      expect(REALTIME_EVENTS.CALL_HOLD).toBe('call:hold');
      expect(REALTIME_EVENTS.CALL_MUTE).toBe('call:mute');
    });

    it('should use call namespace prefix', () => {
      const callEvents = [
        REALTIME_EVENTS.CALL_INCOMING,
        REALTIME_EVENTS.CALL_STARTED,
        REALTIME_EVENTS.CALL_UPDATED,
        REALTIME_EVENTS.CALL_ENDED,
        REALTIME_EVENTS.CALL_HOLD,
        REALTIME_EVENTS.CALL_MUTE,
      ];
      callEvents.forEach((event) => {
        expect(event).toMatch(/^call:/);
      });
    });

    it('should have exactly 8 call events', () => {
      const callEvents = Object.entries(REALTIME_EVENTS).filter(([key]) => key.startsWith('CALL_'));
      expect(callEvents.length).toBe(8);
    });
  });

  describe('SMS events', () => {
    it('should have all SMS events defined', () => {
      expect(REALTIME_EVENTS.SMS_RECEIVED).toBe('sms:received');
      expect(REALTIME_EVENTS.SMS_SENT).toBe('sms:sent');
      expect(REALTIME_EVENTS.SMS_STATUS).toBe('sms:status');
      expect(REALTIME_EVENTS.SMS_TYPING).toBe('sms:typing');
    });

    it('should use sms namespace prefix', () => {
      const smsEvents = [
        REALTIME_EVENTS.SMS_RECEIVED,
        REALTIME_EVENTS.SMS_SENT,
        REALTIME_EVENTS.SMS_STATUS,
        REALTIME_EVENTS.SMS_TYPING,
      ];
      smsEvents.forEach((event) => {
        expect(event).toMatch(/^sms:/);
      });
    });
  });

  describe('Notification events', () => {
    it('should have notification events defined', () => {
      expect(REALTIME_EVENTS.NOTIFICATION).toBe('notification');
      expect(REALTIME_EVENTS.TOAST).toBe('toast');
    });
  });

  describe('Voicemail events', () => {
    it('should have voicemail event defined', () => {
      expect(REALTIME_EVENTS.VOICEMAIL_NEW).toBe('voicemail:new');
    });
  });

  describe('Recording events', () => {
    it('should have all recording events defined', () => {
      expect(REALTIME_EVENTS.RECORDING_NEW).toBe('recording:new');
      expect(REALTIME_EVENTS.RECORDING_DELETED).toBe('recording:deleted');
    });
  });

  describe('Contact events', () => {
    it('should have all contact events defined', () => {
      expect(REALTIME_EVENTS.CONTACT_CREATED).toBe('contact:created');
      expect(REALTIME_EVENTS.CONTACT_UPDATED).toBe('contact:updated');
      expect(REALTIME_EVENTS.CONTACT_DELETED).toBe('contact:deleted');
      expect(REALTIME_EVENTS.CONTACT_CHANGED).toBe('contact:changed');
    });
  });

  describe('Campaign events', () => {
    it('should have all campaign events defined', () => {
      expect(REALTIME_EVENTS.CAMPAIGN_UPDATED).toBe('campaign:updated');
      expect(REALTIME_EVENTS.CAMPAIGN_STATS).toBe('campaign:stats');
    });
  });

  describe('Admin events', () => {
    it('should have all admin events defined', () => {
      expect(REALTIME_EVENTS.ADMIN_USER_STATUS).toBe('admin:user:status');
      expect(REALTIME_EVENTS.ADMIN_DEVICE_STATUS).toBe('admin:device:status');
      expect(REALTIME_EVENTS.ADMIN_STATS_UPDATE).toBe('admin:stats:update');
    });
  });

  describe('Presence events', () => {
    it('should have all presence events defined', () => {
      expect(REALTIME_EVENTS.USER_ONLINE).toBe('presence:online');
      expect(REALTIME_EVENTS.USER_OFFLINE).toBe('presence:offline');
    });
  });

  describe('Type safety', () => {
    it('should have all events as readonly strings', () => {
      Object.values(REALTIME_EVENTS).forEach((value) => {
        expect(typeof value).toBe('string');
      });
    });

    it('should export RealtimeEvent type', () => {
      // Type assertion test - if this compiles, the type is correct
      const event: RealtimeEvent = REALTIME_EVENTS.CALL_STARTED;
      expect(event).toBe('call:started');
    });
  });

  describe('Event uniqueness', () => {
    it('should have unique event names', () => {
      const values = Object.values(REALTIME_EVENTS);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });

    it('should have unique event keys', () => {
      const keys = Object.keys(REALTIME_EVENTS);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });

  describe('Event count validation', () => {
    it('should have at least 50 events total (matching backend)', () => {
      const events = Object.keys(REALTIME_EVENTS);
      // Events have grown as features were added (admin, HA monitoring, etc.)
      expect(events.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Naming conventions', () => {
    it('should use SCREAMING_SNAKE_CASE for keys', () => {
      const keys = Object.keys(REALTIME_EVENTS);
      keys.forEach((key) => {
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
      });
    });

    it('should use lowercase:action format (with underscores allowed in actions)', () => {
      const values = Object.values(REALTIME_EVENTS);
      values.forEach((value) => {
        // Allow underscores in action names (e.g., password_reset, answered_elsewhere)
        expect(value).toMatch(/^[a-z]+(:[a-z_]+)*$/);
      });
    });

    it('should follow namespace:action pattern for namespaced events', () => {
      const eventValues = Object.values(REALTIME_EVENTS);
      const namespacedEvents = eventValues.filter(
        (e) => !['connect', 'disconnect', 'error', 'notification', 'toast'].includes(e)
      );
      namespacedEvents.forEach((event) => {
        // Allow underscores in action names (e.g., admin:user:password_reset)
        expect(event).toMatch(/^[a-z]+:[a-z_]+(:[a-z_]+)*$/);
      });
    });
  });

  describe('Backend sync validation', () => {
    it('should have all events that useRealtimeSync listens to', () => {
      // Events used in useRealtimeSync.ts
      const syncedEvents = [
        'CALL_INCOMING',
        'CALL_STARTED',
        'CALL_UPDATED',
        'CALL_ENDED',
        'SMS_RECEIVED',
        'SMS_SENT',
        'SMS_STATUS',
        'VOICEMAIL_NEW',
        'RECORDING_NEW',
        'RECORDING_DELETED',
        'CONTACT_CREATED',
        'CONTACT_UPDATED',
        'CONTACT_DELETED',
        'CONTACT_CHANGED',
        'CAMPAIGN_UPDATED',
        'CAMPAIGN_STATS',
      ];

      syncedEvents.forEach((eventKey) => {
        expect(REALTIME_EVENTS).toHaveProperty(eventKey);
      });
    });
  });
});
