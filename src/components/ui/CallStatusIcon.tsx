/**
 * Call Status Icon Component
 *
 * Reusable component for displaying call status with appropriate icons.
 *
 * @module components/ui/CallStatusIcon
 */

import React, { memo } from 'react';
import {
  FiPhone,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiPhoneMissed,
  FiPhoneOff,
  FiCheck,
  FiX,
  FiXCircle,
  FiSlash,
  FiAlertCircle,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';

import { DisplayStatus, type DisplayStatusType } from '@/lib/constants/call-status';
import {
  getCallStatusInfo,
  getDirectionConfig,
  type CallStatusInput,
} from '@/lib/utils/call-status';

/**
 * Mapping of display status to icon component
 */
const STATUS_ICONS: Record<DisplayStatusType, IconType> = {
  [DisplayStatus.COMPLETED]: FiCheck,
  [DisplayStatus.YOU_ENDED]: FiCheck,
  [DisplayStatus.THEY_ENDED]: FiCheck,
  [DisplayStatus.MISSED]: FiPhoneMissed,
  [DisplayStatus.NO_ANSWER]: FiAlertCircle,
  [DisplayStatus.BUSY]: FiSlash,
  [DisplayStatus.CANCELLED]: FiX,
  [DisplayStatus.REJECTED]: FiPhoneOff,
  [DisplayStatus.DECLINED]: FiPhoneOff,
  [DisplayStatus.FAILED]: FiXCircle,
  [DisplayStatus.DND]: FiPhoneOff,
  [DisplayStatus.BLOCKED]: FiSlash,
  [DisplayStatus.IN_PROGRESS]: FiPhone,
  [DisplayStatus.RINGING]: FiPhone,
};

/**
 * Props for CallStatusIcon component
 */
export interface CallStatusIconProps {
  /** Call data for status determination */
  call: CallStatusInput;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show direction indicator badge */
  showDirectionBadge?: boolean;
  /** Additional class name for the container */
  className?: string;
}

/**
 * Size configuration
 */
const SIZE_CONFIG = {
  sm: {
    container: 'p-2',
    icon: 'w-4 h-4',
    badge: 'w-2.5 h-2.5',
    badgeContainer: 'p-0.5 -bottom-0.5 -right-0.5',
  },
  md: {
    container: 'p-3',
    icon: 'w-5 h-5',
    badge: 'w-3 h-3',
    badgeContainer: 'p-0.5 -bottom-1 -right-1',
  },
  lg: {
    container: 'p-4',
    icon: 'w-6 h-6',
    badge: 'w-4 h-4',
    badgeContainer: 'p-1 -bottom-1 -right-1',
  },
};

/**
 * Call Status Icon Component
 *
 * Displays an icon representing the call status with optional direction indicator.
 */
export const CallStatusIcon = memo(function CallStatusIcon({
  call,
  size = 'md',
  showDirectionBadge = true,
  className = '',
}: CallStatusIconProps) {
  const { displayStatus, config, isOutbound } = getCallStatusInfo(call);
  const directionConfig = getDirectionConfig(call.direction);
  const sizeConfig = SIZE_CONFIG[size];

  const StatusIcon = STATUS_ICONS[displayStatus];
  const DirectionIcon = isOutbound ? FiPhoneOutgoing : FiPhoneIncoming;

  return (
    <div className={`relative ${sizeConfig.container} rounded-full ${config.bgClass} ${className}`}>
      <StatusIcon className={`${sizeConfig.icon} ${config.colorClass}`} />
      {showDirectionBadge && (
        <div
          className={`absolute ${sizeConfig.badgeContainer} rounded-full bg-[var(--background)] border border-[var(--border)]`}
        >
          <DirectionIcon className={`${sizeConfig.badge} ${directionConfig.colorClass}`} />
        </div>
      )}
    </div>
  );
});

/**
 * Props for CallStatusBadge component
 */
export interface CallStatusBadgeProps {
  /** Call data for status determination */
  call: CallStatusInput;
  /** Additional class name */
  className?: string;
}

/**
 * Call Status Badge Component
 *
 * Displays a text badge with the call status label.
 */
export const CallStatusBadge = memo(function CallStatusBadge({
  call,
  className = '',
}: CallStatusBadgeProps) {
  const { config } = getCallStatusInfo(call);

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${config.badgeClass} ${className}`}>
      {config.label}
    </span>
  );
});

/**
 * Props for CallDirectionBadge component
 */
export interface CallDirectionBadgeProps {
  /** Call direction */
  direction: 'inbound' | 'outbound';
  /** Additional class name */
  className?: string;
}

/**
 * Call Direction Badge Component
 *
 * Displays a text badge with the call direction label.
 */
export const CallDirectionBadge = memo(function CallDirectionBadge({
  direction,
  className = '',
}: CallDirectionBadgeProps) {
  const config = getDirectionConfig(direction);

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${config.badgeClass} ${className}`}>
      {config.label}
    </span>
  );
});

export default CallStatusIcon;
