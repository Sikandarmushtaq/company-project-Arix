/**
 * useDispositionFilters — shared filter state for the disposition-based admin
 * lists (Dispositions + Voicemail Audit). Owns outcome / flagged / agent / date
 * state, the change handlers (each resets to page 1), the org agent list, and
 * the derived query params for the list endpoint.
 *
 * Pass `lockedFlagged: true` for the Voicemail Audit view, where the feed is
 * always the flagged set (the flagged toggle/outcome filter aren't shown).
 *
 * @module components/dispositions/useDispositionFilters
 */

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useOrgAgents } from '@/lib/hooks/useAdminAnalytics';
import { PAGINATION_DEFAULTS } from '@/lib/hooks/usePagination';
import {
  presetRange,
  localInputToISO,
  toLocalInput,
  type DateRangePreset,
} from '@/lib/utils/date-range';

export interface AgentOption {
  id: number;
  label: string;
}

export interface DispositionListFilter {
  outcome?: string;
  flagged?: boolean;
  from?: string;
  to?: string;
  agentUserId?: number;
}

export interface DispositionFilters {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  outcome: string;
  flaggedOnly: boolean;
  agentUserId: number | undefined;
  startDate: string;
  endDate: string;
  preset: DateRangePreset | '';
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  agents: AgentOption[];
  /** Upper bound for the date pickers (now, as a datetime-local string). */
  now: string;

  changeOutcome: (v: string) => void;
  toggleFlagged: () => void;
  changeAgent: (id: number | undefined) => void;
  applyPreset: (p: DateRangePreset) => void;
  changeStart: (v: string) => void;
  changeEnd: (v: string) => void;
  clearAll: () => void;

  /** True when any user-controlled filter is active. */
  filtered: boolean;
  /** Params for `useDispositions` / `listDispositions` (dates already ISO). */
  queryParams: DispositionListFilter;
}

export function useDispositionFilters(opts?: { lockedFlagged?: boolean }): DispositionFilters {
  const lockedFlagged = opts?.lockedFlagged ?? false;

  const [page, setPage] = useState(1);
  // App-standard default (20) — must be one of the Pagination selector's
  // options ([10, 20, 50, 100]) or the rows-per-page dropdown breaks.
  const [pageSize, setPageSizeState] = useState<number>(PAGINATION_DEFAULTS.PAGE_SIZE);
  const [outcome, setOutcome] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [agentUserId, setAgentUserId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState<DateRangePreset | ''>('');
  const [expanded, setExpanded] = useState(false);

  const { data: agentsData } = useOrgAgents();
  const agents = useMemo(
    () => (agentsData ?? []).map((a) => ({ id: a.id, label: a.name })),
    [agentsData]
  );
  const now = useMemo(() => toLocalInput(new Date()), []);

  // Every filter change returns to page 1 so the view stays consistent.
  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };
  const changeOutcome = (v: string) => {
    setOutcome(v);
    setPage(1);
  };
  const toggleFlagged = () => {
    setFlaggedOnly((f) => !f);
    setPage(1);
  };
  const changeAgent = (id: number | undefined) => {
    setAgentUserId(id);
    setPage(1);
  };
  const applyPreset = (p: DateRangePreset) => {
    const r = presetRange(p);
    setPreset(p);
    setStartDate(r.start);
    setEndDate(r.end);
    setPage(1);
  };
  const changeStart = (v: string) => {
    setStartDate(v);
    setPreset('');
    setPage(1);
  };
  const changeEnd = (v: string) => {
    setEndDate(v);
    setPreset('');
    setPage(1);
  };
  const clearAll = () => {
    setOutcome('');
    setFlaggedOnly(false);
    setAgentUserId(undefined);
    setStartDate('');
    setEndDate('');
    setPreset('');
    setPage(1);
  };

  const filtered =
    outcome !== '' || flaggedOnly || agentUserId != null || !!startDate || !!endDate;

  const queryParams: DispositionListFilter = {
    outcome: outcome || undefined,
    flagged: lockedFlagged ? true : flaggedOnly || undefined,
    from: localInputToISO(startDate),
    to: localInputToISO(endDate),
    agentUserId,
  };

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    outcome,
    flaggedOnly,
    agentUserId,
    startDate,
    endDate,
    preset,
    expanded,
    setExpanded,
    agents,
    now,
    changeOutcome,
    toggleFlagged,
    changeAgent,
    applyPreset,
    changeStart,
    changeEnd,
    clearAll,
    filtered,
    queryParams,
  };
}
