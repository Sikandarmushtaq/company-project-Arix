'use client';

import React, { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  FiUpload,
  FiFile,
  FiUsers,
  FiMessageSquare,
  FiLoader,
  FiX,
  FiCheckCircle,
  FiClock,
  FiTrash2,
  FiPlay,
  FiPause,
  FiAlertTriangle,
  FiRefreshCw,
  FiSend,
  FiHash,
  FiDownload,
  FiEye,
  FiLock,
  FiMail,
  FiPhone,
} from 'react-icons/fi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  StyledSelect,
} from '@/components/ui';
import { parseExcelFile, parseManualList } from '@/lib/utils/excelParser';
import { useAutoSms, type QueuedMessage } from '@/lib/hooks/useAutoSms';
import {
  useCreateBulkSmsCampaign,
  useUpdateBulkSmsCampaign,
} from '@/lib/hooks/useBulkSmsCampaigns';
import { CampaignHistory } from './_components/CampaignHistory';
import { TemplatePicker } from './_components/TemplatePicker';
import { resolveTemplate } from '@/lib/stores/bulkSms';
// useSendMessage removed — bulk SMS calls smsService.sendSms directly with explicit `from`
import { useToast } from '@/lib/stores/toast';
import { useConfirm } from '@/lib/hooks';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { useAuthStore } from '@/lib/stores';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { smsService } from '@/lib/api/services/sms.service';
import { userSettingsService } from '@/lib/api/services/user-settings.service';
import { PageTransition } from '@/components/phone';
import { calculateSmsSegments, sanitizeSmsText } from '@/app/phone/messages/_components/utils';

// ── SMS segment calculation (uses proper GSM-7 detection) ────
function getSmsSegments(text: string): {
  chars: number;
  segments: number;
  limit: number;
  isUnicode: boolean;
} {
  const info = calculateSmsSegments(text);
  return {
    chars: info.effectiveLength,
    segments: info.segmentCount,
    limit: info.charsPerSegment || (info.isUnicode ? 70 : 160),
    isUnicode: info.isUnicode,
  };
}

