'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  FiUpload,
  FiFile,
  FiX,
  FiAlertCircle,
  FiArrowLeft,
  FiLoader,
  FiBriefcase,
  FiMessageSquare,
  FiShield,
} from 'react-icons/fi';
import { Card, CardContent, Input, Button, StyledSelect } from '@/components/ui';
import type { SmsCampaignPayload } from '@/lib/api/services/onboarding.service';
import { ENTITY_TYPES, VERTICALS, USE_CASES, STOCK_EXCHANGES, CAMPAIGN_DEFAULTS } from './tenDlcOptions';

/** A number eligible to be registered for SMS on this campaign. */
export interface TenDlcFormNumber {
  phoneNumber: string;
  countryCode: string;
  numberType: string;
}

/** Values used to pre-fill the brand section so the form isn't a blank slate. */
export interface TenDlcPrefill {
  legalCompanyName?: string;
  email?: string;
  phone?: string;
  street?: string;
  website?: string;
}

export interface TenDlcRegistrationFormProps {
  /** Numbers the user can enable for SMS. 10DLC is US-only, so only US numbers are eligible. */
  numbers: TenDlcFormNumber[];
  prefill?: TenDlcPrefill;
  /**
   * The owner's FULL prior submission (brand + campaign + numbers + documents).
   * When present (a resubmit after the admin bounced it back), the ENTIRE form
   * re-hydrates from it so the owner edits only what was flagged, instead of
   * re-entering everything. `prefill` is the first-time fallback (basics only).
   */
  submission?: SmsCampaignPayload | null;
  /** Presign a single document upload. Caller wires this to the right (token / auth) endpoint. */
  uploadFile: (file: {
    name: string;
    contentType: string;
    size: number;
  }) => Promise<{ uploadUrl: string; key: string }>;
  /** Submit the completed 10DLC payload. Throw to surface an inline error. */
  onSubmit: (payload: SmsCampaignPayload) => Promise<void>;
  submitting: boolean;
  /** Optional "skip for now" path — signup provides it; the org portal omits it. */
  onSkip?: () => Promise<void>;
  skipping?: boolean;
  onBack?: () => void;
  heading?: string;
  subheading?: React.ReactNode;
  submitLabel?: string;
}

interface UploadedFile {
  name: string;
  key: string;
  type: string;
  size: number;
  uploading?: boolean;
  error?: string;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.docx';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Local URL helpers (mirror BusinessDetailsStep's; kept local to avoid coupling).
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
function isValidUrl(raw: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  try {
    const u = new URL(normalizeUrl(v));
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-500)] text-white shadow-sm shadow-[var(--primary-600)]/30">
        {icon}
      </span>
      <div>
        <h3 className="text-base font-bold text-[var(--foreground)]">{title}</h3>
        <p className="text-sm text-[var(--muted-foreground)]">{desc}</p>
      </div>
    </div>
  );
}

