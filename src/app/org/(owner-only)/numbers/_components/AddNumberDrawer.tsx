import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCreditCard, FiZap } from 'react-icons/fi';
import { AvailableNumberItem, OrgNumberItem } from './types';
import {
  NumberSearchForm,
  SearchTabKey,
  CountryCode,
} from './NumberSearchForm';
import { AvailableNumberList } from './AvailableNumberList';
import { NumberPurchaseReview } from './NumberPurchaseReview';
import { PaymentMethodSelector, PaymentMethod } from './PaymentMethodSelector';
import { BankTransferPanel } from './BankTransferPanel';
import { Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { formatPhoneUS } from '@/lib/utils/phone';
import { addonApiService } from '@/lib/api/services/addon.service';

// API hooks
import { useSearchOrgNumbers, useBuyNumber } from '@/lib/hooks/useOrg';

interface AddNumberDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  existingNumbers: OrgNumberItem[];
}

export function AddNumberDrawer({
  isOpen,
  onClose,
  existingNumbers,
}: AddNumberDrawerProps) {
  // Search Form State
  const [country, setCountry] = useState<CountryCode>('US');
  const [tab, setTab] = useState<SearchTabKey>('city');
  const [city, setCity] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [digitFilter, setDigitFilter] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AvailableNumberItem[]>([]);

  // Selected Number & Step State
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumberItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // React Query Hooks
  const searchNumbersMutation = useSearchOrgNumbers();
  const buyNumberMutation = useBuyNumber();

  // Reset internal states
  const handleReset = () => {
    setCountry('US');
    setTab('city');
    setCity('');
    setAreaCode('');
    setDigitFilter('');
    setHasSearched(false);
    setSearchResults([]);
    setSelectedNumber(null);
    setPaymentMethod('card');
    setIsProcessingPayment(false);
  };

  const handleClose = () => {
    if (isProcessingPayment) return;
    handleReset();
    onClose();
  };

  const showPurchaseStep = (number: AvailableNumberItem) => {
    setSelectedNumber(number);
    setPaymentMethod('card');
    window.requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const showSearchStep = () => {
    setSelectedNumber(null);
    window.requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  // Run Search via Telnyx API or fallback
  const handleSearch = async () => {
    setIsSearching(true);
    setSelectedNumber(null);
    try {
      const res = await searchNumbersMutation.mutateAsync({
        country_code: country,
        locality: city.trim() || undefined,
        area_code: areaCode.trim() || undefined,
        number_type: 'local',
        limit: 20,
      });

      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: AvailableNumberItem[] = res.data
          .map((item) => ({
            phoneNumber: item.phoneNumber,
            countryCode: (item.countryCode || country) as 'US' | 'CA',
            locality: item.locality || city || undefined,
            region: item.region || undefined,
            numberType: (item.numberType || 'local') as AvailableNumberItem['numberType'],
            features: ['voice', 'sms'],
            monthlyCostCents: item.monthlyCostCents ?? 500,
            upfrontCostCents: item.upfrontCostCents ?? 0,
          }));
        // No client-side price ceiling: the backend already drops numbers above the
        // real carrier-cost limit BEFORE overlaying the plan price. Filtering here on
        // the overlaid (marked-up) price wrongly hid everything once a plan was priced
        // above $1 — the cause of the "0 numbers found" after a markup.
        setSearchResults(mapped);
      } else {
        setSearchResults([]);
      }
    } catch (error: unknown) {
      // A failed search shows its error state + a toast — NEVER fake inventory.
      // (Previously this fell back to a local mock pool, which let an owner select
      // and try to buy a number that doesn't exist.)
      setSearchResults([]);
      toast.error(
        error instanceof Error ? error.message : 'Number search failed. Please try again.'
      );
    } finally {
      setHasSearched(true);
      setIsSearching(false);
    }
  };

  // Available inventory = ONLY real Telnyx search results, minus numbers the org
  // already owns (then refined by the optional digit filter). No mock/fallback
  // pool: on zero results or an error the list renders its empty/error state, so
  // the owner is never shown a fake number they could try to purchase.
  const filteredInventory = useMemo(() => {
    if (!hasSearched) return [];

    const ownedPhones = new Set(existingNumbers.map((n) => n.phoneNumber));
    let results = searchResults.filter((n) => !ownedPhones.has(n.phoneNumber));

    if (digitFilter.trim()) {
      const digits = digitFilter.replace(/\D/g, '');
      if (digits) {
        results = results.filter((n) => n.phoneNumber.replace(/\D/g, '').includes(digits));
      }
    }

    return results;
  }, [hasSearched, digitFilter, existingNumbers, searchResults]);

  // Card purchase: add the number as a RECURRING monthly line item on the org's
  // existing subscription and provision it immediately — IN-APP, no Stripe redirect.
  // The charge is prorated for the current cycle (Stripe `always_invoice`) and the
  // number shows up on the next invoice like the plan. (This replaces the old
  // one-time Checkout path, which charged once, returned to the wrong URL, and never
  // actually provisioned the number.) Orgs with no subscription / no card on file get
  // a clear error and can use Bank transfer below instead.
  const handleCardCheckout = async () => {
    if (!selectedNumber) return;
    setIsProcessingPayment(true);
    try {
      await buyNumberMutation.mutateAsync({
        phoneNumber: selectedNumber.phoneNumber,
        countryCode: selectedNumber.countryCode,
        numberType: selectedNumber.numberType,
      });
      toast.success(
        `${formatPhoneUS(selectedNumber.phoneNumber)} added — billed monthly to your card on file.`
      );
      handleReset();
      onClose();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not complete the purchase. Please try again.'
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Bank transfer: upload proof, then create a pending admin-approval request.
  const handleBankSubmit = async (receipt: File) => {
    if (!selectedNumber) return;
    setIsProcessingPayment(true);
    try {
      const uploadResponse = await addonApiService.getUploadUrl({
        name: receipt.name,
        contentType: receipt.type,
        size: receipt.size,
      });

      const upload = await fetch(uploadResponse.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': receipt.type },
        body: receipt,
      });
      if (!upload.ok) throw new Error(`Receipt upload failed (HTTP ${upload.status})`);

      await addonApiService.submitBankTransfer(
        {
          addonType: 'number',
          phoneNumber: selectedNumber.phoneNumber,
          countryCode: selectedNumber.countryCode,
          numberType: selectedNumber.numberType,
        },
        uploadResponse.data.key
      );

      toast.success(
        `Payment submitted for approval — ${formatPhoneUS(selectedNumber.phoneNumber)} will be added after approval.`
      );
      handleReset();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit bank transfer');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Drawer Body */}
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-[var(--card)] shadow-2xl border-l border-[var(--border)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--foreground)]">Add a Phone Number</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Search carrier inventory and purchase a dedicated number for your organization.
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={isProcessingPayment}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Main Content Area */}
            <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <AnimatePresence mode="wait" initial={false}>
                {!selectedNumber ? (
                  <motion.div
                    key="number-search"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <NumberSearchForm
                      country={country}
                      onCountryChange={setCountry}
                      tab={tab}
                      onTabChange={setTab}
                      city={city}
                      onCityChange={setCity}
                      areaCode={areaCode}
                      onAreaCodeChange={setAreaCode}
                      digitFilter={digitFilter}
                      onDigitFilterChange={setDigitFilter}
                      onSearch={handleSearch}
                      isSearching={isSearching}
                    />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
                          Available Inventory
                        </h3>
                        {hasSearched && (
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {filteredInventory.length} numbers found
                          </span>
                        )}
                      </div>

                      <AvailableNumberList
                        numbers={filteredInventory}
                        selectedNumber={selectedNumber}
                        onSelectNumber={showPurchaseStep}
                        hasSearched={hasSearched}
                        isLoading={isSearching}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="number-purchase"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <NumberPurchaseReview
                      number={selectedNumber}
                      onBack={showSearchStep}
                    />

                    <PaymentMethodSelector
                      method={paymentMethod}
                      onChange={setPaymentMethod}
                    />

                    {paymentMethod === 'bank' ? (
                      <BankTransferPanel
                        amountLabel={`$${(selectedNumber.monthlyCostCents / 100).toFixed(2)}/mo`}
                        onSubmit={handleBankSubmit}
                        isSubmitting={isProcessingPayment}
                      />
                    ) : (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
                        <div className="flex items-center gap-2.5 text-xs text-[var(--foreground)]">
                          <FiCreditCard className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>
                            Adds{' '}
                            <strong className="font-semibold">
                              ${(selectedNumber.monthlyCostCents / 100).toFixed(2)}/mo
                            </strong>{' '}
                            to your subscription, charged to your card on file (prorated for this
                            month). The number is ready right away.
                          </span>
                        </div>
                        <Button
                          onClick={handleCardCheckout}
                          disabled={isProcessingPayment}
                          className="w-full justify-center gap-2"
                        >
                          <FiZap className="w-4 h-4" />
                          <span>
                            {isProcessingPayment
                              ? 'Adding number...'
                              : `Buy — $${(selectedNumber.monthlyCostCents / 100).toFixed(2)}/mo`}
                          </span>
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
