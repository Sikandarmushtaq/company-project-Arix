import React, { useState, useRef } from 'react';
import Image from 'next/image';
import {
  FiCheck,
  FiCopy,
  FiUploadCloud,
  FiFileText,
  FiClock,
  FiAlertCircle,
  FiLoader,
} from 'react-icons/fi';
import { Button } from '@/components/ui';

const BANK_DETAILS = {
  name: 'Bank Alfalah Limited',
  title: 'PAIDIX',
  account: '83501011226159',
  iban: 'PK82ALFH83501011226159',
  qr: '/bank-alfalah-qr.jpg',
};

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

interface BankTransferPanelProps {
  amountLabel: string;
  onSubmit: (receipt: File) => void;
  isSubmitting: boolean;
}

function CopyItem({ label, value }: { label: string; value: string }) {
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
    <div className="flex items-center justify-between gap-3 py-2 px-3 hover:bg-[var(--muted)]/20 transition-colors">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className="truncate font-mono text-xs font-medium text-[var(--foreground)] mt-0.5">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      >
        {copied ? (
          <>
            <FiCheck className="h-3 w-3 text-emerald-600" />
            <span className="text-emerald-600 font-semibold">Copied</span>
          </>
        ) : (
          <>
            <FiCopy className="h-3 w-3" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

export function BankTransferPanel({
  amountLabel,
  onSubmit,
  isSubmitting,
}: BankTransferPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
      setFileError('Upload a PNG, JPEG, WebP, or PDF receipt.');
      setReceipt(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError('Receipt must be under 10 MB. Please upload a smaller file.');
      setReceipt(null);
      return;
    }
    if (file.size === 0) {
      setFileError('The selected receipt is empty. Please choose another file.');
      setReceipt(null);
      return;
    }

    setReceipt(file);
  };

  return (
    <div className="space-y-4">
      {/* Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
        <FiClock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          Transfer <strong>{amountLabel}</strong> to the account below and upload the receipt. Manual
          bank transfer requests are reviewed and activated <strong>within 12–24 hours</strong>.
        </div>
      </div>

      {/* QR Code and Bank Details */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden divide-y divide-[var(--border)]">
        {/* QR Code */}
        <div className="p-4 flex flex-col items-center justify-center bg-white text-zinc-900">
          <Image
            src={BANK_DETAILS.qr}
            alt="Bank Alfalah QR Code"
            width={180}
            height={225}
            className="h-auto w-[160px] object-contain rounded-md"
            unoptimized
          />
          <span className="text-[11px] text-zinc-500 mt-2">
            Scan with your mobile banking app
          </span>
        </div>

        {/* Bank Credentials */}
        <div className="divide-y divide-[var(--border)] bg-[var(--card)]">
          <CopyItem label="Bank Name" value={BANK_DETAILS.name} />
          <CopyItem label="Account Title" value={BANK_DETAILS.title} />
          <CopyItem label="Account Number" value={BANK_DETAILS.account} />
          <CopyItem label="IBAN" value={BANK_DETAILS.iban} />
        </div>
      </div>

      {/* Receipt Upload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--foreground)]">
            Payment Screenshot / Receipt
          </label>
          <span className="text-[11px] text-[var(--muted-foreground)]">Required</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileChange}
        />

        {receipt ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-xs">
            <span className="inline-flex items-center gap-2 truncate text-emerald-800 dark:text-emerald-200 font-medium">
              <FiCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="truncate">{receipt.name}</span>
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              Replace
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="flex w-full flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-[var(--border)] text-center transition-all hover:border-[var(--primary)]/60 hover:bg-[var(--muted)]/30 disabled:opacity-60"
          >
            {isSubmitting ? (
              <FiLoader className="w-5 h-5 animate-spin text-[var(--primary)]" />
            ) : (
              <FiUploadCloud className="w-5 h-5 text-[var(--muted-foreground)]" />
            )}
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {isSubmitting ? 'Uploading receipt...' : 'Click to select payment receipt'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
              <FiFileText className="w-3 h-3" /> PNG, JPEG, WebP or PDF · up to 10 MB
            </span>
          </button>
        )}

        {fileError && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1">
            <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}
      </div>

      {/* Submit CTA */}
      <Button
        type="button"
        onClick={() => receipt && onSubmit(receipt)}
        disabled={!receipt || isSubmitting}
        loading={isSubmitting}
        className="w-full h-10 text-xs font-semibold"
      >
        {isSubmitting ? 'Submitting request...' : 'Submit for approval'}
      </Button>
    </div>
  );
}
