'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  FiArrowLeft,
  FiCreditCard,
  FiHome,
  FiCheck,
  FiCopy,
  FiUploadCloud,
  FiFileText,
  FiAlertCircle,
  FiLoader,
  FiZap,
  FiClock,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { addonApiService, type AddonInput } from '@/lib/api/services/addon.service';
import { toast } from '@/lib/stores/toast';

/** Bank details for manual transfer — single source of truth (mirrors signup). */
const BANK = {
  name: 'Bank Alfalah Limited',
  title: 'PAIDIX',
  account: '83501011226159',
  iban: 'PK82ALFH83501011226159',
  qr: '/bank-alfalah-qr.jpg',
};

const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  addon: AddonInput;
  /** What they're buying, e.g. "3,000 SMS package" or "(415) 555-0100". */
  label: string;
  /** Amount to pay now, e.g. "$79.00". */
  amountLabel: string;
  onBack?: () => void;
  /** Called after a bank-transfer request is submitted (parent closes + refreshes). */
  onSubmitted?: () => void;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className="truncate font-mono text-[13px] text-[var(--foreground)]">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      >
        {copied ? <FiCheck className="h-3.5 w-3.5 text-green-600" /> : <FiCopy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * Payment chooser for a card-less org buying an add-on (number / SMS package):
 *  - Card: full Stripe checkout (bootstraps card + subscription) → activates
 *    instantly and auto-renews.
 *  - Bank transfer: shows the account + QR, takes a payment-proof screenshot,
 *    and files a request that an admin approves within 12–24 hours.
 */
export default function AddonPayChoice({ addon, label, amountLabel, onBack, onSubmitted }: Props) {
  const [method, setMethod] = useState<'card' | 'bank'>('card');
  const [redirecting, setRedirecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payByCard = async () => {
    setRedirecting(true);
    setError(null);
    try {
      const res = await addonApiService.cardCheckout(addon);
      window.location.href = res.data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start card checkout.');
      setRedirecting(false);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setProofKey(null);
    setFileName(file.name);
    if (file.size > MAX_BYTES) {
      setError('File is larger than 10 MB — please upload a smaller screenshot.');
      setFileName(null);
      return;
    }
    setUploading(true);
    try {
      const { data } = await addonApiService.getUploadUrl({
        name: file.name,
        contentType: file.type,
        size: file.size,
      });
      const put = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (HTTP ${put.status})`);
      setProofKey(data.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed — please try again.');
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const submitBank = async () => {
    if (!proofKey) return;
    setSubmitting(true);
    setError(null);
    try {
      await addonApiService.submitBankTransfer(addon, proofKey);
      toast.success('Payment submitted — we’ll activate this within 12–24 hours.');
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit — please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
          <span className="text-lg font-bold text-[var(--foreground)]">{amountLabel}</span>
        </div>
      </div>

      {/* Method toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] p-1">
        {(
          [
            ['card', 'Pay by card', FiCreditCard],
            ['bank', 'Bank transfer', FiHome],
          ] as const
        ).map(([key, text, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMethod(key)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              method === key
                ? 'bg-[var(--primary-600)] text-white'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {text}
          </button>
        ))}
      </div>

      {method === 'card' ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <FiZap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              Pay by card to activate <strong>instantly</strong>. Your card is saved and this add-on
              renews automatically each month — cancel anytime.
            </p>
          </div>
          <Button onClick={payByCard} loading={redirecting} size="lg" className="w-full">
            {!redirecting && <FiCreditCard className="mr-1.5 h-4 w-4" />}
            {redirecting ? 'Redirecting to secure checkout…' : `Pay ${amountLabel} with card`}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Transfer <strong>{amountLabel}</strong> to the account below and upload the receipt.
              We review and activate manual transfers <strong>within 12–24 hours</strong>.
            </p>
          </div>

          <div className="space-y-4">
            {/* QR on top, centered and large — scannable, not squeezed. */}
            <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
              <Image
                src={BANK.qr}
                alt="Payment QR"
                width={220}
                height={275}
                className="h-auto w-[200px] max-w-full object-contain"
                unoptimized
              />
              <span className="text-xs text-neutral-500">Scan to pay with your banking app</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 divide-y divide-[var(--border)]">
              <CopyRow label="Bank" value={BANK.name} />
              <CopyRow label="Account title" value={BANK.title} />
              <CopyRow label="Account number" value={BANK.account} />
              <CopyRow label="IBAN" value={BANK.iban} />
            </div>
          </div>

          {/* Upload */}
          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">
              Upload payment screenshot
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            {proofKey && fileName ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
                <span className="inline-flex items-center gap-2 truncate text-sm text-green-800 dark:text-green-200">
                  <FiCheck className="h-4 w-4 shrink-0" />
                  <span className="truncate">{fileName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 text-xs font-medium text-[var(--primary-600)] hover:underline"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] px-4 py-5 text-center transition hover:border-[var(--primary-600)]/50 hover:bg-[var(--muted)]/40 disabled:opacity-60"
              >
                {uploading ? (
                  <FiLoader className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
                ) : (
                  <FiUploadCloud className="h-6 w-6 text-[var(--muted-foreground)]" />
                )}
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {uploading ? 'Uploading…' : 'Click to upload'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <FiFileText className="h-3.5 w-3.5" /> PNG, JPEG, WebP or PDF · up to 10 MB
                </span>
              </button>
            )}
          </div>

          <Button
            onClick={submitBank}
            disabled={!proofKey || uploading || submitting}
            loading={submitting}
            size="lg"
            className="w-full"
          >
            {submitting ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-[var(--danger)]">
          <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {onBack && (
        <div>
          <Button variant="outline" size="sm" onClick={onBack} disabled={redirecting || submitting}>
            <FiArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </div>
      )}
    </div>
  );
}
