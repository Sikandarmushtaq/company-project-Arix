'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiX, FiInfo, FiLoader, FiEye } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, StyledSelect } from '@/components/ui';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { formatLocalDate } from '@/lib/utils/datetime';
import { superadminApiService, type SmsReview } from '@/lib/api/services/superadmin.service';
import { REVIEW_STATUS_STYLES, formatStatus } from '@/lib/constants/status-styles';
import Link from 'next/link';

const ReviewRow = React.memo(function ReviewRow({
  review,
  onApprove,
  onReject,
  onRequestInfo,
}: {
  review: SmsReview;
  onApprove: (review: SmsReview) => void;
  onReject: (review: SmsReview) => void;
  onRequestInfo: (review: SmsReview) => void;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/signups/reviews/${review.id}`}
            className="font-medium text-[var(--foreground)] hover:underline"
          >
            {review.legalCompanyName}
          </Link>
          <span
            className={`inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full ${
              review.reviewType === 'call_verification'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            }`}
          >
            {review.reviewType === 'call_verification' ? 'Call' : 'SMS'}
          </span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{review.businessName}</p>
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-[var(--foreground)]">{review.contactName}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{review.contactEmail}</p>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${REVIEW_STATUS_STYLES[review.status] || ''}`}
        >
          {formatStatus(review.status)}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-[var(--muted-foreground)]">
        {formatLocalDate(review.createdAt)}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/admin/signups/reviews/${review.id}`}>
            <Button size="sm" variant="outline" aria-label="View details">
              <FiEye className="w-3 h-3" /> View
            </Button>
          </Link>
          {(review.status === 'pending' || review.status === 'in_review') && (
            <>
              <Button
                size="sm"
                variant="success"
                onClick={() => onApprove(review)}
                aria-label="Approve"
              >
                <FiCheck className="w-3 h-3" /> Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onReject(review)}
                aria-label="Reject"
              >
                <FiX className="w-3 h-3" /> Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRequestInfo(review)}
                aria-label="Request info"
              >
                <FiInfo className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function SmsReviewsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [approveReview, setApproveReview] = useState<SmsReview | null>(null);
  const [rejectReview, setRejectReview] = useState<SmsReview | null>(null);
  const [infoReview, setInfoReview] = useState<SmsReview | null>(null);
  const [notes, setNotes] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['superadmin', 'sms-reviews', statusFilter],
    queryFn: () => superadminApiService.getSmsReviews({ status: statusFilter || undefined }),
    staleTime: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      superadminApiService.approveSmsReview(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      setApproveReview(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      superadminApiService.rejectSmsReview(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      setRejectReview(null);
      setNotes('');
    },
  });

  const infoMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      superadminApiService.requestMoreInfo(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      setInfoReview(null);
      setNotes('');
    },
  });

  const reviews = data?.data ?? [];

  const handleApprove = useCallback((r: SmsReview) => setApproveReview(r), []);
  const handleReject = useCallback((r: SmsReview) => {
    setRejectReview(r);
    setNotes('');
  }, []);
  const handleRequestInfo = useCallback((r: SmsReview) => {
    setInfoReview(r);
    setNotes('');
  }, []);

  if (isError)
    return (
      <div className="p-8 text-center text-[var(--danger)]">
        Failed to load reviews. Please try again.
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Registration Reviews</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Review and approve client Call Verification (KYC) and SMS (10DLC) registrations
          </p>
        </div>
        <StyledSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          className="w-auto bg-[var(--card)]"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="more_info_needed">More Info Needed</option>
        </StyledSelect>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Reviews{' '}
            <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
              ({reviews.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted-foreground)]">
              {statusFilter
                ? 'No reviews found with this status'
                : 'No SMS campaign reviews found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Company
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Contact
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Submitted
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <ReviewRow
                      key={review.id}
                      review={review}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Confirmation */}
      <ConfirmModal
        isOpen={approveReview !== null}
        onClose={() => setApproveReview(null)}
        onConfirm={() => {
          if (approveReview) approveMutation.mutate({ id: approveReview.id });
        }}
        title={
          approveReview?.reviewType === 'call_verification'
            ? 'Approve Call Verification (KYC)'
            : 'Approve SMS Campaign (10DLC)'
        }
        message={
          approveReview?.reviewType === 'call_verification'
            ? `Approve business verification for "${approveReview?.legalCompanyName}"? This unlocks unlimited calling on their account.`
            : `Approve the SMS campaign (10DLC) for "${approveReview?.legalCompanyName}"? This lets them buy SMS packages and send at volume.`
        }
        confirmText="Approve"
        variant="info"
        loading={approveMutation.isPending}
      />

      {/* Reject Modal */}
      <Modal
        isOpen={rejectReview !== null}
        onClose={() => setRejectReview(null)}
        title={
          rejectReview?.reviewType === 'call_verification'
            ? 'Reject Call Verification'
            : 'Reject SMS Campaign'
        }
        size="md"
      >
        <div className="space-y-4">
          <p className="text-[var(--muted-foreground)]">
            Provide a reason for rejecting the{' '}
            {rejectReview?.reviewType === 'call_verification'
              ? 'business verification'
              : 'SMS campaign'}{' '}
            for &ldquo;
            {rejectReview?.legalCompanyName}&rdquo;.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-4 py-3 text-sm"
            placeholder="Explain the rejection reason..."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectReview(null)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (rejectReview) rejectMutation.mutate({ id: rejectReview.id, reason: notes });
              }}
              disabled={!notes || rejectMutation.isPending}
              loading={rejectMutation.isPending}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request Info Modal */}
      <Modal
        isOpen={infoReview !== null}
        onClose={() => setInfoReview(null)}
        title="Request Additional Information"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-[var(--muted-foreground)]">
            Describe what additional information is needed from &ldquo;
            {infoReview?.legalCompanyName}&rdquo;.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-4 py-3 text-sm"
            placeholder="Describe the information needed..."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setInfoReview(null)}
              disabled={infoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (infoReview) infoMutation.mutate({ id: infoReview.id, notes });
              }}
              disabled={!notes || infoMutation.isPending}
              loading={infoMutation.isPending}
            >
              Send Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
