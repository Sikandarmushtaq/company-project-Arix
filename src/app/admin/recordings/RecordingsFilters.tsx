'use client';

/**
 * RecordingsFilters — advanced filter bar for the recordings table.
 *
 * Primary row: search + date preset + agent (org-wide viewers) + Advanced toggle.
 * Advanced panel: to-the-minute datetime range, direction, duration range.
 * Active filters are shown as removable chips; Clear-all resets everything.
 *
 * @module app/admin/recordings/RecordingsFilters
 */

import React, { useMemo, useState } from 'react';
import { FiSearch, FiSliders, FiX } from 'react-icons/fi';
import { Button, Input } from '@/components/ui';
import { StyledSelect } from '@/components/ui/StyledSelect';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { DATE_PRESETS, toLocalInput, type DateRangePreset } from '@/lib/utils/date-range';

export interface AgentOption {
  id: number;
  label: string;
}

interface RecordingsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;

  /** datetime-local strings (YYYY-MM-DDTHH:mm). */
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPreset: (preset: DateRangePreset) => void;
  /** Currently-selected preset ('' = custom) so the dropdown reflects it. */
  preset: DateRangePreset | '';

  /** Agent filter — only rendered for org-wide viewers. */
  showAgentFilter: boolean;
  agents: AgentOption[];
  agentUserId: number | undefined;
  onAgentChange: (id: number | undefined) => void;

  direction: '' | 'inbound' | 'outbound';
  onDirectionChange: (d: '' | 'inbound' | 'outbound') => void;

  /** Duration bounds in seconds, as input strings. */
  minDuration: string;
  maxDuration: string;
  onMinDurationChange: (v: string) => void;
  onMaxDurationChange: (v: string) => void;

  onClearAll: () => void;
}

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

export function RecordingsFilters(props: RecordingsFiltersProps) {
  const {
    search,
    onSearchChange,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onPreset,
    preset,
    showAgentFilter,
    agents,
    agentUserId,
    onAgentChange,
    direction,
    onDirectionChange,
    minDuration,
    maxDuration,
    onMinDurationChange,
    onMaxDurationChange,
    onClearAll,
  } = props;

  const [expanded, setExpanded] = useState(false);
  // Upper bound for the date pickers — there are no recordings in the future.
  const now = useMemo(() => toLocalInput(new Date()), []);

  const agentLabel = agents.find((a) => a.id === agentUserId)?.label;
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (agentUserId != null && agentLabel)
    chips.push({ key: 'agent', label: `Agent: ${agentLabel}`, clear: () => onAgentChange(undefined) });
  if (direction) chips.push({ key: 'dir', label: `Direction: ${direction}`, clear: () => onDirectionChange('') });
  if (startDate)
    chips.push({ key: 'from', label: `From: ${startDate.replace('T', ' ')}`, clear: () => onStartDateChange('') });
  if (endDate)
    chips.push({ key: 'to', label: `To: ${endDate.replace('T', ' ')}`, clear: () => onEndDateChange('') });
  if (minDuration) chips.push({ key: 'min', label: `≥ ${minDuration}s`, clear: () => onMinDurationChange('') });
  if (maxDuration) chips.push({ key: 'max', label: `≤ ${maxDuration}s`, clear: () => onMaxDurationChange('') });

  return (
    <div className="flex flex-col gap-3">
      {/* Primary row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            type="text"
            placeholder="Search name or number…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <StyledSelect
          className="w-full sm:w-auto sm:min-w-[150px]"
          value={preset}
          placeholder={startDate || endDate ? 'Custom range' : 'Date range…'}
          onChange={(v) => {
            if (v) onPreset(v as DateRangePreset);
          }}
          aria-label="Quick date range"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </StyledSelect>

        {showAgentFilter && (
          <StyledSelect
            className="w-full sm:w-auto sm:min-w-[160px] sm:max-w-[200px]"
            value={agentUserId != null ? String(agentUserId) : ''}
            onChange={(v) => onAgentChange(v ? Number(v) : undefined)}
            aria-label="Filter by agent"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </StyledSelect>
        )}

        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          <FiSliders className="w-4 h-4 mr-1.5" />
          Advanced
        </Button>

        {chips.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear all
          </Button>
        )}
      </div>

      {/* Advanced panel */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3">
          <label className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
            From
            <DateTimeField
              value={startDate}
              onChange={onStartDateChange}
              max={endDate || now}
              placeholder="Start…"
              aria-label="From date and time"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
            To
            <DateTimeField
              value={endDate}
              onChange={onEndDateChange}
              min={startDate || undefined}
              max={now}
              placeholder="End…"
              aria-label="To date and time"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
            Direction
            <StyledSelect
              value={direction}
              onChange={(v) => onDirectionChange(v as '' | 'inbound' | 'outbound')}
              aria-label="Direction"
            >
              <option value="">All</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </StyledSelect>
          </label>
          <div className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
            Duration (seconds)
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                placeholder="min"
                value={minDuration}
                onChange={(e) => onMinDurationChange(e.target.value)}
                className="w-full"
              />
              <span className="text-[var(--muted-foreground)]">–</span>
              <Input
                type="number"
                min={0}
                placeholder="max"
                value={maxDuration}
                onChange={(e) => onMaxDurationChange(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
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
