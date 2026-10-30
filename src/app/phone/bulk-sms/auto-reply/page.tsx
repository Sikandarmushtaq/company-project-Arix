'use client';

/**
 * Per-number SMS Auto-Reply settings — inbound auto-reply, missed-call text-back,
 * and an after-hours/away message with a weekly business-hours schedule.
 * Gated at the ORG level by the `sms` + `auto_sms` tenant modules — enabled for
 * the org ⇒ available to every user in it.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiZap } from 'react-icons/fi';
import { Button, StyledSelect } from '@/components/ui';
import { useAuthStore } from '@/lib/stores/auth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { toast } from '@/lib/stores/toast';
import { calculateSmsSegments } from '@/app/phone/messages/_components/utils';
import { useAutoReplySettings, useUpsertAutoReply } from '@/lib/hooks/useAutoReply';
import type { BusinessHoursInterval } from '@/lib/api/services/auto-reply.service';
import { TemplatePicker } from '../_components/TemplatePicker';

const DAYS: { d: number; label: string }[] = [
  { d: 1, label: 'Sun' },
  { d: 2, label: 'Mon' },
  { d: 3, label: 'Tue' },
  { d: 4, label: 'Wed' },
  { d: 5, label: 'Thu' },
  { d: 6, label: 'Fri' },
  { d: 7, label: 'Sat' },
];
type DayRow = { open: boolean; start: string; end: string };
const defaultHours = (): Record<number, DayRow> => {
  const out: Record<number, DayRow> = {};
  for (const { d } of DAYS) out[d] = { open: d >= 2 && d <= 6, start: '09:00', end: '17:00' };
  return out;
};
const guessTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

/** Message editor with live SMS-bubble preview + segment count + template insert. */
function MessageField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const seg = calculateSmsSegments(value || '');
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </span>
        <TemplatePicker currentBody={value} onInsert={onChange} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]"
      />
      <div className="mt-1 flex items-center justify-between">
        {value.trim() ? (
          <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-[var(--primary-600)]/10 px-3 py-1.5 text-xs text-[var(--foreground)]">
            {value}
          </div>
        ) : (
          <span className="text-[11px] text-[var(--muted-foreground)]">Preview appears here</span>
        )}
        <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
          {seg.segmentCount} seg
        </span>
      </div>
    </div>
  );
}

