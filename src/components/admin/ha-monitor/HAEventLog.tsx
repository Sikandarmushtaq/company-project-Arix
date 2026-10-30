'use client';

import React from 'react';
import { FiCheckCircle, FiXCircle, FiArrowRight, FiClock, FiUser } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { HAFailoverEvent } from '@/lib/api/services/ha.service';

/**
 * Format time distance to now (e.g., "5 minutes ago")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

interface HAEventLogProps {
  events: HAFailoverEvent[];
  maxItems?: number;
}

export function HAEventLog({ events, maxItems = 5 }: HAEventLogProps) {
  const displayedEvents = events.slice(0, maxItems);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FiClock className="w-4 h-4" />
          Recent Failover Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayedEvents.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
            No failover events recorded
          </p>
        ) : (
          <div className="space-y-3">
            {displayedEvents.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${
                  event.success
                    ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                    : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {event.success ? (
                      <FiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <FiXCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <span className="font-medium text-sm text-[var(--foreground)] capitalize">
                      {event.component}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {formatTimeAgo(new Date(event.timestamp))}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <span className="uppercase font-mono">{event.fromServer}</span>
                  <FiArrowRight className="w-3 h-3" />
                  <span className="uppercase font-mono">{event.toServer}</span>
                  <span className="text-xs">({event.duration}ms)</span>
                </div>

                {event.triggeredBy && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                    <FiUser className="w-3 h-3" />
                    <span>{event.triggeredBy}</span>
                    <span className="text-[var(--muted-foreground)]">• {event.reason}</span>
                  </div>
                )}

                {event.error && (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                    Error: {event.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {events.length > maxItems && (
          <p className="text-xs text-center text-[var(--muted-foreground)] mt-3">
            + {events.length - maxItems} more events
          </p>
        )}
      </CardContent>
    </Card>
  );
}
