'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiArrowLeft,
  FiLoader,
  FiAlertCircle,
  FiCheck,
  FiPhone,
  FiMail,
  FiGlobe,
  FiMapPin,
  FiUser,
  FiCalendar,
  FiCreditCard,
  FiShield,
  FiCopy,
  FiMessageSquare,
  FiDollarSign,
  FiX,
  FiRefreshCw,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { formatLocalDate } from '@/lib/utils/datetime';
import { superadminApiService, type SignupOrder } from '@/lib/api/services/superadmin.service';
import {
  ORDER_STATUS_STYLES,
  NUMBER_STATUS_STYLES,
  formatStatus,
} from '@/lib/constants/status-styles';
import { formatCents } from '@/lib/utils/formatting';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Extended types
// ---------------------------------------------------------------------------

interface OrderNumber {
  id: number;
  phoneNumber: string;
  countryCode: string;
  numberType: string;
  monthlyCostCents: number;
  upfrontCostCents: number;
  provisioningStatus: string;
}

interface OrderLineItem {
  id: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  metadata: Record<string, unknown> | null;
}

interface OrderDetail extends SignupOrder {
  numbers?: OrderNumber[];
  lineItems?: OrderLineItem[];
}

// Tailwind class pairs for the email-verified pill. Kept inline (rather
// than pulled into status-styles.ts) because this is a single 2-state
// indicator, not a broader status taxonomy.
const EMAIL_VERIFY_VERIFIED =
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
const EMAIL_VERIFY_PENDING = 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';

// ---------------------------------------------------------------------------
// Helper: mask sensitive IDs — show first 8 + last 4 chars
// ---------------------------------------------------------------------------

function maskId(value: string | null | undefined): string {
  if (!value) return '\u2014';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}${'*'.repeat(Math.min(value.length - 12, 20))}${value.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Feature-key → display label. Mirrors the FEATURES list in LeadSignupForm;
// unknown keys fall back to the raw key so nothing silently disappears.
const FEATURE_LABELS: Record<string, string> = {
  voice_calls: 'Voice Calls',
  sms: 'SMS / Texting',
  call_recording: 'Call Recording',
  voicemail: 'Voicemail',
  whatsapp_messaging: 'WhatsApp Messaging',
  whatsapp_calls: 'WhatsApp Calls',
  ai_auto_dialer: 'AI Auto-Dialer',
  bulk_sms: 'Bulk SMS',
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-[var(--muted-foreground)] mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="text-sm text-[var(--foreground)] break-words">{value}</p>
      </div>
    </div>
  );
}

function TimelineEvent({ label, date }: { label: string; date: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          date ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-[var(--border)]'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--foreground)]">{label}</p>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] shrink-0">
        {date ? formatLocalDate(date) : '--'}
      </p>
    </div>
  );
}

