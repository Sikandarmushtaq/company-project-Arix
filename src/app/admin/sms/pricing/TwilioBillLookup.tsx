'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiDollarSign, FiLoader, FiPhone, FiSearch } from 'react-icons/fi';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  StyledSelect,
} from '@/components/ui';
import { smsAdminService, type TwilioBill, type UserSmsUsage } from '@/lib/api/services';
import type { TwilioBillProvider } from '@/lib/api/services/sms-usage.api';
import BillResultPanel from './BillResultPanel';

type ProviderSelection = '' | TwilioBillProvider;

interface Props {
  userStats: UserSmsUsage[] | undefined;
  usersLoading: boolean;
  selectedPhone: string;
  onSelectPhone: (phone: string) => void;
}

function currentMonthYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Twilio Bill Lookup card — phone selector + month picker + fetch button.
 * On success renders <BillResultPanel> with the bill data.
 */
export default function TwilioBillLookup({
  userStats,
  usersLoading,
  selectedPhone,
  onSelectPhone,
}: Props) {
  const [phoneSearch, setPhoneSearch] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthYYYYMM());
  // '' = auto-resolve via getUserSmsTypeByPhone server-side. Pick 'standard'
  // or 'auto' to force a specific Twilio sub-account — useful for figuring
  // out which account a phone actually lives on when the auto-resolved
  // mapping looks wrong.
  const [selectedProvider, setSelectedProvider] = useState<ProviderSelection>('');
  const [bill, setBill] = useState<TwilioBill | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    if (!userStats) return [];
    if (!phoneSearch) return userStats;
    const term = phoneSearch.toLowerCase();
    return userStats.filter(
      (u) =>
        u.phone.toLowerCase().includes(term) ||
        u.userName?.toLowerCase().includes(term) ||
        u.userEmail?.toLowerCase().includes(term)
    );
  }, [userStats, phoneSearch]);

  const selectedUser = useMemo(
    () => userStats?.find((u) => u.phone === selectedPhone),
    [userStats, selectedPhone]
  );

  // Clear the bill panel whenever the selected phone OR provider changes —
  // stale data for a different number/account would be confusing.
  useEffect(() => {
    setBill(null);
    setBillError(null);
  }, [selectedPhone, selectedProvider]);

  // If the search filter excludes the currently-selected phone, auto-jump
  // to the first match so the dropdown doesn't show a phantom value the
  // user can't see in the list.
  const selectionInFilter = filteredUsers.some((u) => u.phone === selectedPhone);
  useEffect(() => {
    if (!phoneSearch) return;
    if (selectionInFilter) return;
    if (filteredUsers.length === 0) return;
    onSelectPhone(filteredUsers[0].phone);
  }, [phoneSearch, selectionInFilter, filteredUsers, onSelectPhone]);

  const handleFetchBill = useCallback(async () => {
    if (!selectedPhone || !selectedMonth || billLoading) return;
    setBillLoading(true);
    setBillError(null);
    setBill(null);
    try {
      const result = await smsAdminService.getTwilioBill(
        selectedPhone,
        selectedMonth,
        selectedProvider || undefined
      );
      setBill(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch bill from Twilio';
      setBillError(msg);
      toast.error(msg);
    } finally {
      setBillLoading(false);
    }
  }, [selectedPhone, selectedMonth, selectedProvider, billLoading]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FiPhone className="w-5 h-5 text-[var(--foreground)]" />
          Twilio Bill Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          Fetches every message Twilio billed us for the selected number in the selected month (both
          outbound + inbound) and sums the real <code>Price</code> field. Matches your Twilio
          invoice — no local estimation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_160px_auto] gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
              Phone Number
            </label>
            <div className="space-y-2">
              <div className="relative">
                <FiSearch
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <Input
                  placeholder="Search by phone, name, or email…"
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <StyledSelect
                value={selectedPhone}
                onChange={(v) => onSelectPhone(v)}
                disabled={usersLoading || !userStats || userStats.length === 0}
              >
                {!userStats || userStats.length === 0 ? (
                  <option value="">No phones available</option>
                ) : (
                  filteredUsers.map((u) => (
                    <option key={u.phone} value={u.phone}>
                      {u.phone}
                      {u.userName ? ` — ${u.userName}` : u.userEmail ? ` — ${u.userEmail}` : ''}
                    </option>
                  ))
                )}
              </StyledSelect>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
              Month
            </label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
              Twilio Account
            </label>
            <StyledSelect
              value={selectedProvider}
              onChange={(v) => setSelectedProvider(v as ProviderSelection)}
            >
              <option value="">Auto-detect</option>
              <option value="standard">Standard</option>
              <option value="auto">Auto</option>
            </StyledSelect>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleFetchBill}
              disabled={!selectedPhone || !selectedMonth || billLoading}
              className="w-full md:w-auto"
            >
              {billLoading ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  Fetching…
                </>
              ) : (
                <>
                  <FiDollarSign className="w-4 h-4" />
                  Fetch from Twilio
                </>
              )}
            </Button>
          </div>
        </div>

        {selectedUser && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Selected: <strong>{selectedUser.phone}</strong>
            {selectedUser.userName && <> — {selectedUser.userName}</>}
            {selectedUser.userEmail && <> ({selectedUser.userEmail})</>}
          </p>
        )}

        {billError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            <FiAlertTriangle className="inline w-4 h-4 mr-1.5" />
            {billError}
          </div>
        )}

        {bill && <BillResultPanel bill={bill} provider={selectedProvider || undefined} />}
      </CardContent>
    </Card>
  );
}