/** Labelled textarea with an optional live character counter. */
function TextArea({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  rows = 2,
  min,
  max,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  rows?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const showCount = min !== undefined || max !== undefined;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
        {showCount && (
          <span
            className={`text-xs tabular-nums ${
              (min !== undefined && value.trim().length < min) ||
              (max !== undefined && value.length > max)
                ? 'text-[var(--danger)]'
                : 'text-[var(--muted-foreground)]'
            }`}
          >
            {value.length}
            {max !== undefined ? `/${max}` : ''}
          </span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
      />
      {error ? (
        <p className="mt-1.5 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] px-4 py-3 cursor-pointer hover:bg-[var(--muted)]/40 transition-colors">
      <span className="text-sm text-[var(--foreground)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[var(--primary-600)]' : 'bg-[var(--muted-foreground)]/30'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform mt-[2px] ${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </label>
  );
}

/**
 * Shared 10DLC (SMS) registration form. Presentational + self-contained: the
 * caller injects the number list, prefill values, an upload presigner and a
 * submit handler, so the exact same form powers both the signup wizard step
 * and the org portal's SMS Campaign page. See SmsCampaignStep (signup) and
 * app/org/(owner-only)/sms-campaign (portal) for the two wrappers.
 */
export default function TenDlcRegistrationForm({
  numbers,
  prefill,
  submission,
  uploadFile,
  onSubmit,
  submitting,
  onSkip,
  skipping,
  onBack,
  heading = 'Register for SMS (10DLC)',
  subheading,
  submitLabel = 'Submit registration',
}: TenDlcRegistrationFormProps) {
  // A bounced resubmit re-hydrates the whole form from the prior submission.
  const sb = submission?.brand;
  const sc = submission?.campaign;
  // 10DLC is US-only, so only US numbers are eligible / pre-selected. On a resubmit
  // restore the owner's prior number selection; otherwise default to all US numbers.
  const [smsNumbers, setSmsNumbers] = useState<Set<string>>(() =>
    submission?.smsNumbers?.length
      ? new Set(submission.smsNumbers)
      : new Set(numbers.filter((n) => n.countryCode === 'US').map((n) => n.phoneNumber))
  );

  // 10DLC registration is Standard-only (a registered business with an EIN).
  // Sole-proprietor was removed — every brand must provide an EIN.
  const registrationType = 'standard' as const;

  // Brand — re-hydrated from the prior submission on a resubmit; else prefilled
  // from the signup-order basics; else sensible defaults.
  const [brand, setBrand] = useState({
    legalCompanyName: sb?.legalCompanyName ?? prefill?.legalCompanyName ?? '',
    displayName: sb?.displayName ?? '',
    entityType: sb?.entityType ?? 'PRIVATE_PROFIT',
    ein: sb?.ein ?? '',
    firstName: sb?.firstName ?? '',
    lastName: sb?.lastName ?? '',
    vertical: sb?.vertical ?? 'PROFESSIONAL',
    email: sb?.email ?? prefill?.email ?? '',
    businessContactEmail: sb?.businessContactEmail ?? '',
    phone: sb?.phone ?? prefill?.phone ?? '',
    street: sb?.street ?? prefill?.street ?? '',
    city: sb?.city ?? '',
    state: sb?.state ?? '',
    postalCode: sb?.postalCode ?? '',
    country: sb?.country ?? 'US',
    website: sb?.website ?? prefill?.website ?? '',
    stockSymbol: sb?.stockSymbol ?? '',
    stockExchange: sb?.stockExchange ?? '',
  });
  const setBrandField = (k: keyof typeof brand, v: string) => setBrand((p) => ({ ...p, [k]: v }));

  // Campaign — sensible editable defaults so it's not a blank slate.
  const [campaign, setCampaign] = useState<{
    usecase: string;
    description: string;
    sample1: string;
    sample2: string;
    sample3: string;
    sample4: string;
    sample5: string;
    messageFlow: string;
    helpMessage: string;
    optinKeywords: string;
    optinMessage: string;
    optoutKeywords: string;
    optoutMessage: string;
    helpKeywords: string;
    termsUrl: string;
    privacyUrl: string;
    subscriberOptin: boolean;
    subscriberOptout: boolean;
    subscriberHelp: boolean;
    termsAndConditions: boolean;
    embeddedLink: boolean;
    embeddedLinkSample: string;
    embeddedPhone: boolean;
    ageGated: boolean;
    directLending: boolean;
    numberPool: boolean;
    subUsecases: string[];
  }>({
    // Re-hydrated from the prior submission on a resubmit; else editable defaults.
    // `??` (not `||`) so a deliberately-false boolean from a prior submit survives.
    usecase: sc?.usecase ?? 'MIXED',
    subUsecases: sc?.subUsecases ?? [],
    description: sc?.description ?? '',
    sample1: sc?.sample1 ?? '',
    sample2: sc?.sample2 ?? '',
    sample3: sc?.sample3 ?? '',
    sample4: sc?.sample4 ?? '',
    sample5: sc?.sample5 ?? '',
    messageFlow: sc?.messageFlow ?? '',
    helpMessage: sc?.helpMessage ?? CAMPAIGN_DEFAULTS.helpMessage,
    optinKeywords: sc?.optinKeywords ?? CAMPAIGN_DEFAULTS.optinKeywords,
    optinMessage: sc?.optinMessage ?? CAMPAIGN_DEFAULTS.optinMessage,
    optoutKeywords: sc?.optoutKeywords ?? CAMPAIGN_DEFAULTS.optoutKeywords,
    optoutMessage: sc?.optoutMessage ?? CAMPAIGN_DEFAULTS.optoutMessage,
    helpKeywords: sc?.helpKeywords ?? CAMPAIGN_DEFAULTS.helpKeywords,
    termsUrl: sc?.termsUrl ?? '',
    privacyUrl: sc?.privacyUrl ?? '',
    subscriberOptin: sc?.subscriberOptin ?? true,
    subscriberOptout: sc?.subscriberOptout ?? true,
    subscriberHelp: sc?.subscriberHelp ?? true,
    termsAndConditions: sc?.termsAndConditions ?? true,
    embeddedLink: sc?.embeddedLink ?? false,
    embeddedLinkSample: sc?.embeddedLinkSample ?? '',
    embeddedPhone: sc?.embeddedPhone ?? false,
    ageGated: sc?.ageGated ?? false,
    directLending: sc?.directLending ?? false,
    numberPool: sc?.numberPool ?? false,
  });
  const setCampaignField = <K extends keyof typeof campaign>(k: K, v: (typeof campaign)[K]) =>
    setCampaign((p) => ({ ...p, [k]: v }));

  // Restore previously-uploaded documents on a resubmit so they aren't re-uploaded
  // (they already carry a storage `key`, so they count as complete uploads).
  const [files, setFiles] = useState<UploadedFile[]>(() =>
    (submission?.documents ?? []).map((d) => ({
      name: d.name,
      key: d.key,
      type: d.type,
      size: d.size,
    }))
  );
  const [fileError, setFileError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setFileError('');
      const incoming = Array.from(fileList);
      let runningTotal = totalSize;
      for (const file of incoming) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setFileError(`"${file.name}" is not a supported file type. Use PDF, JPG, PNG, or DOCX.`);
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          setFileError(`"${file.name}" exceeds the 10 MB file size limit.`);
          return;
        }
        runningTotal += file.size;
        if (runningTotal > MAX_TOTAL_SIZE) {
          setFileError('Total upload size exceeds 50 MB.');
          return;
        }
      }

      for (const file of incoming) {
        const placeholder: UploadedFile = {
          name: file.name,
          key: '',
          type: file.type,
          size: file.size,
          uploading: true,
        };
        setFiles((prev) => [...prev, placeholder]);
        try {
          const { uploadUrl, key } = await uploadFile({
            name: file.name,
            contentType: file.type,
            size: file.size,
          });
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });
          if (!putRes.ok) throw new Error(`Upload failed (HTTP ${putRes.status})`);
          setFiles((prev) =>
            prev.map((f) => (f === placeholder ? { ...f, key, uploading: false, error: undefined } : f))
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          setFiles((prev) =>
            prev.map((f) => (f === placeholder ? { ...f, uploading: false, error: msg } : f))
          );
        }
      }
    },
    [uploadFile, totalSize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError('');
  }, []);

  const isUploading = files.some((f) => f.uploading);
  const uploadedFiles = files.filter((f) => !f.uploading && !f.error && f.key);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    // Brand
    if (!brand.legalCompanyName.trim()) e.legalCompanyName = 'Required';
    if (!brand.ein.trim()) e.ein = 'EIN is required';
    else if (!/^\d{2}-?\d{7}$/.test(brand.ein.trim())) e.ein = 'Enter a 9-digit EIN (e.g. 12-3456789)';
    if (!brand.email.trim()) e.email = 'Required';
    if (!brand.phone.trim()) e.phone = 'Required';
    if (!brand.street.trim()) e.street = 'Required';
    if (!brand.city.trim()) e.city = 'Required';
    if (!brand.state.trim()) e.state = 'Required';
    if (!brand.postalCode.trim()) e.postalCode = 'Required';
    // Business contact — TCR expects a named person on the brand.
    if (!brand.firstName.trim()) e.firstName = 'Required';
    if (!brand.lastName.trim()) e.lastName = 'Required';
    // Publicly-traded companies must supply stock info + a business contact email.
    if (brand.entityType === 'PUBLIC_PROFIT') {
      if (!brand.stockSymbol.trim()) e.stockSymbol = 'Required for public companies';
      if (!brand.stockExchange.trim()) e.stockExchange = 'Required for public companies';
      if (!brand.businessContactEmail.trim()) e.businessContactEmail = 'Required for public companies';
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(brand.businessContactEmail.trim()))
        e.businessContactEmail = 'Enter a valid email';
    }
    // Campaign
    if (campaign.description.trim().length < 40) e.description = 'Add at least 40 characters';
    if (!campaign.sample1.trim()) e.sample1 = 'Required';
    if (!campaign.sample2.trim()) e.sample2 = 'Required';
    if (campaign.messageFlow.trim().length < 40) e.messageFlow = 'Add at least 40 characters';
    if (campaign.messageFlow.length > 2048) e.messageFlow = 'Keep this under 2048 characters';
    if (!campaign.helpMessage.trim()) e.helpMessage = 'Required';
    if (!campaign.optinKeywords.trim()) e.optinKeywords = 'Required';
    if (!campaign.optoutKeywords.trim()) e.optoutKeywords = 'Required';
    if (!campaign.helpKeywords.trim()) e.helpKeywords = 'Required';
    if (!isValidUrl(campaign.termsUrl)) e.termsUrl = 'Enter a valid Terms URL';
    if (!isValidUrl(campaign.privacyUrl)) e.privacyUrl = 'Enter a valid Privacy Policy URL';
    // Opt-in / opt-out confirmation messages are required when attested.
    if (campaign.subscriberOptin && !campaign.optinMessage.trim()) e.optinMessage = 'Required';
    if (campaign.subscriberOptout && !campaign.optoutMessage.trim()) e.optoutMessage = 'Required';
    if (campaign.embeddedLink && !isValidUrl(campaign.embeddedLinkSample))
      e.embeddedLinkSample = 'Add a sample link (the campaign includes links)';
    if (
      campaign.usecase === 'MIXED' &&
      (campaign.subUsecases.length < 2 || campaign.subUsecases.length > 5)
    )
      e.subUsecases = 'Pick 2–5 sub use cases for a Mixed campaign';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErrors({});
    setFileError('');

    if (smsNumbers.size === 0) {
      setErrors({ _form: 'Enable at least one US number for SMS.' });
      return;
    }
    if (isUploading) {
      setFileError('Wait for all files to finish uploading.');
      return;
    }
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      // Scroll the first error into view for long forms.
      const firstField = Object.keys(v)[0];
      document.getElementById(`tendlc-${firstField}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const isPublic = brand.entityType === 'PUBLIC_PROFIT';
    const payload: SmsCampaignPayload = {
      registrationType,
      brand: {
        legalCompanyName: brand.legalCompanyName.trim(),
        displayName: brand.displayName.trim() || undefined,
        entityType: brand.entityType,
        // TCR wants 9 bare digits — drop any formatting dash the user typed.
        ein: brand.ein.replace(/\D/g, ''),
        firstName: brand.firstName.trim(),
        lastName: brand.lastName.trim(),
        vertical: brand.vertical,
        email: brand.email.trim(),
        businessContactEmail: brand.businessContactEmail.trim() || undefined,
        phone: brand.phone.trim(),
        street: brand.street.trim(),
        city: brand.city.trim(),
        state: brand.state.trim(),
        postalCode: brand.postalCode.trim(),
        country: brand.country,
        website: normalizeUrl(brand.website) || undefined,
        stockSymbol: isPublic ? brand.stockSymbol.trim() || undefined : undefined,
        stockExchange: isPublic ? brand.stockExchange.trim() || undefined : undefined,
      },
      campaign: {
        usecase: campaign.usecase,
        subUsecases: campaign.usecase === 'MIXED' ? campaign.subUsecases : undefined,
        description: campaign.description.trim(),
        sample1: campaign.sample1.trim(),
        sample2: campaign.sample2.trim(),
        sample3: campaign.sample3.trim() || undefined,
        sample4: campaign.sample4.trim() || undefined,
        sample5: campaign.sample5.trim() || undefined,
        messageFlow: campaign.messageFlow.trim(),
        helpMessage: campaign.helpMessage.trim(),
        optinKeywords: campaign.optinKeywords.trim(),
        optinMessage: campaign.optinMessage.trim() || undefined,
        optoutKeywords: campaign.optoutKeywords.trim(),
        optoutMessage: campaign.optoutMessage.trim() || undefined,
        helpKeywords: campaign.helpKeywords.trim(),
        termsUrl: normalizeUrl(campaign.termsUrl),
        privacyUrl: normalizeUrl(campaign.privacyUrl),
        subscriberOptin: campaign.subscriberOptin,
        subscriberOptout: campaign.subscriberOptout,
        subscriberHelp: campaign.subscriberHelp,
        termsAndConditions: campaign.termsAndConditions,
        embeddedLink: campaign.embeddedLink,
        embeddedLinkSample: campaign.embeddedLink
          ? normalizeUrl(campaign.embeddedLinkSample) || undefined
          : undefined,
        embeddedPhone: campaign.embeddedPhone,
        ageGated: campaign.ageGated,
        directLending: campaign.directLending,
        numberPool: campaign.numberPool,
      },
      smsNumbers: Array.from(smsNumbers),
      documents: uploadedFiles.map(({ name, key, type, size }) => ({ name, key, type, size })),
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : 'Could not submit your SMS registration.',
      });
    }
  };

  const handleSkip = async () => {
    await onSkip?.();
  };

  const err = (k: string) => errors[k];
  const hasEligible = numbers.some((n) => n.countryCode === 'US');

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-6 md:p-8">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-1.5">{heading}</h2>
          {subheading !== undefined ? (
            <div className="text-[var(--muted-foreground)] mb-6 text-sm">{subheading}</div>
          ) : (
            <p className="text-[var(--muted-foreground)] mb-6 text-sm">
              US carriers require every business texting number to be registered (10DLC). We&apos;ll
              submit your own brand &amp; campaign to the carriers for review.
            </p>
          )}

          {errors._form && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4">
              <FiAlertCircle className="w-5 h-5 text-[var(--danger)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--danger)]">{errors._form}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Numbers to register */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Numbers to register <span className="text-[var(--danger)]">*</span>
              </label>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Choose which of your numbers to enable for SMS.
              </p>
              {numbers.length === 0 ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 text-sm text-[var(--muted-foreground)]">
                  You don&apos;t have any numbers yet. Purchase a US number first, then register it
                  for SMS here.
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                  {numbers.map((num) => {
                    const enabled = smsNumbers.has(num.phoneNumber);
                    const eligible = num.countryCode === 'US'; // 10DLC is US-only
                    return (
                      <label
                        key={num.phoneNumber}
                        className={`flex items-center justify-between px-4 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          eligible ? 'cursor-pointer hover:bg-[var(--muted)]/50' : 'opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-[var(--foreground)]">
                            {num.phoneNumber}
                          </span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {num.countryCode} &middot; {num.numberType}
                          </span>
                          {!eligible && (
                            <span className="text-xs text-[var(--muted-foreground)]">· SMS: US only</span>
                          )}
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          disabled={!eligible}
                          onClick={() =>
                            setSmsNumbers((prev) => {
                              const next = new Set(prev);
                              if (next.has(num.phoneNumber)) next.delete(num.phoneNumber);
                              else next.add(num.phoneNumber);
                              return next;
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
                            enabled ? 'bg-[var(--primary-600)]' : 'bg-[var(--muted-foreground)]/30'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform mt-[2px] ${
                              enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                            }`}
                          />
                        </button>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {smsNumbers.size === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 text-sm text-[var(--muted-foreground)]">
                {hasEligible
                  ? 'Enable at least one number above to register an SMS campaign.'
                  : 'Only US numbers can be registered for SMS (10DLC).'}
              </div>
            ) : (
              <>
                {/* Brand */}
                <section className="space-y-5 border-t border-[var(--border)] pt-6">
                  <SectionHeader
                    icon={<FiBriefcase className="h-[18px] w-[18px]" />}
                    title="Business details"
                    desc="The legal entity behind the messages (your 10DLC brand)."
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div id="tendlc-legalCompanyName">
                      <Input
                        label="Legal company name"
                        value={brand.legalCompanyName}
                        onChange={(e) => setBrandField('legalCompanyName', e.target.value)}
                        error={err('legalCompanyName')}
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="entityType"
                        className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                      >
                        Entity type
                      </label>
                      <StyledSelect
                        id="entityType"
                        value={brand.entityType}
                        onChange={(v) => setBrandField('entityType', v)}
                      >
                        {ENTITY_TYPES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </StyledSelect>
                    </div>
                    <div id="tendlc-ein">
                      <Input
                        label="EIN / Tax ID"
                        value={brand.ein}
                        onChange={(e) => setBrandField('ein', e.target.value)}
                        error={err('ein')}
                        placeholder="12-3456789"
                        required
                      />
                    </div>
                    <div id="tendlc-displayName">
                      <Input
                        label="DBA / brand name (optional)"
                        value={brand.displayName}
                        onChange={(e) => setBrandField('displayName', e.target.value)}
                        placeholder="Defaults to your legal company name"
                      />
                    </div>
                    <div id="tendlc-firstName">
                      <Input
                        label="Contact first name"
                        value={brand.firstName}
                        onChange={(e) => setBrandField('firstName', e.target.value)}
                        error={err('firstName')}
                        required
                      />
                    </div>
                    <div id="tendlc-lastName">
                      <Input
                        label="Contact last name"
                        value={brand.lastName}
                        onChange={(e) => setBrandField('lastName', e.target.value)}
                        error={err('lastName')}
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="vertical"
                        className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                      >
                        Industry
                      </label>
                      <StyledSelect
                        id="vertical"
                        value={brand.vertical}
                        onChange={(v) => setBrandField('vertical', v)}
                      >
                        {VERTICALS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </StyledSelect>
                    </div>
                    <div id="tendlc-email">
                      <Input
                        label="Business email"
                        type="email"
                        value={brand.email}
                        onChange={(e) => setBrandField('email', e.target.value)}
                        error={err('email')}
                        required
                      />
                    </div>
                    <div id="tendlc-phone">
                      <Input
                        label="Business phone"
                        value={brand.phone}
                        onChange={(e) => setBrandField('phone', e.target.value)}
                        error={err('phone')}
                        required
                      />
                    </div>
                    <Input
                      label="Website"
                      value={brand.website}
                      onChange={(e) => setBrandField('website', e.target.value)}
                      placeholder="e.g. yourcompany.com"
                    />
                    {brand.entityType === 'PUBLIC_PROFIT' && (
                      <>
                        <div className="md:col-span-2 mt-1 text-xs text-[var(--muted-foreground)]">
                          Publicly-traded companies must provide stock details and a business contact
                          email.
                        </div>
                        <div id="tendlc-businessContactEmail">
                          <Input
                            label="Business contact email"
                            type="email"
                            value={brand.businessContactEmail}
                            onChange={(e) => setBrandField('businessContactEmail', e.target.value)}
                            error={err('businessContactEmail')}
                            required
                          />
                        </div>
                        <div id="tendlc-stockSymbol">
                          <Input
                            label="Stock symbol"
                            value={brand.stockSymbol}
                            onChange={(e) => setBrandField('stockSymbol', e.target.value)}
                            error={err('stockSymbol')}
                            placeholder="e.g. AAPL"
                            required
                          />
                        </div>
                        <div id="tendlc-stockExchange">
                          <label
                            htmlFor="stockExchange"
                            className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                          >
                            Stock exchange
                          </label>
                          <StyledSelect
                            id="stockExchange"
                            value={brand.stockExchange}
                            onChange={(v) => setBrandField('stockExchange', v)}
                          >
                            <option value="">Select…</option>
                            {STOCK_EXCHANGES.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </StyledSelect>
                          {err('stockExchange') && (
                            <p className="mt-1 text-xs text-[var(--danger)]">{err('stockExchange')}</p>
                          )}
                        </div>
                      </>
                    )}
                    <div className="md:col-span-2" id="tendlc-street">
                      <Input
                        label="Street address"
                        value={brand.street}
                        onChange={(e) => setBrandField('street', e.target.value)}
                        error={err('street')}
                        required
                      />
                    </div>
                    <div id="tendlc-city">
                      <Input
                        label="City"
                        value={brand.city}
                        onChange={(e) => setBrandField('city', e.target.value)}
                        error={err('city')}
                        required
                      />
                    </div>
                    <div id="tendlc-state">
                      <Input
                        label="State / Province"
                        value={brand.state}
                        onChange={(e) => setBrandField('state', e.target.value)}
                        error={err('state')}
                        required
                      />
                    </div>
                    <div id="tendlc-postalCode">
                      <Input
                        label="Postal code"
                        value={brand.postalCode}
                        onChange={(e) => setBrandField('postalCode', e.target.value)}
                        error={err('postalCode')}
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="country"
                        className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                      >
                        Country
                      </label>
                      {/* 10DLC / TCR is US-only, so the brand country is fixed to US. */}
                      <StyledSelect
                        id="country"
                        value={brand.country}
                        onChange={(v) => setBrandField('country', v)}
                      >
                        <option value="US">United States</option>
                      </StyledSelect>
                    </div>
                  </div>
                </section>

                {/* Campaign */}
                <section className="space-y-5 border-t border-[var(--border)] pt-6">
                  <SectionHeader
                    icon={<FiMessageSquare className="h-[18px] w-[18px]" />}
                    title="Campaign details"
                    desc="What you'll text and how people opt in — carriers review this."
                  />
                  <div>
                    <label
                      htmlFor="usecase"
                      className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                    >
                      Use case
                    </label>
                    <StyledSelect
                      id="usecase"
                      value={campaign.usecase}
                      onChange={(v) => setCampaignField('usecase', v)}
                    >
                      {USE_CASES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </StyledSelect>
                  </div>

                  {campaign.usecase === 'MIXED' && (
                    <div id="tendlc-subUsecases">
                      <p className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Sub use cases{' '}
                        <span className="text-[var(--muted-foreground)] font-normal">
                          (pick 2–5 for a Mixed campaign)
                        </span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {USE_CASES.filter((o) => o.value !== 'MIXED').map((o) => {
                          const checked = campaign.subUsecases.includes(o.value);
                          return (
                            <label
                              key={o.value}
                              className="flex items-center gap-2 text-sm cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-[var(--muted)]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setCampaign((p) => ({
                                    ...p,
                                    subUsecases: e.target.checked
                                      ? [...p.subUsecases, o.value]
                                      : p.subUsecases.filter((x) => x !== o.value),
                                  }))
                                }
                                className="h-4 w-4 accent-[var(--primary-600)]"
                              />
                              <span>{o.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      {err('subUsecases') && (
                        <p className="mt-1 text-xs text-[var(--danger)]">{err('subUsecases')}</p>
                      )}
                    </div>
                  )}

                  <div id="tendlc-description">
                    <TextArea
                      id="description"
                      label="Campaign description"
                      value={campaign.description}
                      onChange={(v) => setCampaignField('description', v)}
                      error={err('description')}
                      hint="Explain what this campaign is for (min 40 characters)."
                      rows={3}
                      min={40}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <div id="tendlc-sample1">
                      <TextArea
                        id="sample1"
                        label="Sample message 1"
                        value={campaign.sample1}
                        onChange={(v) => setCampaignField('sample1', v)}
                        error={err('sample1')}
                        hint="A realistic message. Include opt-out language, e.g. 'Reply STOP to unsubscribe.'"
                        rows={2}
                      />
                    </div>
                    <div id="tendlc-sample2">
                      <TextArea
                        id="sample2"
                        label="Sample message 2"
                        value={campaign.sample2}
                        onChange={(v) => setCampaignField('sample2', v)}
                        error={err('sample2')}
                        rows={2}
                      />
                    </div>
                    <div id="tendlc-sample3">
                      <TextArea
                        id="sample3"
                        label="Sample message 3 (recommended)"
                        value={campaign.sample3}
                        onChange={(v) => setCampaignField('sample3', v)}
                        hint="More realistic samples improve approval — some use cases require 3+."
                        rows={2}
                      />
                    </div>
                    <div id="tendlc-sample4">
                      <TextArea
                        id="sample4"
                        label="Sample message 4 (optional)"
                        value={campaign.sample4}
                        onChange={(v) => setCampaignField('sample4', v)}
                        rows={2}
                      />
                    </div>
                    <div id="tendlc-sample5">
                      <TextArea
                        id="sample5"
                        label="Sample message 5 (optional)"
                        value={campaign.sample5}
                        onChange={(v) => setCampaignField('sample5', v)}
                        rows={2}
                      />
                    </div>
                  </div>

                  <div id="tendlc-messageFlow">
                    <TextArea
                      id="messageFlow"
                      label="Opt-in / message flow"
                      value={campaign.messageFlow}
                      onChange={(v) => setCampaignField('messageFlow', v)}
                      error={err('messageFlow')}
                      hint="How do people consent to receive texts? (e.g. a web form, checkbox at checkout). Min 40 characters."
                      rows={3}
                      min={40}
                      max={2048}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div id="tendlc-optinKeywords">
                      <Input
                        label="Opt-in keywords"
                        value={campaign.optinKeywords}
                        onChange={(e) => setCampaignField('optinKeywords', e.target.value)}
                        error={err('optinKeywords')}
                      />
                    </div>
                    <div id="tendlc-optoutKeywords">
                      <Input
                        label="Opt-out keywords"
                        value={campaign.optoutKeywords}
                        onChange={(e) => setCampaignField('optoutKeywords', e.target.value)}
                        error={err('optoutKeywords')}
                      />
                    </div>
                    <div id="tendlc-helpKeywords">
                      <Input
                        label="Help keywords"
                        value={campaign.helpKeywords}
                        onChange={(e) => setCampaignField('helpKeywords', e.target.value)}
                        error={err('helpKeywords')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div id="tendlc-optinMessage">
                      <TextArea
                        id="optinMessage"
                        label="Opt-in confirmation message"
                        value={campaign.optinMessage}
                        onChange={(v) => setCampaignField('optinMessage', v)}
                        error={err('optinMessage')}
                        hint="Sent when someone opts in to your messages."
                        rows={2}
                      />
                    </div>
                    <div id="tendlc-optoutMessage">
                      <TextArea
                        id="optoutMessage"
                        label="Opt-out (STOP) confirmation"
                        value={campaign.optoutMessage}
                        onChange={(v) => setCampaignField('optoutMessage', v)}
                        error={err('optoutMessage')}
                        hint="Sent when someone texts STOP."
                        rows={2}
                      />
                    </div>
                  </div>

                  <div id="tendlc-helpMessage">
                    <TextArea
                      id="helpMessage"
                      label="Help message"
                      value={campaign.helpMessage}
                      onChange={(v) => setCampaignField('helpMessage', v)}
                      error={err('helpMessage')}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div id="tendlc-termsUrl">
                      <Input
                        label="Terms & Conditions URL"
                        value={campaign.termsUrl}
                        onChange={(e) => setCampaignField('termsUrl', e.target.value)}
                        error={err('termsUrl')}
                        placeholder="e.g. yourcompany.com/terms"
                        required
                      />
                    </div>
                    <div id="tendlc-privacyUrl">
                      <Input
                        label="Privacy Policy URL"
                        value={campaign.privacyUrl}
                        onChange={(e) => setCampaignField('privacyUrl', e.target.value)}
                        error={err('privacyUrl')}
                        placeholder="e.g. yourcompany.com/privacy"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                        Consent &amp; support (attested to carriers)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Toggle
                          checked={campaign.subscriberOptin}
                          onChange={(v) => setCampaignField('subscriberOptin', v)}
                          label="Subscribers can opt in"
                        />
                        <Toggle
                          checked={campaign.subscriberOptout}
                          onChange={(v) => setCampaignField('subscriberOptout', v)}
                          label="Subscribers can opt out (STOP)"
                        />
                        <Toggle
                          checked={campaign.subscriberHelp}
                          onChange={(v) => setCampaignField('subscriberHelp', v)}
                          label="Subscribers can get help (HELP)"
                        />
                        <Toggle
                          checked={campaign.termsAndConditions}
                          onChange={(v) => setCampaignField('termsAndConditions', v)}
                          label="A call-to-action + terms are published"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)] mb-2">Message content</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Toggle
                          checked={campaign.embeddedLink}
                          onChange={(v) => setCampaignField('embeddedLink', v)}
                          label="Messages contain links"
                        />
                        <Toggle
                          checked={campaign.embeddedPhone}
                          onChange={(v) => setCampaignField('embeddedPhone', v)}
                          label="Messages contain phone numbers"
                        />
                        <Toggle
                          checked={campaign.ageGated}
                          onChange={(v) => setCampaignField('ageGated', v)}
                          label="Age-gated content"
                        />
                        <Toggle
                          checked={campaign.directLending}
                          onChange={(v) => setCampaignField('directLending', v)}
                          label="Direct lending / loan arrangement"
                        />
                        <Toggle
                          checked={campaign.numberPool}
                          onChange={(v) => setCampaignField('numberPool', v)}
                          label="Uses a number pool (50+ numbers)"
                        />
                      </div>
                    </div>
                    {campaign.embeddedLink && (
                      <div id="tendlc-embeddedLinkSample">
                        <Input
                          label="Sample link used in messages"
                          value={campaign.embeddedLinkSample}
                          onChange={(e) => setCampaignField('embeddedLinkSample', e.target.value)}
                          error={err('embeddedLinkSample')}
                          placeholder="e.g. yourcompany.com/promo"
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Documents (optional) */}
                <section className="space-y-3 border-t border-[var(--border)] pt-6">
                  <SectionHeader
                    icon={<FiShield className="h-[18px] w-[18px]" />}
                    title="Supporting documents (optional)"
                    desc="Business license or registration — speeds up review."
                  />
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-[var(--primary-600)] bg-[var(--primary-600)]/5'
                        : 'border-[var(--border)] hover:border-[var(--primary-600)]/40'
                    }`}
                  >
                    <FiUpload
                      className={`w-8 h-8 mb-3 ${isDragOver ? 'text-[var(--primary-600)]' : 'text-[var(--muted-foreground)]'}`}
                    />
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {isDragOver ? 'Drop files here' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      PDF, JPG, PNG, DOCX up to 10 MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      multiple
                      onChange={(e) => {
                        if (e.target.files) processFiles(e.target.files);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </div>
                  {fileError && (
                    <div className="flex items-start gap-2 text-sm text-[var(--danger)]">
                      <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{fileError}</span>
                    </div>
                  )}
                  {files.length > 0 && (
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                            file.error
                              ? 'border-[var(--danger)]/40 bg-[var(--danger)]/5'
                              : 'border-[var(--border)] bg-[var(--muted)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {file.uploading ? (
                              <FiLoader className="w-4 h-4 text-[var(--primary-600)] shrink-0 animate-spin" />
                            ) : file.error ? (
                              <FiAlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
                            ) : (
                              <FiFile className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
                            )}
                            <span className="text-sm text-[var(--foreground)] truncate">
                              {file.name}
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                              {formatFileSize(file.size)}
                            </span>
                            {file.error && (
                              <span className="text-xs text-[var(--danger)] truncate" title={file.error}>
                                {file.error}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            className="text-[var(--muted-foreground)] hover:text-[var(--danger)] transition-colors ml-2"
                            aria-label={`Remove ${file.name}`}
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <p className="rounded-lg bg-[var(--muted)]/40 border border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)]">
                  Your registration is reviewed before it&apos;s submitted to the carriers. Carrier
                  approval is typically quick but can take up to a few days — you&apos;ll be able to
                  send SMS once it&apos;s approved.
                </p>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {onBack && (
                <Button type="button" variant="outline" onClick={onBack} className="flex-shrink-0">
                  <FiArrowLeft className="w-4 h-4" />
                </Button>
              )}
              {onSkip && smsNumbers.size === 0 ? (
                <Button
                  type="button"
                  onClick={handleSkip}
                  loading={skipping}
                  disabled={skipping}
                  className="flex-1"
                >
                  Continue without SMS
                </Button>
              ) : (
                <>
                  {onSkip && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSkip}
                      loading={skipping}
                      className="flex-1"
                    >
                      Skip for now
                    </Button>
                  )}
                  <Button
                    type="submit"
                    loading={submitting}
                    disabled={submitting || isUploading || smsNumbers.size === 0}
                    className="flex-1"
                  >
                    {submitting ? 'Submitting…' : isUploading ? 'Uploading…' : submitLabel}
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
