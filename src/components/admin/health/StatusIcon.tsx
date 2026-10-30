'use client';

/**
 * StatusIcon Component
 *
 * Displays an appropriate icon based on health status.
 *
 * @module components/admin/health/StatusIcon
 */

import React from 'react';
import { FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiActivity } from 'react-icons/fi';

export interface StatusIconProps {
  /** Health status */
  status: string;
  /** Icon size class (default: w-5 h-5) */
  size?: string;
  /** Custom class name */
  className?: string;
}

/**
 * StatusIcon displays the appropriate icon for a health status.
 *
 * @example
 * <StatusIcon status="healthy" />
 * <StatusIcon status="degraded" size="w-6 h-6" />
 */
export const StatusIcon = React.memo(function StatusIcon({
  status,
  size = 'w-5 h-5',
  className = '',
}: StatusIconProps) {
  const baseClass = `${size} ${className}`;

  switch (status) {
    case 'healthy':
      return (
        <FiCheckCircle
          className={`${baseClass} text-green-500`}
          aria-hidden="true"
          role="img"
          aria-label="Healthy"
        />
      );
    case 'degraded':
      return (
        <FiAlertTriangle
          className={`${baseClass} text-yellow-500`}
          aria-hidden="true"
          role="img"
          aria-label="Degraded"
        />
      );
    case 'down':
    case 'critical':
      return (
        <FiAlertCircle
          className={`${baseClass} text-red-500`}
          aria-hidden="true"
          role="img"
          aria-label="Critical"
        />
      );
    default:
      return (
        <FiActivity
          className={`${baseClass} text-gray-500`}
          aria-hidden="true"
          role="img"
          aria-label="Unknown"
        />
      );
  }
});

export default StatusIcon;
