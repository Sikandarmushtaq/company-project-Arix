'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { useSignupOrder } from '@/lib/hooks/useSignup';
import { Button } from '@/components/ui';
import SignupWizard from '@/components/signup/SignupWizard';
import Link from 'next/link';

export default function SignupWizardPage() {
  const params = useParams();
  const token = params.token as string;
  const { data: order, isLoading, error } = useSignupOrder(token);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <FiAlertCircle className="w-12 h-12 text-[var(--danger)] mb-4" />
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">Order Not Found</h2>
        <p className="text-[var(--muted-foreground)] mb-6">This link may have expired or is invalid.</p>
        <Link href="/signup">
          <Button variant="outline">Start a new signup</Button>
        </Link>
      </div>
    );
  }

  return <SignupWizard token={token} order={order} />;
}
