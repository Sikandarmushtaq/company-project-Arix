'use client';

/**
 * Filter strip for the manager oversight conversation list.
 *
 * Controlled component — parent owns state. Three filters:
 *   - free-text search (customer phone / message body / contact name)
 *   - agent dropdown (populated from `useWaOversightAgents`)
 *   - unread-only toggle
 *
 * Keeps zero internal state so the parent can also serialize filters
 * into the URL later without component-level conflicts.
 *
 * @module app/admin/whatsapp/oversight/_components/WaOversightFilters
 */

import React from 'react';
import { FiSearch, FiBellOff } from 'react-icons/fi';
import { Input, Button, StyledSelect } from '@/components/ui';
import { useWaOversightAgents } from '@/lib/hooks';

export interface OversightFilterState {
  search: string;
  agentUserId: number | null;
  unreadOnly: boolean;
}

interface WaOversightFiltersProps {
  filters: OversightFilterState;
  onChange: (next: OversightFilterState) => void;
}

export function WaOversightFilters({ filters, onChange }: WaOversightFiltersProps) {
  const { data: agents, isLoading: agentsLoading } = useWaOversightAgents();

  return (
    <div className="flex flex-col gap-2 mb-3">
      <Input
        placeholder="Search by phone, contact, or message…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        leftIcon={<FiSearch className="w-4 h-4" aria-hidden="true" />}
        aria-label="Search oversight conversations"
      />

      <div className="flex items-center gap-2">
        <StyledSelect
          className="flex-1 bg-[var(--background)]"
          value={filters.agentUserId != null ? String(filters.agentUserId) : ''}
          onChange={(v) =>
            onChange({
              ...filters,
              agentUserId: v ? Number(v) : null,
            })
          }
          aria-label="Filter by agent"
          disabled={agentsLoading}
        >
          <option value="">All agents</option>
          {agents?.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.fullName || a.agentPhone}
            </option>
          ))}
        </StyledSelect>

        <Button
          size="sm"
          variant={filters.unreadOnly ? 'primary' : 'outline'}
          onClick={() => onChange({ ...filters, unreadOnly: !filters.unreadOnly })}
          aria-pressed={filters.unreadOnly}
          title="Show only conversations with unread messages"
        >
          <FiBellOff className="w-4 h-4 mr-1" />
          Unread
        </Button>
      </div>
    </div>
  );
}
