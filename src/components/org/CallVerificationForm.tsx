'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FiBriefcase, FiUpload, FiFile, FiX, FiLoader, FiAlertCircle } from 'react-icons/fi';
import { Card, CardContent, Input, Button, StyledSelect } from '@/components/ui';
import { ENTITY_TYPES, VERTICALS } from '@/components/signup/tenDlcOptions';

/** Business-KYC payload submitted to unlock uncapped calling. NO SMS-campaign fields. */
export interface CallVerificationPayload {
  registrationType: 'standard' | 'sole_prop';
  brand: {
    legalCompanyName: string;
    entityType?: string;
    ein?: string;
    vertical: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: 'US' | 'CA';
    website?: string;
  };
  documents: Array<{ name: string; key: string; type: string; size: number }>;
}

export interface CallVerificationPrefill {
  registrationType?: 'standard' | 'sole_prop';
  legalCompanyName?: string;
  entityType?: string;
  ein?: string;
  vertical?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: 'US' | 'CA';
  website?: string;
}

interface Props {
  prefill?: CallVerificationPrefill;
  onSubmit: (payload: CallVerificationPayload) => Promise<void>;
  submitting: boolean;
  /** Optional presign for document uploads. When omitted, the documents section is hidden. */
  uploadFile?: (file: {
    name: string;
    contentType: string;
    size: number;
  }) => Promise<{ uploadUrl: string; key: string }>;
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
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
        <FiBriefcase className="h-[18px] w-[18px]" />
      </span>
      <div>
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="text-sm text-[var(--muted-foreground)]">{desc}</p>
      </div>
    </div>
  );
}

