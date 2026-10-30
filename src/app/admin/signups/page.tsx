'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSearch, FiCheck, FiLoader, FiRefreshCw, FiAlertCircle, FiEye } from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Pagination,
  StyledSelect,
} from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { usePagination } from '@/lib/hooks/usePagination';
import { formatLocalDate } from '@/lib/utils/datetime';
import { superadminApiService, type SignupOrder } from '@/lib/api/services/superadmin.service';
import { ORDER_STATUS_STYLES, formatStatus } from '@/lib/constants/status-styles';
import { formatCents } from '@/lib/utils/formatting';
import Link from 'next/link';

const OrderRow = React.memo(function OrderRow({
  order,
  onAuthorize,
  isAuthPending,
  onToggleSeen,
  isSeenPending,
}: {
  order: SignupOrder;
  onAuthorize: (order: SignupOrder) => void;
  isAuthPending: boolean;
  onToggleSeen: (order: SignupOrder) => void;
  isSeenPending: boolean;
}) {
  const seen = !!order.seenAt;
  return (
    <tr
      className={`border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${
        seen ? '' : 'bg-[var(--primary-600)]/[0.05]'
      }`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/signups/${order.id}`}
            className={`text-[var(--foreground)] hover:underline ${seen ? 'font-medium' : 'font-semibold'}`}
          >
            {order.businessName || order.campaign || '—'}
          </Link>
          {!seen && (
            <span className="inline-flex items-center rounded-full bg-[var(--primary-600)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              New
            </span>
          )}
          {order.paymentMethod === 'bank_transfer' && (
            <span
              className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
              title="Paid by manual bank transfer — receipt on the order detail page"
            >
              Bank transfer
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {order.businessNature ||
            (order.quantityOfDialers != null
              ? `${order.quantityOfDialers} dialer${order.quantityOfDialers === 1 ? '' : 's'}`
              : '')}
        </p>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-[var(--foreground)]">{order.contactName}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{order.contactEmail}</p>
        {order.whatsappNumber && (
          <p className="text-xs text-[var(--muted-foreground)]">WhatsApp: {order.whatsappNumber}</p>
        )}
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ORDER_STATUS_STYLES[order.status] || ORDER_STATUS_STYLES.draft}`}
        >
          {formatStatus(order.status)}
        </span>
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm text-[var(--foreground)]">
        {order.paymentAmountCents > 0 ? formatCents(order.paymentAmountCents) : '-'}
      </td>
      <td className="py-3 px-4 text-sm text-[var(--muted-foreground)]">
        {formatLocalDate(order.createdAt)}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {seen ? (
            <button
              type="button"
              onClick={() => onToggleSeen(order)}
              disabled={isSeenPending}
              title={`Seen${order.seenByName ? ` by ${order.seenByName}` : ''}${
                order.seenAt ? ` · ${formatLocalDate(order.seenAt)}` : ''
              } — click to mark unseen`}
              className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              <FiCheck className="w-3 h-3 text-emerald-500" /> Seen
            </button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onToggleSeen(order)}
              disabled={isSeenPending}
              title="Mark this request as seen"
            >
              <FiCheck className="w-3 h-3" /> Mark seen
            </Button>
          )}
          <Link href={`/admin/signups/${order.id}`}>
            <Button size="sm" variant="outline" aria-label="View details">
              <FiEye className="w-3 h-3" /> View
            </Button>
          </Link>
          {order.status === 'pending_verification' && (
            <Button
              size="sm"
              variant="success"
              onClick={() => onAuthorize(order)}
              disabled={isAuthPending}
            >
              <FiCheck className="w-3 h-3" /> Authorize
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [authorizeOrder, setAuthorizeOrder] = useState<SignupOrder | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [
      'superadmin',
      'orders',
      {
        page: pagination.page,
        search: debouncedSearch,
        status: statusFilter,
        paymentMethod: paymentFilter,
      },
    ],
    queryFn: () =>
      superadminApiService.getOrders({
        page: pagination.page,
        limit: pagination.pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        paymentMethod: paymentFilter || undefined,
      }),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data?.meta) pagination.setTotalItems(data.meta.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.meta]);

  const authorizeMutation = useMutation({
    mutationFn: (orderId: number) => superadminApiService.authorizeOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'orders'] });
      setAuthorizeOrder(null);
    },
  });

  const seenMutation = useMutation({
    mutationFn: ({ id, seen }: { id: number; seen: boolean }) =>
      superadminApiService.markOrderSeen(id, seen),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'orders'] }),
  });

  const orders = data?.data ?? [];
  const handleToggleSeen = useCallback(
    (order: SignupOrder) => seenMutation.mutate({ id: order.id, seen: !order.seenAt }),
    [seenMutation]
  );
  const handleAuthorizeClick = useCallback((order: SignupOrder) => setAuthorizeOrder(order), []);
  const handleAuthorizeConfirm = useCallback(async () => {
    if (!authorizeOrder) return;
    await authorizeMutation.mutateAsync(authorizeOrder.id);
  }, [authorizeOrder, authorizeMutation]);

  if (isError)
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load orders. Please try again.
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Signup Orders</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          View and manage all client signup orders
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              All Orders
              {data?.meta && (
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                  ({data.meta.total})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-72">
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<FiSearch className="w-4 h-4" />}
                />
              </div>
              <StyledSelect
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  pagination.goToPage(1);
                }}
                className="w-auto bg-[var(--card)]"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="paid">Paid</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="active">Active</option>
                <option value="failed">Failed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </StyledSelect>
              <StyledSelect
                value={paymentFilter}
                onChange={(v) => {
                  setPaymentFilter(v);
                  pagination.goToPage(1);
                }}
                className="w-auto bg-[var(--card)]"
              >
                <option value="">All Methods</option>
                <option value="stripe">Card (Stripe)</option>
                <option value="bank_transfer">Bank Transfer</option>
              </StyledSelect>
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && orders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              {searchQuery || statusFilter || paymentFilter
                ? 'No orders found matching your filters'
                : 'No signup orders found yet.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Business
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Contact
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Date
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        onAuthorize={handleAuthorizeClick}
                        isAuthPending={authorizeMutation.isPending}
                        onToggleSeen={handleToggleSeen}
                        isSeenPending={seenMutation.isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {data?.meta && data.meta.totalPages > 1 && (
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={pagination.totalItems}
                    hasNextPage={pagination.hasNextPage}
                    hasPreviousPage={pagination.hasPreviousPage}
                    pageRange={pagination.pageRange}
                    onPageChange={pagination.goToPage}
                    onPageSizeChange={pagination.setPageSize}
                    disabled={isFetching}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={authorizeOrder !== null}
        onClose={() => setAuthorizeOrder(null)}
        onConfirm={handleAuthorizeConfirm}
        title="Authorize Order"
        message={`Authorize "${authorizeOrder?.businessName}"? This will activate their organization and user account, enabling dialer access.`}
        confirmText="Authorize"
        variant="info"
        loading={authorizeMutation.isPending}
      />
    </div>
  );
}
