'use client';

/**
 * Phase 3 — Calls tab (RingCentral-style). New UI only; all data/mutations
 * are reused from existing hooks (useCalls, useDeleteCalls). Renders the call
 * list (panel) + the call-detail pane (main area).
 */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiSearch, FiChevronDown, FiPhone, FiMessageSquare, FiMoreHorizontal,
  FiTrash2, FiFlag, FiX, FiCheck, FiInfo, FiCopy, FiUserPlus, FiSlash,
  FiPhoneIncoming, FiPhoneOutgoing, FiPhoneMissed,
} from 'react-icons/fi';
import { GenericAvatar } from './avatarUtils';
import {
  useCalls,
  useDeleteCalls,
  useContactDisplayName,
  useContacts,
  useCreateContact,
  useUpdateContact,
} from '@/lib/hooks';
import { useContactLookupStore } from '@/lib/stores/contactLookup';
import { ContactFormModal } from '@/app/phone/contacts/ContactModals';
import { formatRelativeTime } from '@/lib/utils/datetime';
import { ConfirmModal } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import type { Call } from '@/lib/api';
import { isMissedCall } from '@/lib/utils/call-status';
import type { CreateContactInput } from '@/lib/validation';

type Filter = 'all' | 'missed' | 'outbound' | 'inbound';

const AV_COLORS = ['#7a52c9', '#0d9488', '#d97706', '#2563eb', '#dc2626', '#1f7a53', '#8a5a2b', '#0891b2'];
function colorFor(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
function initialsOf(name: string) {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '#';
}
export function partyNumber(c: Call) {
  return c.direction === 'inbound' ? c.caller : c.callee;
}
function fmtDuration(sec: number) {
  if (sec <= 0) return '0 sec';
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

/* ---------- avatar — delegates to the shared GenericAvatar (person silhouette
   for number-only entries, initials otherwise) ---------- */
function Avatar({ call, name, size }: { call: Call; name: string; size: number }) {
  return <GenericAvatar name={name} number={partyNumber(call)} size={size} />;
}

/* ---------- direction glyph — proper phone±arrow icons (RingCentral-style) ---------- */
function DirIcon({ call }: { call: Call }) {
  if (isMissedCall(call)) return <FiPhoneMissed className="w-3.5 h-3.5 text-[var(--danger)]" />;
  if (call.direction === 'inbound')
    return <FiPhoneIncoming className="w-3.5 h-3.5 text-green-600" />;
  return <FiPhoneOutgoing className="w-3.5 h-3.5 text-[var(--foreground)]" />;
}

/* ---------- one row ---------- */
function RowMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors [&_svg]:w-[18px] [&_svg]:h-[18px] ${
        danger
          ? 'text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CallRow({
  call, editing, checked, selected, onClick, onToggle, onCall, onMessage,
  onCopy, onAddContact, onDelete, onBlock,
}: {
  call: Call; editing: boolean; checked: boolean; selected: boolean;
  onClick: () => void; onToggle: () => void; onCall: () => void; onMessage: () => void;
  onCopy: () => void; onAddContact: () => void; onDelete: () => void; onBlock: () => void;
}) {
  const number = partyNumber(call);
  const name = useContactDisplayName(number, call.contactName);
  const missed = isMissedCall(call);
  const activate = editing ? onToggle : onClick;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(
    null
  );
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-[var(--border)]/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-500)] ${
        selected ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20' : 'hover:bg-[var(--muted)]/60'
      }`}
    >
      {editing && (
        <span className={`w-5 h-5 rounded border-2 grid place-items-center shrink-0 ${checked ? 'bg-[var(--primary-600)] border-[var(--border)]' : 'border-[var(--border)]'}`}>
          {checked && <FiCheck className="w-3 h-3 text-white" />}
        </span>
      )}
      <Avatar call={call} name={name} size={40} />
      <div className="flex-1 min-w-0">
        <div className={`text-[14.5px] font-bold truncate flex items-center gap-1.5 ${missed ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'}`}>
          {name}
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)] mt-0.5">
          <DirIcon call={call} />
          {missed ? 'Missed call' : fmtDuration(call.duration)}
        </div>
      </div>
      {!editing && (
        <>
          <span
            className={`text-[12px] text-[var(--muted-foreground)] shrink-0 ${menuOpen ? 'hidden' : 'group-hover:hidden'}`}
          >
            {formatRelativeTime(call.startTime)}
          </span>
          <div
            className={`items-center gap-1 shrink-0 ${menuOpen ? 'flex' : 'hidden group-hover:flex'}`}
          >
            <button onClick={(e) => { e.stopPropagation(); onCall(); }} title="Call" className="w-8 h-8 rounded-full bg-[var(--muted)] grid place-items-center text-[var(--muted-foreground)] hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30">
              <FiPhone className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onMessage(); }} title="Message" className="w-8 h-8 rounded-full bg-[var(--muted)] grid place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <FiMessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpen) {
                  setMenuOpen(false);
                  return;
                }
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const menuH = 200;
                const openUp = r.bottom + menuH > window.innerHeight;
                setMenuPos({
                  right: window.innerWidth - r.right,
                  ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
                });
                setMenuOpen(true);
              }}
              title="More"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="w-8 h-8 rounded-full bg-[var(--muted)] grid place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <FiMoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen &&
              menuPos &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[55]"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  />
                  <div
                    role="menu"
                    style={{ position: 'fixed', right: menuPos.right, top: menuPos.top, bottom: menuPos.bottom }}
                    className="z-[56] min-w-[190px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenuItem icon={<FiUserPlus />} label="Add contact" onClick={() => { setMenuOpen(false); onAddContact(); }} />
                    <RowMenuItem icon={<FiCopy />} label="Copy number" onClick={() => { setMenuOpen(false); onCopy(); }} />
                    <RowMenuItem icon={<FiTrash2 />} label="Delete" onClick={() => { setMenuOpen(false); onDelete(); }} />
                    <RowMenuItem icon={<FiSlash />} label="Block number" danger onClick={() => { setMenuOpen(false); onBlock(); }} />
                  </div>
                </>,
                document.body
              )}
          </div>
        </>
      )}
    </div>
  );
}

