'use client';

/**
 * Detail view for a card-less (bank-transfer) add-on request the org submitted —
 * opened from a row on the Numbers page. Shows the status, what was requested,
 * the amount, and (for a rejected/failed request) exactly why, so the owner can
 * act on it. Read-only: the org doesn't approve its own requests.
 */

import React from 'react';
import { Modal } from '@/components/ui';
import { formatCents } from '@/lib/utils/formatting';
import { formatPhoneUS } from '@/lib/utils/phone';
import type { AddonPurchaseRequest } from '@/lib/api/services/addon.service';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting approval',
  rejected: 'Rejected',
  failed: 'Failed',
  approved: 'Approved',
};

function title(r: AddonPurchaseRequest): string {
  if (r.addonType === 'number') return r.phoneNumber ? formatPhoneUS(r.phoneNumber) : 'New phone number';
  if (r.bundleSlug) return `${r.bundleSlug.replace(/sms/i, '').toUpperCase()} SMS package`;
  return 'SMS package';
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] py-2.5 text-sm last:border-0">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-right font-medium text-[var(--foreground)] break-words">{children}</span>
    </div>
  );
}

export default function RequestDetailModal({
  isOpen,
  onClose,
  request: r,
}: {
  isOpen: boolean;
  onClose: () => void;
  request: AddonPurchaseRequest;
}) {
  const dash = <span className="text-[var(--muted-foreground)]">—</span>;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title(r)} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status] ?? STATUS_STYLES.pending}`}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">Paid by bank transfer</span>
        </div>

        {/* The headline message — what the owner most needs to know. */}
        {r.status === 'pending' && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Your payment was received. An admin will review it and activate this shortly — usually
            within 12–24 hours.
          </p>
        )}
        {r.status === 'rejected' && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <p className="font-semibold">This request was rejected.</p>
            <p className="mt-1">{r.reviewNotes ? r.reviewNotes : 'Contact your administrator for details.'}</p>
          </div>
        )}
        {r.status === 'failed' && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <p className="font-semibold">This couldn&apos;t be activated.</p>
            <p className="mt-1">
              {r.errorMessage ? r.errorMessage : 'A provisioning error occurred.'} Your payment was
              not used — please contact support.
            </p>
          </div>
        )}

        <dl>
          <Row label="Type">{r.addonType === 'number' ? 'Phone number' : 'SMS package'}</Row>
          {r.addonType === 'number' && (
            <Row label="Number">{r.phoneNumber ? formatPhoneUS(r.phoneNumber) : dash}</Row>
          )}
          {r.addonType === 'number' && <Row label="Number type">{r.numberType ? r.numberType.replace(/_/g, ' ') : dash}</Row>}
          {r.addonType === 'number' && r.countryCode && <Row label="Country">{r.countryCode}</Row>}
          <Row label="Amount">
            {formatCents(r.amountCents)} <span className="font-normal text-[var(--muted-foreground)]">{r.currency?.toUpperCase()}</span>
          </Row>
          <Row label="Requested">{new Date(r.createdAt).toLocaleString()}</Row>
          {r.reviewedAt && (
            <Row label={r.status === 'rejected' ? 'Rejected' : 'Reviewed'}>{new Date(r.reviewedAt).toLocaleString()}</Row>
          )}
        </dl>
      </div>
    </Modal>
  );
}
