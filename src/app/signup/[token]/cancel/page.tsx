'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FiAlertTriangle } from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import Link from 'next/link';

export default function SignupCancelPage() {
  const params = useParams();
  const token = params.token as string;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiAlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">Payment Cancelled</h1>
          <p className="text-[var(--muted-foreground)] mb-6">
            No worries! Your order has been saved. You can return to complete your purchase anytime.
          </p>
          <Link href={`/signup/${token}`}>
            <Button>Return to Checkout</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
