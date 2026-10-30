'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { whatsappAdminService } from '@/lib/api/services/whatsapp.service';
import type { UpdateWaPricingRequest } from '@/lib/api/services/whatsapp-types';
import { toast } from 'sonner';

export default function WhatsAppPricingPage() {
  const queryClient = useQueryClient();

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['wa-pricing'],
    queryFn: () => whatsappAdminService.getPricing(),
    staleTime: 30000,
  });

  const [form, setForm] = useState({
    marketingConversationPrice: 0.025,
    utilityConversationPrice: 0.015,
    authenticationConversationPrice: 0.0135,
    serviceConversationPrice: 0,
    markupPercentage: 0,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [trackedVersion, setTrackedVersion] = useState('');

  useEffect(() => {
    if (pricing && pricing.updatedAt !== trackedVersion) {
      setForm({
        marketingConversationPrice: pricing.marketingConversationPrice,
        utilityConversationPrice: pricing.utilityConversationPrice,
        authenticationConversationPrice: pricing.authenticationConversationPrice,
        serviceConversationPrice: pricing.serviceConversationPrice,
        markupPercentage: pricing.markupPercentage,
      });
      setTrackedVersion(pricing.updatedAt);
      setHasChanges(false);
    }
  }, [pricing, trackedVersion]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateWaPricingRequest) => whatsappAdminService.updatePricing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-pricing'] });
      setSaveStatus('saved');
      setHasChanges(false);
      toast.success('WhatsApp pricing updated');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('error');
      toast.error('Failed to update pricing');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  const handleChange = (field: string, value: string) => {
    const num = parseFloat(value) || 0;
    setForm((prev) => ({ ...prev, [field]: num }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    updateMutation.mutate(form);
  };

  // Meta reference rates (US, 2024)
  const metaRates = {
    marketing: 0.025,
    utility: 0.015,
    authentication: 0.0135,
    service: 0.0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaWhatsapp className="text-green-500" />
            WhatsApp Pricing
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Configure conversation-based pricing for WhatsApp Business
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saveStatus === 'saved'
              ? 'bg-green-500/20 text-green-400'
              : saveStatus === 'error'
                ? 'bg-red-500/20 text-red-400'
                : hasChanges
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] cursor-not-allowed'
          }`}
        >
          {saveStatus === 'saving' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : saveStatus === 'saved' ? (
            <FiCheck className="w-4 h-4" />
          ) : saveStatus === 'error' ? (
            <FiAlertCircle className="w-4 h-4" />
          ) : (
            <FiSave className="w-4 h-4" />
          )}
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Rates Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Conversation Rates (per 24h window)</h2>
          <div className="space-y-3">
            {[
              {
                key: 'marketingConversationPrice',
                label: 'Marketing',
                desc: 'Promotional messages, offers',
              },
              {
                key: 'utilityConversationPrice',
                label: 'Utility',
                desc: 'Order updates, account alerts',
              },
              {
                key: 'authenticationConversationPrice',
                label: 'Authentication',
                desc: 'OTP, verification codes',
              },
              {
                key: 'serviceConversationPrice',
                label: 'Service',
                desc: 'Customer-initiated support',
              },
            ].map(({ key, label, desc }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--muted-foreground)]">$</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
                  />
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Markup & Reference Card */}
        <div className="space-y-6">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Business Markup</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Markup Percentage</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.markupPercentage}
                  onChange={(e) => handleChange('markupPercentage', e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm"
                />
                <span className="text-sm text-[var(--muted-foreground)]">%</span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Applied on top of conversation cost for revenue
              </p>
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Meta Reference Rates (US)</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(metaRates).map(([key, rate]) => (
                <div
                  key={key}
                  className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border)]"
                >
                  <div className="text-xs text-[var(--muted-foreground)] capitalize">{key}</div>
                  <div className="text-lg font-semibold">${rate.toFixed(4)}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              WhatsApp charges per conversation (24-hour window), not per message. Rates vary by
              country and category.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
