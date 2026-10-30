/**
 * Call Status Constants
 *
 * Centralized definitions for call statuses, types, and display configurations.
 *
 * @module lib/constants/call-status
 */

/**
 * Call status values as stored in the database
 */
export const CallStatus = {
  COMPLETED: 'completed',
  ANSWERED: 'answered',
  MISSED: 'missed',
  NO_ANSWER: 'no-answer',
  BUSY: 'busy',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  DECLINED: 'declined',
  FAILED: 'failed',
  ERROR: 'error',
  DND: 'dnd',
  BLOCKED: 'blocked',
  IN_PROGRESS: 'in-progress',
  RINGING: 'ringing',
  CONNECTING: 'connecting',
} as const;

export type CallStatusType = (typeof CallStatus)[keyof typeof CallStatus];

/**
 * Statuses that indicate the call was never answered
 * These calls should have duration = 0 (ring time is not talk time)
 */
export const UNANSWERED_STATUSES = new Set<CallStatusType>([
  CallStatus.MISSED,
  CallStatus.NO_ANSWER,
  CallStatus.BUSY,
  CallStatus.CANCELLED,
  CallStatus.REJECTED,
  CallStatus.DECLINED,
  CallStatus.FAILED,
  CallStatus.ERROR,
  CallStatus.DND,
  CallStatus.BLOCKED,
]);

/**
 * Statuses that indicate a successful/completed call
 */
export const ANSWERED_STATUSES = new Set<CallStatusType>([
  CallStatus.COMPLETED,
  CallStatus.ANSWERED,
]);

/**
 * Check if a status represents an unanswered call
 */
export function isUnansweredStatus(status: string): boolean {
  return UNANSWERED_STATUSES.has(status as CallStatusType);
}

/**
 * Check if a status represents an answered/completed call
 */
export function isAnsweredStatus(status: string): boolean {
  return ANSWERED_STATUSES.has(status as CallStatusType);
}

/**
 * Determine the correct status for an unanswered call based on direction
 */
export function getUnansweredStatus(direction: 'inbound' | 'outbound'): CallStatusType {
  return direction === 'inbound' ? CallStatus.MISSED : CallStatus.NO_ANSWER;
}

/**
 * Call direction values
 */
export const CallDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export type CallDirectionType = (typeof CallDirection)[keyof typeof CallDirection];

/**
 * Who terminated the call
 */
export const TerminatedBy = {
  LOCAL: 'local',
  REMOTE: 'remote',
  SYSTEM: 'system',
} as const;

export type TerminatedByType = (typeof TerminatedBy)[keyof typeof TerminatedBy];

/**
 * Display status - the user-friendly status we show in the UI
 */
export const DisplayStatus = {
  COMPLETED: 'completed',
  YOU_ENDED: 'you_ended',
  THEY_ENDED: 'they_ended',
  MISSED: 'missed',
  NO_ANSWER: 'no_answer',
  BUSY: 'busy',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  DECLINED: 'declined',
  FAILED: 'failed',
  DND: 'dnd',
  BLOCKED: 'blocked',
  IN_PROGRESS: 'in_progress',
  RINGING: 'ringing',
} as const;

export type DisplayStatusType = (typeof DisplayStatus)[keyof typeof DisplayStatus];

/**
 * Status display configuration
 */
export interface StatusDisplayConfig {
  label: string;
  colorClass: string;
  bgClass: string;
  badgeClass: string;
}

/**
 * Mapping of display status to UI configuration
 */
export const STATUS_DISPLAY_CONFIG: Record<DisplayStatusType, StatusDisplayConfig> = {
  [DisplayStatus.COMPLETED]: {
    label: 'Completed',
    colorClass: 'text-green-500',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  [DisplayStatus.YOU_ENDED]: {
    label: 'You ended',
    colorClass: 'text-green-500',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  [DisplayStatus.THEY_ENDED]: {
    label: 'They ended',
    colorClass: 'text-green-500',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  [DisplayStatus.MISSED]: {
    label: 'Missed',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  [DisplayStatus.NO_ANSWER]: {
    label: 'No Answer',
    colorClass: 'text-yellow-500',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  [DisplayStatus.BUSY]: {
    label: 'Busy',
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  [DisplayStatus.CANCELLED]: {
    label: 'Cancelled',
    colorClass: 'text-gray-500',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
  [DisplayStatus.REJECTED]: {
    label: 'Rejected',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  [DisplayStatus.DECLINED]: {
    label: 'Declined',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  [DisplayStatus.FAILED]: {
    label: 'Failed',
    colorClass: 'text-red-600',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  [DisplayStatus.DND]: {
    label: 'Missed (DND)',
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  [DisplayStatus.BLOCKED]: {
    label: 'Blocked',
    colorClass: 'text-red-600',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  [DisplayStatus.IN_PROGRESS]: {
    label: 'In Progress',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  [DisplayStatus.RINGING]: {
    label: 'Ringing',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

/**
 * Direction display configuration
 */
export const DIRECTION_DISPLAY_CONFIG = {
  [CallDirection.OUTBOUND]: {
    label: 'Outgoing',
    colorClass: 'text-blue-500',
    badgeClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  },
  [CallDirection.INBOUND]: {
    label: 'Incoming',
    colorClass: 'text-green-500',
    badgeClass: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  },
} as const;
