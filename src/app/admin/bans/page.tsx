'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  FiShield,
  FiGlobe,
  FiClock,
  FiAlertCircle,
  FiLoader,
  FiCheck,
  FiUser,
  FiMonitor,
  FiSearch,
  FiRefreshCw,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Pagination,
} from '@/components/ui';
import {
  useBannedUsers,
  useTempBans,
  useDeviceBans,
  useSetBanStatus,
  useConfirm,
} from '@/lib/hooks';
import { usePagination } from '@/lib/hooks/usePagination';
import { useDebounce } from '@/lib/hooks';
import { formatLocalDateTime } from '@/lib/utils/datetime';
import type { BannedUser } from '@/lib/api/services';

/**
 * Memoized banned user row component
 */
const BannedUserRow = React.memo(function BannedUserRow({
  user,
  onUnban,
  isUnbanning,
}: {
  user: BannedUser;
  onUnban: (userId: number, username: string) => void;
  isUnbanning: boolean;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4 font-medium text-[var(--foreground)]">
        {user.fullName || user.email}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">{user.email}</td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {user.banReason || 'No reason specified'}
      </td>
      <td className="py-3 px-4 text-[var(--muted-foreground)]">
        {formatLocalDateTime(user.bannedAt)}
      </td>
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUnban(user.id, user.fullName || user.email)}
          disabled={isUnbanning}
          className="text-[var(--success)]"
          aria-label={`Unban ${user.fullName || user.email}`}
        >
          <FiCheck className="w-4 h-4 mr-1" aria-hidden="true" />
          Unban
        </Button>
      </td>
    </tr>
  );
});

