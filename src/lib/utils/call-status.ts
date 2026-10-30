/**
 * Call Status Utilities
 *
 * Functions for determining call status and display information.
 *
 * @module lib/utils/call-status
 */

import {
  CallStatus,
  CallDirection,
  TerminatedBy,
  DisplayStatus,
  STATUS_DISPLAY_CONFIG,
  DIRECTION_DISPLAY_CONFIG,
  type DisplayStatusType,
  type StatusDisplayConfig,
} from '@/lib/constants/call-status';

/**
 * Input for determining call status
 */
export interface CallStatusInput {
  direction: 'inbound' | 'outbound';
  status?: string | null;
  answerTime?: string | null;
  duration?: number;
  terminatedBy?: string | null;
}

/**
 * Result of call status determination
 */
export interface CallStatusResult {
  displayStatus: DisplayStatusType;
  config: StatusDisplayConfig;
  isOutbound: boolean;
  wasAnswered: boolean;
}

/**
 * Determine the display status for a call based on its properties
 *
 * @param call - Call properties to analyze
 * @returns Display status type
 */
export function determineDisplayStatus(call: CallStatusInput): DisplayStatusType {
  const status = call.status?.toLowerCase() || '';
  const terminatedBy = call.terminatedBy?.toLowerCase() || '';
  const isOutbound = call.direction === CallDirection.OUTBOUND;
  const wasAnswered = !!call.answerTime;
  const hasDuration = (call.duration || 0) > 0;

  // Failed/Error states
  if (status === CallStatus.FAILED || status === CallStatus.ERROR) {
    return DisplayStatus.FAILED;
  }

  // Busy state
  if (status === CallStatus.BUSY) {
    return DisplayStatus.BUSY;
  }

  // DND state
  if (status === CallStatus.DND) {
    return DisplayStatus.DND;
  }

  // Blocked state
  if (status === CallStatus.BLOCKED) {
    return DisplayStatus.BLOCKED;
  }

  // Rejected/Declined states
  if (status === CallStatus.REJECTED || status === CallStatus.DECLINED) {
    return isOutbound ? DisplayStatus.DECLINED : DisplayStatus.REJECTED;
  }

  // Cancelled state
  if (status === CallStatus.CANCELLED) {
    return DisplayStatus.CANCELLED;
  }

  // No-answer state
  if (status === CallStatus.NO_ANSWER || status === 'noanswer' || status === 'timeout') {
    return isOutbound ? DisplayStatus.NO_ANSWER : DisplayStatus.MISSED;
  }

  // Explicit missed state
  if (status === CallStatus.MISSED) {
    return DisplayStatus.MISSED;
  }

  // Completed/Answered calls
  if (
    wasAnswered ||
    status === CallStatus.COMPLETED ||
    status === CallStatus.ANSWERED ||
    hasDuration
  ) {
    if (terminatedBy === TerminatedBy.LOCAL) {
      return DisplayStatus.YOU_ENDED;
    }
    if (terminatedBy === TerminatedBy.REMOTE) {
      return DisplayStatus.THEY_ENDED;
    }
    return DisplayStatus.COMPLETED;
  }

  // In-progress states
  if (status === CallStatus.IN_PROGRESS || status === CallStatus.CONNECTING) {
    return DisplayStatus.IN_PROGRESS;
  }

  if (status === CallStatus.RINGING) {
    return DisplayStatus.RINGING;
  }

  // Fallback: check if it looks like a missed/no-answer call
  if (!wasAnswered && !hasDuration) {
    return isOutbound ? DisplayStatus.NO_ANSWER : DisplayStatus.MISSED;
  }

  // Default fallback
  return DisplayStatus.COMPLETED;
}

/**
 * Get complete status information for a call
 *
 * @param call - Call properties to analyze
 * @returns Complete status result with config
 */
export function getCallStatusInfo(call: CallStatusInput): CallStatusResult {
  const displayStatus = determineDisplayStatus(call);
  const config = STATUS_DISPLAY_CONFIG[displayStatus];

  return {
    displayStatus,
    config,
    isOutbound: call.direction === CallDirection.OUTBOUND,
    wasAnswered: !!call.answerTime,
  };
}

/**
 * Get direction display configuration
 *
 * @param direction - Call direction
 * @returns Direction display config
 */
export function getDirectionConfig(direction: 'inbound' | 'outbound') {
  return DIRECTION_DISPLAY_CONFIG[direction];
}

/** Minimal shape needed to classify a call as missed (a subset of `Call`). */
export interface MissedCallInput {
  direction: 'inbound' | 'outbound';
  status?: string | null;
  answerTime?: string | null;
  endTime?: string | null;
  duration?: number;
}

