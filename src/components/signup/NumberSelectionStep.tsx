'use client';

import React, { useState, useEffect } from 'react';
import { FiSearch, FiX, FiArrowLeft, FiPhone, FiInbox, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { useSearchNumbers, useSetNumbers } from '@/lib/hooks/useSignup';
import { useSignupStore } from '@/lib/stores/signup';
import { Card, CardContent, Button, Input, StyledSelect } from '@/components/ui';
import type { SignupOrderData, AvailableNumber } from '@/lib/api/services/onboarding.service';

interface Props {
  token: string;
  order: SignupOrderData;
  onBack?: () => void;
  onContinue?: () => void;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
];

// Feature chips we surface (Telnyx returns many; these are the ones customers care about).
const FEATURE_LABELS: Record<string, string> = {
  voice: 'Voice',
  sms: 'SMS',
  mms: 'MMS',
};


export default function NumberSelectionStep({ token, order, onBack, onContinue }: Props) {
  const [country, setCountry] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [continueError, setContinueError] = useState('');

  const { selectedNumbers, setSelectedNumbers } = useSignupStore();
  const searchMutation = useSearchNumbers();

  // Signup includes exactly ONE number (per-number pricing isn't offered here
  // yet), so number selection is single-select: picking a number replaces any
  // prior pick; tapping the selected one clears it.
  const selectNumber = (num: AvailableNumber) => {
    const isSelected = selectedNumbers.some((n) => n.phoneNumber === num.phoneNumber);
    setSelectedNumbers(isSelected ? [] : [num]);
  };

  // Sync store with the order's already-saved numbers on mount (return visits).
  useEffect(() => {
    if (order.numbers.length > 0) {
      setSelectedNumbers(
        order.numbers.map((n) => ({
          phoneNumber: n.phoneNumber,
          countryCode: n.countryCode,
          region: n.region ?? undefined,
          locality: n.locality ?? undefined,
          numberType: n.numberType,
          monthlyCostCents: n.monthlyCostCents,
          upfrontCostCents: n.upfrontCostCents,
        }))
      );
    } else {
      setSelectedNumbers([]);
    }
  }, [order.numbers, setSelectedNumbers]);
  const setNumbersMutation = useSetNumbers(token);

  const handleSearch = async () => {
    setSearchError('');
    try {
      const res = await searchMutation.mutateAsync({
        country_code: country,
        area_code: areaCode.trim() || undefined,
        number_type: 'local', // plan includes a local number; toll-free isn't offered here
        limit: 20,
      });
      // The search already restricts to `number_type: 'local'`, which IS the
      // standard number included with the plan (currently $5/mo). Show exactly
      // what the backend returns — do NOT re-filter on a hardcoded cents cap:
      // a stale "$1" ceiling silently hid every $5 standard number, so the list
      // always looked empty. Premium/vanity numbers aren't 'local', so they
      // don't come back here in the first place.
      setResults(res.data);
      setHasSearched(true);
    } catch {
      // Telnyx returns a 400 (→ our 500) for area codes with no inventory.
      // Surface a friendly, actionable hint rather than a raw error.
      setResults([]);
      setHasSearched(true);
      setSearchError(
        'No numbers are available for that search. Try a different area code or leave it blank.'
      );
    }
  };

  const handleContinue = async () => {
    if (selectedNumbers.length === 0) return;
    setContinueError('');
    try {
      await setNumbersMutation.mutateAsync(selectedNumbers);
      onContinue?.();
    } catch (err) {
      // Surface the failure instead of silently doing nothing — otherwise the
      // Continue button reads as broken. The backend re-verifies each number
      // against Telnyx before saving and can reject/error here.
      setContinueError(
        err instanceof Error
          ? err.message
          : 'Could not save your numbers. Please try again.'
      );
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      <div className="lg:col-span-2 space-y-6">
        {/* Search */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-[var(--foreground)]">Find your number</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">
              Choose a country and (optionally) an area code. Your plan includes a local number.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="country-select"
                  className="block text-xs font-semibold text-[var(--foreground)] mb-1.5"
                >
                  Country
                </label>
                <StyledSelect id="country-select" value={country} onChange={(v) => setCountry(v)}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <Input
                label="Area code"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                placeholder="Optional"
              />
              <div className="flex items-end">
                <Button
                  variant="coral"
                  onClick={handleSearch}
                  loading={searchMutation.isPending}
                  className="w-full"
                >
                  <FiSearch className="w-4 h-4 mr-1.5" />
                  {searchMutation.isPending ? 'Searching…' : 'Search'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searchError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--muted)]">
                <FiAlertCircle className="h-6 w-6 text-[var(--muted-foreground)]" />
              </div>
              <p className="text-sm text-[var(--foreground)] font-medium">{searchError}</p>
            </CardContent>
          </Card>
        ) : results.length > 0 ? (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">
                {results.length} available number{results.length !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-2.5">
                {results.map((num) => {
                  const isSelected = selectedNumbers.some((n) => n.phoneNumber === num.phoneNumber);
                  const chips = (num.features ?? [])
                    .map((f) => FEATURE_LABELS[f.name])
                    .filter(Boolean);
                  return (
                    <button
                      key={num.phoneNumber}
                      type="button"
                      onClick={() => selectNumber(num)}
                      aria-pressed={isSelected}
                      className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-[var(--coral)] bg-[var(--coral)]/5'
                          : 'border-[var(--border)] hover:border-[var(--coral)]/40 hover:bg-[var(--muted)]/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                              isSelected
                                ? 'border-[var(--coral)] bg-[var(--coral)] text-white'
                                : 'border-[var(--border)]'
                            }`}
                          >
                            {isSelected && <FiCheck className="h-3 w-3" />}
                          </span>
                          <span className="font-mono text-base font-semibold text-[var(--foreground)]">
                            {num.phoneNumber}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 pl-[30px]">
                          {(num.region || num.locality) && (
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {num.region || num.locality}
                            </span>
                          )}
                          {chips.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="rounded-full bg-[var(--coral)]/10 px-2.5 py-1 text-xs font-bold text-[var(--coral-700)]">
                          Included
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : hasSearched ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--muted)]">
                <FiInbox className="h-6 w-6 text-[var(--muted-foreground)]" />
              </div>
              <p className="text-sm text-[var(--foreground)] font-medium">No numbers found</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Try a different area code or number type.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--coral)]/10">
                <FiPhone className="h-6 w-6 text-[var(--coral-700)]" />
              </div>
              <p className="text-sm text-[var(--foreground)] font-medium">
                Search to see available numbers
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Pick a country and type above, then hit Search.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar — selection summary */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-6">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">
              Your selection
              {selectedNumbers.length > 0 && (
                <span className="ml-1.5 text-[var(--muted-foreground)] font-medium">
                  ({selectedNumbers.length})
                </span>
              )}
            </h3>

            {selectedNumbers.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] mb-6">
                No number selected yet. Tap a number to select it.
              </p>
            ) : (
              <div className="space-y-2 mb-5">
                {selectedNumbers.map((num) => (
                  <div
                    key={num.phoneNumber}
                    className="flex items-center justify-between rounded-lg bg-[var(--muted)]/50 px-3 py-2"
                  >
                    <span className="font-mono text-sm font-medium text-[var(--foreground)] truncate">
                      {num.phoneNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedNumbers([])}
                      className="ml-2 text-[var(--muted-foreground)] hover:text-[var(--danger)] transition-colors shrink-0"
                      aria-label={`Remove ${num.phoneNumber}`}
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--border)] pt-4 mb-5">
              <div className="flex items-center gap-2 text-sm">
                <FiCheck className="h-4 w-4 shrink-0 text-[var(--coral-700)]" />
                <span className="text-[var(--foreground)]">Included with your plan</span>
              </div>
            </div>

            {continueError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3">
                <FiAlertCircle className="w-4 h-4 text-[var(--danger)] mt-0.5 shrink-0" />
                <p className="text-xs text-[var(--danger)]">{continueError}</p>
              </div>
            )}
            <div className="flex gap-2.5">
              {onBack && (
                <Button type="button" variant="outline" onClick={onBack} className="shrink-0">
                  <FiArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="coral"
                onClick={handleContinue}
                disabled={selectedNumbers.length === 0}
                loading={setNumbersMutation.isPending}
                className="w-full"
              >
                {setNumbersMutation.isPending ? 'Saving…' : 'Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