export default function BansPage() {
  // Server-side search and pagination for banned users
  const [usersSearch, setUsersSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize] = useState(10);
  const debouncedUsersSearch = useDebounce(usersSearch, 300);

  const {
    data: bannedUsersData,
    isLoading: loadingUsers,
    error: usersError,
    isFetching: fetchingUsers,
    refetch: refetchUsers,
  } = useBannedUsers({
    page: usersPage,
    limit: usersPageSize,
    search: debouncedUsersSearch || undefined,
  });
  const {
    data: tempBans,
    isLoading: loadingTemp,
    isFetching: fetchingTemp,
    refetch: refetchTemp,
  } = useTempBans();
  const {
    data: deviceBans,
    isLoading: loadingDevices,
    isFetching: fetchingDevices,
    refetch: refetchDevices,
  } = useDeviceBans();
  const unbanMutation = useSetBanStatus();
  const { confirm } = useConfirm();

  const isLoading = loadingUsers || loadingTemp || loadingDevices;
  const isFetching = fetchingUsers || fetchingTemp || fetchingDevices;

  // Get banned users from server response
  const bannedUsers = bannedUsersData?.users || [];
  const usersTotalItems = bannedUsersData?.total || 0;
  const usersTotalPages = bannedUsersData?.totalPages || 1;

  // Track search version to reset page on search change (avoids setState in effect)
  const [trackedUsersSearch, setTrackedUsersSearch] = useState<string>('');
  if (debouncedUsersSearch !== trackedUsersSearch) {
    setTrackedUsersSearch(debouncedUsersSearch);
    if (usersPage !== 1) {
      setUsersPage(1);
    }
  }

  // Search state for temp bans and device bans (client-side, these are placeholders)
  const [tempSearch, setTempSearch] = useState('');
  const [devicesSearch, setDevicesSearch] = useState('');

  // Pagination for temp bans and device bans (client-side)
  const tempPagination = usePagination({ initialPageSize: 10 });
  const devicesPagination = usePagination({ initialPageSize: 10 });

  // Filter temp bans (client-side, placeholder data)
  const filteredTempBans = useMemo(() => {
    if (!tempBans) return [];
    if (!tempSearch.trim()) return tempBans;

    const query = tempSearch.toLowerCase();
    return tempBans.filter(
      (ban) => ban.ip.toLowerCase().includes(query) || ban.reason.toLowerCase().includes(query)
    );
  }, [tempBans, tempSearch]);

  // Filter device bans (client-side, placeholder data)
  const filteredDeviceBans = useMemo(() => {
    if (!deviceBans) return [];
    if (!devicesSearch.trim()) return deviceBans;

    const query = devicesSearch.toLowerCase();
    return deviceBans.filter(
      (ban) => ban.contact.toLowerCase().includes(query) || ban.reason.toLowerCase().includes(query)
    );
  }, [deviceBans, devicesSearch]);

  // Update pagination totals for temp bans and device bans (client-side)
  useEffect(() => {
    tempPagination.setTotalItems(filteredTempBans.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tempPagination.setTotalItems is stable
  }, [filteredTempBans.length]);

  useEffect(() => {
    devicesPagination.setTotalItems(filteredDeviceBans.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- devicesPagination.setTotalItems is stable
  }, [filteredDeviceBans.length]);

  // Paginated data for temp bans and device bans (client-side)
  const paginatedTempBans = useMemo(() => {
    const start = (tempPagination.page - 1) * tempPagination.pageSize;
    const end = start + tempPagination.pageSize;
    return filteredTempBans.slice(start, end);
  }, [filteredTempBans, tempPagination.page, tempPagination.pageSize]);

  const paginatedDeviceBans = useMemo(() => {
    const start = (devicesPagination.page - 1) * devicesPagination.pageSize;
    const end = start + devicesPagination.pageSize;
    return filteredDeviceBans.slice(start, end);
  }, [filteredDeviceBans, devicesPagination.page, devicesPagination.pageSize]);

  const handleUnban = useCallback(
    async (userId: number, username: string) => {
      const confirmed = await confirm({
        title: 'Unban User',
        message: `Are you sure you want to unban "${username}"? They will be able to access the system again.`,
        confirmText: 'Unban',
        variant: 'warning',
      });
      if (confirmed) {
        try {
          await unbanMutation.mutateAsync({ id: userId, banned: false });
        } catch (err) {
          console.error('Failed to unban user:', err);
        }
      }
    },
    [unbanMutation, confirm]
  );

  const handleRefreshAll = useCallback(() => {
    refetchUsers();
    refetchTemp();
    refetchDevices();
  }, [refetchUsers, refetchTemp, refetchDevices]);

  const handleUsersSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsersSearch(e.target.value);
  }, []);

  const handleTempSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTempSearch(e.target.value);
      tempPagination.goToPage(1);
    },
    [tempPagination]
  );

  const handleDevicesSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDevicesSearch(e.target.value);
      devicesPagination.goToPage(1);
    },
    [devicesPagination]
  );

  if (usersError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle
            className="w-12 h-12 text-[var(--danger)] mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-[var(--danger)]">Failed to load ban data</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {usersError instanceof Error ? usersError.message : 'Unknown error'}
          </p>
          <Button onClick={handleRefreshAll} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Bans</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Manage banned users, IPs, and devices
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefreshAll}
          disabled={isFetching}
          aria-label="Refresh all bans"
        >
          <FiRefreshCw
            className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900">
              <FiUser className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : usersTotalItems}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">Banned Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900">
              <FiGlobe
                className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : (tempBans?.length ?? 0)}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">IP Bans</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
              <FiMonitor
                className="w-5 h-5 text-purple-600 dark:text-purple-400"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {isLoading ? '-' : (deviceBans?.length ?? 0)}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">Device Bans</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banned Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              Banned Users
              <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                ({usersTotalItems})
              </span>
            </CardTitle>
            <div className="w-64">
              <Input
                placeholder="Search users..."
                value={usersSearch}
                onChange={handleUsersSearchChange}
                leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
                aria-label="Search banned users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--primary)]" aria-hidden="true" />
            </div>
          ) : bannedUsers.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              <FiShield className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p>{usersSearch ? 'No users match your search' : 'No banned users'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">Permanently banned users table.</caption>
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Username
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Reason
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Banned At
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bannedUsers.map((user) => (
                      <BannedUserRow
                        key={user.id}
                        user={user}
                        onUnban={handleUnban}
                        isUnbanning={unbanMutation.isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {usersTotalPages > 1 && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={usersPage}
                    totalPages={usersTotalPages}
                    pageSize={usersPageSize}
                    totalItems={usersTotalItems}
                    hasNextPage={usersPage < usersTotalPages}
                    hasPreviousPage={usersPage > 1}
                    pageRange={Array.from(
                      { length: Math.min(5, usersTotalPages) },
                      (_, i) => i + Math.max(1, usersPage - 2)
                    ).filter((p) => p <= usersTotalPages)}
                    onPageChange={setUsersPage}
                    disabled={fetchingUsers}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Temporary IP Bans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              Temporary IP Bans
              {tempBans && (
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                  ({filteredTempBans.length}
                  {tempSearch && ` of ${tempBans.length}`})
                </span>
              )}
            </CardTitle>
            <div className="w-64">
              <Input
                placeholder="Search IPs..."
                value={tempSearch}
                onChange={handleTempSearchChange}
                leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
                aria-label="Search IP bans"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTemp ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)]" aria-hidden="true" />
            </div>
          ) : paginatedTempBans.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <FiClock className="w-10 h-10 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>{tempSearch ? 'No IP bans match your search' : 'No temporary IP bans'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">Temporary IP bans table.</caption>
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        IP Address
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Reason
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Expires At
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTempBans.map((ban, index) => (
                      <tr
                        key={`temp-${ban.ip}-${index}`}
                        className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-[var(--foreground)]">
                          {ban.ip}
                        </td>
                        <td className="py-3 px-4 text-[var(--muted-foreground)]">{ban.reason}</td>
                        <td className="py-3 px-4 text-[var(--muted-foreground)]">
                          {formatLocalDateTime(ban.expiresAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {tempPagination.totalPages > 1 && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={tempPagination.page}
                    totalPages={tempPagination.totalPages}
                    pageSize={tempPagination.pageSize}
                    totalItems={filteredTempBans.length}
                    hasNextPage={tempPagination.hasNextPage}
                    hasPreviousPage={tempPagination.hasPreviousPage}
                    pageRange={tempPagination.pageRange}
                    onPageChange={tempPagination.goToPage}
                    onPageSizeChange={tempPagination.setPageSize}
                    disabled={fetchingTemp}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Device Bans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              Device Bans
              {deviceBans && (
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                  ({filteredDeviceBans.length}
                  {devicesSearch && ` of ${deviceBans.length}`})
                </span>
              )}
            </CardTitle>
            <div className="w-64">
              <Input
                placeholder="Search devices..."
                value={devicesSearch}
                onChange={handleDevicesSearchChange}
                leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
                aria-label="Search device bans"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)]" aria-hidden="true" />
            </div>
          ) : paginatedDeviceBans.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              <FiMonitor className="w-10 h-10 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>{devicesSearch ? 'No devices match your search' : 'No device bans'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">Banned devices table.</caption>
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Contact
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Reason
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Expires At
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDeviceBans.map((ban, index) => (
                      <tr
                        key={`device-${ban.contact}-${index}`}
                        className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-sm text-[var(--foreground)] truncate max-w-xs">
                          {ban.contact}
                        </td>
                        <td className="py-3 px-4 text-[var(--muted-foreground)]">{ban.reason}</td>
                        <td className="py-3 px-4 text-[var(--muted-foreground)]">
                          {formatLocalDateTime(ban.expiresAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {devicesPagination.totalPages > 1 && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={devicesPagination.page}
                    totalPages={devicesPagination.totalPages}
                    pageSize={devicesPagination.pageSize}
                    totalItems={filteredDeviceBans.length}
                    hasNextPage={devicesPagination.hasNextPage}
                    hasPreviousPage={devicesPagination.hasPreviousPage}
                    pageRange={devicesPagination.pageRange}
                    onPageChange={devicesPagination.goToPage}
                    onPageSizeChange={devicesPagination.setPageSize}
                    disabled={fetchingDevices}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
