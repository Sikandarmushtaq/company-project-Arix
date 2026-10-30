'use client';

/**
 * HealthCheckCard Component
 *
 * Displays a service health check with status indicator.
 *
 * @module components/admin/health/HealthCheckCard
 */

import React from 'react';
import { FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiActivity } from 'react-icons/fi';
import { getStatusColor, getStatusBg } from '@/lib/utils/health';

export interface HealthCheck {
  /** Service name */
  name: string;
  /** Health status */
  status: string;
  /** Status message/details */
  message: string;
}

export interface HealthCheckCardProps {
  /** Health check data */
  check: HealthCheck;
  /** Custom class name */
  className?: string;
}

/**
 * Get status icon component based on status
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <FiCheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />;
    case 'degraded':
      return <FiAlertTriangle className="w-5 h-5 text-yellow-500" aria-hidden="true" />;
    case 'down':
    case 'critical':
      return <FiAlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />;
    default:
      return <FiActivity className="w-5 h-5 text-gray-500" aria-hidden="true" />;
  }
}

/**
 * Get accessible status label
 */
function getAccessibleLabel(check: HealthCheck): string {
  return `${check.name} is ${check.status}. ${check.message}`;
}

/**
 * HealthCheckCard displays a service health status with icon and message.
 *
 * @example
 * <HealthCheckCard
 *   check={{ name: 'Database', status: 'healthy', message: 'Connected, latency 5ms' }}
 * />
 */
export const HealthCheckCard = React.memo(function HealthCheckCard({
  check,
  className = '',
}: HealthCheckCardProps) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border border-[var(--border)] ${getStatusBg(
        check.status
      )} ${className}`}
      role="status"
      aria-label={getAccessibleLabel(check)}
    >
      <div className="flex items-center gap-3">
        {getStatusIcon(check.status)}
        <div>
          <div className="font-medium text-[var(--foreground)]">{check.name}</div>
          <div className="text-sm text-[var(--muted-foreground)]">{check.message}</div>
        </div>
      </div>
      <div className={`font-semibold capitalize ${getStatusColor(check.status)}`}>
        <span className="sr-only">Status: </span>
        {check.status}
      </div>
    </div>
  );
});

export default HealthCheckCard;
