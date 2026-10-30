'use client';

import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FiAlertCircle, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useCreateLead } from '@/lib/hooks/useSignup';
import { ApiValidationError } from '@/lib/api/services/onboarding.service';
import { Input, Button, Card, CardContent } from '@/components/ui';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const IS_DEV = process.env.NODE_ENV === 'development';

interface FormState {
  contactName: string;
  contactEmail: string;
  whatsappNumber: string;
  campaign: string;
  quantityOfDialers: string; // kept as string in the form; coerced on submit
}

const INITIAL_FORM: FormState = {
  contactName: '',
  contactEmail: '',
  whatsappNumber: '',
  campaign: '',
  quantityOfDialers: '',
};

/**
 * Products the customer can request. `key` is what we store/send; `label` +
 * `description` are display-only. Keep keys stable — the admin Signups view
 * maps them back to labels via the same list.
 */
const FEATURES: Array<{ key: string; label: string; description: string }> = [
  { key: 'voice_calls', label: 'Voice Calls', description: 'Inbound & outbound calling' },
  { key: 'sms', label: 'SMS / Texting', description: 'Send & receive text messages' },
  { key: 'call_recording', label: 'Call Recording', description: 'Automatic call recording' },
  { key: 'voicemail', label: 'Voicemail', description: 'Voicemail box & greetings' },
  { key: 'bulk_sms', label: 'Bulk SMS', description: 'Mass text campaigns' },
];

/**
 * Simplified lead-capture signup: name, email, WhatsApp number, campaign, and
 * quantity of dialers. Submits to POST /onboarding/lead — no account, number
 * selection, or payment. The request lands in the admin Signups list; the admin
 * reaches out and provisions later.
 */
export default function LeadSignupForm() {
  // Warm up the TLS connection to Cloudflare up front so the Turnstile widget
  // (which is injected only after hydration) has one less round-trip to make
  // when it mounts. Cheap, deduped by React, and the biggest lever on how fast
  // the captcha appears.
  if (TURNSTILE_SITE_KEY) {
    ReactDOM.prefetchDNS('https://challenges.cloudflare.com');
    ReactDOM.preconnect('https://challenges.cloudflare.com', { crossOrigin: 'anonymous' });
  }

  const createLead = useCreateLead();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [features, setFeatures] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [widgetReady, setWidgetReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
  };

  const toggleFeature = (key: string) => {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    if (errors.features) setErrors((prev) => ({ ...prev, features: '' }));
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.contactName.trim()) errs.contactName = 'Please enter your name';
    if (!form.contactEmail.trim()) errs.contactEmail = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim()))
      errs.contactEmail = 'Please enter a valid email address';
    if (!form.whatsappNumber.trim()) errs.whatsappNumber = 'Please enter your WhatsApp number';
    if (!form.campaign.trim()) errs.campaign = 'Please tell us what the dialer is for';
    const qty = Number(form.quantityOfDialers);
    if (!form.quantityOfDialers.trim()) errs.quantityOfDialers = 'Please enter a quantity';
    else if (!Number.isInteger(qty) || qty < 1)
      errs.quantityOfDialers = 'Enter a whole number of 1 or more';
    if (features.length === 0) errs.features = 'Please select at least one feature you need';
    // Only require the captcha when it's actually configured (a site key is
    // present so the widget renders). Without a key there's no widget to
    // complete, so requiring a token here would silently block every submit —
    // and the error lives inside the widget block, so it'd be invisible too.
    if (TURNSTILE_SITE_KEY && !IS_DEV && !captchaToken)
      errs.captcha = 'Please complete the verification';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await createLead.mutateAsync({
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        whatsappNumber: form.whatsappNumber.trim(),
        campaign: form.campaign.trim(),
        quantityOfDialers: Number(form.quantityOfDialers),
        interestedFeatures: features,
        captchaToken: captchaToken || 'dev-bypass',
      });
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof ApiValidationError) {
        const fieldErrors: Record<string, string> = {};
        for (const { field, message } of err.fields) fieldErrors[field] = message;
        setErrors(fieldErrors);
      } else {
        setErrors({ _form: err instanceof Error ? err.message : 'Something went wrong' });
      }
      turnstileRef.current?.reset();
      setCaptchaToken('');
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <FiCheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            Thanks — we&apos;ve got your request
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
            Our team will review it and reach out on WhatsApp shortly to set up your dialers.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit}>
          {errors._form && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" />
              <p className="text-sm text-[var(--danger)]">{errors._form}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Input
              label="Name"
              name="contactName"
              value={form.contactName}
              onChange={handleChange}
              error={errors.contactName}
              placeholder="e.g. Michael Carter"
              required
            />
            <Input
              label="Email"
              name="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={handleChange}
              error={errors.contactEmail}
              placeholder="e.g. michael@company.com"
              required
            />
            <Input
              label="WhatsApp Number"
              name="whatsappNumber"
              value={form.whatsappNumber}
              onChange={handleChange}
              error={errors.whatsappNumber}
              placeholder="e.g. +1 202 555 0147"
              hint="The WhatsApp number our sales team will contact you on to set you up."
              required
            />
            <Input
              label="Campaign"
              name="campaign"
              value={form.campaign}
              onChange={handleChange}
              error={errors.campaign}
              placeholder="e.g. Real estate lead outreach"
              hint="What you'll use the dialer for."
              required
            />
            <Input
              label="Quantity of Dialers"
              name="quantityOfDialers"
              type="number"
              min={1}
              value={form.quantityOfDialers}
              onChange={handleChange}
              error={errors.quantityOfDialers}
              placeholder="e.g. 5"
              required
            />
          </div>

          <fieldset className="mt-8">
            <legend className="text-sm font-semibold text-[var(--foreground)]">
              What do you need? <span className="text-[var(--danger)]">*</span>
            </legend>
            <p className="mb-3 mt-1 text-xs text-[var(--muted-foreground)]">
              Select every feature you&apos;re interested in — pick as many as you like.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => {
                const checked = features.includes(f.key);
                return (
                  <label
                    key={f.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      checked
                        ? 'border-[var(--border)] bg-[var(--primary-600)]/10'
                        : 'border-[var(--border)] hover:border-[var(--border)]/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary-600)]"
                      checked={checked}
                      onChange={() => toggleFeature(f.key)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--foreground)]">
                        {f.label}
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {f.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.features && (
              <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
                {errors.features}
              </p>
            )}
          </fieldset>

          {TURNSTILE_SITE_KEY && (
            <div className="mt-6">
              {/* Reserve the widget's height so nothing jumps when it loads, and
                  show a placeholder so the area never looks empty/broken. */}
              <div className="relative min-h-[65px]">
                {!widgetReady && (
                  <div className="absolute inset-0 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading verification…
                  </div>
                )}
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onWidgetLoad={() => setWidgetReady(true)}
                  onSuccess={(token) => {
                    setCaptchaToken(token);
                    if (errors.captcha) setErrors((prev) => ({ ...prev, captcha: '' }));
                  }}
                  onError={() => setWidgetReady(true)}
                  onExpire={() => setCaptchaToken('')}
                  options={{ theme: 'auto', size: 'normal' }}
                />
              </div>
              {errors.captcha && (
                <p className="mt-1.5 text-sm text-[var(--danger)]" role="alert">
                  {errors.captcha}
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button type="submit" size="lg" loading={createLead.isPending}>
              {createLead.isPending ? 'Submitting…' : 'Request Dialers'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