function CopyableField({
  label,
  value,
  masked,
}: {
  label: string;
  value: string | null | undefined;
  masked?: boolean;
}) {
  if (!value) {
    return (
      <div className="p-3 rounded-lg bg-[var(--muted)]">
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="text-sm font-mono text-[var(--muted-foreground)] mt-1">&mdash;</p>
      </div>
    );
  }
  return (
    <div className="p-3 rounded-lg bg-[var(--muted)] group">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-sm font-mono text-[var(--foreground)] truncate flex-1">
          {masked ? maskId(value) : value}
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
          }}
          className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-opacity"
          title="Copy to clipboard"
        >
          <FiCopy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // Per-row retry state for the Phone Numbers table. Tracked by number
  // id so multiple Retry buttons can spin independently.
  const [retryingNumberId, setRetryingNumberId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['superadmin', 'orders', id],
    queryFn: () => superadminApiService.getOrder(Number(id)),
    enabled: !!id,
    staleTime: 30_000,
  });

  const order = data?.data as OrderDetail | undefined;

  const authorizeMutation = useMutation({
    mutationFn: (orderId: number) => superadminApiService.authorizeOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'orders'] });
      setShowAuthorizeModal(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason: string }) =>
      superadminApiService.rejectOrder(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'orders'] });
      setShowRejectModal(false);
      setRejectReason('');
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({ orderId, numberId }: { orderId: number; numberId: number }) =>
      superadminApiService.retryNumberPurchase(orderId, numberId),
    // Settled (success or error) → clear the spinner. Errors are surfaced
    // via mutation state so the row UI can show a quiet "tried, failed"
    // hint without a global toast.
    onSettled: () => setRetryingNumberId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'orders', id] });
    },
  });

  const seenMutation = useMutation({
    mutationFn: ({ orderId, seen }: { orderId: number; seen: boolean }) =>
      superadminApiService.markOrderSeen(orderId, seen),
    // Refresh both this detail and the list so the NEW badge / Seen state sync.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superadmin', 'orders'] }),
  });

  // Auto-mark seen the first time an admin opens an unseen request. The ref
  // guards against re-firing during the window before the refetch lands.
  const autoSeenRef = useRef<number | null>(null);
  useEffect(() => {
    if (order && !order.seenAt && autoSeenRef.current !== order.id) {
      autoSeenRef.current = order.id;
      seenMutation.mutate({ orderId: order.id, seen: true });
    }
  }, [order, seenMutation]);

  const handleToggleSeen = useCallback(() => {
    if (!order) return;
    seenMutation.mutate({ orderId: order.id, seen: !order.seenAt });
  }, [order, seenMutation]);

  const handleAuthorizeConfirm = useCallback(async () => {
    if (!order) return;
    await authorizeMutation.mutateAsync(order.id);
  }, [order, authorizeMutation]);

  const handleRejectConfirm = useCallback(async () => {
    if (!order || rejectReason.trim().length < 10) return;
    await rejectMutation.mutateAsync({ orderId: order.id, reason: rejectReason.trim() });
  }, [order, rejectReason, rejectMutation]);

  const handleRetryNumber = useCallback(
    (numberId: number) => {
      if (!order) return;
      setRetryingNumberId(numberId);
      retryMutation.mutate({ orderId: order.id, numberId });
    },
    [order, retryMutation]
  );

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
      </div>
    );
  }

  // ---- Error state ----
  if (error || !order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mx-auto mb-4" />
          <p className="text-[var(--danger)] font-medium">
            {error ? 'Failed to load order' : 'Order not found'}
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {error instanceof Error ? error.message : `Order #${id} could not be found.`}
          </p>
          <Button onClick={() => router.push('/admin/signups')} className="mt-4">
            <FiArrowLeft className="w-4 h-4" /> Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const numbers = order.numbers ?? [];
  const lineItems = order.lineItems ?? [];
  const oneTimeItems = lineItems.filter((item) => !item.metadata?.recurring);
  const recurringItems = lineItems.filter((item) => item.metadata?.recurring);
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.totalCents, 0);
  const monthlyTotal = recurringItems.reduce(
    (sum, item) => sum + (Number(item.metadata?.monthlyCents) || item.unitPriceCents),
    0
  );
  const isPaid = !!order.paidAt;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/signups">
            <Button variant="ghost" size="icon">
              <FiArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Order #{order.id}</h1>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                  ORDER_STATUS_STYLES[order.status] || ORDER_STATUS_STYLES.draft
                }`}
              >
                {formatStatus(order.status)}
              </span>
            </div>
            <p className="text-[var(--muted-foreground)] mt-1">{order.businessName}</p>
            <button
              type="button"
              onClick={handleToggleSeen}
              disabled={seenMutation.isPending}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
              title={order.seenAt ? 'Click to mark unseen' : 'Click to mark seen'}
            >
              {order.seenAt ? (
                <>
                  <FiCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Seen
                  {order.seenByName ? ` by ${order.seenByName}` : ''}
                  {` · ${formatLocalDate(order.seenAt)}`}
                  <span className="ml-1 underline">Mark unseen</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--primary-600)]" />
                  Not seen yet
                  <span className="ml-1 underline">Mark as seen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Authorize is only sensible on a paid, pending-verification
            order. Reject is available across any pre-active state
            (draft / paid / pending / failed) so a spam signup, an
            abandoned cart, or a stuck provisioning all have a clean
            disposal path. An already-active order can't be rejected from
            here — deactivate the org via /admin/users/:id instead. */}
        {order.status === 'pending_verification' && (
          <div className="flex items-center gap-2">
            <Button variant="success" onClick={() => setShowAuthorizeModal(true)}>
              <FiCheck className="w-4 h-4" /> Authorize Order
            </Button>
            <Button variant="danger" onClick={() => setShowRejectModal(true)}>
              <FiX className="w-4 h-4" /> Reject Order
            </Button>
          </div>
        )}
        {order.status !== 'pending_verification' &&
          order.status !== 'active' &&
          order.status !== 'rejected' &&
          order.status !== 'cancelled' && (
            <Button variant="danger" onClick={() => setShowRejectModal(true)}>
              <FiX className="w-4 h-4" /> Reject Order
            </Button>
          )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Payment Status                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <FiCreditCard className="w-4 h-4" />
              Payment Status
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Payment badge + amount */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ${
                  isPaid
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isPaid ? <FiCheck className="w-6 h-6" /> : <FiDollarSign className="w-6 h-6" />}
              </div>
              <div>
                <p
                  className={`text-lg font-semibold ${
                    isPaid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isPaid ? 'Payment Received' : 'Awaiting Payment'}
                </p>
                {isPaid && order.paidAt && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Paid on {formatLocalDate(order.paidAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {order.paymentAmountCents > 0 ? formatCents(order.paymentAmountCents) : '$0.00'}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] uppercase">
                {order.paymentCurrency || 'USD'}
              </p>
            </div>
          </div>

          {/* Manual bank-transfer proof (records) — present only when paid by transfer */}
          {order.bankTransferProofUrl && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3">
              <span className="text-sm text-[var(--foreground)]">
                Paid by <strong>bank transfer</strong> — customer-uploaded receipt
              </span>
              <a
                href={order.bankTransferProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                View payment proof
              </a>
            </div>
          )}

          {/* Stripe IDs — masked for security with copy-on-hover */}
          <div className="border-t border-[var(--border)] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <FiShield className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Payment References
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CopyableField label="Payment Intent" value={order.stripePaymentIntentId} masked />
              <CopyableField
                label="Checkout Session"
                value={order.stripeCheckoutSessionId}
                masked
              />
              <CopyableField label="Customer ID" value={order.stripeCustomerId} masked />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Business Information                                               */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            <InfoRow
              icon={<FiUser className="w-4 h-4" />}
              label="Business Name"
              value={order.businessName}
            />
            <InfoRow
              icon={<FiUser className="w-4 h-4" />}
              label="Business Nature"
              value={order.businessNature}
            />
            <InfoRow
              icon={<FiUser className="w-4 h-4" />}
              label="Contact Name"
              value={order.contactName}
            />
            <div className="flex items-start gap-3 py-2">
              <span className="text-[var(--muted-foreground)] mt-0.5 shrink-0">
                <FiMail className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[var(--muted-foreground)]">Contact Email</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-[var(--foreground)] break-words">
                    {order.contactEmail}
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                      order.emailVerified ? EMAIL_VERIFY_VERIFIED : EMAIL_VERIFY_PENDING
                    }`}
                    title={
                      order.emailVerified
                        ? order.emailVerifiedAt
                          ? `Verified ${formatLocalDate(order.emailVerifiedAt)}`
                          : 'Verified'
                        : 'Customer has not clicked the verify link in their inbox'
                    }
                  >
                    {order.emailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>
            </div>
            <InfoRow
              icon={<FiPhone className="w-4 h-4" />}
              label="Contact Phone"
              value={order.contactPhone}
            />
            <InfoRow
              icon={<FiMessageSquare className="w-4 h-4" />}
              label="WhatsApp Number"
              value={order.whatsappNumber}
            />
            <InfoRow
              icon={<FiUser className="w-4 h-4" />}
              label="Campaign"
              value={order.campaign}
            />
            <InfoRow
              icon={<FiPhone className="w-4 h-4" />}
              label="Quantity of Dialers"
              value={order.quantityOfDialers != null ? String(order.quantityOfDialers) : null}
            />
            <InfoRow
              icon={<FiMapPin className="w-4 h-4" />}
              label="Business Address"
              value={order.businessAddress}
            />
            <InfoRow
              icon={<FiGlobe className="w-4 h-4" />}
              label="Business Website"
              value={order.businessWebsite}
            />
            <InfoRow
              icon={<FiShield className="w-4 h-4" />}
              label="Signup IP"
              value={order.ipAddress}
            />
          </div>

          {order.interestedFeatures && order.interestedFeatures.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="text-xs text-[var(--muted-foreground)] mb-2">Interested In</p>
              <div className="flex flex-wrap gap-2">
                {order.interestedFeatures.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center rounded-full bg-[var(--primary-600)]/10 px-3 py-1 text-xs font-medium text-[var(--foreground)]"
                  >
                    {FEATURE_LABELS[key] || key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Phone Numbers                                                      */}
      {/* ------------------------------------------------------------------ */}
      {numbers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Phone Numbers
              <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">
                ({numbers.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Phone Number
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Country
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Type
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Upfront
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Monthly
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--muted-foreground)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {numbers.map((num) => {
                    const canRetry =
                      num.provisioningStatus === 'failed' || num.provisioningStatus === 'pending';
                    const isThisRowRetrying = retryingNumberId === num.id;
                    return (
                      <tr
                        key={num.id}
                        className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-sm text-[var(--foreground)]">
                          {num.phoneNumber}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--foreground)]">
                          {num.countryCode}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--foreground)] capitalize">
                          {num.numberType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--foreground)] text-right font-mono">
                          {formatCents(num.upfrontCostCents)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--foreground)] text-right font-mono">
                          {formatCents(num.monthlyCostCents)}/mo
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              NUMBER_STATUS_STYLES[num.provisioningStatus] ||
                              NUMBER_STATUS_STYLES.pending
                            }`}
                          >
                            {num.provisioningStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canRetry && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetryNumber(num.id)}
                              disabled={isThisRowRetrying || retryMutation.isPending}
                              loading={isThisRowRetrying}
                            >
                              <FiRefreshCw className="w-3 h-3" /> Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Charges                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <FiDollarSign className="w-4 h-4" />
              Charges
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineItems.length > 0 ? (
            <div className="space-y-6">
              {/* One-time charges */}
              {oneTimeItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-3">
                    One-Time Charges
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 px-4 font-medium text-[var(--muted-foreground)] text-xs">
                            Description
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-[var(--muted-foreground)] text-xs">
                            Qty
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-[var(--muted-foreground)] text-xs">
                            Unit Price
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-[var(--muted-foreground)] text-xs">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {oneTimeItems.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[var(--border)]/50 hover:bg-[var(--muted)] transition-colors"
                          >
                            <td className="py-2 px-4 text-sm text-[var(--foreground)]">
                              {item.description}
                            </td>
                            <td className="py-2 px-4 text-sm text-[var(--foreground)] text-right font-mono">
                              {item.quantity}
                            </td>
                            <td className="py-2 px-4 text-sm text-[var(--foreground)] text-right font-mono">
                              {formatCents(item.unitPriceCents)}
                            </td>
                            <td className="py-2 px-4 text-sm text-[var(--foreground)] text-right font-mono font-medium">
                              {formatCents(item.totalCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[var(--border)]">
                          <td
                            colSpan={3}
                            className="py-2 px-4 text-sm font-semibold text-[var(--foreground)] text-right"
                          >
                            Due Today
                          </td>
                          <td className="py-2 px-4 text-sm font-bold text-[var(--foreground)] text-right font-mono">
                            {formatCents(oneTimeTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Recurring charges */}
              {recurringItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-3">
                    Monthly Recurring
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 px-4 font-medium text-[var(--muted-foreground)] text-xs">
                            Description
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-[var(--muted-foreground)] text-xs">
                            Monthly
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recurringItems.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[var(--border)]/50 hover:bg-[var(--muted)] transition-colors"
                          >
                            <td className="py-2 px-4 text-sm text-[var(--foreground)]">
                              {item.description}
                            </td>
                            <td className="py-2 px-4 text-sm text-[var(--foreground)] text-right font-mono">
                              {formatCents(
                                Number(item.metadata?.monthlyCents) || item.unitPriceCents
                              )}
                              /mo
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[var(--border)]">
                          <td className="py-2 px-4 text-sm font-semibold text-[var(--foreground)] text-right">
                            Monthly Total
                          </td>
                          <td className="py-2 px-4 text-sm font-bold text-[var(--foreground)] text-right font-mono">
                            {formatCents(monthlyTotal)}/mo
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--muted-foreground)]">
                {order.paymentAmountCents > 0
                  ? `Total payment: ${formatCents(order.paymentAmountCents)} ${order.paymentCurrency.toUpperCase()}`
                  : 'No charge information available for this order.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Order Timeline                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <FiCalendar className="w-4 h-4" />
              Order Timeline
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 divide-y divide-[var(--border)]">
            <TimelineEvent label="Order Created" date={order.createdAt} />
            <TimelineEvent label="Payment Received" date={order.paidAt} />
            <TimelineEvent label="Order Completed" date={order.completedAt} />
            <TimelineEvent label="Last Updated" date={order.updatedAt} />
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Additional Details                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[var(--muted)]">
              <p className="text-xs text-[var(--muted-foreground)]">Organization ID</p>
              <p className="text-sm font-mono text-[var(--foreground)] mt-1">
                {order.organizationId ?? '\u2014'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--muted)]">
              <p className="text-xs text-[var(--muted-foreground)]">Admin User ID</p>
              <p className="text-sm font-mono text-[var(--foreground)] mt-1">
                {order.adminUserId ?? '\u2014'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--muted)]">
              <p className="text-xs text-[var(--muted-foreground)]">SMS Campaign</p>
              {order.smsCampaignRequested ? (
                order.smsReviewId ? (
                  <Link
                    href={`/admin/signups/reviews/${order.smsReviewId}`}
                    className="text-sm text-[var(--foreground)] hover:underline mt-1 flex items-center gap-1.5"
                  >
                    <FiMessageSquare className="w-3.5 h-3.5" />
                    View review #{order.smsReviewId}
                  </Link>
                ) : (
                  <p className="text-sm text-[var(--foreground)] mt-1 flex items-center gap-1.5">
                    <FiMessageSquare className="w-3.5 h-3.5 text-[var(--foreground)]" />
                    Requested
                  </p>
                )
              ) : (
                <p className="text-sm text-[var(--foreground)] mt-1">Not requested</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Reject Modal — requires a 10+ char reason. The reason flows into  */}
      {/* the customer-facing rejection email verbatim, so admin should     */}
      {/* phrase it as customer copy.                                       */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
        }}
        title="Reject Order"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-[var(--muted-foreground)]">
            Rejecting <strong>&ldquo;{order.businessName}&rdquo;</strong> will release any purchased
            phone numbers, refund the Stripe payment (if any), and email the customer with the
            reason below. This action cannot be undone.
          </p>
          <div>
            <label
              htmlFor="rejectReason"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Reason (sent to customer)
            </label>
            <textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-4 py-3 text-sm"
              placeholder="e.g. We were unable to verify your business information. Please re-apply with documentation showing..."
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Minimum 10 characters. {rejectReason.trim().length} / 2000
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
              disabled={rejectReason.trim().length < 10 || rejectMutation.isPending}
              loading={rejectMutation.isPending}
            >
              <FiX className="w-4 h-4" /> Reject Order
            </Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Authorize Modal                                                    */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmModal
        isOpen={showAuthorizeModal}
        onClose={() => setShowAuthorizeModal(false)}
        onConfirm={handleAuthorizeConfirm}
        title="Authorize Order"
        message={`Authorize "${order.businessName}"? This will activate their organization and user account, enabling dialer access.`}
        confirmText="Authorize"
        variant="info"
        loading={authorizeMutation.isPending}
      />
    </div>
  );
}
