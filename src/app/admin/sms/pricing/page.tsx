'use client';

import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { useQuery } from '@tanstack/react-query';
import { smsAdminService } from '@/lib/api/services';
import { usePermissions } from '@/lib/hooks/usePermissions';
import TwilioBillLookup from './TwilioBillLookup';
import MonthHistoryTable from './MonthHistoryTable';
import PricingConfigCard from './PricingConfigCard';

/**
 * /admin/sms/pricing — admin-only page combining authoritative Twilio
 * billing data (per-phone, per-month, including 6-month history) with the
 * customer-facing pricing config.
 *
 * The route group already requires admin OR manager role; this page adds a
 * stricter gate (admin only) since billing data is sensitive. The backend
 * routes are gated independently with requireAdmin middleware — this UI
 * gate is for UX, not security.
 */
export default function SmsPricingPage() {
  const { isAdmin, isLoading: permsLoading } = usePermissions();

  // Selected phone is shared between TwilioBillLookup (single-month detail)
  // and MonthHistoryTable (6-month rollup). Auto-picks the first available
  // phone once user stats load, but the user can change it.
  const [selectedPhone, setSelectedPhone] = useState<string>('');

  const { data: userStats, isLoading: usersLoading } = useQuery({
    queryKey: ['sms-user-stats'],
    queryFn: () => smsAdminService.getUserUsageStats(),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!selectedPhone && userStats && userStats.length > 0) {
      setSelectedPhone(userStats[0].phone);
    }
  }, [userStats, selectedPhone]);

  if (permsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="w-8 h-8 animate-spin text-[var(--foreground)]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <FiAlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Admin only</h2>
          <p className="text-[var(--muted-foreground)]">
            SMS pricing and Twilio billing data is restricted to administrators. Managers can
            view usage at <strong>/admin/sms/usage</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">SMS Pricing & Twilio Bills</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Pull the authoritative monthly bill (outbound + inbound) for any number directly from
          Twilio, or set the rates you charge your customers.
        </p>
      </div>

      <TwilioBillLookup
        userStats={userStats}
        usersLoading={usersLoading}
        selectedPhone={selectedPhone}
        onSelectPhone={setSelectedPhone}
      />

      <MonthHistoryTable selectedPhone={selectedPhone} />

      <PricingConfigCard />
    </div>
  );
}