/* ==================== LIST (panel) ==================== */
export function CallsList({
  selectedId, onSelect, onCall, onMessage, onDeleted, onAddContact, onBlock,
}: {
  selectedId: number | null;
  onSelect: (c: Call) => void;
  onCall: (c: Call) => void;
  onMessage: (c: Call) => void;
  onDeleted?: (ids: number[]) => void;
  onAddContact: (num: string) => void;
  onBlock: (num: string) => void;
}) {
  const { data: calls = [], isLoading, error } = useCalls(50);
  const deleteCalls = useDeleteCalls();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // The last-picked non-"All" filter, kept so the second control's label persists
  // (RingCentral keeps it as e.g. OUTGOING even while you're viewing All).
  const [secondaryFilter, setSecondaryFilter] = useState<Exclude<Filter, 'all'>>('missed');
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (filter === 'missed' && !isMissedCall(c)) return false;
      if (filter === 'outbound' && c.direction !== 'outbound') return false;
      if (filter === 'inbound' && c.direction !== 'inbound') return false;
      if (q) {
        const num = partyNumber(c).toLowerCase();
        const nm = (c.contactName || '').toLowerCase();
        if (!num.includes(q) && !nm.includes(q)) return false;
      }
      return true;
    });
  }, [calls, filter, search]);

  const toggle = (id: number) =>
    setChecked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const confirmDelete = () => {
    const ids = Array.from(checked);
    deleteCalls.mutate(ids, {
      onSuccess: () => toast.success(`${ids.length} call record${ids.length === 1 ? '' : 's'} deleted`),
      onError: () => toast.error('Failed to delete call records'),
    });
    onDeleted?.(ids);
    setChecked(new Set());
    setEditing(false);
    setConfirmOpen(false);
  };

  // Label reflects the PERSISTENT secondary choice, not the active filter — so it
  // stays "OUTGOING" even when you toggle to All.
  const secondaryLabel =
    secondaryFilter === 'missed' ? 'MISSED' : secondaryFilter === 'outbound' ? 'OUTGOING' : 'INCOMING';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* filter / edit bar */}
      {editing ? (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)]">
          <b className="text-sm text-[var(--foreground)]">{checked.size} selected</b>
          <div className="flex-1" />
          <button title="Flag" className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><FiFlag className="w-[18px] h-[18px]" /></button>
          <button title="Delete" disabled={!checked.size} onClick={() => setConfirmOpen(true)} className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-40"><FiTrash2 className="w-[18px] h-[18px]" /></button>
          <button title="Close" onClick={() => { setEditing(false); setChecked(new Set()); }} className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><FiX className="w-[18px] h-[18px]" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] relative">
          <div className="flex-1 flex items-center gap-2 text-[var(--muted-foreground)]">
            <FiSearch className="w-4 h-4 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search calls" className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]" />
            {search && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSearch('')} title="Clear search" aria-label="Clear search" className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button onClick={() => { setFilter('all'); setFilterOpen(false); }} className={`text-[13px] font-black ${filter === 'all' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>ALL</button>
          {/* Secondary filter: the label APPLIES the current secondary choice (acts
              as a button); the ▾ opens the menu to change which one. */}
          <div className={`group flex items-center gap-0.5 ${filter !== 'all' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]'}`}>
            <button
              onClick={() => { setFilter(secondaryFilter); setFilterOpen(false); }}
              className={`text-[13px] font-black ${filter === 'all' ? 'group-hover:text-[var(--foreground)]' : ''}`}
            >
              {secondaryLabel}
            </button>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              aria-label="Change call filter"
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              className={`grid place-items-center ${filter === 'all' ? 'group-hover:text-[var(--foreground)]' : ''}`}
            >
              <FiChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => setEditing(true)} className="text-[13px] font-black text-[var(--foreground)]">Edit</button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-14 top-11 z-50 min-w-[150px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1.5" role="menu">
                {([['missed', 'Missed'], ['outbound', 'Outgoing'], ['inbound', 'Incoming']] as [Exclude<Filter, 'all'>, string][]).map(([f, label]) => (
                  <button
                    key={f}
                    role="menuitem"
                    onClick={() => { setSecondaryFilter(f); setFilter(f); setFilterOpen(false); }}
                    className={`flex items-center justify-between w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-[var(--muted)] ${secondaryFilter === f ? 'text-[var(--foreground)] font-bold' : 'text-[var(--foreground)]'}`}
                  >
                    {label}
                    {secondaryFilter === f && <FiCheck className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && calls.length === 0 && (
          <div className="grid place-items-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border)] border-t-transparent" /></div>
        )}
        {error && calls.length === 0 && <div className="text-center py-10 text-sm text-[var(--danger)]">{error.message}</div>}
        {!isLoading && shown.length === 0 && !error && <div className="text-center py-10 text-sm text-[var(--muted-foreground)]">No calls</div>}
        {shown.map((c) => (
          <CallRow
            key={c.id}
            call={c}
            editing={editing}
            checked={checked.has(c.id)}
            selected={selectedId === c.id}
            onClick={() => onSelect(c)}
            onToggle={() => toggle(c.id)}
            onCall={() => onCall(c)}
            onMessage={() => onMessage(c)}
            onCopy={() => {
              navigator.clipboard?.writeText(partyNumber(c));
              toast.success('Number copied');
            }}
            onAddContact={() => onAddContact(partyNumber(c))}
            onDelete={() => {
              deleteCalls.mutate([c.id], {
                onSuccess: () => toast.success('Call record deleted'),
                onError: () => toast.error('Failed to delete call record'),
              });
              onDeleted?.([c.id]);
            }}
            onBlock={() => onBlock(partyNumber(c))}
          />
        ))}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete call log"
        message={`Do you want to delete the selected call${checked.size === 1 ? '' : 's'}?`}
        confirmText="Delete"
        variant="danger"
        loading={deleteCalls.isPending}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ==================== DETAIL PANE (main area) ==================== */
export function CallDetailPane({
  call, userNumber, onClose, onCall, onMessage, onAddContact, onBlock,
}: {
  call: Call;
  userNumber?: string;
  onClose: () => void;
  onCall: (c: Call) => void;
  onMessage: (c: Call) => void;
  onAddContact: (num: string) => void;
  onBlock: (num: string) => void;
}) {
  const number = partyNumber(call);
  const name = useContactDisplayName(number, call.contactName);
  const isNum = name === number;
  const missed = isMissedCall(call);

  const actions = [
    { icon: <FiPhone className="w-[22px] h-[22px]" />, label: 'Call', fn: () => onCall(call) },
    { icon: <FiMessageSquare className="w-[22px] h-[22px]" />, label: 'Message', fn: () => onMessage(call) },
    { icon: <FiUserPlus className="w-[22px] h-[22px]" />, label: 'Add contact', fn: () => onAddContact(number) },
    { icon: <FiSlash className="w-[22px] h-[22px]" />, label: 'Block', fn: () => onBlock(number) },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-6 pt-4">
        <button onClick={onClose} title="Close" className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><FiX className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-auto px-6 md:px-10 pb-10 flex flex-col items-center">
        <Avatar call={call} name={name} size={96} />
        <div className="mt-3.5 text-[26px] font-black text-[var(--foreground)] flex items-center gap-2">
          {isNum ? 'Unknown' : name}
          <FiInfo className="w-[18px] h-[18px] text-[var(--muted-foreground)]" />
        </div>
        <div className="mt-1 text-[15px] text-[var(--muted-foreground)] flex items-center gap-2">
          {number}
          <button title="Copy number" onClick={() => navigator.clipboard?.writeText(number)}><FiCopy className="w-4 h-4 hover:text-[var(--foreground)]" /></button>
        </div>

        {/* action row */}
        <div className="flex gap-6 mt-7 mb-8">
          {actions.map((a) => (
            <button key={a.label} onClick={a.fn} className="flex flex-col items-center gap-2 text-[var(--muted-foreground)] group">
              <span className="w-[52px] h-[52px] rounded-full bg-[var(--muted)] grid place-items-center group-hover:bg-[var(--primary-50)] dark:group-hover:bg-[var(--primary-900)]/30 group-hover:text-[var(--foreground)] transition-colors">{a.icon}</span>
              <span className="text-[11.5px] font-bold">{a.label}</span>
            </button>
          ))}
        </div>

        {/* from / to */}
        <div className="w-full max-w-[680px] rounded-2xl border border-[var(--border)] p-4 md:p-5 mb-3.5">
          <div className="text-[13px] font-black text-[var(--foreground)] mb-1.5">{call.direction === 'inbound' ? 'To' : 'From'}</div>
          <div className="text-sm text-[var(--muted-foreground)]">{userNumber || '—'} <span className="opacity-70">(me)</span></div>
        </div>
        {/* timeline */}
        <div className="w-full max-w-[680px] rounded-2xl border border-[var(--border)] p-4 md:p-5">
          <div className="text-[13px] font-black text-[var(--foreground)] mb-1.5">{formatRelativeTime(call.startTime)}</div>
          <div className={`text-sm font-bold ${missed ? 'text-[var(--danger)]' : call.direction === 'outbound' ? 'text-green-700 dark:text-green-500' : 'text-[var(--foreground)]'}`}>
            {missed ? 'Missed call' : `${call.direction === 'outbound' ? 'Outgoing' : 'Incoming'} call (${fmtDuration(call.duration)})`}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== ADD-CONTACT FLOW (screenshots 6/7/8) ==================== */
function AddToExistingModal({ number, onClose }: { number: string; onClose: () => void }) {
  const { data: contacts = [], isLoading } = useContacts();
  const updateContact = useUpdateContact();
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<{ id: number; name: string; contact: string } | null>(
    null
  );

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = (contacts as Array<{ id: number; name: string; contact: string }>) || [];
    if (!query) return list.slice(0, 30);
    return list
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(query) ||
          (c.contact || '').toLowerCase().includes(query)
      )
      .slice(0, 30);
  }, [contacts, q]);

  const doAttach = (c: { id: number; name: string }) => {
    updateContact.mutate(
      { id: c.id, data: { contact: number } },
      {
        onSuccess: () => {
          toast.success(`Number added to ${c.name}`);
          onClose();
        },
        onError: () => toast.error('Failed to add the number'),
      }
    );
  };
  // Single-number model: confirm before replacing a contact's existing number.
  const onPick = (c: { id: number; name: string; contact: string }) => {
    if (c.contact && c.contact !== number) setPending(c);
    else doAttach(c);
  };

  return (
    <>
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[460px] max-w-[92vw] max-h-[80vh] flex flex-col rounded-2xl bg-[var(--card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <b className="text-[18px] font-black text-[var(--foreground)]">Add to existing</b>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 border border-[var(--border)] rounded-xl px-3 py-2.5 mb-4 focus-within:border-[var(--border)]">
          <FiSearch className="w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Enter name or number"
            className="flex-1 bg-transparent outline-none text-sm text-[var(--foreground)]"
          />
        </div>
        <div className="text-[13px] font-bold text-[var(--foreground)] mb-2">Search results</div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="grid place-items-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border)] border-t-transparent" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10 text-sm text-[var(--muted-foreground)]">
              No contacts found
            </div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-[var(--muted)] text-left"
              >
                <div
                  className="w-9 h-9 rounded-full grid place-items-center text-white font-bold text-[12px] shrink-0"
                  style={{ background: colorFor(c.name || String(c.id)) }}
                >
                  {initialsOf(c.name || '?')}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--foreground)] truncate">{c.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)] truncate">{c.contact}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
    {pending && (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
        onClick={() => setPending(null)}
      >
        <div
          className="w-[380px] max-w-[92vw] rounded-2xl bg-[var(--card)] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-[18px] font-black text-[var(--foreground)] mb-2">Replace number?</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-5">
            <b className="text-[var(--foreground)]">{pending.name}</b> already has{' '}
            <b className="text-[var(--foreground)]">{pending.contact}</b>. Replace it with{' '}
            <b className="text-[var(--foreground)]">{number}</b>?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold text-[var(--foreground)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => doAttach(pending)}
              disabled={updateContact.isPending}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-50"
            >
              Replace
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export function AddContactFlow({ number, onClose }: { number: string; onClose: () => void }) {
  const [step, setStep] = useState<'choose' | 'create' | 'existing'>('choose');
  const createContact = useCreateContact();
  const [saveError, setSaveError] = useState<string | null>(null);
  const existingContacts = useContactLookupStore((s) => s.contacts);

  const handleCreate = async (data: CreateContactInput) => {
    setSaveError(null);
    try {
      await createContact.mutateAsync({
        name: data.name,
        contact: data.contact,
        type: data.type,
        notes: data.notes || undefined,
      });
      toast.success(`Contact "${data.name}" saved`);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save contact');
      throw err;
    }
  };

  if (step === 'create') {
    return (
      <ContactFormModal
        isOpen
        editingContact={null}
        defaultPhoneNumber={number}
        onSubmit={handleCreate}
        onClose={onClose}
        isSaving={createContact.isPending}
        apiError={saveError}
        existingContacts={existingContacts}
      />
    );
  }
  if (step === 'existing') {
    return <AddToExistingModal number={number} onClose={onClose} />;
  }
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[340px] max-w-[92vw] rounded-2xl bg-[var(--card)] p-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <b className="text-[16px] font-black text-[var(--foreground)]">Add contact</b>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setStep('create')}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-[15px] font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] [&_svg]:w-5 [&_svg]:h-5"
        >
          <FiUserPlus />
          Create new contact
        </button>
        <button
          type="button"
          onClick={() => setStep('existing')}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-[15px] font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] [&_svg]:w-5 [&_svg]:h-5"
        >
          <FiSearch />
          Add to existing
        </button>
      </div>
    </div>
  );
}