function ToggleCard({
  title,
  desc,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span>
          <span className="block font-bold text-[var(--foreground)]">{title}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{desc}</span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
      </label>
      {enabled && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

export default function AutoReplyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { modules } = usePermissions();
  // Org-level: Auto-SMS enabled for the org ⇒ available to every user in it.
  const hasAccess = modules?.['sms'] !== false && modules?.['auto_sms'] !== false;

  const numbers = useMemo(
    () => (user?.phoneNumbers ?? []).filter((p) => p.smsEnabled).map((p) => p.phoneNumber),
    [user?.phoneNumbers]
  );
  const [phone, setPhone] = useState('');
  useEffect(() => {
    if (!phone && numbers.length) setPhone(numbers[0]);
  }, [numbers, phone]);

  const { data: settings, isLoading } = useAutoReplySettings(hasAccess ? phone || null : null);
  const upsert = useUpsertAutoReply();

  // Form state
  const [inboundEnabled, setInboundEnabled] = useState(false);
  const [inboundMsg, setInboundMsg] = useState('');
  const [missedEnabled, setMissedEnabled] = useState(false);
  const [missedMsg, setMissedMsg] = useState('');
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayMsg, setAwayMsg] = useState('');
  const [hours, setHours] = useState<Record<number, DayRow>>(defaultHours);
  const [timezone, setTimezone] = useState(guessTz());
  const [cooldown, setCooldown] = useState(240);

  // Hydrate when settings load (per selected number).
  useEffect(() => {
    if (isLoading) return;
    setInboundEnabled(settings?.inboundReplyEnabled ?? false);
    setInboundMsg(settings?.inboundReplyMessage ?? '');
    setMissedEnabled(settings?.missedCallTextEnabled ?? false);
    setMissedMsg(settings?.missedCallMessage ?? '');
    setAwayEnabled(settings?.awayEnabled ?? false);
    setAwayMsg(settings?.awayMessage ?? '');
    setTimezone(settings?.timezone || guessTz());
    setCooldown(settings?.cooldownMinutes ?? 240);
    const h = defaultHours();
    if (settings?.businessHours?.length) {
      for (const { d } of DAYS) h[d] = { ...h[d], open: false };
      for (const iv of settings.businessHours) {
        if (h[iv.day]) h[iv.day] = { open: true, start: iv.start, end: iv.end };
      }
    }
    setHours(h);
  }, [settings, isLoading, phone]);

  const setDay = (d: number, patch: Partial<DayRow>) =>
    setHours((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));

  const handleSave = async () => {
    if (!phone) return;
    const businessHours: BusinessHoursInterval[] = DAYS.filter((x) => hours[x.d]?.open).map((x) => ({
      day: x.d,
      start: hours[x.d].start,
      end: hours[x.d].end,
    }));
    try {
      await upsert.mutateAsync({
        phone,
        data: {
          inboundReplyEnabled: inboundEnabled,
          inboundReplyMessage: inboundMsg.trim() || null,
          missedCallTextEnabled: missedEnabled,
          missedCallMessage: missedMsg.trim() || null,
          awayEnabled,
          awayMessage: awayMsg.trim() || null,
          businessHours: businessHours.length ? businessHours : null,
          timezone: timezone || null,
          cooldownMinutes: cooldown,
        },
      });
      toast.success('Auto-reply saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-10 text-center">
          <FiZap className="mx-auto mb-3 h-8 w-8 text-[var(--primary-600)]" />
          <h2 className="text-lg font-extrabold">Auto-SMS isn’t enabled</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Auto-reply is part of Auto-SMS. Ask your admin to enable it for your number.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        <div>
          <button
            onClick={() => router.push('/phone/bulk-sms')}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <FiArrowLeft className="h-3.5 w-3.5" /> Campaigns
          </button>
          <h1 className="text-2xl font-black tracking-tight">Auto-reply</h1>
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
            Automatically respond to texts and missed calls on a number.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Number
          </label>
          <StyledSelect
            value={phone}
            onChange={(v) => setPhone(v)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm sm:w-72"
          >
            {numbers.length === 0 && <option value="">No SMS number available</option>}
            {numbers.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </StyledSelect>
        </div>

        <ToggleCard
          title="Reply to incoming texts"
          desc="Send an automatic reply the first time a contact texts this number."
          enabled={inboundEnabled}
          onToggle={setInboundEnabled}
        >
          <MessageField
            label="Auto-reply message"
            value={inboundMsg}
            onChange={setInboundMsg}
            placeholder="Thanks for texting! We’ll get back to you shortly."
          />
        </ToggleCard>

        <ToggleCard
          title="Text back missed calls"
          desc="When a call to this number goes unanswered, text the caller automatically."
          enabled={missedEnabled}
          onToggle={setMissedEnabled}
        >
          <MessageField
            label="Missed-call message"
            value={missedMsg}
            onChange={setMissedMsg}
            placeholder="Sorry we missed your call! How can we help?"
          />
        </ToggleCard>

        <ToggleCard
          title="After-hours / away message"
          desc="Outside your business hours, reply with an away message instead of the normal auto-reply."
          enabled={awayEnabled}
          onToggle={setAwayEnabled}
        >
          <MessageField
            label="Away message"
            value={awayMsg}
            onChange={setAwayMsg}
            placeholder="Thanks! We’re closed right now and will reply during business hours."
          />
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Business hours ({timezone || 'local'})
            </label>
            <div className="space-y-1.5">
              {DAYS.map(({ d, label }) => (
                <div key={d} className="flex items-center gap-2 text-sm">
                  <label className="flex w-20 items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={hours[d].open}
                      onChange={(e) => setDay(d, { open: e.target.checked })}
                    />
                    {label}
                  </label>
                  <input
                    type="time"
                    value={hours[d].start}
                    disabled={!hours[d].open}
                    onChange={(e) => setDay(d, { start: e.target.value })}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm disabled:opacity-40"
                    style={{ colorScheme: 'light dark' }}
                  />
                  <span className="text-[var(--muted-foreground)]">–</span>
                  <input
                    type="time"
                    value={hours[d].end}
                    disabled={!hours[d].open}
                    onChange={(e) => setDay(d, { end: e.target.value })}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm disabled:opacity-40"
                    style={{ colorScheme: 'light dark' }}
                  />
                </div>
              ))}
            </div>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm sm:w-72"
            />
          </div>
        </ToggleCard>

        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <span className="font-medium text-[var(--foreground)]">Don’t re-reply to the same contact for</span>
          <input
            type="number"
            min={0}
            value={cooldown}
            onChange={(e) => setCooldown(Math.max(0, Number(e.target.value)))}
            className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
          />
          <span className="text-[var(--muted-foreground)]">minutes</span>
        </div>

        <p className="rounded-lg bg-[var(--muted)]/40 px-3 py-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          Contacts who text STOP are opted out of all automated messages. Auto-replies apply to 1:1
          conversations only.
        </p>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={upsert.isPending} disabled={!phone || upsert.isPending}>
            Save auto-reply
          </Button>
        </div>
      </div>
    </div>
  );
}
