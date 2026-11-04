
'use client';

import React, { useState, useEffect } from 'react';
import {
  FiSearch,
  FiX,
  FiArrowLeft,
  FiPhone,
  FiInbox,
  FiAlertCircle,
  FiCheck,
} from 'react-icons/fi';
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

const FEATURE_LABELS: Record<string, string> = {
  voice: 'Voice',
  sms: 'SMS',
  mms: 'MMS',
};

const cardStyle = '!border-[#2d2d31] !bg-[#171719] !text-white';

export default function NumberSelectionStep({ token, order, onBack, onContinue }: Props) {
  const [country, setCountry] = useState('US');
  const [areaCode, setAreaCode] = useState('');
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [continueError, setContinueError] = useState('');

  const { selectedNumbers, setSelectedNumbers } = useSignupStore();
  const searchMutation = useSearchNumbers();

  const selectNumber = (num: AvailableNumber) => {
    const isSelected = selectedNumbers.some((n) => n.phoneNumber === num.phoneNumber);
    setSelectedNumbers(isSelected ? [] : [num]);
  };

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
        number_type: 'local',
        limit: 20,
      });

      setResults(res.data);
      setHasSearched(true);
    } catch {
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
      setContinueError(
        err instanceof Error
          ? err.message
          : 'Could not save your numbers. Please try again.'
      );
    }
  };

  return (
    <div
      className="grid grid-cols-1 gap-6 text-white lg:grid-cols-3 lg:gap-8 [&_input]:!border-[#36363a] [&_input]:!bg-[#202023] [&_input]:!text-white [&_input]:placeholder:!text-[#777780]"
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
      <div className="space-y-6 lg:col-span-2">
        <Card className={cardStyle}>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-white">Find your number</h2>

            <p className="mb-5 text-sm text-[#a1a1aa]">
              Choose a country and (optionally) an area code. Your plan includes a local number.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="country-select"
                  className="mb-1.5 block text-xs font-semibold text-white"
                >
                  Country
                </label>

                <StyledSelect
                  id="country-select"
                  value={country}
                  onChange={(v) => setCountry(v)}
                >
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
                  <FiSearch className="mr-1.5 h-4 w-4" />
                  {searchMutation.isPending ? 'Searching…' : 'Search'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {searchError ? (
          <Card className={cardStyle}>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#242427]">
                <FiAlertCircle className="h-6 w-6 text-[#a1a1aa]" />
              </div>
              <p className="text-sm font-medium text-white">{searchError}</p>
            </CardContent>
          </Card>
        ) : results.length > 0 ? (
          <Card className={cardStyle}>
            <CardContent className="p-6">
              <h3 className="mb-4 text-sm font-bold text-white">
                {results.length} available number{results.length !== 1 ? 's' : ''}
              </h3>

              <div className="space-y-2.5">
                {results.map((num) => {
                  const isSelected = selectedNumbers.some(
                    (n) => n.phoneNumber === num.phoneNumber
                  );

                  const chips = (num.features ?? [])
                    .map((f) => FEATURE_LABELS[f.name])
                    .filter(Boolean);

                  return (
                    <button
                      key={num.phoneNumber}
                      type="button"
                      onClick={() => selectNumber(num)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center justify-between gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? 'border-[#ff7838] bg-[#ff7838]/10'
                          : 'border-[#2d2d31] hover:border-[#ff7838]/40 hover:bg-[#242427]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                              isSelected
                                ? 'border-[#ff7838] bg-[#ff7838] text-white'
                                : 'border-[#55555a]'
                            }`}
                          >
                            {isSelected && <FiCheck className="h-3 w-3" />}
                          </span>

                          <span className="font-mono text-base font-semibold text-white">
                            {num.phoneNumber}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2 pl-[30px]">
                          {(num.region || num.locality) && (
                            <span className="text-xs text-[#a1a1aa]">
                              {num.region || num.locality}
                            </span>
                          )}

                          {chips.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-[#242427] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="rounded-full bg-[#ff7838]/10 px-2.5 py-1 text-xs font-bold text-[#ff7838]">
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
          <Card className={cardStyle}>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#242427]">
                <FiInbox className="h-6 w-6 text-[#a1a1aa]" />
              </div>
              <p className="text-sm font-medium text-white">No numbers found</p>
              <p className="mt-1 text-sm text-[#a1a1aa]">
                Try a different area code or number type.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className={cardStyle}>
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#ff7838]/10">
                <FiPhone className="h-6 w-6 text-[#ff7838]" />
              </div>
              <p className="text-sm font-medium text-white">
                Search to see available numbers
              </p>
              <p className="mt-1 text-sm text-[#a1a1aa]">
                Pick a country and type above, then hit Search.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-1">
        <Card className={`${cardStyle} lg:sticky lg:top-6`}>
          <CardContent className="p-6">
            <h3 className="mb-4 text-sm font-bold text-white">
              Your selection
              {selectedNumbers.length > 0 && (
                <span className="ml-1.5 font-medium text-[#a1a1aa]">
                  ({selectedNumbers.length})
                </span>
              )}
            </h3>

            {selectedNumbers.length === 0 ? (
              <p className="mb-6 text-sm text-[#a1a1aa]">
                No number selected yet. Tap a number to select it.
              </p>
            ) : (
              <div className="mb-5 space-y-2">
                {selectedNumbers.map((num) => (
                  <div
                    key={num.phoneNumber}
                    className="flex items-center justify-between rounded-lg bg-[#242427] px-3 py-2"
                  >
                    <span className="truncate font-mono text-sm font-medium text-white">
                      {num.phoneNumber}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedNumbers([])}
                      className="ml-2 shrink-0 text-[#a1a1aa] transition-colors hover:text-red-400"
                      aria-label={`Remove ${num.phoneNumber}`}
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-5 border-t border-[#2d2d31] pt-4">
              <div className="flex items-center gap-2 text-sm">
                <FiCheck className="h-4 w-4 shrink-0 text-[#ff7838]" />
                <span className="text-white">Included with your plan</span>
              </div>
            </div>

            {continueError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{continueError}</p>
              </div>
            )}

            <div className="flex gap-2.5">
              {onBack && (
                <Button type="button" variant="outline" onClick={onBack} className="shrink-0">
                  <FiArrowLeft className="h-4 w-4" />
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
