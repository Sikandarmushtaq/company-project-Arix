'use client';

import React from 'react';
import { FiMessageSquare, FiImage, FiDollarSign, FiAlertTriangle } from 'react-icons/fi';
import { Card, CardContent } from '@/components/ui';
import { formatTenthCents as formatCost } from '@/lib/utils/formatting';
import type { SmsUsageSummary, UserSmsUsage } from '@/lib/api/services';

export interface SmsUsageSummaryCardsProps {
  summary: SmsUsageSummary | undefined;
  userStats: UserSmsUsage[] | undefined;
}

export function SmsUsageSummaryCards({ summary, userStats }: SmsUsageSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FiMessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Total SMS</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {(summary?.totalSmsSent || 0) + (summary?.totalSmsReceived || 0)}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {summary?.totalSmsSent || 0} sent / {summary?.totalSmsReceived || 0} received
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <FiImage className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Total MMS</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {(summary?.totalMmsSent || 0) + (summary?.totalMmsReceived || 0)}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {summary?.totalMmsSent || 0} sent / {summary?.totalMmsReceived || 0} received
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
              <FiDollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Total Cost</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCost(summary?.totalCostTwilioCents || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <FiAlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Limit Status</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {userStats?.filter((u) => u.status === 'limit_reached').length || 0}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {userStats?.filter((u) => u.status === 'near_limit' || u.status === 'warning')
                  .length || 0}{' '}
                approaching limit
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
