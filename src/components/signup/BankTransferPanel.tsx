'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FiArrowLeft,
  FiCopy,
  FiCheck,
  FiUploadCloud,
  FiFileText,
  FiAlertCircle,
  FiLoader,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { onboardingApiService } from '@/lib/api/services/onboarding.service';

/** Bank details customers transfer to. Display-only, single source of truth. */
const BANK = {
  name: 'Bank Alfalah Limited',
  title: 'PAIDIX',
  account: '83501011226159',
  iban: 'PK82ALFH83501011226159',
  qr: '/bank-alfalah-qr.jpg',
};

const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

function Row({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </p>
        <p
          className={`truncate text-[var(--foreground)] ${mono ? 'font-mono text-[15px]' : 'font-medium'}`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        aria-label={`Copy ${label}`}
      >
        {copied ? <FiCheck className="h-3.5 w-3.5 text-green-600" /> : <FiCopy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

interface Props {
  token: string;
  amountLabel: string;
  onBack?: () => void;
}

/**
 * Manual bank-transfer payment. The customer transfers to the account (scan the
 * QR or copy the IBAN), uploads a screenshot of the confirmation, and submits —
 * the order then activates automatically. No card, no Stripe.
 */
export default function BankTransferPanel({ token, amountLabel, onBack }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { data } = await onboardingApiService.getBankTransferUploadUrl(token, {
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

  const handleSubmit = async () => {
    if (!proofKey) return;
    setSubmitting(true);
    setError(null);
    try {
      // Pass the origin so provisioning brands the org to this funnel (arixcall).
      const returnUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      await onboardingApiService.submitBankTransfer(token, proofKey, returnUrl);
      router.push(`/signup/${token}/success`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit — please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* How to pay */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          Transfer <span className="font-semibold text-[var(--foreground)]">{amountLabel}</span> to
          the account below (scan the QR in your banking app, or copy the IBAN), then upload a
          screenshot of the confirmation. Your account activates as soon as you submit.
        </p>
      </div>

      <div className="space-y-4">
        {/* QR on top, centered and large — scannable, not squeezed. */}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
          <Image
            src={BANK.qr}
            alt={`${BANK.name} payment QR`}
            width={220}
            height={275}
            className="h-auto w-[200px] max-w-full object-contain"
            unoptimized
          />
          <span className="text-xs text-neutral-500">Scan to pay with your banking app</span>
        </div>

        {/* Account details */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 divide-y divide-[var(--border)]">
          <Row label="Bank" value={BANK.name} mono={false} />
          <Row label="Account title" value={BANK.title} mono={false} />
          <Row label="Account number" value={BANK.account} />
          <Row label="IBAN" value={BANK.iban} />
          <Row label="Amount" value={amountLabel} mono={false} />
        </div>
      </div>

      {/* Upload proof */}
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
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3">
            <span className="inline-flex items-center gap-2 truncate text-sm font-medium text-[var(--foreground)]">
              <FiCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{fileName}</span>
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-xs font-medium text-[var(--coral-700)] hover:underline"
            >
              Replace
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] px-4 py-6 text-center transition hover:border-[var(--coral)]/50 hover:bg-[var(--muted)]/40 disabled:opacity-60"
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

      {error && (
        <div className="flex items-start gap-2 text-sm text-[var(--danger)]">
          <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3">
        {onBack && (
          <Button type="button" variant="outline" size="xl" onClick={onBack} className="flex-shrink-0">
            <FiArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Button
          variant="coral"
          onClick={handleSubmit}
          disabled={!proofKey || uploading || submitting}
          loading={submitting}
          size="xl"
          className="w-full"
        >
          {submitting ? 'Activating your account…' : "I've paid — submit & activate"}
        </Button>
      </div>
    </div>
  );
}
