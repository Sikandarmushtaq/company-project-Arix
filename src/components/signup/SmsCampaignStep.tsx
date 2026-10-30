'use client';

import React from 'react';
import { useSubmitSmsCampaign, useSkipSmsCampaign } from '@/lib/hooks/useSignup';
import { onboardingApiService } from '@/lib/api/services/onboarding.service';
import type { SignupOrderData, SmsCampaignPayload } from '@/lib/api/services/onboarding.service';
import TenDlcRegistrationForm from './TenDlcRegistrationForm';

interface Props {
  token: string;
  order: SignupOrderData;
  onBack?: () => void;
  onContinue?: () => void;
}

/**
 * Signup-wizard wrapper around the shared 10DLC form. Wires the form to the
 * token-scoped onboarding endpoints and advances the wizard on submit/skip.
 * The form UI itself is SSOT in TenDlcRegistrationForm (also used by the org
 * portal's SMS Campaign page).
 */
export default function SmsCampaignStep({ token, order, onBack, onContinue }: Props) {
  const submitMutation = useSubmitSmsCampaign(token);
  const skipMutation = useSkipSmsCampaign(token);

  const handleSubmit = async (payload: SmsCampaignPayload) => {
    await submitMutation.mutateAsync(payload);
    onContinue?.();
  };

  const handleSkip = async () => {
    await skipMutation.mutateAsync();
    onContinue?.();
  };

  return (
    <TenDlcRegistrationForm
      numbers={order.numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        countryCode: n.countryCode,
        numberType: n.numberType,
      }))}
      prefill={{
        legalCompanyName: order.businessName || '',
        email: order.contactEmail || '',
        phone: order.contactPhone || '',
        street: order.businessAddress || '',
        website: order.businessWebsite || '',
      }}
      uploadFile={async (file) => {
        const res = await onboardingApiService.getSmsCampaignUploadUrl(token, file);
        return res.data;
      }}
      onSubmit={handleSubmit}
      submitting={submitMutation.isPending}
      onSkip={handleSkip}
      skipping={skipMutation.isPending}
      onBack={onBack}
      subheading={
        <>
          US carriers require every business texting number to be registered (10DLC). We&apos;ll
          submit your own brand &amp; campaign to the carriers — it&apos;s optional, and you can skip
          and add it later.
        </>
      }
    />
  );
}
