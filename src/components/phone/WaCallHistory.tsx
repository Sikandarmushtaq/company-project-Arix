'use client';

/**
 * WhatsApp Call History
 *
 * Displays recent WhatsApp calls in a compact list.
 * Shown alongside or within the WhatsApp messaging page.
 *
 * @module components/phone/WaCallHistory
 */

import React from 'react';
import { FiPhone, FiPhoneIncoming, FiPhoneOutgoing, FiPhoneMissed } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { waCallService } from '@/lib/api/services/waCall.service';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { useContactDisplayName } from '@/lib/hooks/useContactName';

function formatDuration(secs: number): string {
  if (secs === 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CallStatusIcon({ status, direction }: { status: string; direction: string }) {
  if (status === 'missed') return <FiPhoneMissed className="w-4 h-4 text-red-500" />;
  if (status === 'rejected') return <FiPhoneMissed className="w-4 h-4 text-red-400" />;
  if (direction === 'inbound') return <FiPhoneIncoming className="w-4 h-4 text-blue-500" />;
  return <FiPhoneOutgoing className="w-4 h-4 text-green-500" />;
}

function CallRow({
  call,
}: {
  call: {
    customerNumber: string;
    customerName: string | null;
    direction: string;
    status: string;
    durationSecs: number;
    startedAt: string | null;
  };
}) {
  const displayName = useContactDisplayName(call.customerNumber, call.customerName ?? undefined);

  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-[var(--muted)] rounded-lg transition-colors">
      <CallStatusIcon status={call.status} direction={call.direction} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {formatPhoneNumber(call.customerNumber)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-[var(--muted-foreground)]">
          {call.startedAt ? formatTime(call.startedAt) : '—'}
        </p>
        <p className="text-xs font-mono text-[var(--muted-foreground)]">
          {formatDuration(call.durationSecs)}
        </p>
      </div>
    </div>
  );
}

export function WaCallHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['wa-call-history'],
    queryFn: () => waCallService.getHistory(20, 0),
    staleTime: 30_000,
  });

  const calls = data?.calls ?? [];

  if (isLoading) {
    return (
      <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">
        Loading call history...
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">
        <FaWhatsapp className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No WhatsApp calls yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        WhatsApp Calls
      </div>
      {calls.map((call) => (
        <CallRow key={call.id} call={call} />
      ))}
    </div>
  );
}
