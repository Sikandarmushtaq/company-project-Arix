'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiCheck,
  FiDollarSign,
  FiLoader,
  FiSave,
} from 'react-icons/fi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { smsAdminService, type UpdateSmsPricingRequest } from '@/lib/api/services';

// Twilio US long-code reference rates — used only for the margin preview.
// The Twilio Bill Lookup section is the source of truth for actual cost.
const TWILIO_REF_COST = {
  smsOutbound: 0.0083,
  mmsOutbound: 0.022,
};

function formatCurrency(dollars: number): string {
  if (Math.abs(dollars) >= 1) return `$${dollars.toFixed(2)}`;
  if (Math.abs(dollars) >= 0.01) return `${(dollars * 100).toFixed(2)}¢`;
  return `${(dollars * 100).toFixed(3)}¢`;
}

/**
 * Customer-facing SMS/MMS pricing config card. Admin sets the per-segment
 * rate charged to customers; the card shows a live margin vs Twilio's
 * published US long-code rate. Save commits to `sms_pricing_config`.
 */
export default function PricingConfigCard() {
  const queryClient = useQueryClient();

  const {
    data: fetchedPricing,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sms-pricing'],
    queryFn: () => smsAdminService.getPricing(),
  });

  const [pricing, setPricing] = useState({
    smsOutboundPrice: 0.0083,
    smsInboundPrice: 0.0083,
    mmsOutboundPrice: 0.022,
    mmsInboundPrice: 0.0165,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync local form state when server data refreshes. Only overwrites if
  // the user hasn't made unsaved changes (preserves in-flight edits) AND
  // the server values actually differ from what we last synced — prevents
  // the post-save flicker where hasChanges flipping to false would briefly
  // restore the pre-save server snapshot before the refetch lands.
  const lastSyncedSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!fetchedPricing || hasChanges) return;
    const sig = `${fetchedPricing.smsOutboundPrice}|${fetchedPricing.smsInboundPrice}|${fetchedPricing.mmsOutboundPrice}|${fetchedPricing.mmsInboundPrice}`;
    if (lastSyncedSigRef.current === sig) return;
    lastSyncedSigRef.current = sig;
    setPricing({
      smsOutboundPrice: fetchedPricing.smsOutboundPrice,
      smsInboundPrice: fetchedPricing.smsInboundPrice,
      mmsOutboundPrice: fetchedPricing.mmsOutboundPrice,
      mmsInboundPrice: fetchedPricing.mmsInboundPrice,
    });
  }, [fetchedPricing, hasChanges]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSmsPricingRequest) => smsAdminService.updatePricing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-pricing'] });
      setSaveStatus('saved');
      setHasChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  const handleChange = useCallback((key: keyof typeof pricing, value: string) => {
    const numValue = parseFloat(value);
    // Bound the input — prevents Infinity/NaN from corrupting the form state.
    const safe =
      !Number.isFinite(numValue) || numValue < 0 ? 0 : Math.min(numValue, 100);
    setPricing((prev) => ({ ...prev, [key]: safe }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    setSaveStatus('saving');
    updateMutation.mutate({
      ...pricing,
      carrierSurcharge: 0.004,
      failedMessageFee: 0.001,
      markupPercentage: 0,
    });
  }, [pricing, updateMutation]);

  const margin = useMemo(() => {
    const smsProfit = pricing.smsOutboundPrice - TWILIO_REF_COST.smsOutbound;
    const mmsProfit = pricing.mmsOutboundPrice - TWILIO_REF_COST.mmsOutbound;
    return {
      sms: {
        yourRate: formatCurrency(pricing.smsOutboundPrice),
        twilioCost: formatCurrency(TWILIO_REF_COST.smsOutbound),
        profit: formatCurrency(Math.abs(smsProfit)),
        negative: smsProfit < 0,
        pct:
          TWILIO_REF_COST.smsOutbound > 0
            ? ((smsProfit / TWILIO_REF_COST.smsOutbound) * 100).toFixed(0)
            : '0',
      },
      mms: {
        yourRate: formatCurrency(pricing.mmsOutboundPrice),
        twilioCost: formatCurrency(TWILIO_REF_COST.mmsOutbound),
        profit: formatCurrency(Math.abs(mmsProfit)),
        negative: mmsProfit < 0,
        pct:
          TWILIO_REF_COST.mmsOutbound > 0
            ? ((mmsProfit / TWILIO_REF_COST.mmsOutbound) * 100).toFixed(0)
            : '0',
      },
    };
  }, [pricing]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-[var(--danger)]">
          <FiAlertTriangle className="w-8 h-8 mx-auto mb-2" />
          Failed to load SMS pricing config.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FiDollarSign className="w-5 h-5 text-[var(--foreground)]" />
            Customer Pricing (what you charge your users)
          </CardTitle>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveStatus === 'saving' || isLoading}
            className={
              saveStatus === 'saved'
                ? 'bg-green-600 hover:bg-green-700'
                : saveStatus === 'error'
                  ? 'bg-red-600 hover:bg-red-700'
                  : ''
            }
          >
            {saveStatus === 'saving' ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <FiCheck className="w-4 h-4" />
                Saved!
              </>
            ) : saveStatus === 'error' ? (
              <>
                <FiAlertTriangle className="w-4 h-4" />
                Failed
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Reference Twilio rates (US long-code): SMS {formatCurrency(TWILIO_REF_COST.smsOutbound)}
          /seg, MMS {formatCurrency(TWILIO_REF_COST.mmsOutbound)}/msg. Your rates below are what
          gets charged to your customers for each message.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Outbound SMS ($/seg)"
            value={String(pricing.smsOutboundPrice)}
            onChange={(e) => handleChange('smsOutboundPrice', e.target.value)}
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.0083"
          />
          <Input
            label="Inbound SMS ($/seg)"
            value={String(pricing.smsInboundPrice)}
            onChange={(e) => handleChange('smsInboundPrice', e.target.value)}
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.0083"
          />
          <Input
            label="Outbound MMS ($/msg)"
            value={String(pricing.mmsOutboundPrice)}
            onChange={(e) => handleChange('mmsOutboundPrice', e.target.value)}
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.0220"
          />
          <Input
            label="Inbound MMS ($/msg)"
            value={String(pricing.mmsInboundPrice)}
            onChange={(e) => handleChange('mmsInboundPrice', e.target.value)}
            type="number"
            step="0.0001"
            min="0"
            placeholder="0.0165"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-medium text-[var(--foreground)] mb-2">SMS (1 segment)</p>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--muted-foreground)]">Your rate:</span>
              <span className="font-mono">{margin.sms.yourRate}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--muted-foreground)]">Twilio ref:</span>
              <span className="font-mono">{margin.sms.twilioCost}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">Margin:</span>
              <span
                className={`font-mono font-bold ${margin.sms.negative ? 'text-red-600' : 'text-green-600'}`}
              >
                {margin.sms.negative ? '−' : ''}
                {margin.sms.profit}
                {!margin.sms.negative &&
                  Number(margin.sms.pct) > 0 &&
                  ` (${margin.sms.pct}%)`}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-medium text-[var(--foreground)] mb-2">MMS</p>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--muted-foreground)]">Your rate:</span>
              <span className="font-mono">{margin.mms.yourRate}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--muted-foreground)]">Twilio ref:</span>
              <span className="font-mono">{margin.mms.twilioCost}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-[var(--border)]">
              <span className="text-[var(--muted-foreground)]">Margin:</span>
              <span
                className={`font-mono font-bold ${margin.mms.negative ? 'text-red-600' : 'text-green-600'}`}
              >
                {margin.mms.negative ? '−' : ''}
                {margin.mms.profit}
                {!margin.mms.negative &&
                  Number(margin.mms.pct) > 0 &&
                  ` (${margin.mms.pct}%)`}
              </span>
            </div>
          </div>
        </div>

        {fetchedPricing?.updatedAt && (
          <p className="text-xs text-[var(--muted-foreground)] text-right mt-3">
            Last updated: {new Date(fetchedPricing.updatedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