/**
 * Whether a call should be shown as "missed".
 *
 * "Missed" is strictly an INBOUND concept — an unanswered outbound call is
 * "no answer", not "missed" (this matches `determineDisplayStatus`, which maps
 * outbound no-answer → NO_ANSWER and only inbound → MISSED).
 *
 * A call is also only ever "missed" once it has actually ENDED without being
 * answered. A still-live call — ringing (no answerTime, no endTime) or answered
 * and connected (answerTime set, no endTime) — is never missed. The older crude
 * heuristic (`!answerTime && duration === 0 && inbound`) omitted the ended
 * check, so a currently-ringing inbound call flashed as "Missed call" in the
 * lists.
 *
 * SSOT for the Recent/Calls/History list glyphs + labels.
 */
export function isMissedCall(call: MissedCallInput): boolean {
  if (call.direction !== 'inbound') return false;
  // Explicit backend verdict always wins (implies the call has ended).
  if (call.status === 'missed' || call.status === 'no-answer') return true;
  // Otherwise: ended, never answered, no talk time.
  return !!call.endTime && !call.answerTime && (call.duration || 0) === 0;
}

/** Set of successful call statuses */
const SUCCESSFUL_STATUSES = new Set<DisplayStatusType>([
  DisplayStatus.COMPLETED,
  DisplayStatus.YOU_ENDED,
  DisplayStatus.THEY_ENDED,
]);

/** Set of unanswered call statuses */
const UNANSWERED_STATUSES = new Set<DisplayStatusType>([
  DisplayStatus.MISSED,
  DisplayStatus.NO_ANSWER,
  DisplayStatus.BUSY,
  DisplayStatus.CANCELLED,
  DisplayStatus.REJECTED,
  DisplayStatus.DECLINED,
  DisplayStatus.FAILED,
  DisplayStatus.DND,
  DisplayStatus.BLOCKED,
]);

/**
 * Check if a call status represents a successful/completed call
 *
 * @param displayStatus - Display status to check
 * @returns True if call was successful
 */
export function isSuccessfulCall(displayStatus: DisplayStatusType): boolean {
  return SUCCESSFUL_STATUSES.has(displayStatus);
}

/**
 * Check if a call status represents an unanswered call
 *
 * @param displayStatus - Display status to check
 * @returns True if call was not answered
 */
export function isUnansweredCall(displayStatus: DisplayStatusType): boolean {
  return UNANSWERED_STATUSES.has(displayStatus);
}

// ============================================================
// Monitoring Call Utilities
// ============================================================

/**
 * Caller ID prefixes that indicate a monitoring call from Asterisk ChanSpy
 * These calls should be handled by AdminMonitorPanel, not regular phone UI
 */
export const MONITORING_CALLER_PREFIXES = ['Monitor', 'Whisper', 'Barge'] as const;

/**
 * Monitoring mode type
 */
export type MonitorMode = 'monitor' | 'whisper' | 'barge';

/**
 * Check if a call is a monitoring call based on caller name
 * Asterisk ChanSpy sets caller ID like "Monitor 1001" or "Whisper 1002"
 *
 * @param callerName - Caller name/ID to check
 * @returns True if this is a monitoring call
 */
export function isMonitoringCall(callerName: string | undefined): boolean {
  if (!callerName) return false;
  return MONITORING_CALLER_PREFIXES.some((prefix) => callerName.startsWith(prefix));
}

/**
 * Detect monitoring mode from caller name
 *
 * @param callerName - Caller name like "Monitor 1001", "Whisper 1002", "Barge 1003"
 * @returns The monitoring mode, or null if not a monitoring call
 */
export function detectMonitorMode(callerName: string | undefined): MonitorMode | null {
  if (!callerName) return null;
  if (callerName.startsWith('Barge')) return 'barge';
  if (callerName.startsWith('Whisper')) return 'whisper';
  if (callerName.startsWith('Monitor')) return 'monitor';
  return null;
}

/**
 * Extract extension from monitoring caller name
 * e.g., "Monitor 1001" -> "1001", "Whisper 1002" -> "1002"
 *
 * @param callerName - Monitoring caller name
 * @param fallback - Fallback value if extraction fails
 * @returns The extracted extension or fallback
 */
export function extractMonitorExtension(callerName: string | undefined, fallback?: string): string {
  if (!callerName) return fallback || '';
  const parts = callerName.split(' ');
  if (parts.length > 1) {
    return parts.slice(1).join(' ');
  }
  return fallback || '';
}
