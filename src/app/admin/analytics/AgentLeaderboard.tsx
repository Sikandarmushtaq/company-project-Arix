'use client';

/**
 * AgentLeaderboard — Phase 3 per-agent performance table (CDR-backed).
 *
 * All agents side by side over a range: calls, connected %, talk time, avg MOS,
 * below-MOS-3 %, last active. Sortable columns + date presets + In/Out. For an
 * agent's per-day/month trend, use the Call Performance panel's agent dropdown.
 *
 * @module app/admin/analytics/AgentLeaderboard
 */

import React, { useMemo, useState } from 'react';
import { FiChevronUp, FiChevronDown, FiDownload } from 'react-icons/fi';
import { Card, CardContent, Button } from '@/components/ui';
import { StyledSelect } from '@/components/ui/StyledSelect';
import { useAgentLeaderboard } from '@/lib/hooks/useAdminAnalytics';
import { presetRange, localInputToISO, DATE_PRESETS, type DateRangePreset } from '@/lib/utils/date-range';
import { downloadCsvRows, safeFilename } from '@/lib/utils/csv';

type Dir = '' | 'inbound' | 'outbound';
type SortKey = 'name' | 'calls' | 'connectedPct' | 'talkSec' | 'avgMos' | 'belowPct' | 'lastActive';

const DIRS: { key: Dir; label: string }[] = [
  { key: 'outbound', label: 'Outbound' },
  { key: 'inbound', label: 'Inbound' },
  { key: '', label: 'All' },
];

function fmtHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function pctNum(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}
function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

export function AgentLeaderboard() {
  const initial = useMemo(() => presetRange('thisMonth'), []);
  const [preset, setPreset] = useState<DateRangePreset | ''>('thisMonth');
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [direction, setDirection] = useState<Dir>('outbound');

  const applyPreset = (key: DateRangePreset) => {
    setPreset(key);
    const r = presetRange(key);
    setStart(r.start);
    setEnd(r.end);
  };
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'calls',
    dir: 'desc',
  });

  const { data, isLoading } = useAgentLeaderboard({
    startDate: localInputToISO(start) || '',
    endDate: localInputToISO(end) || '',
    direction: direction || undefined,
  });

  const rows = useMemo(() => {
    const list = (data ?? []).map((a) => ({
      ...a,
      connectedPct: pctNum(a.connected, a.calls),
      belowPct: pctNum(a.belowMos3, a.mosScored),
    }));
    const { key, dir } = sort;
    const val = (r: (typeof list)[number]): number | string => {
      switch (key) {
        case 'name':
          return r.name.toLowerCase();
        case 'avgMos':
          return r.avgMos ?? -1;
        case 'lastActive':
          return r.lastActive ?? '';
        default:
          return r[key];
      }
    };
    return list.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    );

  // Render helper (not a component) — keeps sort/toggle in closure without
  // declaring a component during render.
  const renderTh = (k: SortKey, label: string, right?: boolean) => (
    <th
      key={k}
      className={`px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] cursor-pointer select-none ${
        right ? 'text-right' : 'text-left'
      }`}
      onClick={() => toggleSort(k)}
    >
      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
        {label}
        {sort.key === k &&
          (sort.dir === 'asc' ? (
            <FiChevronUp className="w-3 h-3" />
          ) : (
            <FiChevronDown className="w-3 h-3" />
          ))}
      </span>
    </th>
  );

  const handleExport = () => {
    if (rows.length === 0) return;
    const headers = [
      'Agent', 'DID', 'Calls', 'Inbound', 'Outbound', 'Connected', 'Connected %',
      'Talk time (s)', 'Avg MOS', 'Below MOS 3', 'Below 3 %', 'MOS scored', 'Last active',
    ];
    const data2: (string | number)[][] = rows.map((a) => [
      a.name, a.did, a.calls, a.inbound, a.outbound, a.connected, Math.round(a.connectedPct),
      a.talkSec, a.avgMos != null ? a.avgMos.toFixed(2) : '', a.belowMos3,
      a.mosScored > 0 ? Math.round(a.belowPct) : '', a.mosScored,
      a.lastActive ? a.lastActive.slice(0, 10) : '',
    ]);
    downloadCsvRows(
      safeFilename(`agent-performance_${direction || 'all'}_${start.slice(0, 10)}_to_${end.slice(0, 10)}`),
      headers,
      data2
    );
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Agent Performance</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              CDR-backed · {direction === '' ? 'all directions' : direction} · click a column to sort
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StyledSelect
              className="w-auto min-w-[140px]"
              value={preset}
              placeholder="Custom range"
              onChange={(v) => v && applyPreset(v as DateRangePreset)}
              aria-label="Quick date range"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </StyledSelect>
            <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden">
              {DIRS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setDirection(o.key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    direction === o.key
                      ? 'bg-[var(--primary-600)] text-white'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
            >
              <FiDownload className="w-4 h-4 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {renderTh('name', 'Agent')}
                {renderTh('calls', 'Calls', true)}
                {renderTh('connectedPct', 'Connected', true)}
                {renderTh('talkSec', 'Talk time', true)}
                {renderTh('avgMos', 'Avg MOS', true)}
                {renderTh('belowPct', 'Below 3', true)}
                {renderTh('lastActive', 'Last active', true)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--muted-foreground)]">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--muted-foreground)]">
                    No calls in this range.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr
                    key={a.userId}
                    className="border-b border-[var(--border)] hover:bg-[var(--muted)]/30"
                  >
                    <td className="px-3 py-2 text-sm font-medium text-[var(--foreground)]">
                      {a.name}
                      <span className="ml-2 text-xs text-[var(--muted-foreground)]">{a.did}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-sm">{a.calls}</td>
                    <td className="px-3 py-2 text-right text-sm">
                      {Math.round(a.connectedPct)}%
                      <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                        ({a.connected})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-sm">{fmtHms(a.talkSec)}</td>
                    <td className="px-3 py-2 text-right text-sm">
                      {a.avgMos != null ? a.avgMos.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`px-3 py-2 text-right text-sm ${
                        a.belowPct >= 25 ? 'text-[var(--danger)]' : ''
                      }`}
                    >
                      {a.mosScored > 0 ? `${Math.round(a.belowPct)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-[var(--muted-foreground)]">
                      {fmtDate(a.lastActive)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
