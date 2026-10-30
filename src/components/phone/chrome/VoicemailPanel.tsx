'use client';

/**
 * Voicemail tab (RingCentral-style, screenshot 9). New UI only — all data +
 * mutations are the existing battle-tested hooks (useVoicemailsPaginated,
 * useMarkVoicemailAsRead, useDeleteVoicemail(s)). Playback uses the SSOT
 * <AudioPlayer/>. List (panel) + detail pane (main area).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiSearch, FiVoicemail, FiTrash2, FiX, FiCheck, FiInfo, FiCopy,
  FiPhone, FiMessageSquare, FiUserPlus, FiSlash,
} from 'react-icons/fi';
import {
  useVoicemailsPaginated,
  useMarkVoicemailAsRead,
  useDeleteVoicemail,
  useDeleteVoicemails,
  useContactDisplayName,
} from '@/lib/hooks';
import { voicemailService, type Voicemail } from '@/lib/api';
import { formatConversationTime } from '@/lib/utils/datetime';
import { ConfirmModal } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { AudioPlayer } from '@/components/phone/AudioPlayer';
import { useAudioStore } from '@/lib/stores/audioPlayer';
import { GenericAvatar, fmtClock } from './avatarUtils';

function nameFor(vm: Voicemail): string | undefined {
  return vm.callerIdName && vm.callerIdName !== 'Unknown' ? vm.callerIdName : undefined;
}

/* ---------- one row ---------- */
function VoicemailRow({
  vm, editing, checked, selected, onClick, onToggle,
}: {
  vm: Voicemail; editing: boolean; checked: boolean; selected: boolean;
  onClick: () => void; onToggle: () => void;
}) {
  const name = useContactDisplayName(vm.callerIdNum, nameFor(vm));
  const isNew = !vm.read;
  const activate = editing ? onToggle : onClick;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      }}
      className={`group flex items-start gap-3 px-4 py-2.5 cursor-pointer border-b border-[var(--border)]/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-500)] ${
        selected ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20' : 'hover:bg-[var(--muted)]/60'
      }`}
    >
      {editing ? (
        <span className={`mt-1 w-5 h-5 rounded border-2 grid place-items-center shrink-0 ${checked ? 'bg-[var(--primary-600)] border-[var(--border)]' : 'border-[var(--border)]'}`}>
          {checked && <FiCheck className="w-3 h-3 text-white" />}
        </span>
      ) : (
        <span className="mt-1 w-2 shrink-0 grid place-items-center">
          {isNew && <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />}
        </span>
      )}
      <GenericAvatar name={name} number={vm.callerIdNum} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[14.5px] font-bold truncate ${isNew ? 'text-[var(--foreground)]' : 'text-[var(--foreground)]'}`}>{name}</span>
          <FiInfo className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted-foreground)] mt-0.5">
          <FiVoicemail className="w-3.5 h-3.5 shrink-0" />
          {fmtClock(vm.duration)}
        </div>
        {vm.transcription && (
          <p className="text-[12.5px] text-[var(--muted-foreground)] mt-1 line-clamp-2">{vm.transcription}</p>
        )}
      </div>
      <span className="text-[12px] text-[var(--muted-foreground)] shrink-0 whitespace-nowrap">
        {formatConversationTime(vm.origTime)}
      </span>
    </div>
  );
}

/* ==================== LIST (panel) ==================== */
export function VoicemailList({
  selectedId, onSelect, onDeleted,
}: {
  selectedId: string | null;
  onSelect: (vm: Voicemail) => void;
  onDeleted?: (ids: string[]) => void;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  // On the UNREAD tab, opening an item marks it read — but it should NOT vanish
  // mid-view. We keep just-opened ids "sticky" so the row stays (its blue dot
  // clears) until the tab is toggled (see the ALL/UNREAD handlers) or the list
  // is refetched/remounted, at which point it correctly drops out of UNREAD.
  const [stickyRead, setStickyRead] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useVoicemailsPaginated({ page: 1, limit: 50 });
  const deleteVoicemails = useDeleteVoicemails();
  const all = useMemo(() => data?.voicemails ?? [], [data]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((vm) => {
      if (unreadOnly && vm.read && !stickyRead.has(vm.id)) return false;
      if (q) {
        const num = (vm.callerIdNum || '').toLowerCase();
        const nm = (vm.callerIdName || '').toLowerCase();
        const tx = (vm.transcription || '').toLowerCase();
        if (!num.includes(q) && !nm.includes(q) && !tx.includes(q)) return false;
      }
      return true;
    });
  }, [all, unreadOnly, search, stickyRead]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const confirmDelete = () => {
    const rows = all.filter((vm) => checked.has(vm.id));
    const ids = rows.map((vm) => vm.id);
    deleteVoicemails.mutate(
      rows.map((vm) => ({ extension: vm.extension, msgId: vm.id })),
      {
        onSuccess: () => toast.success(`${ids.length} voicemail${ids.length === 1 ? '' : 's'} deleted`),
        onError: () => toast.error('Failed to delete voicemails'),
      }
    );
    onDeleted?.(ids);
    setChecked(new Set());
    setEditing(false);
    setConfirmOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* filter / edit bar */}
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search voicemail" className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]" />
            {search && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSearch('')} title="Clear search" aria-label="Clear search" className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button onClick={() => { setUnreadOnly(false); setStickyRead(new Set()); }} className={`text-[13px] font-black ${!unreadOnly ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>ALL</button>
          <button onClick={() => { setUnreadOnly(true); setStickyRead(new Set()); }} className={`text-[13px] font-black ${unreadOnly ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>UNREAD</button>
          <button onClick={() => setEditing(true)} className="text-[13px] font-black text-[var(--foreground)]">Edit</button>
        </div>
      )}

      {/* list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && all.length === 0 && (
          <div className="grid place-items-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border)] border-t-transparent" /></div>
        )}
        {error && all.length === 0 && <div className="text-center py-10 text-sm text-[var(--danger)]">{(error as Error).message}</div>}
        {!isLoading && shown.length === 0 && !error && <div className="text-center py-10 text-sm text-[var(--muted-foreground)]">No voicemails</div>}
        {shown.map((vm) => (
          <VoicemailRow
            key={vm.id}
            vm={vm}
            editing={editing}
            checked={checked.has(vm.id)}
            selected={selectedId === vm.id}
            onClick={() => {
              // Keep it visible on the UNREAD tab even once it flips to read.
              if (unreadOnly && !vm.read) {
                setStickyRead((prev) => new Set(prev).add(vm.id));
              }
              onSelect(vm);
            }}
            onToggle={() => toggle(vm.id)}
          />
        ))}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete voicemail"
        message={`Delete the selected voicemail${checked.size === 1 ? '' : 's'}?`}
        confirmText="Delete"
        variant="danger"
        loading={deleteVoicemails.isPending}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ==================== DETAIL PANE (main area) ==================== */
export function VoicemailDetailPane({
  vm, userNumber, onClose, onCall, onMessage, onAddContact, onBlock, onDeleted,
}: {
  vm: Voicemail;
  userNumber?: string;
  onClose: () => void;
  onCall: (num: string) => void;
  onMessage: (num: string) => void;
  onAddContact: (num: string) => void;
  onBlock: (num: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const number = vm.callerIdNum;
  const name = useContactDisplayName(number, nameFor(vm));
  const isNum = !name || name === number;
  const markRead = useMarkVoicemailAsRead();
  const deleteVoicemail = useDeleteVoicemail();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const markedRef = useRef<string | null>(null);

  // Audio: fetch the blob through apiClient (Bearer-token authenticated) — a
  // plain <audio src> can't send the Authorization header, so a direct/stream
  // URL 401s. Done as LOCAL state (not a ['voicemail'] React Query) so
  // markRead's cancelQueries(['voicemail']) can't cancel it. Voicemails are
  // small, so this is fast; the player shows a spinner while it loads.
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioError, setAudioError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;
    setAudioUrl(null);
    setAudioError(false);
    setAudioLoading(true);
    voicemailService
      .getAudioBlob(vm.extension, vm.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objUrl = u;
        setAudioUrl(u);
        setAudioLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAudioError(true);
        setAudioLoading(false);
      });
    return () => {
      cancelled = true;
      // If this voicemail is the one loaded in the shared player, stop it before
      // revoking its blob URL — don't leave a revoked source, and don't keep
      // audio playing after you've switched away from it.
      const player = useAudioStore.getState();
      if (player.activeId === `vm-${vm.id}`) player.stop();
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [vm.extension, vm.id, reloadKey]);

  // Mark read immediately on open (realtime unread→read). Independent of the
  // audio fetch above (that's plain state, not a query), so nothing cancels it.
  useEffect(() => {
    if (!vm.read && markedRef.current !== vm.id) {
      markedRef.current = vm.id;
      markRead.mutate({ extension: vm.extension, msgId: vm.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.id, vm.read]);

  const actions = [
    { icon: <FiPhone className="w-[22px] h-[22px]" />, label: 'Call', fn: () => onCall(number) },
    { icon: <FiMessageSquare className="w-[22px] h-[22px]" />, label: 'Message', fn: () => onMessage(number) },
    { icon: <FiUserPlus className="w-[22px] h-[22px]" />, label: 'Add contact', fn: () => onAddContact(number) },
    { icon: <FiSlash className="w-[22px] h-[22px]" />, label: 'Block', fn: () => onBlock(number) },
  ];

  const doDelete = () => {
    deleteVoicemail.mutate(
      { extension: vm.extension, msgId: vm.id },
      {
        onSuccess: () => { toast.success('Voicemail deleted'); onDeleted?.(vm.id); onClose(); },
        onError: () => toast.error('Failed to delete voicemail'),
      }
    );
    setConfirmOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end gap-1 px-6 pt-4">
        <button onClick={() => setConfirmOpen(true)} title="Delete" className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><FiTrash2 className="w-5 h-5" /></button>
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

        {/* To (me) */}
        <div className="w-full max-w-[680px] rounded-2xl border border-[var(--border)] p-4 md:p-5 mb-3.5">
          <div className="text-[13px] font-black text-[var(--foreground)] mb-1.5">To</div>
          <div className="text-sm text-[var(--muted-foreground)]">{userNumber || '—'} <span className="opacity-70">(me)</span></div>
        </div>

        {/* audio player card */}
        <div className="w-full max-w-[680px] rounded-2xl border border-[var(--border)] p-4 md:p-5">
          <div className="text-[13px] font-black text-[var(--foreground)] mb-3">{formatConversationTime(vm.origTime)}</div>
          {audioError ? (
            <div className="flex items-center justify-between gap-3 py-2 text-sm text-[var(--muted-foreground)]">
              <span>Couldn&apos;t load the audio.</span>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="text-[13px] font-bold text-[var(--foreground)] hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <AudioPlayer
              id={`vm-${vm.id}`}
              url={audioUrl || ''}
              loading={audioLoading}
              durationSeconds={vm.duration}
              filename={`voicemail-${number}.wav`}
            />
          )}
        </div>

        {/* transcript — only when the backend actually provides one */}
        {vm.transcription && (
          <div className="w-full max-w-[680px] mt-6">
            <div className="text-[15px] font-black text-[var(--foreground)] mb-2">Transcript</div>
            <p className="text-[14px] leading-relaxed text-[var(--muted-foreground)]">{vm.transcription}</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete voicemail"
        message="Delete this voicemail?"
        confirmText="Delete"
        variant="danger"
        loading={deleteVoicemail.isPending}
        onConfirm={doDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
