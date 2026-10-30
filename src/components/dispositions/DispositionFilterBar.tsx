'use client';

/**
 * DispositionFilterBar — the shared filter bar for the disposition-based admin
 * lists (Dispositions + Voicemail Audit). Renders, in the Recordings pattern:
 * a primary row (optional outcome · agent · date preset · optional flagged
 * toggle · custom-dates toggle · clear), a collapsible custom-date panel, and
 * removable active-filter chips. Fully controlled by {@link DispositionFilters}.
 *
 * @module components/dispositions/DispositionFilterBar
 */

import React from 'react';
import { FiAlertTriangle, FiSliders, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui';
import { StyledSelect } from '@/components/ui/StyledSelect';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { DATE_PRESETS, type DateRangePreset } from '@/lib/utils/date-range';
import type { DispositionFilters } from './useDispositionFilters';

/** A removable active-filter chip (same style as the recordings filter bar). */
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/30 border border-[var(--primary-200)] dark:border-[var(--primary-800)] px-2.5 py-1 text-xs text-[var(--foreground)] dark:text-[var(--primary-300)]">
      {label}
      <button type="button" onClick={onRemove} className="hover:opacity-70" aria-label="Remove filter">
        <FiX className="w-3 h-3" />
      </button>
    </span>
  );
}

interface Props {
  filters: DispositionFilters;
  /** Show the outcome dropdown (Dispositions) — hidden for the flagged-only Audit view. */
  showOutcome?: boolean;
  /** Show the "Flagged only" toggle (Dispositions) — hidden when the feed is always flagged. */
  showFlaggedToggle?: boolean;
  /** Outcome catalog for the dropdown + chip label (required when showOutcome). */
  outcomes?: { code: string; label: string }[];
  labelFor?: (code: string) => string;
}

export function DispositionFilterBar({
  filters: f,
  showOutcome = false,
  showFlaggedToggle = false,
  outcomes = [],
  labelFor,
}: Props) {
  const agentLabel = f.agents.find((a) => a.id === f.agentUserId)?.label;

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (showOutcome && f.outcome && labelFor)
    chips.push({ key: 'outcome', label: `Outcome: ${labelFor(f.outcome)}`, clear: () => f.changeOutcome('') });
  if (f.agentUserId != null && agentLabel)
    chips.push({ key: 'agent', label: `Agent: ${agentLabel}`, clear: () => f.changeAgent(undefined) });
  if (f.startDate)
    chips.push({ key: 'from', label: `From: ${f.startDate.replace('T', ' ')}`, clear: () => f.changeStart('') });
  if (f.endDate)
    chips.push({ key: 'to', label: `To: ${f.endDate.replace('T', ' ')}`, clear: () => f.changeEnd('') });

  return (
    <div className="flex flex-col gap-3">
      {/* Primary filter row */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        {showOutcome && (
          <StyledSelect
            className="w-full sm:w-auto sm:min-w-[160px]"
            value={f.outcome}
            onChange={f.changeOutcome}
            aria-label="Filter by outcome"
          >
            <option value="">All outcomes</option>
            {outcomes.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </StyledSelect>
        )}

        <StyledSelect
          className="w-full sm:w-auto sm:min-w-[160px]"
          value={f.agentUserId != null ? String(f.agentUserId) : ''}
          onChange={(v) => f.changeAgent(v ? Number(v) : undefined)}
          aria-label="Filter by agent"
        >
          <option value="">All agents</option>
          {f.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </StyledSelect>

        <StyledSelect
          className="w-full sm:w-auto sm:min-w-[150px]"
          value={f.preset}
          placeholder={f.startDate || f.endDate ? 'Custom range' : 'Date range…'}
          onChange={(v) => {
            if (v) f.applyPreset(v as DateRangePreset);
          }}
          aria-label="Quick date range"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </StyledSelect>

        {showFlaggedToggle && (
          <Button
            variant={f.flaggedOnly ? 'primary' : 'outline'}
            size="sm"
            onClick={f.toggleFlagged}
            aria-pressed={f.flaggedOnly}
          >
            <FiAlertTriangle className="w-4 h-4 mr-1.5" />
            Flagged only
          </Button>
        )}

        <Button
          variant={f.expanded ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => f.setExpanded((v) => !v)}
          aria-expanded={f.expanded}
        >
          <FiSliders className="w-4 h-4 mr-1.5" />
          Custom dates
        </Button>

        {f.filtered && (
          <Button variant="ghost" size="sm" onClick={f.clearAll}>
            Clear all
          </Button>
        )}
      </div>

      {/* Custom date-range panel */}
      {f.expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3">
          <label className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
            From
            <DateTimeField
              value={f.startDate}
              onChange={f.changeStart}
              max={f.endDate || f.now}
              placeholder="Start…"
              aria-label="From date and time"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
            To
            <DateTimeField
              value={f.endDate}
              onChange={f.changeEnd}
              min={f.startDate || undefined}
              max={f.now}
              placeholder="End…"
              aria-label="To date and time"
            />
          </label>
        </div>
      )}

      {/* Active-filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} onRemove={c.clear} />
          ))}
        </div>
      )}
    </div>
  );
}
