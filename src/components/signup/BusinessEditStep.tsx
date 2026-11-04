
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertCircle,
  FiArrowRight,
  FiUser,
  FiMail,
  FiPhone,
  FiHome,
  FiShoppingBag,
} from 'react-icons/fi';
import { useUpdateBusiness } from '@/lib/hooks/useSignup';
import { ApiValidationError } from '@/lib/api/services/onboarding.service';
import { Input, Button } from '@/components/ui';
import type { SignupOrderData } from '@/lib/api/services/onboarding.service';

interface Props {
  token: string;
  order: SignupOrderData;
  onContinue: () => void;
}

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

export default function BusinessEditStep({ token, order, onContinue }: Props) {
  const updateBusiness = useUpdateBusiness(token);
  const [form, setForm] = useState({
    businessName: order.businessName,
    contactName: order.contactName,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const errs: Record<string, string> = {};
    if (!form.businessName.trim()) errs.businessName = 'Required';
    if (!form.contactName.trim()) errs.contactName = 'Required';
    if (!form.contactEmail.trim()) errs.contactEmail = 'Required';
    if (!form.contactPhone.trim()) errs.contactPhone = 'Required';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      await updateBusiness.mutateAsync({
        ...form,
        businessNature: order.businessNature || 'General',
        businessAddress: order.businessAddress || '',
        businessWebsite: order.businessWebsite || '',
      });
      onContinue();
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
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[#2d2d31] bg-[#171719] text-white shadow-xl shadow-black/30 [&_input]:!border-[#36363a] [&_input]:!bg-[#202023] [&_input]:!text-white [&_input]:placeholder:!text-[#777780]"
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
      <div className="p-6 sm:p-8 lg:p-10">
        <motion.div variants={item} className="mb-8">
          <h2 className="text-xl font-bold text-white">
            Edit business details
          </h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">
            Update your business information before proceeding.
          </p>
        </motion.div>

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
              required
            />
          </motion.section>

          <motion.section variants={item} className="space-y-4">
            <SectionHeader
              icon={<FiUser className="h-[18px] w-[18px]" />}
              title="Your account"
              desc="The name and email on your account."
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
          </motion.section>

          <motion.div variants={item} className="pt-1">
            <Button
              type="submit"
              variant="coral"
              size="lg"
              loading={updateBusiness.isPending}
              className="group w-full sm:ml-auto sm:flex sm:w-auto"
            >
              {updateBusiness.isPending ? 'Saving…' : 'Save & continue'}
              {!updateBusiness.isPending && (
                <FiArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </Button>
          </motion.div>
        </form>
      </div>
    </motion.div>
  );
}
