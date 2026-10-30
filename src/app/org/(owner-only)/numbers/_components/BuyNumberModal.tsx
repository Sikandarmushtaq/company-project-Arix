'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FiSearch, FiMapPin, FiHash, FiLoader, FiArrowLeft, FiPhone } from 'react-icons/fi';
import { Modal, Button, Input, Tabs, TabsList, TabsTrigger, StyledSelect } from '@/components/ui';
import { useSearchOrgNumbers, useBuyNumber, useOrgBilling } from '@/lib/hooks/useOrg';
import { toast } from '@/lib/stores/toast';
import { formatPhoneUS } from '@/lib/utils/phone';
import type { AvailableNumber } from '@/lib/api/services/onboarding.service';
import AddonPayChoice from '@/components/org/AddonPayChoice';

type TabKey = 'city' | 'area' | 'tollfree';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Country = 'US' | 'CA';

export default function BuyNumberModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>('city');
  const [country, setCountry] = useState<Country>('US');
  const [city, setCity] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [digitFilter, setDigitFilter] = useState('');
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);

  const searchMutation = useSearchOrgNumbers();
  const buyMutation = useBuyNumber();
  const { data: billing } = useOrgBilling();
  const queryClient = useQueryClient();
  // Additional numbers bill on the plan's interval ($5/mo or $48/yr).
  const priceText = billing?.subscription?.interval === 'year' ? '$48/year' : '$5/month';

  const reset = () => {
    setTab('city');
    setCountry('US');
    setCity('');
    setAreaCode('');
    setDigitFilter('');
    setResults([]);
    setSearched(false);
    setSelected(null);
  };

  const handleClose = () => {
    if (buyMutation.isPending) return;
    reset();
    onClose();
  };

  const runSearch = async () => {
    setSelected(null);
    setSearched(true);
    try {
      const res = await searchMutation.mutateAsync({
        // Toll-free is a shared NANP pool (searched under US) — the country
        // selector only applies to local (city/area-code) numbers.
        country_code: tab === 'tollfree' ? 'US' : country,
        locality: tab === 'city' && city.trim() ? city.trim() : undefined,
        area_code: tab === 'area' && areaCode.trim() ? areaCode.trim() : undefined,
        number_type: tab === 'tollfree' ? 'toll_free' : 'local',
        limit: 20,
      });
      setResults(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not search numbers');
      setResults([]);
    }
  };

  // Client-side "filter by digits or phrases" over the fetched results.
  const filtered = useMemo(() => {
    const q = digitFilter.replace(/\D/g, '');
    if (!q) return results;
    return results.filter((n) => n.phoneNumber.replace(/\D/g, '').includes(q));
  }, [results, digitFilter]);

  const handleBuy = async () => {
    if (!selected) return;
    try {
      await buyMutation.mutateAsync({
        phoneNumber: selected.phoneNumber,
        countryCode: selected.countryCode || country,
        numberType: (selected.numberType as 'local' | 'toll_free' | 'national') || 'local',
      });
      toast.success(`${formatPhoneUS(selected.phoneNumber)} added to your organization`);
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the number');
    }
  };

  // ---- Confirm step -------------------------------------------------------
  if (selected) {
    // A card on file → charge it instantly (existing flow). No card → offer the
    // pay-choice (add a card for instant activation, or bank transfer w/ approval).
    const hasCard = !!billing?.paymentMethod;
    const bankAmount = billing?.subscription?.interval === 'year' ? '$48.00' : '$5.00';
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={hasCard ? 'Add number' : 'Add number — choose payment'}
        size={hasCard ? 'sm' : 'md'}
      >
        {hasCard ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--muted)] text-[var(--foreground)]">
                <FiPhone className="w-5 h-5" />
              </span>
              <div>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {formatPhoneUS(selected.phoneNumber)}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {[selected.locality, selected.region].filter(Boolean).join(', ') ||
                    ((selected.countryCode || country) === 'CA' ? 'Canada' : 'United States')}
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              By adding this number to your organization, your card on file will be charged an
              additional <span className="font-medium text-[var(--foreground)]">{priceText}</span>{' '}
              plus applicable taxes and fees.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelected(null)}
                disabled={buyMutation.isPending}
              >
                <FiArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={handleBuy}
                loading={buyMutation.isPending}
                disabled={buyMutation.isPending}
              >
                {buyMutation.isPending ? 'Adding…' : 'Add number'}
              </Button>
            </div>
          </div>
        ) : (
          <AddonPayChoice
            addon={{
              addonType: 'number',
              phoneNumber: selected.phoneNumber,
              countryCode: selected.countryCode || country,
              numberType:
                (selected.numberType as 'local' | 'toll_free' | 'national') || 'local',
            }}
            label={formatPhoneUS(selected.phoneNumber)}
            amountLabel={bankAmount}
            onBack={() => setSelected(null)}
            onSubmitted={() => {
              // Refresh the submitter's own request list immediately so the new
              // "pending" row shows right away — don't wait on the WS round-trip.
              queryClient.invalidateQueries({ queryKey: ['org', 'addon-requests'] });
              reset();
              onClose();
            }}
          />
        )}
      </Modal>
    );
  }

  // ---- Search step --------------------------------------------------------
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add a number" size="md">
      <div className="space-y-4">
        {/* Country — search US or Canada numbers (both NANP). Switching clears
            prior results so a US search never lingers on a Canada view. */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--foreground)]">Country</span>
          <StyledSelect
            value={country}
            onChange={(v) => {
              const c = v as Country;
              if (c === country) return;
              setCountry(c);
              setResults([]);
              setSearched(false);
              setSelected(null);
            }}
            className="w-44 bg-[var(--card)]"
            aria-label="Number country"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </StyledSelect>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          {/* Toll-free is not available to org admins — local (city / area code) only. */}
          <TabsList variant="underline" className="w-full">
            <TabsTrigger value="city" variant="underline">By city</TabsTrigger>
            <TabsTrigger value="area" variant="underline">By area code</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3">
          {tab === 'city' && (
            <Input
              label="City"
              leftIcon={<FiMapPin className="w-4 h-4" />}
              placeholder="Enter a city name"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
          )}
          {tab === 'area' && (
            <Input
              label="Area code"
              leftIcon={<FiHash className="w-4 h-4" />}
              placeholder="e.g. 415"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
          )}
          <div className="flex gap-2">
            <Input
              hideLabel
              label="Filter"
              leftIcon={<FiSearch className="w-4 h-4" />}
              placeholder="Filter by digits"
              value={digitFilter}
              onChange={(e) => setDigitFilter(e.target.value)}
              className="flex-1"
            />
            <Button onClick={runSearch} loading={searchMutation.isPending}>
              Search
            </Button>
          </div>
        </div>

        <div className="min-h-[220px] max-h-[340px] overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
          {searchMutation.isPending ? (
            <div className="flex items-center justify-center py-16">
              <FiLoader className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : !searched ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)]">
              <FiSearch className="w-6 h-6 mb-2" />
              Search to see available numbers.
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)]">
              No numbers found. Try another {tab === 'area' ? 'area code' : tab === 'city' ? 'city' : 'search'}.
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.phoneNumber}
                type="button"
                onClick={() => setSelected(n)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--muted)]/60 transition-colors"
              >
                <span className="font-mono text-sm font-medium text-[var(--foreground)]">
                  {formatPhoneUS(n.phoneNumber)}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {[n.locality, n.region].filter(Boolean).join(', ')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
