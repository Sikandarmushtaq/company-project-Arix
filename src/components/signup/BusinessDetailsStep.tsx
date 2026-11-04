
'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiAlertCircle,
  FiArrowRight,
  FiUser,
  FiMail,
  FiLock,
  FiPhone,
  FiHome,
  FiShoppingBag,
  FiCheck,
  FiPhoneCall,
  FiMessageSquare,
  FiGrid,
  FiShield,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useCreateOrder } from '@/lib/hooks/useSignup';
import { ApiValidationError } from '@/lib/api/services/onboarding.service';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { getPlan, planPriceLabel, type BillingPeriod, type PlanSlug } from './plans';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const IS_DEV = process.env.NODE_ENV === 'development';

interface BusinessDetailsStepProps {
  plan?: PlanSlug;
  billing?: BillingPeriod;
  onBackToPlans?: () => void;
}

interface FormState {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  password: string;
  tosAccepted: boolean;
}

const INITIAL_FORM: FormState = {
  businessName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  password: '',
  tosAccepted: false,
};

const BENEFITS: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}[] = [
  { icon: FiPhoneCall, title: 'Powerful calling', desc: 'Crystal clear calls with advanced routing' },
  { icon: FiMessageSquare, title: 'SMS & MMS', desc: 'Reach your customers instantly' },
  { icon: FiGrid, title: 'Easy to manage', desc: 'Everything in one simple dashboard' },
  { icon: FiShield, title: 'Secure & reliable', desc: 'Enterprise-grade security and 99.99% uptime' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

function SectionHeader({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ff7838] text-white shadow-sm shadow-[#ff7838]/30">
        {icon}
      </span>
      <div>
        <h2 className="text-[15px] font-bold leading-tight text-white">{title}</h2>
        <p className="text-[13px] text-[#a1a1aa]">{desc}</p>
      </div>
    </div>
  );
}

export default function BusinessDetailsStep({
  plan,
  billing = 'monthly',
  onBackToPlans,
}: BusinessDetailsStepProps = {}) {
  const router = useRouter();
  const createOrder = useCreateOrder();
  const selectedPlan = getPlan(plan);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.businessName.trim()) errs.businessName = 'Required';
    if (!form.contactPhone.trim()) errs.contactPhone = 'Required';
    if (!form.contactName.trim()) errs.contactName = 'Required';
    if (!form.contactEmail.trim()) errs.contactEmail = 'Required';
    if (!form.password) {
      errs.password = 'Required';
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    } else if (!PASSWORD_REGEX.test(form.password)) {
      errs.password = 'Password must include at least one letter and one number';
    }
    if (!form.tosAccepted) errs.tosAccepted = 'You must accept the Terms of Service';
    if (!IS_DEV && TURNSTILE_SITE_KEY && !captchaToken) {
      errs.captcha = 'Please complete the verification';
    }
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
      const result = await createOrder.mutateAsync({
        businessName: form.businessName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        password: form.password,
        businessNature: 'General',
        businessAddress: '',
        confirmPassword: form.password,
        planSlug: plan === 'custom' ? undefined : plan,
        billingPeriod: billing,
        captchaToken: captchaToken || 'dev-bypass',
        tosAccepted: true,
      });
      router.push(`/signup/${result.data.token}`);
    } catch (err: unknown) {
      if (err instanceof ApiValidationError) {
        const fieldErrors: Record<string, string> = {};
        for (const { field, message } of err.fields) {
          fieldErrors[field] = message;
        }
        setErrors(fieldErrors);
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setErrors({ _form: message });
      }
      turnstileRef.current?.reset();
      setCaptchaToken('');
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719] text-white shadow-xl shadow-black/30 [&_input]:!border-[#36363a] [&_input]:!bg-[#202023] [&_input]:!text-white [&_input]:placeholder:!text-[#777780]"
      style={
        {
          '--foreground': '#ffffff',
          '--muted-foreground': '#a1a1aa',
          '--card': '#171719',
          '--border': '#2d2d31',
          '--muted': '#242427',
          '--coral': '#ff7838',
          '--coral-700': '#ff6a00',
          '--danger': '#f87171',
          '--background': '#101011',
          '--input': '#202023',
          colorScheme: 'dark',
        } as React.CSSProperties
      }
    >
      <div className="grid lg:grid-cols-[1.45fr_1fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          {selectedPlan && (
            <motion.div
              variants={item}
              className="mb-8 flex items-center justify-between gap-3 rounded-2xl border border-[#ff7838]/15 bg-[#ff7838]/[0.07] p-4"
            >
              <div className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#202023] text-[#ff7838] shadow-sm ring-1 ring-[#ff7838]/20">
                  <FaCrown className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-[#a1a1aa]">Your selected plan</p>
                  <p className="text-[15px] font-bold leading-tight text-white">
                    {selectedPlan.name} Plan
                  </p>
                  <p className="text-sm leading-tight">
                    <span className="font-bold text-[#ff7838]">
                      {planPriceLabel(selectedPlan, billing)}
                    </span>{' '}
                    <span className="text-[#a1a1aa]">
                      /user/mo{billing === 'yearly' ? ' billed annually' : ''}
                    </span>
                  </p>
                </div>
              </div>
              {onBackToPlans && (
                <button
                  type="button"
                  onClick={onBackToPlans}
                  className="shrink-0 text-sm font-semibold text-[#ff7838] underline-offset-2 hover:underline"
                >
                  Change plan
                </button>
              )}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-7">
            {errors._form && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm text-red-400">{errors._form}</p>
              </div>
            )}

            <motion.section variants={item} className="space-y-4">
              <SectionHeader
                icon={<FiShoppingBag className="h-[18px] w-[18px]" />}
                title="About your business"
                desc="This helps us set up your account quickly."
              />
              <Input
                label="Business name"
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                error={errors.businessName}
                leftIcon={<FiHome className="h-4 w-4" />}
                placeholder="e.g. Carter Realty Group"
                required
              />
              <Input
                label="Contact phone number"
                name="contactPhone"
                value={form.contactPhone}
                onChange={handleChange}
                error={errors.contactPhone}
                leftIcon={<FiPhone className="h-4 w-4" />}
                placeholder="e.g. +1 202 555 0147"
                hint="We'll use this number if we need to reach you about your account."
                required
              />
            </motion.section>

            <motion.section variants={item} className="space-y-4">
              <SectionHeader
                icon={<FiUser className="h-[18px] w-[18px]" />}
                title="Your account"
                desc="You'll use these details to sign in and manage your account."
              />
              <Input
                label="Your name"
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                error={errors.contactName}
                leftIcon={<FiUser className="h-4 w-4" />}
                placeholder="e.g. Michael Carter"
                required
              />
              <Input
                label="Email address"
                name="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={handleChange}
                error={errors.contactEmail}
                leftIcon={<FiMail className="h-4 w-4" />}
                placeholder="name@yourcompany.com"
                required
              />
              <Input
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                leftIcon={<FiLock className="h-4 w-4" />}
                hint="At least 8 characters, with one letter and one number"
                required
              />
            </motion.section>

            {TURNSTILE_SITE_KEY && (
              <motion.div variants={item}>
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => {
                    setCaptchaToken(token);
                    if (errors.captcha) setErrors((prev) => ({ ...prev, captcha: '' }));
                  }}
                  onExpire={() => setCaptchaToken('')}
                  options={{ theme: 'auto', size: 'normal' }}
                />
                {errors.captcha && (
                  <p className="mt-1.5 text-sm text-red-400" role="alert">
                    {errors.captcha}
                  </p>
                )}
              </motion.div>
            )}

            <motion.div variants={item}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.tosAccepted}
                  onChange={(e) => setForm({ ...form, tosAccepted: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-[#36363a] accent-[#ff7838] focus:ring-[#ff7838]"
                />
                <span className="text-sm text-[#a1a1aa]">
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    className="font-medium text-[#ff7838] underline underline-offset-2"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    className="font-medium text-[#ff7838] underline underline-offset-2"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {errors.tosAccepted && (
                <p className="mt-1.5 text-sm text-red-400" role="alert">
                  {errors.tosAccepted}
                </p>
              )}
            </motion.div>

            <motion.div variants={item} className="space-y-3 pt-1">
              <Button
                type="submit"
                variant="coral"
                size="lg"
                loading={createOrder.isPending}
                className="group w-full"
              >
                {createOrder.isPending ? 'Creating account…' : 'Continue to numbers'}
                {!createOrder.isPending && (
                  <FiArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-[#a1a1aa]">
                <FiLock className="h-3.5 w-3.5" />
                Your information is secure and encrypted
              </p>
            </motion.div>
          </form>
        </div>

        <motion.aside
          variants={item}
          className="hidden flex-col gap-8 border-l border-[#2d2d31] bg-[#141416] p-8 lg:flex lg:p-10"
        >
          <div className="relative mx-auto mt-2 w-full max-w-[240px]">
            <div className="rounded-2xl border border-[#2d2d31] bg-[#202023] p-4 shadow-lg shadow-black/20">
              <div className="mb-3 flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400/70" />
                <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#ff7838] text-white shadow-md shadow-[#ff7838]/30">
                  <FiPhoneCall className="h-6 w-6" />
                </span>
                <div className="flex-1 space-y-2">
                  <span className="block h-2 w-4/5 rounded-full bg-[#36363a]" />
                  <span className="block h-2 w-3/5 rounded-full bg-[#ff7838]/30" />
                  <span className="block h-2 w-2/5 rounded-full bg-[#36363a]" />
                </div>
              </div>
            </div>
            <span className="absolute -bottom-3 -right-2 grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-[#242427]">
              <FiCheck className="h-4 w-4" strokeWidth={3} />
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">What you get with ArixCall</h3>
            <ul className="mt-5 space-y-5">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#ff7838] ring-1 ring-[#ff7838]/30">
                    <FiCheck className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{b.title}</p>
                    <p className="text-[13px] leading-snug text-[#a1a1aa]">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
}
