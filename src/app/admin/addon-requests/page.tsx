'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiLoader,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiExternalLink,
  FiPhone,
  FiMessageSquare,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Pagination,
  StyledSelect,
} from '@/components/ui';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { usePagination } from '@/lib/hooks/usePagination';
import { formatLocalDate } from '@/lib/utils/datetime';
import { formatCents } from '@/lib/utils/formatting';
import { formatPhoneUS } from '@/lib/utils/phone';
import { addonApiService, type AddonPurchaseRequest } from '@/lib/api/services/addon.service';
import { toast } from '@/lib/stores/toast';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function addonLabel(r: AddonPurchaseRequest): { icon: React.ReactNode; text: string } {
  if (r.addonType === 'number') {
    return {
      icon: <FiPhone className="w-3.5 h-3.5" />,
      text: r.phoneNumber ? formatPhoneUS(r.phoneNumber) : 'Phone number',
    };
  }
  return {
    icon: <FiMessageSquare className="w-3.5 h-3.5" />,
    text: r.bundleSlug ? `${r.bundleSlug.replace('sms', '').toUpperCase()} SMS package` : 'SMS package',
  };
}

export default function AddonRequestsPage() {
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const [statusFilter, setStatusFilter] = useState('pending');
  const [approveReq, setApproveReq] = useState<AddonPurchaseRequest | null>(null);
  const [rejectReq, setRejectReq] = useState<AddonPurchaseRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'addon-requests', { page: pagination.page, status: statusFilter }],
    queryFn: () =>
      addonApiService.adminList({
        page: pagination.page,
        limit: pagination.pageSize,
        status: statusFilter || undefined,
      }),
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (data?.meta) pagination.setTotalItems(data.meta.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.meta]);

  const approveMutation = useMutation({
    mutationFn: (id: number) => addonApiService.adminApprove(id),
    onSuccess: () => {
      toast.success('Approved — the add-on has been provisioned.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'addon-requests'] });
      setApproveReq(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      addonApiService.adminReject(id, notes),
    onSuccess: () => {
      toast.success('Request rejected.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'addon-requests'] });
      setRejectReq(null);
      setRejectNote('');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not reject'),
  });

  const requests = data?.data ?? [];

  if (isError) {
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load add-on requests. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Add-on Requests</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Manual bank-transfer purchases (numbers &amp; SMS packages) awaiting approval. Approving
          provisions the add-on immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>
              Requests
              {data?.meta && (
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                  ({data.meta.total})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <StyledSelect
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  pagination.goToPage(1);
                }}
                className="w-auto bg-[var(--card)]"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
                <option value="">All</option>
              </StyledSelect>
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && requests.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              No {statusFilter || ''} requests.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                      <th className="py-3 px-4 font-medium">Organization</th>
                      <th className="py-3 px-4 font-medium">Add-on</th>
                      <th className="py-3 px-4 font-medium text-right">Amount</th>
                      <th className="py-3 px-4 font-medium">Requested</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Proof</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const a = addonLabel(r);
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                        >
                          <td className="py-3 px-4">
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {r.organizationName || `Org ${r.organizationId}`}
                            </p>
                            {r.requestedByName && (
                              <p className="text-xs text-[var(--muted-foreground)]">
                                by {r.requestedByName}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground)]">
                              {a.icon}
                              {a.text}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm text-[var(--foreground)]">
                            {formatCents(r.amountCents)}
                          </td>
                          <td className="py-3 px-4 text-sm text-[var(--muted-foreground)]">
                            {formatLocalDate(r.createdAt)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                STATUS_STYLES[r.status] ?? STATUS_STYLES.rejected
                              }`}
                            >
                              {r.status}
                            </span>
                            {r.status === 'failed' && r.errorMessage && (
                              <p
                                className="mt-1 max-w-[200px] truncate text-xs text-red-600 dark:text-red-400"
                                title={r.errorMessage}
                              >
                                {r.errorMessage}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {r.proofUrl ? (
                              <a
                                href={r.proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-[var(--primary-600)] hover:underline"
                              >
                                View <FiExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-[var(--muted-foreground)]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {r.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => setApproveReq(r)}
                                  disabled={approveMutation.isPending}
                                >
                                  <FiCheck className="w-3 h-3" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRejectReq(r)}
                                  disabled={rejectMutation.isPending}
                                >
                                  <FiX className="w-3 h-3" /> Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--muted-foreground)]">
                                {r.reviewedAt ? formatLocalDate(r.reviewedAt) : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
        isOpen={approveReq !== null}
        onClose={() => setApproveReq(null)}
        onConfirm={() => approveReq && approveMutation.mutate(approveReq.id)}
        title="Approve this purchase?"
        message={
          approveReq
            ? `This will provision ${addonLabel(approveReq).text} for ${
                approveReq.organizationName || `org ${approveReq.organizationId}`
              } immediately. Confirm you've received the ${formatCents(
                approveReq.amountCents
              )} bank transfer.`
            : ''
        }
        confirmText="Approve & provision"
        variant="info"
        loading={approveMutation.isPending}
      />

      <Modal
        isOpen={rejectReq !== null}
        onClose={() => {
          setRejectReq(null);
          setRejectNote('');
        }}
        title="Reject this request?"
        size="sm"
      >
        {rejectReq && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Reject the {addonLabel(rejectReq).text} request from{' '}
              <span className="font-medium text-[var(--foreground)]">
                {rejectReq.organizationName || `org ${rejectReq.organizationId}`}
              </span>
              ? Nothing is provisioned. The customer can submit again.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">
                Reason (optional — saved to the request record)
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. payment not received, wrong amount…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]/40"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectReq(null);
                  setRejectNote('');
                }}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  rejectReq &&
                  rejectMutation.mutate({ id: rejectReq.id, notes: rejectNote.trim() || undefined })
                }
                loading={rejectMutation.isPending}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