export function CallVerificationForm({ prefill, onSubmit, submitting, uploadFile }: Props) {
  const [registrationType, setRegistrationType] = useState<'standard' | 'sole_prop'>(
    prefill?.registrationType ?? 'standard'
  );
  const [brand, setBrand] = useState({
    legalCompanyName: prefill?.legalCompanyName ?? '',
    entityType: prefill?.entityType ?? 'PRIVATE_PROFIT',
    ein: prefill?.ein ?? '',
    vertical: prefill?.vertical ?? (VERTICALS[0]?.value ?? ''),
    email: prefill?.email ?? '',
    phone: prefill?.phone ?? '',
    street: prefill?.street ?? '',
    city: prefill?.city ?? '',
    state: prefill?.state ?? '',
    postalCode: prefill?.postalCode ?? '',
    country: (prefill?.country ?? 'US') as 'US' | 'CA',
    website: prefill?.website ?? '',
  });
  const [documents, setDocuments] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStandard = registrationType === 'standard';

  const setField = (k: keyof typeof brand, v: string) => setBrand((b) => ({ ...b, [k]: v }));
  const err = (k: string) => errors[k];

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !uploadFile) return;
      for (const file of Array.from(files)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setFormError(`${file.name}: unsupported type (PDF, JPG, PNG, or DOCX only).`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setFormError(`${file.name}: exceeds 15 MB.`);
          continue;
        }
        const placeholder: UploadedFile = {
          name: file.name,
          key: '',
          type: file.type,
          size: file.size,
          uploading: true,
        };
        setDocuments((d) => [...d, placeholder]);
        try {
          const { uploadUrl, key } = await uploadFile({
            name: file.name,
            contentType: file.type,
            size: file.size,
          });
          await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          setDocuments((d) =>
            d.map((x) => (x === placeholder ? { ...x, key, uploading: false } : x))
          );
        } catch {
          setDocuments((d) =>
            d.map((x) => (x === placeholder ? { ...x, uploading: false, error: 'Upload failed' } : x))
          );
        }
      }
    },
    [uploadFile]
  );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (brand.legalCompanyName.trim().length < 2) e.legalCompanyName = 'Required';
    if (!brand.vertical) e.vertical = 'Required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(brand.email)) e.email = 'Valid email required';
    if (brand.phone.trim().length < 7) e.phone = 'Required';
    if (!brand.street.trim()) e.street = 'Required';
    if (!brand.city.trim()) e.city = 'Required';
    if (!brand.state.trim()) e.state = 'Required';
    if (!brand.postalCode.trim()) e.postalCode = 'Required';
    if (isStandard && !/^\d{2}-?\d{7}$/.test(brand.ein)) e.ein = 'EIN must be 9 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    const ein = brand.ein.replace(/-/g, '');
    try {
      await onSubmit({
        registrationType,
        brand: {
          legalCompanyName: brand.legalCompanyName.trim(),
          ...(isStandard ? { entityType: brand.entityType, ein } : {}),
          vertical: brand.vertical,
          email: brand.email.trim(),
          phone: brand.phone.trim(),
          street: brand.street.trim(),
          city: brand.city.trim(),
          state: brand.state.trim(),
          postalCode: brand.postalCode.trim(),
          country: brand.country,
          website: brand.website.trim() || undefined,
        },
        documents: documents
          .filter((d) => d.key && !d.error)
          .map((d) => ({ name: d.name, key: d.key, type: d.type, size: d.size })),
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    }
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        {/* Registration type */}
        <div className="flex flex-wrap gap-3">
          {(
            [
              { v: 'standard', label: 'Registered business', desc: 'Has an EIN / Tax ID' },
              { v: 'sole_prop', label: 'Sole proprietor', desc: 'Individual / no EIN' },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setRegistrationType(o.v)}
              className={`flex-1 min-w-[180px] rounded-lg border p-3 text-left transition ${
                registrationType === o.v
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                  : 'border-[var(--border)] hover:border-[var(--primary)]/50'
              }`}
            >
              <div className="text-sm font-semibold text-[var(--foreground)]">{o.label}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{o.desc}</div>
            </button>
          ))}
        </div>

        <section className="space-y-5 border-t border-[var(--border)] pt-6">
          <SectionHeader
            title="Business details"
            desc="The legal entity behind your account. Carriers and our compliance team review this to unlock calling & SMS bundles."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Input
                label="Legal company name"
                value={brand.legalCompanyName}
                onChange={(e) => setField('legalCompanyName', e.target.value)}
                error={err('legalCompanyName')}
                required
              />
            </div>
            {isStandard && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Entity type
                </label>
                <StyledSelect value={brand.entityType} onChange={(v) => setField('entityType', v)}>
                  {ENTITY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </StyledSelect>
              </div>
            )}
            {isStandard && (
              <div>
                <Input
                  label="EIN / Tax ID"
                  value={brand.ein}
                  onChange={(e) => setField('ein', e.target.value)}
                  error={err('ein')}
                  placeholder="12-3456789"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Industry</label>
              <StyledSelect value={brand.vertical} onChange={(v) => setField('vertical', v)}>
                {VERTICALS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </StyledSelect>
            </div>
            <div>
              <Input
                label="Business email"
                type="email"
                value={brand.email}
                onChange={(e) => setField('email', e.target.value)}
                error={err('email')}
                required
              />
            </div>
            <div>
              <Input
                label="Business phone"
                value={brand.phone}
                onChange={(e) => setField('phone', e.target.value)}
                error={err('phone')}
                required
              />
            </div>
            <Input
              label="Website"
              value={brand.website}
              onChange={(e) => setField('website', e.target.value)}
              placeholder="e.g. yourcompany.com"
            />
            <div className="md:col-span-2">
              <Input
                label="Street address"
                value={brand.street}
                onChange={(e) => setField('street', e.target.value)}
                error={err('street')}
                required
              />
            </div>
            <div>
              <Input
                label="City"
                value={brand.city}
                onChange={(e) => setField('city', e.target.value)}
                error={err('city')}
                required
              />
            </div>
            <div>
              <Input
                label="State / Province"
                value={brand.state}
                onChange={(e) => setField('state', e.target.value)}
                error={err('state')}
                required
              />
            </div>
            <div>
              <Input
                label="Postal code"
                value={brand.postalCode}
                onChange={(e) => setField('postalCode', e.target.value)}
                error={err('postalCode')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Country</label>
              <StyledSelect value={brand.country} onChange={(v) => setField('country', v)}>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
              </StyledSelect>
            </div>
          </div>
        </section>

        {/* Documents (optional) */}
        {uploadFile && (
          <section className="space-y-3 border-t border-[var(--border)] pt-6">
            <SectionHeader
              title="Supporting documents (optional)"
              desc="Business license or registration — speeds up review."
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-6 text-center hover:border-[var(--primary)]/60"
            >
              <FiUpload className="h-5 w-5 text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--muted-foreground)]">
                Click to upload (PDF, JPG, PNG, DOCX — max 15 MB)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(',')}
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {documents.length > 0 && (
              <ul className="space-y-2">
                {documents.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                  >
                    <FiFile className="h-4 w-4 text-[var(--muted-foreground)]" />
                    <span className="flex-1 truncate text-[var(--foreground)]">{d.name}</span>
                    {d.uploading ? (
                      <FiLoader className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                    ) : d.error ? (
                      <span className="text-xs text-[var(--destructive)]">{d.error}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDocuments((docs) => docs.filter((_, j) => j !== i))}
                      className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="flex justify-end border-t border-[var(--border)] pt-6">
          <Button onClick={submit} disabled={submitting || documents.some((d) => d.uploading)}>
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
