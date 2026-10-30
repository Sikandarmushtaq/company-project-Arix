'use client';

/**
 * Recordings tab (RingCentral-style, screenshot 11). New UI only — data +
 * mutations are the existing hooks (useRecordingsPaginated, useDeleteRecording,
 * useBulkDeleteRecordings). Playback uses the SSOT <AudioPlayer/> pointed at the
 * progressive same-origin stream URL (seekable via Range). List (panel) +
 * summary/detail (main area).
 */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiSearch, FiTrash2, FiX, FiCheck, FiInfo, FiCopy, FiPlayCircle,
  FiPhone, FiMessageSquare, FiUserPlus, FiSlash, FiMic, FiMoreHorizontal, FiDownload,
} from 'react-icons/fi';
import {
  useRecordingsPaginated,
  useBulkDeleteRecordings,
  useContactDisplayName,
} from '@/lib/hooks';
import { recordingsService, type Recording } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils/datetime';
import { ConfirmModal } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { AudioPlayer } from '@/components/phone/AudioPlayer';
import { useAudioStore } from '@/lib/stores/audioPlayer';
import { GenericAvatar, fmtClock } from './avatarUtils';

/* ---------- row overflow-menu item ---------- */
function RowMenuItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
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

/* ---------- one row ---------- */
function RecordingRow({
  rec, editing, checked, selected, onClick, onToggle,
  onCall, onMessage, onCopy, onAddContact, onDelete, onBlock, onDownload,
}: {
  rec: Recording; editing: boolean; checked: boolean; selected: boolean;
  onClick: () => void; onToggle: () => void;
  onCall: () => void; onMessage: () => void; onCopy: () => void;
  onAddContact: () => void; onDelete: () => void; onBlock: () => void; onDownload: () => void;
}) {
  const name = useContactDisplayName(rec.otherParty, undefined);
  // Blue play-circle when this recording is the one loaded in the shared player.
  const isActive = useAudioStore((s) => s.activeId === `rec-${rec.id}`);
  const activate = editing ? onToggle : onClick;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
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
      <GenericAvatar name={name} number={rec.otherParty} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14.5px] font-bold truncate text-[var(--foreground)]">{name}</span>
          <FiInfo className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)] mt-0.5">
          {isActive ? (
            <FiPlayCircle className="w-3.5 h-3.5 shrink-0 text-[var(--foreground)]" />
          ) : (
            <FiPlayCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          Recording
          <span className="opacity-60">· {fmtClock(rec.duration)}</span>
        </div>
      </div>
      {!editing && (
        <>
          <span className={`text-[12px] text-[var(--muted-foreground)] shrink-0 whitespace-nowrap ${menuOpen ? 'hidden' : 'group-hover:hidden'}`}>
            {formatRelativeTime(rec.startTime)}
          </span>
          <div className={`items-center gap-1 shrink-0 ${menuOpen ? 'flex' : 'hidden group-hover:flex'}`}>
            <button onClick={(e) => { e.stopPropagation(); onCall(); }} title="Call" className="w-8 h-8 rounded-full bg-[var(--muted)] grid place-items-center text-[var(--muted-foreground)] hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30">
              <FiPhone className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onMessage(); }} title="Message" className="w-8 h-8 rounded-full bg-[var(--muted)] grid place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <FiMessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpen) { setMenuOpen(false); return; }
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const openUp = r.bottom + 220 > window.innerHeight;
                setMenuPos({
                  right: window.innerWidth - r.right,
                  ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
                });
                setMenuOpen(true);
              }}
              title="More" aria-haspopup="menu" aria-expanded={menuOpen}
              className="w-8 h-8 rounded-full bg-[var(--muted)] grid place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <FiMoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && menuPos && createPortal(
              <>
                <div className="fixed inset-0 z-[55]" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                <div
                  role="menu"
                  style={{ position: 'fixed', right: menuPos.right, top: menuPos.top, bottom: menuPos.bottom }}
                  className="z-[56] min-w-[190px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RowMenuItem icon={<FiDownload />} label="Download" onClick={() => { setMenuOpen(false); onDownload(); }} />
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
export function RecordingsList({
  selectedId, onSelect, onDeleted, onCall, onMessage, onAddContact, onBlock,
}: {
  selectedId: string | null;
  onSelect: (rec: Recording) => void;
  onDeleted?: (ids: string[]) => void;
  onCall: (num: string) => void;
  onMessage: (num: string) => void;
  onAddContact: (num: string) => void;
  onBlock: (num: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, error } = useRecordingsPaginated({ page: 1, limit: 50 });
  const bulkDelete = useBulkDeleteRecordings();
  const all = useMemo(() => data?.recordings ?? [], [data]);

  const deleteRec = (rec: Recording) => {
    bulkDelete.mutate(
      { mode: 'ids', ids: [rec.id] },
      {
        onSuccess: () => toast.success('Recording deleted'),
        onError: () => toast.error('Failed to delete recording'),
      }
    );
    onDeleted?.([rec.id]);
  };

  const downloadRec = async (rec: Recording) => {
    try {
      const blob = await recordingsService.getAudio(rec.id);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = rec.filename || `recording-${rec.otherParty}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      toast.error('Failed to download recording');
    }
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => {
      const num = (r.otherParty || '').toLowerCase();
      const nm = (r.agentName || '').toLowerCase();
      return num.includes(q) || nm.includes(q);
    });
  }, [all, search]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const confirmDelete = () => {
    const ids = Array.from(checked);
    bulkDelete.mutate(
      { mode: 'ids', ids },
      {
        onSuccess: () => toast.success(`${ids.length} recording${ids.length === 1 ? '' : 's'} deleted`),
        onError: () => toast.error('Failed to delete recordings'),
      }
    );
    onDeleted?.(ids);
    setChecked(new Set());
    setEditing(false);
    setConfirmOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* search / edit bar */}
      {editing ? (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)]">
          <b className="text-sm text-[var(--foreground)]">{checked.size} selected</b>
          <div className="flex-1" />
          <button title="Delete" disabled={!checked.size} onClick={() => setConfirmOpen(true)} className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-40"><FiTrash2 className="w-[18px] h-[18px]" /></button>
          <button title="Close" onClick={() => { setEditing(false); setChecked(new Set()); }} className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><FiX className="w-[18px] h-[18px]" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)]">
          <div className="flex-1 flex items-center gap-2 text-[var(--muted-foreground)]">
            <FiSearch className="w-4 h-4 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recordings" className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]" />
            {search && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSearch('')} title="Clear search" aria-label="Clear search" className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="text-[13px] font-black text-[var(--foreground)]">Edit</button>
        </div>
      )}

      {/* list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && all.length === 0 && (
          <div className="grid place-items-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border)] border-t-transparent" /></div>
        )}
        {error && all.length === 0 && <div className="text-center py-10 text-sm text-[var(--danger)]">{(error as Error).message}</div>}
        {!isLoading && shown.length === 0 && !error && <div className="text-center py-10 text-sm text-[var(--muted-foreground)]">No recordings</div>}
        {shown.map((rec) => (
          <RecordingRow
            key={rec.id}
            rec={rec}
            editing={editing}
            checked={checked.has(rec.id)}
            selected={selectedId === rec.id}
            onClick={() => onSelect(rec)}
            onToggle={() => toggle(rec.id)}
            onCall={() => onCall(rec.otherParty)}
            onMessage={() => onMessage(rec.otherParty)}
            onCopy={() => { navigator.clipboard?.writeText(rec.otherParty); toast.success('Number copied'); }}
            onAddContact={() => onAddContact(rec.otherParty)}
            onDelete={() => deleteRec(rec)}
            onBlock={() => onBlock(rec.otherParty)}
            onDownload={() => downloadRec(rec)}
          />
        ))}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete recording"
        message={`Delete the selected recording${checked.size === 1 ? '' : 's'}? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={bulkDelete.isPending}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ==================== SUMMARY (empty main area) ==================== */
export function RecordingsSummary() {
  return (
    <div className="flex-1 grid place-items-center text-center px-6">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] grid place-items-center mx-auto mb-4">
          <FiMic className="w-7 h-7 text-[var(--muted-foreground)]" />
        </div>
        <p className="text-[22px] font-black text-[var(--foreground)]">Recordings summary</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          For a detailed view, select an item from the list panel on the left.
        </p>
      </div>
    </div>
  );
}

/* ==================== DETAIL PANE (main area) ==================== */
export function RecordingDetailPane({
  rec, userNumber, onClose, onCall, onMessage, onAddContact, onBlock,
}: {
  rec: Recording;
  userNumber?: string;
  onClose: () => void;
  onCall: (num: string) => void;
  onMessage: (num: string) => void;
  onAddContact: (num: string) => void;
  onBlock: (num: string) => void;
}) {
  const number = rec.otherParty;
  const name = useContactDisplayName(number, undefined);
  const isNum = !name || name === number;
  const streamUrl = recordingsService.getPlaybackStreamUrl(rec.id);

  // No "Note" for recordings (matches RingCentral) — Call / Message / Add / Block.
  const actions = [
    { icon: <FiPhone className="w-[22px] h-[22px]" />, label: 'Call', fn: () => onCall(number) },
    { icon: <FiMessageSquare className="w-[22px] h-[22px]" />, label: 'Message', fn: () => onMessage(number) },
    { icon: <FiUserPlus className="w-[22px] h-[22px]" />, label: 'Add contact', fn: () => onAddContact(number) },
    { icon: <FiSlash className="w-[22px] h-[22px]" />, label: 'Block', fn: () => onBlock(number) },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-6 pt-4">
        <button onClick={onClose} title="Close" className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><FiX className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-auto px-6 md:px-10 pb-10 flex flex-col items-center">
        <GenericAvatar name={name} number={number} size={96} />
        <div className="mt-3.5 text-[26px] font-black text-[var(--foreground)] flex items-center gap-2">
          {isNum ? 'Unknown' : name}
          <FiInfo className="w-[18px] h-[18px] text-[var(--muted-foreground)]" />
        </div>
        <div className="mt-1 text-[15px] text-[var(--muted-foreground)] flex items-center gap-2">
          {number}
          <button title="Copy number" onClick={() => { navigator.clipboard?.writeText(number); toast.success('Number copied'); }}><FiCopy className="w-4 h-4 hover:text-[var(--foreground)]" /></button>
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

        {/* audio player card */}
        <div className="w-full max-w-[680px] rounded-2xl border border-[var(--border)] p-4 md:p-5 mb-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-black text-[var(--foreground)]">{formatRelativeTime(rec.startTime)}</div>
            <div className={`text-[12px] font-bold ${rec.direction === 'outbound' ? 'text-green-700 dark:text-green-500' : 'text-[var(--foreground)]'}`}>
              {rec.direction === 'outbound' ? 'Outgoing' : 'Incoming'} recording
            </div>
          </div>
          <AudioPlayer
            id={`rec-${rec.id}`}
            url={streamUrl}
            durationSeconds={rec.duration}
            filename={rec.filename || `recording-${number}.wav`}
          />
        </div>

        {/* from / to */}
        <div className="w-full max-w-[680px] rounded-2xl border border-[var(--border)] p-4 md:p-5">
          <div className="text-[13px] font-black text-[var(--foreground)] mb-1.5">{rec.direction === 'inbound' ? 'To' : 'From'}</div>
          <div className="text-sm text-[var(--muted-foreground)]">{userNumber || rec.extension || '—'} <span className="opacity-70">(me)</span></div>
        </div>
      </div>
    </div>
  );
}
