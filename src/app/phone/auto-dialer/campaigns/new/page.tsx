'use client';

/**
 * Create Campaign Page
 *
 * Multi-step form: name → select agent → add numbers → settings → create.
 *
 * @module app/phone/auto-dialer/campaigns/new/page
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FiArrowLeft,
  FiCpu,
  FiCheck,
  FiPhone,
  FiUpload,
  FiFile,
  FiX,
  FiDownload,
  FiUsers,
} from 'react-icons/fi';
import { Card, CardContent, Button, Input, StyledSelect } from '@/components/ui';
import { PageTransition } from '@/components/phone';
import { useCreateCampaign, useAgents } from '@/lib/hooks/useCampaigns';
import { autodialerService } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth';
import { parseExcelFile, parseManualList, type ParsedPhoneNumber } from '@/lib/utils/excelParser';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface FormData {
  name: string;
  description: string;
  agentId: string;
  callerId: string;
  maxConcurrentCalls: number;
  callTimeout: number;
  retryAttempts: number;
  scheduledAt: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    agentId: '',
    callerId: '',
    maxConcurrentCalls: 3,
    callTimeout: 30,
    retryAttempts: 1,
    scheduledAt: '',
  });
  const [recipients, setRecipients] = useState<ParsedPhoneNumber[]>([]);
  const [manualText, setManualText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const reuseId = searchParams.get('reuse');
  const user = useAuthStore((s) => s.user);
  const aiDialerNumbers = (user?.phoneNumbers || []).filter((p) => p.aiDialerEnabled);
  const { data: agentsData } = useAgents({ limit: 100 });
  const agents = agentsData?.agents.filter((a) => a.status === 'active') || [];
  const createCampaign = useCreateCampaign();

  // Pre-fill from reused campaign
  useEffect(() => {
    if (!reuseId) return;
    (async () => {
      try {
        const old = await autodialerService.getCampaign(parseInt(reuseId, 10));
        setForm((prev) => ({
          ...prev,
          name: `${old.name} (copy)`,
          description: old.description || '',
          agentId: old.agentId ? String(old.agentId) : '',
          callerId: old.callerId || '',
          maxConcurrentCalls: old.maxConcurrentCalls || 3,
          callTimeout: old.callTimeout || 30,
          retryAttempts: 1,
          scheduledAt: '',
        }));
        // Also load the numbers from the old campaign
        const nums = await autodialerService.getCampaignNumbers(parseInt(reuseId, 10), {
          limit: 10000,
        });
        if (nums.numbers.length > 0) {
          setRecipients(nums.numbers.map((n, i) => ({ phone: n.phoneNumber, row: i + 1 })));
        }
      } catch {
        /* ignore if campaign not found */
      }
    })();
  }, [reuseId]);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      setRecipients((prev) => {
        const existing = new Set(prev.map((p) => p.phone));
        const newOnes = parsed.filter((p) => !existing.has(p.phone));
        return [...prev, ...newOnes];
      });
      setUploadedFileName(file.name);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleParseManual = useCallback(() => {
    if (!manualText.trim()) return;
    const parsed = parseManualList(manualText);
    setRecipients((prev) => {
      const existing = new Set(prev.map((p) => p.phone));
      const newOnes = parsed.filter((p) => !existing.has(p.phone));
      return [...prev, ...newOnes];
    });
    setManualText('');
  }, [manualText]);

  const removeRecipient = useCallback((index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const downloadTemplate = useCallback(() => {
    const csv = 'Phone Number,Name\n+12125551234,John Smith\n+19175559876,Jane Doe\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-dialer-contacts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name) {
      setError('Campaign name is required');
      return;
    }
    if (!form.callerId) {
      setError('No caller ID assigned');
      return;
    }
    if (recipients.length === 0) {
      setError('Add at least one phone number');
      return;
    }

    try {
      const campaign = await createCampaign.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        callerId: form.callerId,
        maxConcurrentCalls: form.maxConcurrentCalls,
        callTimeout: form.callTimeout,
        retryAttempts: form.retryAttempts,
        scheduledAt: form.scheduledAt || undefined,
        numbers: recipients.map((r) => r.phone),
      });

      if (form.agentId) {
        await autodialerService.updateCampaign(campaign.id, {
          agentId: parseInt(form.agentId, 10),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- update payload type omits agentId; deliberate escape hatch
        } as any);
      }

      router.push(`/phone/auto-dialer/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    }
  }, [form, recipients, createCampaign, router]);

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col bg-[var(--card)]">
        {/* Header region */}
        <div className="shrink-0 border-b border-[var(--border)] px-5 pt-3.5 pb-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/phone/auto-dialer"
              aria-label="Back to campaigns"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <FiArrowLeft className="h-4 w-4" />
            </Link>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
              <FiCpu className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-[var(--foreground)]">New Campaign</h1>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">Step {step} of 3</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-3 flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-[var(--primary-600)]' : 'bg-[var(--muted)]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Scroll area */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-2xl space-y-4 px-5 py-4">
            {error && (
          <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Campaign Details</h2>
              <Input
                label="Campaign Name"
                required
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Spring Outreach 2026"
              />
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Campaign goal and notes..."
                />
              </div>

              {/* Outbound Caller ID — admin enables per number (like Bulk SMS) */}
              <div>
                <label className="block text-sm font-medium mb-1">Outbound Caller ID</label>
                <p className="text-xs text-muted-foreground mb-2">
                  The number recipients will see when called. Admin must enable AI Dialer on your
                  number.
                </p>
                {aiDialerNumbers.length > 0 ? (
                  aiDialerNumbers.length === 1 ? (
                    // Single AI number — show as read-only
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-muted/30">
                      <FiPhone className="h-4 w-4 text-[var(--foreground)]" />
                      <span className="text-sm font-mono font-medium">
                        {aiDialerNumbers[0].phoneNumber.startsWith('+')
                          ? aiDialerNumbers[0].phoneNumber
                          : `+${aiDialerNumbers[0].phoneNumber}`}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        AI Dialer enabled
                      </span>
                      {/* Auto-set callerId */}
                      {!form.callerId &&
                        (() => {
                          updateField(
                            'callerId',
                            aiDialerNumbers[0].phoneNumber.startsWith('+')
                              ? aiDialerNumbers[0].phoneNumber
                              : `+${aiDialerNumbers[0].phoneNumber}`
                          );
                          return null;
                        })()}
                    </div>
                  ) : (
                    // Multiple AI numbers — show dropdown
                    <StyledSelect
                      className="bg-background font-mono"
                      value={form.callerId}
                      onChange={(v) => updateField('callerId', v)}
                    >
                      <option value="">Select a number...</option>
                      {aiDialerNumbers.map((pn) => {
                        const num = pn.phoneNumber.startsWith('+')
                          ? pn.phoneNumber
                          : `+${pn.phoneNumber}`;
                        return (
                          <option key={pn.id} value={num}>
                            {num} {pn.label ? `(${pn.label})` : ''}{' '}
                            {pn.isPrimary ? '— Primary' : ''}
                          </option>
                        );
                      })}
                    </StyledSelect>
                  )
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5">
                    <FiPhone className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        No AI Dialer number enabled
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Contact your admin to enable AI Dialer on your phone number.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Agent Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">AI Agent</label>
                <p className="text-xs text-muted-foreground mb-2">
                  The AI voice agent that will handle calls in this campaign.
                </p>
                {agents.length === 0 ? (
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-dashed">
                    <span className="text-sm text-muted-foreground">
                      No active agents available
                    </span>
                    <Link
                      href="/phone/auto-dialer/agents"
                      className="text-xs text-[var(--foreground)] font-medium hover:underline"
                    >
                      Create Agent
                    </Link>
                  </div>
                ) : (
                  <StyledSelect
                    className="bg-background"
                    value={form.agentId}
                    onChange={(v) => updateField('agentId', v)}
                  >
                    <option value="">Select an agent...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.voiceName ? `— ${a.voiceName}` : ''}
                      </option>
                    ))}
                  </StyledSelect>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (!form.name) {
                      setError('Campaign name is required');
                      return;
                    }
                    if (!form.callerId) {
                      setError('No caller ID assigned. Contact your admin.');
                      return;
                    }
                    if (!form.agentId) {
                      setError('Please select an AI agent');
                      return;
                    }
                    setStep(2);
                  }}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Phone Numbers */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Phone Numbers</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Add the numbers you want the AI agent to call. Any format works.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 text-xs text-[var(--foreground)] hover:underline"
                >
                  <FiDownload className="h-3.5 w-3.5" />
                  Download Template
                </button>
              </div>

              {/* Upload Section */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary/40 hover:bg-primary/5 ${uploadedFileName ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {uploadedFileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FiFile className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {uploadedFileName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — {recipients.length} numbers loaded
                    </span>
                  </div>
                ) : (
                  <>
                    <FiUpload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Drop a file here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CSV or Excel (.xlsx, .xls) — any column layout works
                    </p>
                  </>
                )}
              </div>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">OR PASTE MANUALLY</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Manual Entry */}
              <div>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={
                    'Paste numbers in any format:\n2164281997\n+1 (312) 555-1234\nJohn, 4155559999'
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={handleParseManual}
                  disabled={!manualText.trim()}
                >
                  Add Numbers
                </Button>
              </div>

              {/* Recipients List */}
              {recipients.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <FiUsers className="h-4 w-4" />
                      {recipients.length} number{recipients.length !== 1 ? 's' : ''} added
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:underline"
                      onClick={() => {
                        setRecipients([]);
                        setUploadedFileName('');
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                    {recipients.map((r, i) => (
                      <div
                        key={`${r.phone}-${i}`}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">{formatPhoneNumber(r.phone)}</span>
                          {r.name && (
                            <span className="text-muted-foreground text-xs">{r.name}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRecipient(i)}
                          className="p-1 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <FiX className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                DNC numbers will be automatically filtered out when the campaign starts.
              </p>

              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (recipients.length === 0) {
                      setError('Add at least one number');
                      return;
                    }
                    setStep(3);
                  }}
                >
                  Next — {recipients.length} number{recipients.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Settings & Review */}
        {step === 3 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Settings & Review</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Max Concurrent Calls"
                  type="number"
                  value={String(form.maxConcurrentCalls)}
                  onChange={(e) => updateField('maxConcurrentCalls', Number(e.target.value))}
                />
                <Input
                  label="Call Timeout (sec)"
                  type="number"
                  value={String(form.callTimeout)}
                  onChange={(e) => updateField('callTimeout', Number(e.target.value))}
                />
                <Input
                  label="Retry Attempts"
                  type="number"
                  value={String(form.retryAttempts)}
                  onChange={(e) => updateField('retryAttempts', Number(e.target.value))}
                />
                <Input
                  label="Schedule (optional)"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => updateField('scheduledAt', e.target.value)}
                />
              </div>
              <div className="mt-4 p-4 bg-muted rounded-md text-sm space-y-1">
                <p>
                  <strong>Campaign:</strong> {form.name}
                </p>
                <p>
                  <strong>Caller ID:</strong> {form.callerId}
                </p>
                <p>
                  <strong>Agent:</strong>{' '}
                  {agents.find((a) => String(a.id) === form.agentId)?.name || 'Not selected'}
                </p>
                <p>
                  <strong>Numbers:</strong> {recipients.length}
                </p>
                <p>
                  <strong>Concurrency:</strong> {form.maxConcurrentCalls}
                </p>
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={createCampaign.isPending}>
                  <FiCheck className="mr-2 h-4 w-4" />
                  {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
