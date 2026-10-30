'use client';

/**
 * Call-Menu canvas node components + palette metadata (React Flow / @xyflow).
 * One generic card renders every step; the Menu step adds one labelled output
 * handle per keypad option. Each output shows an inline "+" to add the next step
 * via the picker, and a badge flags steps that still need attention.
 */

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  FiPhoneIncoming,
  FiVolume2,
  FiGrid,
  FiUser,
  FiUsers,
  FiVoicemail,
  FiPhoneForwarded,
  FiXCircle,
  FiPlus,
  FiClock,
} from 'react-icons/fi';
import type { IvrNodeType, IvrNodeData } from '@/lib/api/services/ivr.api';
import { useBuilder } from './BuilderContext';

type NodeKind = 'start' | 'step' | 'menu' | 'hours' | 'end';

export const NODE_META: Record<
  IvrNodeType,
  {
    label: string;
    blurb: string;
    Icon: React.ComponentType<{ className?: string }>;
    accent: string;
    kind: NodeKind;
  }
> = {
  entry: {
    label: 'Incoming call',
    blurb: 'Where every call begins.',
    Icon: FiPhoneIncoming,
    accent: '#0ea5e9',
    kind: 'start',
  },
  greeting: {
    label: 'Greeting',
    blurb: 'Play a message to the caller.',
    Icon: FiVolume2,
    accent: '#8b5cf6',
    kind: 'step',
  },
  menu: {
    label: 'Menu',
    blurb: 'Let callers press a key to choose.',
    Icon: FiGrid,
    accent: '#f59e0b',
    kind: 'menu',
  },
  hours: {
    label: 'Business hours',
    blurb: 'Route by day, time & holidays.',
    Icon: FiClock,
    accent: '#6366f1',
    kind: 'hours',
  },
  ring_user: {
    label: 'Ring a person',
    blurb: 'Ring one team member’s phone.',
    Icon: FiUser,
    accent: '#10b981',
    kind: 'step',
  },
  ring_group: {
    label: 'Ring the team',
    blurb: 'Ring everyone at once.',
    Icon: FiUsers,
    accent: '#10b981',
    kind: 'step',
  },
  voicemail: {
    label: 'Voicemail',
    blurb: 'Let the caller leave a message.',
    Icon: FiVoicemail,
    accent: '#64748b',
    kind: 'end',
  },
  transfer: {
    label: 'Forward',
    blurb: 'Send the call to another number.',
    Icon: FiPhoneForwarded,
    accent: '#0ea5e9',
    kind: 'end',
  },
  hangup: {
    label: 'Hang up',
    blurb: 'End the call.',
    Icon: FiXCircle,
    accent: '#ef4444',
    kind: 'end',
  },
};

/** Steps a user can add (entry is created with the flow). */
export const PALETTE: IvrNodeType[] = [
  'greeting',
  'menu',
  'hours',
  'ring_user',
  'ring_group',
  'voicemail',
  'transfer',
  'hangup',
];

/** One-line preview of what a step is configured to do. */
function subtitle(type: IvrNodeType, data: IvrNodeData): string {
  switch (type) {
    case 'greeting':
      return data.prompt?.text ? `“${trunc(data.prompt.text)}”` : 'No message yet';
    case 'menu':
      return data.options?.length ? `${data.options.length} option(s)` : 'No options yet';
    case 'hours': {
      const n = data.hours?.length ?? 0;
      const h = data.holidays?.length ?? 0;
      if (!n && !h) return 'No hours set yet';
      return `${n} open period(s)${h ? ` · ${h} holiday(s)` : ''}`;
    }
    case 'ring_user':
      return data.extension ? `Ext ${data.extension}` : 'Unassigned';
    case 'ring_group':
      return data.groupId ? 'A team' : 'No team chosen';
    case 'transfer':
      return data.externalNumber || (data.extension ? `Ext ${data.extension}` : 'No destination set');
    case 'voicemail':
      return data.extension ? `Mailbox ${data.extension}` : 'Leave a message';
    case 'hangup':
      return 'End the call';
    case 'entry':
      return 'Start of the call';
    default:
      return '';
  }
}
const trunc = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n)}…` : s);

const HANDLE_STYLE: React.CSSProperties = {
  width: 9,
  height: 9,
  background: 'var(--card)',
  border: '2px solid var(--muted-foreground)',
};

/** Small round "+" used on open outputs to add the next step. */
function AddButton({
  onClick,
  className,
  size = 'md',
  title,
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  size?: 'sm' | 'md';
  title: string;
}) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`nodrag flex ${dim} items-center justify-center rounded-full border border-dashed border-[var(--muted-foreground)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-sm transition-colors hover:border-[var(--primary-600)] hover:bg-[var(--primary-600)]/5 hover:text-[var(--primary-600)] ${className ?? ''}`}
    >
      <FiPlus className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
    </button>
  );
}

function StepCard({
  id,
  type,
  data,
  selected,
}: {
  id: string;
  type: IvrNodeType;
  data: IvrNodeData;
  selected?: boolean;
}) {
  const meta = NODE_META[type];
  const { Icon } = meta;
  const { issuesByNode } = useBuilder();
  const issues = issuesByNode[id] ?? [];
  const hasError = issues.some((i) => i.level === 'error');
  const hasWarn = !hasError && issues.length > 0;

  const issueText = issues.map((i) => `• ${i.message}`).join('\n');

  return (
    <div
      title={issueText || undefined}
      className="relative rounded-xl border bg-[var(--card)] shadow-sm transition-shadow"
      style={{
        borderColor: selected ? meta.accent : 'var(--border)',
        boxShadow: selected ? `0 0 0 2px ${meta.accent}55` : undefined,
        minWidth: 190,
      }}
    >
      {(hasError || hasWarn) && (
        <span
          title={issueText}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none text-white shadow"
          style={{ background: hasError ? '#ef4444' : '#f59e0b' }}
        >
          !
        </span>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${meta.accent}1a`, color: meta.accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--foreground)]">
            {data.label || meta.label}
          </div>
          <div className="truncate text-[11px] text-[var(--muted-foreground)]">{subtitle(type, data)}</div>
        </div>
      </div>
    </div>
  );
}

