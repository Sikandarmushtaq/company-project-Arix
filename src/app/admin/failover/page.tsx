'use client';

import React from 'react';
import {
  FiServer,
  FiArrowRight,
  FiCheck,
  FiAlertTriangle,
  FiAlertCircle,
  FiLoader,
  FiRefreshCw,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, ErrorState } from '@/components/ui';
import { useFailoverStatus, useSwitchAllToBackup, useConfirm, useAlert } from '@/lib/hooks';
import { formatLocalDateTime } from '@/lib/utils/datetime';

export default function FailoverPage() {
  const { data: status, isLoading, error, refetch } = useFailoverStatus();
  const switchAllMutation = useSwitchAllToBackup();
  const { confirm } = useConfirm();
  const { success } = useAlert();

  const handleSwitchAll = async () => {
    const confirmed = await confirm({
      title: 'Switch to Backup Server',
      message:
        'Are you sure you want to switch ALL users to the backup server? This may cause brief disconnections.',
      confirmText: 'Switch All',
      variant: 'warning',
    });
    if (confirmed) {
      try {
        const count = await switchAllMutation.mutateAsync();
        await success(`${count} users switched to backup server`);
      } catch (err) {
        console.error('Failed to switch to backup:', err);
      }
    }
  };

  if (error) {
    return (
      <ErrorState
        title="Failed to load failover status"
        message={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Server Failover</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Manage server failover and redundancy
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            variant="danger"
            onClick={handleSwitchAll}
            disabled={switchAllMutation.isPending || !status}
          >
            <FiAlertTriangle className="w-4 h-4" />
            Switch All to Backup
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" />
        </div>
      ) : !status ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          <FiServer className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Failover configuration not available</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    status.activeServer === 'primary'
                      ? 'bg-green-100 dark:bg-green-900'
                      : 'bg-yellow-100 dark:bg-yellow-900'
                  }`}
                >
                  <FiServer
                    className={`w-5 h-5 ${
                      status.activeServer === 'primary'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)] capitalize">
                    {status.activeServer}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">Active Server</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <FiCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {status.usersOnPrimary}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">Users on Primary</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <FiAlertTriangle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {status.usersOnBackup}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">Users on Backup</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Server Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Server Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`p-6 rounded-xl border-2 ${
                  status.activeServer === 'primary'
                    ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                    : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                      SIP Server Failover
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          status.activeServer === 'primary'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}
                      >
                        {status.activeServer === 'primary' ? 'Primary Active' : 'Backup Active'}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-[var(--card)]">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--muted-foreground)] mb-1">Primary Server</p>
                    <p className="font-mono text-sm text-[var(--foreground)]">
                      {status.primaryServer}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      {status.usersOnPrimary} users connected
                    </p>
                  </div>
                  <FiArrowRight className="w-5 h-5 text-[var(--muted-foreground)]" />
                  <div className="flex-1">
                    <p className="text-xs text-[var(--muted-foreground)] mb-1">Backup Server</p>
                    <p className="font-mono text-sm text-[var(--foreground)]">
                      {status.backupServer}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      {status.usersOnBackup} users connected
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-4 text-sm text-[var(--muted-foreground)]">
                  <span>
                    Last Failover:{' '}
                    {status.lastFailover ? formatLocalDateTime(status.lastFailover) : 'Never'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
