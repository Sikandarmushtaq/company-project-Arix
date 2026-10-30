'use client';

/**
 * Campaign Detail & Live Dashboard
 *
 * Shows campaign stats, call progress, and transcripts.
 * Real-time updates via WebSocket (no polling).
 *
 * @module app/phone/auto-dialer/campaigns/[id]/page
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FiArrowLeft,
  FiPlay,
  FiSquare,
  FiPause,
  FiRefreshCw,
  FiPhone,
  FiCheckCircle,
  FiXCircle,
  FiMessageSquare,
  FiDownloadCloud,
  FiChevronsRight,
  FiChevronRight,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { PageTransition } from '@/components/phone';
import { autodialerService } from '@/lib/api';
import {
  useCampaignsPaginated,
  useCampaignStats,
  useStartCampaign,
  useStopCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useAiCalls,
  useAiCallTranscript,
} from '@/lib/hooks/useCampaigns';
import type { AiCall } from '@/lib/api';

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = parseInt(params.id as string, 10);
  const [callPage, setCallPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<AiCall | null>(null);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    try {
      await autodialerService.syncCampaignResults(campaignId);
      queryClient.invalidateQueries({ queryKey: ['ai-calls'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch {
      /* ignore */
    }
    setSyncing(false);
  };

  // Fetch campaign from the list (avoids creating a separate endpoint)
  const { data: campaignsData } = useCampaignsPaginated({});
  const campaign = campaignsData?.campaigns.find((c) => c.id === campaignId);

  const { data: stats } = useCampaignStats(campaignId);
  const { data: callsData } = useAiCalls(campaignId, { page: callPage, limit: 20 });
  const calls = callsData?.calls || [];

  // Campaign progress = numbers no longer pending, over the full list.
  const processed = stats ? Math.max(0, stats.totalNumbers - stats.pending) : 0;
  const progressPct =
    stats && stats.totalNumbers > 0 ? Math.round((processed / stats.totalNumbers) * 100) : 0;

  const startCampaign = useStartCampaign();
  const stopCampaign = useStopCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();

  const outcomeIcon: Record<string, React.ReactNode> = {
    answered: <FiCheckCircle className="text-green-400" />,
    transferred: <FiPhone className="text-blue-400" />,
    voicemail: <FiMessageSquare className="text-purple-400" />,
    no_answer: <FiXCircle className="text-yellow-400" />,
    busy: <FiXCircle className="text-orange-400" />,
    failed: <FiXCircle className="text-red-400" />,
  };

  if (!campaign) {
    return (
      <PageTransition className="absolute inset-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col bg-[var(--card)]">
          <div className="shrink-0 border-b border-[var(--border)] px-5 pt-3.5 pb-3">
            <Link
              href="/phone/auto-dialer"
              aria-label="Back to campaigns"
              className="inline-grid h-9 w-9 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <FiArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid flex-1 place-items-center px-6 text-center text-sm text-[var(--muted-foreground)]">
            Campaign not found or loading…
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col bg-[var(--card)]">
        {/* Header region */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 pt-3.5 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/phone/auto-dialer"
              aria-label="Back to campaigns"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <FiArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-[var(--foreground)]">
                {campaign.name}
              </h1>
              {campaign.description && (
                <p className="truncate text-sm text-[var(--muted-foreground)]">
                  {campaign.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              title="Sync results from AI platform"
            >
              <FiDownloadCloud className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </Button>
            {(campaign.status === 'draft' ||
              campaign.status === 'scheduled' ||
              campaign.status === 'completed' ||
              campaign.status === 'cancelled') && (
              <Button
                size="sm"
                onClick={() => startCampaign.mutate(campaignId)}
                disabled={startCampaign.isPending}
              >
                <FiPlay className="mr-2 h-4 w-4" />
                {campaign.status === 'completed' || campaign.status === 'cancelled'
                  ? 'Restart'
                  : 'Start'}
              </Button>
            )}
            {campaign.status === 'running' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => pauseCampaign.mutate(campaignId)}
                >
                  <FiPause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => stopCampaign.mutate(campaignId)}
                >
                  <FiSquare className="mr-2 h-4 w-4 text-red-500" />
                  Stop
                </Button>
              </>
            )}
            {campaign.status === 'paused' && (
              <>
                <Button size="sm" onClick={() => resumeCampaign.mutate(campaignId)}>
                  <FiRefreshCw className="mr-2 h-4 w-4" />
                  Resume
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => stopCampaign.mutate(campaignId)}
                >
                  <FiSquare className="mr-2 h-4 w-4 text-red-500" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Body: full-height split — LEFT (stats + AI calls) | RIGHT (call detail) */}
        <div className="flex min-h-0 flex-1">
          {/* ---- LEFT: stats + AI Calls list ---- */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Stats */}
            {stats && (
              <div className="shrink-0 border-b border-[var(--border)] px-5 py-3.5">
                {/* Live campaign progress */}
                <div className="mb-3.5">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      Campaign progress
                    </span>
                    <span className="text-xs font-black tabular-nums text-[var(--foreground)]">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                    <motion.div
                      className="h-full rounded-full bg-[var(--primary-600)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 24 }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    {processed.toLocaleString()} of {stats.totalNumbers.toLocaleString()} numbers dialed
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard label="Total Numbers" value={stats.totalNumbers} />
                  <StatCard label="Completed" value={stats.completed} color="text-green-600 dark:text-green-400" />
                  <StatCard label="Failed" value={stats.failed} color="text-red-600 dark:text-red-400" />
                  <StatCard label="Avg Duration" value={`${stats.averageDuration}s`} />
                  <StatCard label="Pending" value={stats.pending} />
                  <StatCard label="Answered" value={stats.answered} color="text-blue-600 dark:text-blue-400" />
                  <StatCard label="No Answer" value={stats.noAnswer} color="text-yellow-600 dark:text-yellow-400" />
                  <StatCard label="Busy" value={stats.busy} color="text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            )}
            {/* AI Calls sub-header */}
            <div className="shrink-0 border-b border-[var(--border)] px-5 py-3">
              <h2 className="font-bold text-[var(--foreground)]">AI Calls</h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Results stream in real-time as calls complete
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {calls.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
                  {campaign.status === 'draft'
                    ? 'Start the campaign to begin dialing'
                    : 'No calls yet — waiting for results…'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--card)]/95 backdrop-blur-sm">
                    <tr className="border-b border-[var(--border)] text-left text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      <th className="px-5 py-2.5">Date &amp; Time</th>
                      <th className="px-3 py-2.5">Phone Number</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Duration</th>
                      <th className="px-3 py-2.5">Credits</th>
                      <th className="w-9 pr-4" aria-label="Open" />
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => {
                      const startDate = call.startedAt
                        ? new Date(call.startedAt)
                        : call.createdAt
                          ? new Date(call.createdAt)
                          : null;
                      const isSel = selectedCall?.id === call.id;
                      return (
                        <tr
                          key={call.id}
                          className={`group cursor-pointer border-b border-[var(--border)]/60 transition-colors ${
                            isSel
                              ? 'bg-[var(--primary-50)] shadow-[inset_2px_0_0_var(--primary-600)] dark:bg-[var(--primary-900)]/20'
                              : 'hover:bg-[var(--muted)]/40'
                          }`}
                          onClick={() => setSelectedCall(call)}
                        >
                          <td className="px-5 py-2.5">
                            {startDate ? (
                              <div>
                                <div className="text-xs font-medium text-[var(--foreground)]">
                                  {startDate.toLocaleDateString()}
                                </div>
                                <div className="text-[11px] text-[var(--muted-foreground)]">
                                  {startDate.toLocaleTimeString()}
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-xs text-[var(--foreground)]">
                              {call.phoneNumber}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-[var(--foreground)]">
                              {outcomeIcon[call.outcome || ''] || null}
                              <span className="text-xs capitalize">
                                {call.outcome || call.status}
                              </span>
                            </div>
                            {call.callSuccessful !== null && (
                              <div
                                className={`mt-0.5 text-[10px] font-medium ${call.callSuccessful ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                              >
                                {call.callSuccessful ? 'Successful' : 'Unsuccessful'}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium tabular-nums text-[var(--foreground)]">
                              {call.durationSecs > 0 ? `${call.durationSecs}s` : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                              {call.costCents > 0 ? `${call.costCents} credits` : '—'}
                            </span>
                          </td>
                          <td className="w-9 pr-4 text-right">
                            <FiChevronRight
                              className={`inline h-4 w-4 transition-opacity ${
                                isSel
                                  ? 'text-[var(--foreground)] opacity-100'
                                  : 'text-[var(--muted-foreground)] opacity-0 group-hover:opacity-60'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {callsData && callsData.totalPages > 1 && (
              <div className="flex shrink-0 items-center justify-center gap-2 border-t border-[var(--border)] px-4 py-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={callPage <= 1}
                  onClick={() => setCallPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="px-2 text-sm text-[var(--muted-foreground)]">
                  Page {callPage} of {callsData.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={callPage >= callsData.totalPages}
                  onClick={() => setCallPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          {/* ---- RIGHT: call detail pane (full-height column; overlay on mobile) ---- */}
          <AnimatePresence>
            {selectedCall && (
              <CallDetailPane
                call={selectedCall}
                outcomeIcon={outcomeIcon}
                onClose={() => setSelectedCall(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
    </div>
  );
}

/** Right-side detail pane for a selected AI call. Mirrors the messages
 *  ConversationDetails full-height column (SSOT) — desktop right column,
 *  full-screen overlay on mobile, with a subtle slide-in. */
function CallDetailPane({
  call,
  outcomeIcon,
  onClose,
}: {
  call: AiCall;
  outcomeIcon: Record<string, React.ReactNode>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'transcript'>('details');
  const startDate = call.startedAt
    ? new Date(call.startedAt)
    : call.createdAt
      ? new Date(call.createdAt)
      : null;
  return (
    <motion.div
      initial={{ x: 28, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 28, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="absolute inset-0 z-20 flex h-full min-h-0 flex-col overflow-hidden bg-[var(--card)] md:static md:z-auto md:w-[380px] md:shrink-0 md:border-l md:border-[var(--border)] lg:w-[400px]"
    >
      {/* header — mirrors messages ConversationDetails */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-[17px] font-black text-[var(--foreground)]">Call Details</h2>
        <button
          type="button"
          onClick={onClose}
          title="Hide details"
          aria-label="Hide details"
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <FiChevronsRight className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* contact strip (pinned) */}
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
          <FiPhone className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-[var(--foreground)]">
            {call.phoneNumber}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {outcomeIcon[call.outcome || ''] || null}
            <span className="text-xs capitalize text-[var(--muted-foreground)]">
              {call.outcome || call.status}
            </span>
            {call.callSuccessful !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${call.callSuccessful ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}
              >
                {call.callSuccessful ? 'Successful' : 'Unsuccessful'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex shrink-0 items-center gap-5 border-b border-[var(--border)] px-4">
        <PaneTab active={tab === 'details'} onClick={() => setTab('details')}>
          DETAILS
        </PaneTab>
        <PaneTab active={tab === 'transcript'} onClick={() => setTab('transcript')}>
          TRANSCRIPT
        </PaneTab>
      </div>

      {/* body — single scroll; crossfades on tab or call change */}
      <div className="min-h-0 flex-1 overflow-auto">
        <motion.div
          key={`${call.id}-${tab}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="px-4 py-4"
        >
          {tab === 'details' ? (
            <div className="space-y-5">
              {/* metadata */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 rounded-xl bg-[var(--muted)]/40 p-3.5">
                <MetaItem label="Date" value={startDate ? startDate.toLocaleDateString() : '—'} />
                <MetaItem label="Time" value={startDate ? startDate.toLocaleTimeString() : '—'} />
                <MetaItem
                  label="Duration"
                  value={call.durationSecs > 0 ? `${call.durationSecs}s` : '—'}
                />
                <MetaItem
                  label="Credits"
                  value={call.costCents > 0 ? `${call.costCents}` : '—'}
                />
              </div>

              {/* summary */}
              {call.transcriptSummary && (
                <div>
                  <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Summary
                  </h4>
                  <p className="text-sm leading-relaxed text-[var(--foreground)]">
                    {call.transcriptSummary}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <TranscriptThread callId={call.id} />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

function PaneTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative py-2.5 text-[13px] font-black tracking-wide transition-colors ${
        active
          ? 'text-[var(--foreground)]'
          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="callPaneTabUnderline"
          className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-[var(--primary-600)]"
        />
      )}
    </button>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--muted)]/50 px-3 py-2.5">
      <p className={`text-lg font-black leading-none tabular-nums ${color || 'text-[var(--foreground)]'}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}

function TranscriptThread({ callId }: { callId: number }) {
  const { data: messages, isLoading } = useAiCallTranscript(callId);

  if (isLoading)
    return (
      <div className="py-10 text-center text-xs text-[var(--muted-foreground)]">
        Loading transcript…
      </div>
    );
  if (!messages || messages.length === 0)
    return (
      <div className="py-10 text-center text-xs text-[var(--muted-foreground)]">
        No transcript available
      </div>
    );

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const isAgent = msg.role === 'agent';
        const isCaller = msg.role === 'user';
        const time = msg.timeInCallSecs != null ? fmtTime(msg.timeInCallSecs) : null;

        // Tool actions render as a centered note (content may live in toolCalls,
        // so `message` can be empty) — never a chat bubble.
        if (!isAgent && !isCaller) {
          return (
            <div key={msg.id} className="flex justify-center">
              <span className="max-w-[90%] rounded-lg bg-[var(--muted)] px-3 py-1.5 text-center text-[11px] font-medium text-[var(--muted-foreground)]">
                {msg.message?.trim() || 'Tool action'}
              </span>
            </div>
          );
        }

        // Skip empty agent/caller turns.
        if (!msg.message?.trim()) return null;

        return (
          <div
            key={msg.id}
            className={`flex flex-col gap-1 ${isAgent ? 'items-start' : 'items-end'}`}
          >
            <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
              <span>{isAgent ? 'Agent' : 'Caller'}</span>
              {time && <span className="font-medium tabular-nums opacity-70">· {time}</span>}
            </div>
            <div
              className={`max-w-[85%] px-3 py-2 text-[13px] leading-relaxed ${
                isAgent
                  ? 'rounded-2xl rounded-tl-sm bg-[var(--muted)] text-[var(--foreground)]'
                  : 'rounded-2xl rounded-tr-sm bg-[var(--primary-600)] text-white'
              }`}
            >
              {msg.message}
            </div>
          </div>
        );
      })}
    </div>
  );
}