/** Generic node: target on top (unless start), single source on bottom (unless end). */
function GenericNode({ id, type, data, selected }: NodeProps & { type: IvrNodeType }) {
  const meta = NODE_META[type];
  const { connectedHandles, onAddAfter } = useBuilder();
  const connected = connectedHandles.has(id);
  return (
    <>
      {meta.kind !== 'start' && <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />}
      <StepCard id={id} type={type} data={data as IvrNodeData} selected={selected} />
      {meta.kind !== 'end' && (
        <>
          <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
          {!connected && (
            <AddButton
              className="absolute -bottom-3 left-1/2 -translate-x-1/2"
              title="Add the next step"
              onClick={(e) => onAddAfter(id, undefined, e)}
            />
          )}
        </>
      )}
    </>
  );
}

/** Menu node: target on top + one labelled source handle per option key on the right. */
function MenuNode({ id, data, selected }: NodeProps) {
  const d = data as IvrNodeData;
  const options = d.options ?? [];
  const { connectedHandles, onAddAfter } = useBuilder();
  return (
    <>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <StepCard id={id} type="menu" data={d} selected={selected} />
      <div className="mt-1 flex flex-col gap-1 pb-1">
        {options.length === 0 && (
          <p className="px-3 pb-1 text-center text-[10px] text-[var(--muted-foreground)]">
            Add keypad options in the panel →
          </p>
        )}
        {options.map((opt, i) => {
          const connected = connectedHandles.has(`${id}:${opt.key}`);
          return (
            <div key={opt.key} className="relative flex items-center justify-end gap-1 pr-4 text-[11px]">
              <span className="text-[var(--muted-foreground)]">
                <b className="text-[var(--foreground)]">{opt.key}</b>
                {opt.label ? ` · ${trunc(opt.label, 14)}` : ''}
              </span>
              {!connected && (
                <AddButton
                  size="sm"
                  title={`Add the step for key ${opt.key}`}
                  onClick={(e) => onAddAfter(id, opt.key, e)}
                />
              )}
              <Handle
                id={opt.key}
                type="source"
                position={Position.Right}
                // Center the handle within its own option row (it's absolutely
                // positioned against this `relative` row), so each connector
                // tracks the keypad line it belongs to.
                style={{
                  ...HANDLE_STYLE,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: -6,
                  borderColor: NODE_META.menu.accent,
                }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The three fixed branches of a business-hours node. */
const HOURS_BRANCHES: { key: 'open' | 'closed' | 'holiday'; label: string; color: string }[] = [
  { key: 'open', label: 'Open', color: '#10b981' },
  { key: 'closed', label: 'Closed', color: '#64748b' },
  { key: 'holiday', label: 'Holiday', color: '#f59e0b' },
];

/** Business-hours node: target on top + one labelled source handle per branch. */
function HoursNode({ id, data, selected }: NodeProps) {
  const d = data as IvrNodeData;
  const { connectedHandles, onAddAfter } = useBuilder();
  const hasHolidays = (d.holidays?.length ?? 0) > 0;
  return (
    <>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <StepCard id={id} type="hours" data={d} selected={selected} />
      <div className="mt-1 flex flex-col gap-1 pb-1">
        {HOURS_BRANCHES.map((b) => {
          const connected = connectedHandles.has(`${id}:${b.key}`);
          // The holiday branch is optional — show its connector when holidays exist
          // OR when something is still wired to it (so removing holidays can't strand
          // a dangling edge).
          if (b.key === 'holiday' && !hasHolidays && !connected) return null;
          return (
            <div key={b.key} className="relative flex items-center justify-end gap-1 pr-4 text-[11px]">
              <span className="font-medium" style={{ color: b.color }}>
                {b.label}
              </span>
              {!connected && (
                <AddButton
                  size="sm"
                  title={`Add the step for “${b.label}”`}
                  onClick={(e) => onAddAfter(id, b.key, e)}
                />
              )}
              <Handle
                id={b.key}
                type="source"
                position={Position.Right}
                style={{
                  ...HANDLE_STYLE,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: -6,
                  borderColor: b.color,
                }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

/** React Flow nodeTypes registry — one entry per IvrNodeType. */
export const nodeTypes = {
  entry: (p: NodeProps) => <GenericNode {...p} type="entry" />,
  greeting: (p: NodeProps) => <GenericNode {...p} type="greeting" />,
  menu: MenuNode,
  hours: HoursNode,
  ring_user: (p: NodeProps) => <GenericNode {...p} type="ring_user" />,
  ring_group: (p: NodeProps) => <GenericNode {...p} type="ring_group" />,
  voicemail: (p: NodeProps) => <GenericNode {...p} type="voicemail" />,
  transfer: (p: NodeProps) => <GenericNode {...p} type="transfer" />,
  hangup: (p: NodeProps) => <GenericNode {...p} type="hangup" />,
};
