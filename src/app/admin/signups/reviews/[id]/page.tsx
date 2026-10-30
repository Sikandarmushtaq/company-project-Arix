'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiArrowLeft,
  FiLoader,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiInfo,
  FiFile,
  FiDownload,
  FiCalendar,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { formatLocalDate } from '@/lib/utils/datetime';
import { superadminApiService, type SmsReview } from '@/lib/api/services/superadmin.service';
import { REVIEW_STATUS_STYLES, formatStatus } from '@/lib/constants/status-styles';
import { formatFileSize } from '@/lib/utils/formatting';
import { useAuthStore } from '@/lib/stores/auth';
import Link from 'next/link';

function isActionable(status: SmsReview['status']): boolean {
  return status === 'pending' || status === 'in_review';
}

// ---------------------------------------------------------------------------
// Detail Field component
// ---------------------------------------------------------------------------

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[var(--foreground)]">{value || '\u2014'}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SmsReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reviewId = Number(params.id);

  // Modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [notes, setNotes] = useState('');

  // Fetch single review
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['superadmin', 'sms-review', reviewId],
    queryFn: () => superadminApiService.getSmsReview(reviewId),
    enabled: !isNaN(reviewId),
    staleTime: 30_000,
  });

  const review = data?.data ?? null;

  // Mutations -----------------------------------------------------------------

  const approveMutation = useMutation({
    mutationFn: ({ id, notes: n }: { id: number; notes?: string }) =>
      superadminApiService.approveSmsReview(id, n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-review', reviewId] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      setShowApproveModal(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      superadminApiService.rejectSmsReview(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-review', reviewId] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      setShowRejectModal(false);
      setNotes('');
    },
  });

  const infoMutation = useMutation({
    mutationFn: ({ id, notes: n }: { id: number; notes: string }) =>
      superadminApiService.requestMoreInfo(id, n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-review', reviewId] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      setShowInfoModal(false);
      setNotes('');
    },
  });

  // Handlers ------------------------------------------------------------------

  const handleOpenReject = useCallback(() => {
    setNotes('');
    setShowRejectModal(true);
  }, []);

  const handleOpenInfo = useCallback(() => {
    setNotes('');
    setShowInfoModal(true);
  }, []);

  // Loading state -------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
      </div>
    );
  }

  // Error state ---------------------------------------------------------------

  if (isError || !review) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/signups/reviews"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:underline"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Reviews
        </Link>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FiAlertCircle className="w-10 h-10 text-[var(--danger)] mb-3" />
              <p className="text-[var(--foreground)] font-medium">
                {isError
                  ? (error as Error)?.message || 'Failed to load review'
                  : 'Review not found'}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/admin/signups/reviews')}
              >
                Return to Reviews
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render --------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/signups/reviews"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Back to Reviews"
          >
            <FiArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Review #{review.id}</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              Submitted {formatLocalDate(review.createdAt)}
            </p>
          </div>
          <span
            className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${REVIEW_STATUS_STYLES[review.status] || ''}`}
          >
            {formatStatus(review.status)}
          </span>
        </div>

        {/* Action buttons (header) */}
        {isActionable(review.status) && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="success" onClick={() => setShowApproveModal(true)}>
              <FiCheck className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button size="sm" variant="danger" onClick={handleOpenReject}>
              <FiX className="w-3.5 h-3.5" /> Reject
            </Button>
            <Button size="sm" variant="outline" onClick={handleOpenInfo}>
              <FiInfo className="w-3.5 h-3.5" /> Request Info
            </Button>
          </div>
        )}
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <DetailField label="Legal Company Name" value={review.legalCompanyName} />
            <DetailField label="Registration Number" value={review.companyRegistrationNumber} />
            <DetailField label="Company Address" value={review.companyAddress} />
            <DetailField label="Company Country" value={review.companyCountry} />
          </dl>
        </CardContent>
      </Card>

      {/* Call Verification (KYC) business details — only for call_verification reviews */}
      {review.reviewType === 'call_verification' && review.payload?.brand && (
        <Card>
          <CardHeader>
            <CardTitle>Business Verification (KYC)</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <DetailField
                label="Registration Type"
                value={review.payload.registrationType === 'sole_prop' ? 'Sole proprietor' : 'Registered business'}
              />
              <DetailField label="Entity Type" value={review.payload.brand.entityType || null} />
              <DetailField label="EIN / Tax ID" value={review.payload.brand.ein || null} />
              <DetailField label="Industry" value={review.payload.brand.vertical || null} />
              <DetailField label="Business Email" value={review.payload.brand.email || null} />
              <DetailField label="Business Phone" value={review.payload.brand.phone || null} />
              <DetailField label="Website" value={review.payload.brand.website || null} />
              <DetailField label="Street" value={review.payload.brand.street || null} />
              <DetailField label="City" value={review.payload.brand.city || null} />
              <DetailField label="State" value={review.payload.brand.state || null} />
              <DetailField label="Postal Code" value={review.payload.brand.postalCode || null} />
              <DetailField label="Country" value={review.payload.brand.country || null} />
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Business Context */}
      <Card>
        <CardHeader>
          <CardTitle>Business Context</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5">
            <DetailField label="Business Name" value={review.businessName} />
            <DetailField label="Contact Name" value={review.contactName} />
            <DetailField
              label="Contact Email"
              value={
                review.contactEmail ? (
                  <a
                    href={`mailto:${review.contactEmail}`}
                    className="text-[var(--foreground)] hover:underline"
                  >
                    {review.contactEmail}
                  </a>
                ) : null
              }
            />
          </dl>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>
            Documents{' '}
            <span className="text-sm font-normal text-[var(--muted-foreground)] ml-1">
              ({review.documents?.length ?? 0})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!review.documents || review.documents.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
              No documents uploaded.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {review.documents.map((doc, idx) => (
                <li
                  key={doc.key || idx}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--muted)]">
                      <FiFile className="w-4 h-4 text-[var(--muted-foreground)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {doc.type} &middot; {formatFileSize(doc.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const token = useAuthStore.getState().token;
                        const base = process.env.NEXT_PUBLIC_API_URL || '/api/proxy';
                        const res = await fetch(
                          `${base}/admin/signup-reviews/${review.id}/documents/${encodeURIComponent(doc.key)}`,
                          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                        );
                        const json = await res.json();
                        if (!res.ok || !json.success) {
                          alert(json.error?.message || 'Failed to download document');
                          return;
                        }
                        // Backend returns a signed URL — open it to download
                        const a = document.createElement('a');
                        a.href = json.data.url;
                        a.download = doc.name;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.click();
                      } catch {
                        alert('Failed to download document');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors shrink-0"
                  >
                    <FiDownload className="w-3.5 h-3.5" />
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Review History */}
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <DetailField
              label="Reviewed By"
              value={review.reviewedBy ? `User #${review.reviewedBy}` : null}
            />
            <DetailField
              label="Reviewed At"
              value={
                review.reviewedAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <FiCalendar className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                    {formatLocalDate(review.reviewedAt)}
                  </span>
                ) : null
              }
            />
            <div className="sm:col-span-2">
              <DetailField label="Reviewer Notes" value={review.reviewerNotes} />
            </div>
            {review.rejectionReason && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--danger)]">
                  Rejection Reason
                </dt>
                <dd className="mt-1 text-sm text-[var(--foreground)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  {review.rejectionReason}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Bottom Actions (for actionable reviews) */}
      {isActionable(review.status) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="success" onClick={() => setShowApproveModal(true)}>
                <FiCheck className="w-4 h-4" /> Approve Campaign
              </Button>
              <Button variant="danger" onClick={handleOpenReject}>
                <FiX className="w-4 h-4" /> Reject Campaign
              </Button>
              <Button variant="outline" onClick={handleOpenInfo}>
                <FiInfo className="w-4 h-4" /> Request More Information
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={() => approveMutation.mutate({ id: review.id })}
        title="Approve SMS Campaign"
        message={`Approve the SMS campaign for "${review.legalCompanyName}"? This will enable SMS messaging on their account.`}
        confirmText="Approve"
        variant="info"
        loading={approveMutation.isPending}
      />

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject SMS Campaign"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-[var(--muted-foreground)]">
            Provide a reason for rejecting the SMS campaign for &ldquo;{review.legalCompanyName}
            &rdquo;.
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
              onClick={() => setShowRejectModal(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => rejectMutation.mutate({ id: review.id, reason: notes })}
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
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Request Additional Information"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-[var(--muted-foreground)]">
            Describe what additional information is needed from &ldquo;{review.legalCompanyName}
            &rdquo;.
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
              onClick={() => setShowInfoModal(false)}
              disabled={infoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => infoMutation.mutate({ id: review.id, notes })}
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