// ── Demo format download ─────────────────────────────────────
function downloadDemoFormat() {
  const rows = [
    ['Name', 'Phone', 'Address'],
    ['John Smith', '2125551234', '123 Main St'],
    ['Jane Doe', '9175559876', '456 Oak Ave'],
    ['Bob Wilson', '3105557890', '789 Pine Rd'],
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-sms-format.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV export ───────────────────────────────────────────────
function exportCampaignCSV(sent: QueuedMessage[], failed: QueuedMessage[]) {
  const rows = [['Phone', 'Name', 'Address', 'Status', 'Time', 'Error', 'Message'].join(',')];

  for (const msg of sent) {
    rows.push(
      [
        msg.to,
        csvEscape(msg.name || ''),
        csvEscape(msg.address || ''),
        'Sent',
        msg.sentAt ? new Date(msg.sentAt).toLocaleString() : '',
        '',
        csvEscape(msg.body),
      ].join(',')
    );
  }
  for (const msg of failed) {
    rows.push(
      [
        msg.to,
        csvEscape(msg.name || ''),
        csvEscape(msg.address || ''),
        'Failed',
        '',
        csvEscape(msg.error || 'Unknown'),
        csvEscape(msg.body),
      ].join(',')
    );
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bulk-sms-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// ── Constants ────────────────────────────────────────────────
const INTERVAL_OPTIONS = [
  { value: 3, label: '3s' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
];

// ── Phone number row ─────────────────────────────────────────
const PhoneRow = memo(function PhoneRow({
  phone,
  name,
  address,
  status,
  onRemove,
  disabled,
}: {
  phone: string;
  name?: string;
  address?: string;
  status: QueuedMessage | null;
  onRemove: () => void;
  disabled: boolean;
}) {
  const currentStatus = status?.status;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]/30 transition-colors group">
      <div className="flex-shrink-0">
        {currentStatus === 'pending' && <FiClock className="w-4 h-4 text-amber-500" />}
        {currentStatus === 'sending' && <FiLoader className="w-4 h-4 text-blue-500 animate-spin" />}
        {!currentStatus && <FiHash className="w-4 h-4 text-[var(--muted-foreground)]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate">
          {formatPhoneNumber(phone)}
        </p>
        {(name || address) && (
          <p className="text-xs text-[var(--muted-foreground)] truncate">
            {[name, address].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      {currentStatus && (
        <Badge variant={currentStatus === 'pending' ? 'warning' : 'info'} size="sm">
          {currentStatus === 'pending' ? 'Queued' : 'Sending'}
        </Badge>
      )}
      {!currentStatus && !disabled && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--muted)] transition-all"
          aria-label={`Remove ${formatPhoneNumber(phone)}`}
        >
          <FiX className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        </button>
      )}
    </div>
  );
});

// ── Wizard stepper ───────────────────────────────────────────
const WIZARD_STEPS = ['Recipients', 'Message', 'Review & Send'];

function WizardStepper({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick: (i: number) => void;
}) {
  return (
    <div className="flex items-center">
      {WIZARD_STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            <button
              type="button"
              onClick={() => onStepClick(i)}
              disabled={i > step}
              className={`flex items-center gap-2 ${i > step ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black transition-colors ${
                  done
                    ? 'bg-[var(--primary-600)] text-white'
                    : active
                      ? 'bg-[var(--primary-600)] text-white ring-4 ring-[var(--primary-600)]/15'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                }`}
              >
                {done ? <FiCheckCircle className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`hidden text-sm font-semibold transition-colors sm:inline ${
                  active
                    ? 'text-[var(--foreground)]'
                    : done
                      ? 'text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)]'
                }`}
              >
                {label}
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div className="mx-2 h-px flex-1 bg-[var(--border)]">
                <div
                  className="h-full bg-[var(--primary-600)] transition-all duration-300"
                  style={{ width: done ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <span className="text-right text-sm font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function BulkSmsPage() {
  const { user } = useAuthStore();
  const { modules } = usePermissions();
  const searchParams = useSearchParams();
  const campaignParam = searchParams.get('campaign');
  const deepLinkCampaignId = campaignParam ? parseInt(campaignParam, 10) || null : null;
  const [manualList, setManualList] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'manual'>('file');
  const [mode, setMode] = useState<'list' | 'compose'>('list'); // list = history, compose = wizard
  const [browsingList, setBrowsingList] = useState(false); // viewing history while a paused run is parked
  const [step, setStep] = useState(0); // wizard: 0 recipients · 1 message · 2 review
  const [campaignName, setCampaignName] = useState('');
  const campaignIdRef = useRef<number | null>(null); // read by the send callback
  const finalizedRef = useRef(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { confirm } = useConfirm();
  const [smsUsage, setSmsUsage] = useState<{
    sent: number;
    limit: number;
    remaining: number;
  } | null>(null);

  // ── Isolated phone selector (does NOT change global active phone) ──
  const phoneNumbers = user?.phoneNumbers || [];
  const hasMultiplePhones = phoneNumbers.length > 1;
  const [selectedPhone, setSelectedPhone] = useState('');
  const selectedPhoneRef = useRef('');

  // Initialize to matching phoneNumber entry (avoids format mismatch between senderPhone and phoneNumber values)
  useEffect(() => {
    if (selectedPhone || !user?.senderPhone) return;
    const senderDigits = user.senderPhone.replace(/\D/g, '');
    const match = phoneNumbers.find((p) => p.phoneNumber.replace(/\D/g, '') === senderDigits);
    const initial = match?.phoneNumber || user.senderPhone;
    setSelectedPhone(initial);
    selectedPhoneRef.current = initial;
  }, [user?.senderPhone, phoneNumbers.length]); // eslint-disable-line react-hooks/exhaustive-deps -- init once

  // Keep ref in sync
  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  // Check if selected phone has auto SMS enabled
  // If phoneNumbers is empty (user not in multi-number table), allow by default (no regression)
  // Auto-SMS is an ORG-level entitlement — enabled for the org ⇒ available to EVERY
  // user in it (no per-user smsType / per-number flag). The org `sms` + `auto_sms`
  // modules are the single source of truth.
  const hasAccess = modules?.['sms'] !== false && modules?.['auto_sms'] !== false;
  const isAutoSmsEnabled = hasAccess;

  // Fetch SMS usage on mount
  useEffect(() => {
    smsService
      .getUsage()
      .then(setSmsUsage)
      .catch(() => {});
  }, []);

  const {
    isRunning,
    start,
    pause,
    recipients,
    setRecipients,
    removeRecipient,
    queue,
    sentMessages,
    failedMessages,
    messageTemplate,
    setMessageTemplate,
    uploadedFileName,
    setUploadedFileName,
    intervalSeconds,
    setIntervalSeconds,
    queueBulkMessages,
    retryFailed,
    clearAll,
    setSendCallback,
    // Persisted (survives remount/refresh) so a paused/active run can always be
    // finalized — aliased to keep the existing campaignId/setCampaignId code.
    currentCampaignId: campaignId,
    setCurrentCampaignId: setCampaignId,
  } = useAutoSms();

  // Campaign history (client-reported: the send loop stays client-side; these
  // record each run's lifecycle so the history list can render).
  const createCampaign = useCreateBulkSmsCampaign();
  const updateCampaign = useUpdateBulkSmsCampaign();

  // Determine admin-controlled interval settings
  const adminInterval = user?.bulkSmsInterval ?? 5;
  const userCanControlInterval = user?.bulkSmsIntervalControl ?? false;

  // Initialize interval from user settings on first render
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current || !user) return;
    initializedRef.current = true;
    if (!userCanControlInterval) {
      // Admin controls: force admin interval
      setIntervalSeconds(adminInterval);
    } else {
      // User controls: use saved preference or admin default
      setIntervalSeconds(user.userBulkSmsInterval ?? adminInterval);
    }
  }, [user, adminInterval, userCanControlInterval, setIntervalSeconds]);

  // When admin revokes control via real-time update, force admin interval
  useEffect(() => {
    if (!userCanControlInterval) {
      setIntervalSeconds(adminInterval);
    }
  }, [userCanControlInterval, adminInterval, setIntervalSeconds]);

  // Handle user changing interval (persist to backend when allowed)
  const handleIntervalChange = useCallback(
    async (seconds: number) => {
      setIntervalSeconds(seconds);
      if (userCanControlInterval) {
        try {
          await userSettingsService.updateBulkSmsInterval(seconds);
          // Update local auth store
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            useAuthStore.getState().setUser({ ...currentUser, userBulkSmsInterval: seconds });
          }
        } catch {
          // Silently fail - interval is already set locally
        }
      }
    },
    [userCanControlInterval, setIntervalSeconds]
  );

  const totalSent = sentMessages.length;
  const failedCount = failedMessages.length;

  // Refresh usage after campaign completes
  useEffect(() => {
    if (totalSent > 0 && queue.length === 0) {
      smsService
        .getUsage()
        .then(setSmsUsage)
        .catch(() => {});
    }
  }, [totalSent, queue.length]);

  // Keep the campaign-id ref in sync so the (stable) send callback tags each
  // message with the current campaign.
  useEffect(() => {
    campaignIdRef.current = campaignId;
  }, [campaignId]);

  // Wire up send callback — uses smsService directly with explicit `from` (isolated
  // phone selector) and tags the message with the bulk campaign id (attribution).
  useEffect(() => {
    setSendCallback(async (to: string, body: string) => {
      await smsService.sendSms({
        to,
        body,
        from: selectedPhoneRef.current,
        ...(campaignIdRef.current ? { bulkCampaignId: campaignIdRef.current } : {}),
      });
    });
  }, [setSendCallback]);

  // Template detection
  const hasNameVar = messageTemplate.includes('{name}');
  const hasAddressVar = messageTemplate.includes('{address}');
  const hasTemplateVar = hasNameVar || hasAddressVar;
  const hasNames = recipients.some((r) => r.name);
  const hasAddresses = recipients.some((r) => r.address);

  // File processing
  const handleFileProcess = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseExcelFile(file);
        if (parsed.length === 0) {
          toast.error('No valid phone numbers found in file');
          return;
        }
        setRecipients(parsed);
        setUploadedFileName(file.name);
        toast.success(`Imported ${parsed.length} phone numbers`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to parse file');
      }
    },
    [toast, setRecipients, setUploadedFileName]
  );

  // Dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) handleFileProcess(files[0]);
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
    disabled: isRunning,
    noClick: true,
    noKeyboard: true,
  });

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleFileProcess(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [handleFileProcess]
  );

  const handleParseManual = useCallback(() => {
    if (!manualList.trim()) {
      toast.error('Please enter phone numbers');
      return;
    }
    const parsed = parseManualList(manualList);
    if (parsed.length === 0) {
      toast.error('No valid phone numbers found');
      return;
    }
    setRecipients(parsed);
    setUploadedFileName(null);
    toast.success(`Parsed ${parsed.length} phone numbers`);
  }, [manualList, toast, setRecipients, setUploadedFileName]);

  const handleStartCampaign = useCallback(async () => {
    if (!messageTemplate.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (recipients.length === 0) {
      toast.error('Please add phone numbers first');
      return;
    }
    if (!isAutoSmsEnabled) {
      toast.error('Auto SMS is not enabled for this phone number. Contact your admin.');
      return;
    }

    const { segments } = getSmsSegments(messageTemplate);
    const totalSegments = segments * recipients.length;
    const estMinutes = Math.ceil((recipients.length * intervalSeconds) / 60);

    // Pre-flight check: warn if recipients exceed remaining SMS limit
    let limitWarning = '';
    if (smsUsage && smsUsage.limit > 0 && recipients.length > smsUsage.remaining) {
      limitWarning = `\n\nWarning: You have ${smsUsage.remaining} message${smsUsage.remaining !== 1 ? 's' : ''} remaining but ${recipients.length} recipients. Only the first ${smsUsage.remaining} will send successfully.`;
    }

    const sendingFrom = formatPhoneNumber(selectedPhoneRef.current);
    const confirmed = await confirm({
      title: 'Start Bulk SMS Campaign',
      message: `Send ${recipients.length} message${recipients.length !== 1 ? 's' : ''} (${totalSegments} SMS segment${totalSegments !== 1 ? 's' : ''}) from ${sendingFrom}?\n\nInterval: ${intervalSeconds}s between messages\nEstimated time: ~${estMinutes} minute${estMinutes !== 1 ? 's' : ''}${hasTemplateVar ? `\nUsing ${[hasNameVar && '{name}', hasAddressVar && '{address}'].filter(Boolean).join(', ')} personalization` : ''}${limitWarning}`,
      confirmText: 'Start Sending',
      variant: limitWarning ? 'danger' : 'info',
    });

    if (!confirmed) return;

    // Create the campaign record FIRST and await its id, so every message can be
    // tagged with it (attribution). History is best-effort: if the record fails,
    // we still send — the messages just go untagged.
    finalizedRef.current = false;
    setCampaignId(null);
    campaignIdRef.current = null;
    const name = campaignName.trim() || `Bulk SMS — ${new Date().toLocaleString()}`;
    try {
      const created = await createCampaign.mutateAsync({
        name,
        fromNumber: selectedPhoneRef.current,
        messageTemplate: messageTemplate.trim(),
        intervalSeconds,
        totalCount: recipients.length,
      });
      campaignIdRef.current = created.id;
      setCampaignId(created.id);
    } catch {
      /* history is best-effort; the send itself is unaffected */
    }

    queueBulkMessages(recipients, messageTemplate.trim());
    start();
    toast.success(`Campaign started: ${recipients.length} messages queued`);
  }, [
    messageTemplate,
    recipients,
    confirm,
    intervalSeconds,
    hasTemplateVar,
    hasNameVar,
    hasAddressVar,
    queueBulkMessages,
    start,
    toast,
    smsUsage,
    isAutoSmsEnabled,
    campaignName,
    createCampaign,
  ]);

  const handleExport = useCallback(() => {
    exportCampaignCSV(sentMessages, failedMessages);
    toast.success('Report downloaded');
  }, [sentMessages, failedMessages, toast]);

  // Computed values
  const { chars, segments, limit, isUnicode } = getSmsSegments(messageTemplate);

  // Calculate whether sanitization can reduce segments
  const canReduceSegments = useMemo(() => {
    if (!isUnicode || !messageTemplate.trim()) return false;
    const sanitized = sanitizeSmsText(messageTemplate);
    const sanitizedInfo = calculateSmsSegments(sanitized);
    return sanitizedInfo.segmentCount < segments;
  }, [messageTemplate, isUnicode, segments]);

  const reducedSegmentCount = useMemo(() => {
    if (!canReduceSegments) return segments;
    return calculateSmsSegments(sanitizeSmsText(messageTemplate)).segmentCount;
  }, [canReduceSegments, messageTemplate, segments]);

  // Store original template before sanitization for undo
  const [originalTemplate, setOriginalTemplate] = useState<string | null>(null);

  const handleReduceSegments = useCallback(() => {
    setOriginalTemplate(messageTemplate);
    setMessageTemplate(sanitizeSmsText(messageTemplate));
  }, [messageTemplate, setMessageTemplate]);

  const handleUndoReduce = useCallback(() => {
    if (originalTemplate !== null) {
      setMessageTemplate(originalTemplate);
      setOriginalTemplate(null);
    }
  }, [originalTemplate, setMessageTemplate]);

  // Clear undo state when user manually edits
  useEffect(() => {
    if (
      originalTemplate !== null &&
      messageTemplate !== sanitizeSmsText(originalTemplate) &&
      messageTemplate !== originalTemplate
    ) {
      setOriginalTemplate(null);
    }
  }, [messageTemplate, originalTemplate]);

  // A run exists in the store (may be running, paused, or finished).
  const hasRun = queue.length > 0 || totalSent > 0 || failedCount > 0;
  // Show the dashboard for it — UNLESS the user chose to browse the history list
  // while a paused run is parked (so a paused campaign stays resumable).
  const campaignActive = hasRun && !browsingList;
  const totalMessages = queue.length + totalSent + failedCount;
  const progressPct = totalMessages > 0 ? (totalSent / totalMessages) * 100 : 0;
  const canExport = totalSent > 0 || failedCount > 0;

  // Wizard: estimated send time + per-step gating
  const estMinutes = Math.ceil((recipients.length * intervalSeconds) / 60);
  const canAdvance = step === 0 ? recipients.length > 0 : step === 1 ? !!messageTemplate.trim() : true;

  // Finalize the campaign history record when the run drains naturally.
  useEffect(() => {
    if (
      campaignId &&
      !finalizedRef.current &&
      !isRunning &&
      queue.length === 0 &&
      (totalSent > 0 || failedCount > 0)
    ) {
      finalizedRef.current = true;
      updateCampaign.mutate({
        id: campaignId,
        data: { status: 'completed', sentCount: totalSent, failedCount },
      });
    }
  }, [campaignId, isRunning, queue.length, totalSent, failedCount, updateCampaign]);

  // Return to the history list, finalizing the record (completed if it ran to
  // the end, cancelled if aborted mid-run).
  const handleStartNew = useCallback(async () => {
    if (queue.length > 0) {
      const confirmed = await confirm({
        title: 'Stop & Clear Campaign',
        message: 'This campaign hasn’t finished. Stop it and return to campaigns?',
        confirmText: 'Stop & Clear',
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    if (campaignId && !finalizedRef.current) {
      finalizedRef.current = true;
      const finalStatus = queue.length === 0 && totalSent > 0 ? 'completed' : 'cancelled';
      updateCampaign.mutate({
        id: campaignId,
        data: { status: finalStatus, sentCount: totalSent, failedCount },
      });
    }
    setManualList('');
    clearAll();
    setCampaignId(null);
    campaignIdRef.current = null;
    setCampaignName('');
    setStep(0);
    setMode('list');
  }, [queue.length, confirm, campaignId, totalSent, failedCount, updateCampaign, clearAll]);

  // Return to the history list. A PAUSED run (queue remaining) is parked, not
  // cleared, so it stays resumable — we just record it as "Paused" and browse
  // the list. A finished run is recorded "Completed" and cleared. No confirm.
  const handleBackToCampaigns = useCallback(() => {
    const paused = queue.length > 0;
    if (campaignId) {
      updateCampaign.mutate({
        id: campaignId,
        data: { status: paused ? 'paused' : 'completed', sentCount: totalSent, failedCount },
      });
    }
    if (paused) {
      // Keep the queue + campaign id in the store so Resume can continue it.
      setBrowsingList(true);
      setMode('list');
      return;
    }
    // Finished — nothing left to resume.
    finalizedRef.current = true;
    setManualList('');
    clearAll();
    setCampaignId(null);
    campaignIdRef.current = null;
    setCampaignName('');
    setStep(0);
    setMode('list');
  }, [campaignId, queue.length, totalSent, failedCount, updateCampaign, clearAll]);

  // Resume a parked paused run: drop back into the dashboard and continue sending.
  const handleResumeCampaign = useCallback(() => {
    setBrowsingList(false);
    start();
  }, [start]);

  // Preview: first 3 resolved messages
  const previewMessages = useMemo(() => {
    if (!showPreview || !hasTemplateVar) return [];
    return recipients.slice(0, 3).map((r) => ({
      phone: r.phone,
      name: r.name,
      address: r.address,
      resolved: resolveTemplate(messageTemplate, r.name, r.address),
    }));
  }, [showPreview, hasTemplateVar, recipients, messageTemplate]);

  // Show access-denied card if user doesn't have Bulk SMS access
  if (!hasAccess) {
    return (
      <PageTransition className="absolute inset-0 overflow-hidden">
        <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-[var(--background)] p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] p-8 text-center md:p-12">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 mb-6">
              <FiSend className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                Auto SMS Feature
              </span>
            </div>

            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center shadow-lg shadow-[var(--primary-500)]/20">
              <FiSend className="w-10 h-10 text-white" />
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-[var(--foreground)] mb-3">Bulk SMS</h1>

            {/* Description */}
            <p className="text-lg text-[var(--muted-foreground)] mb-8 max-w-md mx-auto">
              Send automated SMS campaigns to multiple recipients with personalized messages and
              scheduling.
            </p>

            {/* Features Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)]">
                <FiUsers className="w-6 h-6 text-[var(--foreground)] mx-auto mb-2" />
                <p className="text-sm font-medium text-[var(--foreground)]">Bulk Import</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Excel, CSV, or manual entry
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)]">
                <FiMessageSquare className="w-6 h-6 text-[var(--foreground)] mx-auto mb-2" />
                <p className="text-sm font-medium text-[var(--foreground)]">Personalization</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {'{name}'}, {'{address}'} variables
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)]">
                <FiClock className="w-6 h-6 text-[var(--foreground)] mx-auto mb-2" />
                <p className="text-sm font-medium text-[var(--foreground)]">Scheduled Sending</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Configurable send intervals
                </p>
              </div>
            </div>

            {/* CTA */}
            <Button
              size="lg"
              onClick={() => {
                window.location.href =
                  'mailto:sales@bitnexdial.com?subject=Bulk SMS Access Inquiry';
              }}
              className="gap-2 px-8"
            >
              <FiMail className="w-5 h-5" />
              Contact Admin
            </Button>

            <p className="text-sm text-[var(--muted-foreground)] mt-4">
              Contact your administrator to enable Bulk SMS for your account
            </p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div
        {...getRootProps()}
        className="relative flex h-full min-h-0 flex-col bg-[var(--background)]"
      >
        <input {...getInputProps()} />

        {/* Drag overlay */}
        {isDragActive && (
          <div className="fixed inset-0 z-50 bg-[var(--primary-50)]/80 dark:bg-[var(--primary-900)]/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="bg-[var(--card)] rounded-xl p-12 shadow-2xl border-2 border-dashed border-[var(--border)]">
              <FiUpload className="w-12 h-12 text-[var(--foreground)] mx-auto mb-4 animate-bounce" />
              <p className="text-xl font-semibold text-[var(--foreground)] text-center">
                Drop to import contacts
              </p>
              <p className="text-sm text-[var(--muted-foreground)] text-center mt-1">
                Supports .xlsx, .xls, .csv
              </p>
            </div>
          </div>
        )}

        {/* Header region */}
        <div className="shrink-0 border-b border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 pt-3.5 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
                <FiMessageSquare className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black text-[var(--foreground)]">Bulk SMS</h1>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                  Send SMS campaigns to multiple recipients
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canExport && (
                <Button onClick={handleExport} variant="outline" size="sm">
                  <FiDownload className="w-4 h-4 mr-1" />
                  Export
                </Button>
              )}
              {!campaignActive && mode === 'compose' && (
                <Button onClick={() => setMode('list')} variant="ghost" size="sm">
                  Campaigns
                </Button>
              )}
              {(campaignActive || (recipients.length > 0 && !browsingList)) && (
                <Button onClick={handleStartNew} variant="ghost" size="sm">
                  <FiTrash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Scroll area — content centered at a comfortable width (composer, not a list) */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-5">

          {/* Campaign history (default landing when not composing/sending) */}
          {!campaignActive && mode === 'list' && (
            <CampaignHistory
              openCampaignId={deepLinkCampaignId}
              resumableCampaignId={queue.length > 0 ? campaignId : null}
              onResume={handleResumeCampaign}
              onNewCampaign={() => {
                // Starting fresh abandons any parked paused run.
                clearAll();
                setBrowsingList(false);
                setCampaignId(null);
                campaignIdRef.current = null;
                finalizedRef.current = false;
                setCampaignName('');
                setStep(0);
                setMode('compose');
              }}
            />
          )}

          {/* Setup wizard stepper */}
          {!campaignActive && mode === 'compose' && (
            <WizardStepper step={step} onStepClick={(i) => i <= step && setStep(i)} />
          )}

          {/* Context bar — sending-from + usage (dashboard, or review step) */}
          {(campaignActive || (mode === 'compose' && step === 2)) &&
            (phoneNumbers.length > 0 || (smsUsage && smsUsage.limit > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2.5">
              {phoneNumbers.length > 0 && (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <FiPhone className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                  <span className="shrink-0 text-sm text-[var(--muted-foreground)]">
                    Sending from:
                  </span>
                  {hasMultiplePhones ? (
                    <StyledSelect
                      value={selectedPhone}
                      onChange={(v) => setSelectedPhone(v)}
                      disabled={isRunning}
                      className="w-auto min-w-[180px] bg-[var(--background)]"
                    >
                      {phoneNumbers.map((p) => (
                        <option key={p.id || p.phoneNumber} value={p.phoneNumber}>
                          {formatPhoneNumber(p.phoneNumber)}
                          {!p.autoSmsEnabled ? ' (No Auto SMS)' : ''}
                        </option>
                      ))}
                    </StyledSelect>
                  ) : (
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {formatPhoneNumber(selectedPhone || user?.senderPhone || '')}
                    </span>
                  )}
                  {!isAutoSmsEnabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <FiAlertTriangle className="h-3 w-3" />
                      Auto SMS not enabled
                    </span>
                  )}
                </div>
              )}
              {smsUsage && smsUsage.limit > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                  <FiMessageSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm text-[var(--foreground)]">
                    <span className="font-semibold">{smsUsage.remaining}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {' '}
                      / {smsUsage.limit} SMS remaining
                    </span>
                  </span>
                  {smsUsage.remaining <= 10 && smsUsage.remaining > 0 && (
                    <Badge variant="warning" size="sm">
                      Low
                    </Badge>
                  )}
                  {smsUsage.remaining === 0 && (
                    <Badge variant="danger" size="sm">
                      Limit reached
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stats Row */}
          {campaignActive && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] px-3 py-2.5">
                <p className="text-lg font-black leading-none tabular-nums text-[var(--foreground)]">
                  {totalMessages}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted-foreground)]">Total</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] px-3 py-2.5">
                <p className="text-lg font-black leading-none tabular-nums text-amber-600 dark:text-amber-400">
                  {queue.length}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted-foreground)]">Queued</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] px-3 py-2.5">
                <p className="text-lg font-black leading-none tabular-nums text-green-600 dark:text-green-400">
                  {totalSent}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted-foreground)]">Sent</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] px-3 py-2.5">
                <p className="text-lg font-black leading-none tabular-nums text-red-600 dark:text-red-400">
                  {failedCount}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted-foreground)]">Failed</p>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {campaignActive && queue.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {isRunning ? (
                      <Button onClick={pause} variant="outline" size="sm">
                        <FiPause className="w-3.5 h-3.5 mr-1" />
                        Pause
                      </Button>
                    ) : (
                      <Button onClick={start} size="sm">
                        <FiPlay className="w-3.5 h-3.5 mr-1" />
                        Resume
                      </Button>
                    )}
                    {isRunning && (
                      <Badge variant="success" dot dotColor="#10b981">
                        Sending
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {totalSent} / {totalMessages}
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {isRunning && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">
                    Sending one message every {intervalSeconds} seconds
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Campaign Complete */}
          {totalSent > 0 && queue.length === 0 && failedCount === 0 && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-700 dark:text-green-400">
                        Campaign Complete
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        All {totalSent} messages sent successfully.
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleExport} variant="outline" size="sm">
                    <FiDownload className="w-3.5 h-3.5 mr-1" />
                    Export Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed Messages */}
          {failedCount > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiAlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        {failedCount} message{failedCount !== 1 ? 's' : ''} failed
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {failedMessages[0]?.error || 'Send failed'}
                      </p>
                    </div>
                  </div>
                  <Button onClick={retryFailed} variant="outline" size="sm">
                    <FiRefreshCw className="w-3.5 h-3.5 mr-1" />
                    Retry All
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wizard step content */}
          <div className="space-y-4">
              {/* Step 1 · Recipients (import + review) */}
              {!campaignActive && mode === 'compose' && step === 0 && (
              <motion.div
                key="step-recipients"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
              {/* Add recipients */}
              <Card>
                <CardHeader className="pb-0">
                  <div className="flex border-b border-[var(--border)]">
                    <button
                      onClick={() => setActiveTab('file')}
                      className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                        activeTab === 'file'
                          ? 'text-[var(--foreground)]'
                          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiFile className="w-4 h-4" />
                        Import File
                      </span>
                      {activeTab === 'file' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-600)]" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('manual')}
                      className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                        activeTab === 'manual'
                          ? 'text-[var(--foreground)]'
                          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiUsers className="w-4 h-4" />
                        Enter Manually
                      </span>
                      {activeTab === 'manual' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-600)]" />
                      )}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {activeTab === 'file' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div
                        onClick={() => {
                          if (!isDragActive && !isRunning) fileInputRef.current?.click();
                        }}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                          uploadedFileName && recipients.length > 0
                            ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                            : isDragActive
                              ? 'border-[var(--border)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 scale-[1.01]'
                              : 'border-[var(--border)] hover:border-[var(--primary-400)] hover:bg-[var(--muted)]/30'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploadedFileName && recipients.length > 0 ? (
                          <>
                            <FiCheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                              {uploadedFileName}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              {recipients.length} phone numbers imported
                              {(hasNames || hasAddresses) &&
                                ` (with ${[hasNames && 'names', hasAddresses && 'addresses'].filter(Boolean).join(' & ')})`}
                            </p>
                            {!isRunning && (
                              <p className="text-xs text-[var(--muted-foreground)] mt-3">
                                Click or drop to replace
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <FiUpload className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              Drop a file or click to browse
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] mt-1">
                              Supports .xlsx, .xls, .csv
                            </p>
                          </>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadDemoFormat();
                        }}
                        className="mt-3 text-xs text-[var(--foreground)] hover:underline flex items-center gap-1 mx-auto"
                      >
                        <FiDownload className="w-3 h-3" />
                        Download demo format
                      </button>
                    </div>
                  )}

                  {activeTab === 'manual' && (
                    <div>
                      <textarea
                        value={manualList}
                        onChange={(e) => setManualList(e.target.value)}
                        placeholder="Paste phone numbers — one per line, or separated by spaces/commas:&#10;&#10;+12125551234&#10;9175559876&#10;John Doe, 2125557890"
                        rows={7}
                        disabled={isRunning}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] disabled:opacity-50 resize-none"
                      />
                      <Button
                        onClick={handleParseManual}
                        className="mt-3 w-full"
                        variant="outline"
                        disabled={!manualList.trim() || isRunning}
                      >
                        Parse Numbers
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 1b · Review recipients */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Recipients
                      {recipients.length > 0 && (
                        <Badge variant="secondary">{recipients.length}</Badge>
                      )}
                    </CardTitle>
                    {recipients.length > 0 && !isRunning && (
                      <Button
                        onClick={() => {
                          setRecipients([]);
                          setUploadedFileName(null);
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        <FiTrash2 className="w-3.5 h-3.5 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {recipients.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--muted)] flex items-center justify-center">
                        <FiUsers className="w-7 h-7 text-[var(--muted-foreground)]" />
                      </div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        No recipients yet
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-[200px] mx-auto">
                        Import a file or enter numbers manually to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                      {recipients.map((item, index) => {
                        const queuedMsg = queue.find((m) => m.to === item.phone) || null;
                        return (
                          <PhoneRow
                            key={`${item.phone}-${index}`}
                            phone={item.phone}
                            name={item.name}
                            address={item.address}
                            status={queuedMsg}
                            onRemove={() => removeRecipient(index)}
                            disabled={isRunning}
                          />
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
              </motion.div>
              )}

              {/* Step 2 · Message */}
              {!campaignActive && mode === 'compose' && step === 1 && (
              <motion.div
                key="step-message"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Message</CardTitle>
                    <div className="flex items-center gap-3">
                      {/* Saved templates — insert a canned message or save the current one */}
                      <TemplatePicker
                        currentBody={messageTemplate}
                        onInsert={(body) => setMessageTemplate(body)}
                        enabled={hasAccess}
                      />
                      {/* Interval selector */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Interval:
                          {!userCanControlInterval && (
                            <span
                              className="ml-1 inline-flex items-center gap-0.5"
                              title="Set by admin"
                            >
                              <FiLock className="w-3 h-3" />
                            </span>
                          )}
                        </span>
                        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                          {INTERVAL_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleIntervalChange(opt.value)}
                              disabled={isRunning || !userCanControlInterval}
                              className={`px-2 py-1 text-xs font-medium transition-colors ${
                                intervalSeconds === opt.value
                                  ? 'bg-[var(--primary-600)] text-white'
                                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                              } disabled:opacity-50`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    placeholder='Type your message here...&#10;&#10;Use {name} or {address} to personalize&#10;e.g. "Hi {name}, your delivery to {address} is confirmed!"'
                    rows={5}
                    disabled={isRunning}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] disabled:opacity-50 resize-none"
                  />
                  {/* Footer row: template hint + char counter */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {hasNameVar && (
                        <Badge variant="default" size="sm">
                          {'{name}'}
                        </Badge>
                      )}
                      {hasAddressVar && (
                        <Badge variant="default" size="sm">
                          {'{address}'}
                        </Badge>
                      )}
                      {hasTemplateVar && (hasNames || hasAddresses) && recipients.length > 0 && (
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="text-xs text-[var(--foreground)] hover:underline flex items-center gap-1"
                        >
                          <FiEye className="w-3 h-3" />
                          {showPreview ? 'Hide' : 'Preview'}
                        </button>
                      )}
                      {segments > 0 && !hasTemplateVar && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {segments} segment{segments !== 1 ? 's' : ''}
                          {recipients.length > 0 && (
                            <> &middot; {segments * recipients.length} total</>
                          )}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs ${
                        chars > limit && segments > 1
                          ? 'text-amber-500'
                          : 'text-[var(--muted-foreground)]'
                      }`}
                    >
                      {chars} / {limit}
                    </span>
                  </div>

                  {/* Reduce segments / Undo controls */}
                  {canReduceSegments && originalTemplate === null && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleReduceSegments}
                        className="text-xs font-medium text-[var(--foreground)] hover:text-[var(--foreground)] hover:underline"
                      >
                        Reduce to {reducedSegmentCount} segment
                        {reducedSegmentCount !== 1 ? 's' : ''}
                      </button>
                    </div>
                  )}
                  {originalTemplate !== null && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleUndoReduce}
                        className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline"
                      >
                        Undo
                      </button>
                    </div>
                  )}

                  {/* Template preview */}
                  {showPreview && previewMessages.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                      <p className="text-xs font-medium text-[var(--muted-foreground)]">
                        Preview (first {previewMessages.length})
                      </p>
                      {previewMessages.map((p, i) => (
                        <div
                          key={i}
                          className="text-xs p-2.5 rounded-lg bg-[var(--muted)]/50 border border-[var(--border)]"
                        >
                          <span className="font-medium text-[var(--muted-foreground)]">
                            {formatPhoneNumber(p.phone)}
                            {p.name && ` (${p.name})`}:
                          </span>
                          <p className="text-[var(--foreground)] mt-0.5">{p.resolved}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              </motion.div>
              )}

              {/* Step 3 · Review & send */}
              {!campaignActive && mode === 'compose' && step === 2 && (
              <motion.div
                key="step-review"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Campaign name</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder={`Bulk SMS — ${new Date().toLocaleDateString()}`}
                      maxLength={255}
                      disabled={isRunning}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] disabled:opacity-50"
                    />
                    <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                      Shown in your campaign history. Leave blank for an auto-generated name.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Review &amp; send</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-[var(--border)]">
                    <SummaryRow label="Recipients" value={recipients.length} />
                    <SummaryRow
                      label="Message"
                      value={`${chars} char${chars !== 1 ? 's' : ''} · ${segments} segment${segments !== 1 ? 's' : ''}`}
                    />
                    <SummaryRow label="Total SMS segments" value={segments * recipients.length} />
                    <SummaryRow label="Send interval" value={`${intervalSeconds}s between messages`} />
                    <SummaryRow label="Estimated time" value={`~${estMinutes} min`} />
                    {hasTemplateVar && (
                      <SummaryRow
                        label="Personalization"
                        value={[hasNameVar && '{name}', hasAddressVar && '{address}']
                          .filter(Boolean)
                          .join(', ')}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Message preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap rounded-xl bg-[var(--muted)]/50 p-3 text-sm text-[var(--foreground)]">
                      {messageTemplate.trim() || 'No message entered'}
                    </div>
                    {!isAutoSmsEnabled && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <FiAlertTriangle className="h-3.5 w-3.5" />
                        Auto SMS is not enabled for this number — sending is disabled.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
              )}

              {/* Wizard navigation */}
              {!campaignActive && mode === 'compose' && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      step === 0 ? setMode('list') : setStep((s) => Math.max(0, s - 1))
                    }
                  >
                    {step === 0 ? 'Cancel' : 'Back'}
                  </Button>
                  {step < 2 ? (
                    <Button onClick={() => setStep((s) => Math.min(2, s + 1))} disabled={!canAdvance}>
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStartCampaign}
                      disabled={
                        !messageTemplate.trim() ||
                        recipients.length === 0 ||
                        isRunning ||
                        !isAutoSmsEnabled
                      }
                      size="lg"
                    >
                      <FiSend className="mr-2 h-5 w-5" />
                      {isRunning
                        ? 'Starting…'
                        : `Send to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
                    </Button>
                  )}
                </div>
              )}

              {/* Per-message "Sent" log intentionally omitted here — the campaign
                  detail drawer's recipient roster is the SSOT for that. */}

              {/* Return to the history list — available whenever the run isn't
                  actively sending (paused or finished). Finalizes the record. */}
              {campaignActive && !isRunning && (
                <Button onClick={handleBackToCampaigns} variant="outline" className="w-full">
                  <FiRefreshCw className="mr-2 h-4 w-4" />
                  Back to Campaigns
                </Button>
              )}
          </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
