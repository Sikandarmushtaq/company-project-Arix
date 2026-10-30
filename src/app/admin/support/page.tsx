'use client';

/**
 * Super-admin Support Inbox (/admin/support).
 *
 * Lists support tickets (open / active / closed), lets a super-admin CLAIM an
 * unclaimed ticket (first-claim-wins), chat with the user, TRANSFER to another
 * super-admin, and END the session. Opening a ticket clears its ring.
 *
 * @module app/admin/support/page
 */

import { useEffect, useRef, useState } from 'react';
import { FiLifeBuoy, FiSend, FiX, FiUser, FiPaperclip } from 'react-icons/fi';
import { useAuthStore } from '@/lib/stores/auth';
import { useSocket } from '@/lib/providers/SocketProvider';
import { REALTIME_EVENTS } from '@/lib/constants/events';
import type { SupportTicket, SupportTicketStatus } from '@/lib/api/services/support.api';
import {
  useAdminTickets,
  useAdminMessages,
  useSuperAdmins,
  useClaimTicket,
  useAdminReply,
  useMarkAdminRead,
  useTransferTicket,
  useCloseTicket,
  useUploadAdminAttachment,
  useDuty,
  useSetDuty,
} from '@/lib/hooks/useSupport';
import { compressImage } from '@/lib/utils/image-compress';

const TABS: Array<{ key: SupportTicketStatus; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
];

export default function AdminSupportPage() {
  const myId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<SupportTicketStatus>('open');
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const { data: tickets } = useAdminTickets(tab);
  const { data: messages } = useAdminMessages(selected?.id);
  const { data: superAdmins } = useSuperAdmins();

  const claim = useClaimTicket();
  const reply = useAdminReply();
  const markRead = useMarkAdminRead();
  const transfer = useTransferTicket();
  const close = useCloseTicket();
  const uploadAttachment = useUploadAdminAttachment();
  const { data: duty } = useDuty();
  const setDuty = useSetDuty();

  const [draft, setDraft] = useState('');
  const [transferTo, setTransferTo] = useState<number | ''>('');
  const threadRef = useRef<HTMLDivElement | null>(null);

  // Live "user is typing" draft preview (pushed from the guest/user side).
  const { socket, isConnected } = useSocket();
  const [typing, setTyping] = useState<{ ticketId: number; draft: string } | null>(null);
  useEffect(() => {
    if (!socket || !isConnected) return;
    const onTyping = (p: { ticketId: number; draft: string }) => {
      if (typeof p?.ticketId === 'number') setTyping({ ticketId: p.ticketId, draft: p.draft ?? '' });
    };
    socket.on(REALTIME_EVENTS.SUPPORT_TYPING, onTyping);
    return () => {
      socket.off(REALTIME_EVENTS.SUPPORT_TYPING, onTyping);
    };
  }, [socket, isConnected]);
  // Expire the preview a few seconds after the last update (they stopped typing).
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setTyping(null), 5000);
    return () => clearTimeout(t);
  }, [typing]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAssignedToMe = !!selected && selected.assignedAdminId === myId;
  const isUnclaimed = !!selected && selected.status === 'open';

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages?.items?.length, selected?.id, typing?.draft]);

  // Opening a ticket clears its ring for every super-admin.
  useEffect(() => {
    if (selected?.id) markRead.mutate(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const openTicket = (t: SupportTicket) => {
    setSelected(t);
    setDraft('');
    setTransferTo('');
  };

  const doClaim = async () => {
    if (!selected) return;
    try {
      const updated = await claim.mutateAsync(selected.id);
      setSelected(updated);
    } catch {
      /* already claimed — the list refetch will reflect the new owner */
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !selected || !isAssignedToMe) return;
    reply.mutate({ ticketId: selected.id, body: text });
    setDraft('');
  };

  const canReply = !!selected && isAssignedToMe && selected.status !== 'closed';

  // Compress in the browser, then reply with the image (current draft = caption).
  const sendImage = async (file: File) => {
    if (!selected || !canReply || uploadAttachment.isPending) return;
    const caption = draft.trim();
    const compressed = await compressImage(file);
    uploadAttachment.mutate(
      { ticketId: selected.id, file: compressed, caption: caption || undefined },
      { onSuccess: () => setDraft('') }
    );
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void sendImage(file);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const img = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!img) return;
    const file = img.getAsFile();
    if (file) {
      e.preventDefault();
      void sendImage(file);
    }
  };

  const doTransfer = async () => {
    if (!selected || !transferTo) return;
    await transfer.mutateAsync({ ticketId: selected.id, toAdminId: Number(transferTo) });
    setSelected(null);
  };

  const doClose = async () => {
    if (!selected) return;
    const closed = await close.mutateAsync(selected.id);
    setSelected(closed);
  };

  const list = tickets?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--coral)]/10 text-[var(--coral-700)]">
          <FiLifeBuoy className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Support Inbox</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Claim a request, chat with the user, transfer, or end the session.
          </p>
        </div>

        {/* Punch-in toggle — when NO agent is on duty, new requests auto-reply. */}
        <div className="ml-auto flex flex-col items-end gap-1">
          <label
            className="flex cursor-pointer select-none items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 shadow-sm"
            title="When you're on duty, requests ring you. When no agent is on duty, users get an automatic reply."
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={!!duty?.onDuty}
              onChange={(e) => setDuty.mutate(e.target.checked)}
              disabled={setDuty.isPending || duty === undefined}
            />
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                duty?.onDuty ? 'bg-emerald-500' : 'bg-[var(--muted)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  duty?.onDuty ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {duty?.onDuty ? 'On duty' : 'On break'}
            </span>
          </label>
          <span className="text-xs text-[var(--muted-foreground)]">
            {duty ? `${duty.onDutyCount} agent${duty.onDutyCount === 1 ? '' : 's'} on duty` : ' '}
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Ticket list */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <div className="flex gap-1 border-b border-[var(--border)] p-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.key
                    ? 'bg-[var(--primary-600)] text-white'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {list.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--muted-foreground)]">
                No {tab} tickets.
              </p>
            ) : (
              list.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t)}
                  className={`flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-4 py-3 text-left transition hover:bg-[var(--muted)] ${
                    selected?.id === t.id ? 'bg-[var(--muted)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {t.userName || `User #${t.userId}`}
                    </span>
                    {t.unreadForAdmin > 0 && (
                      <span className="ml-auto rounded-full bg-[var(--primary-600)] px-1.5 text-xs font-semibold text-white">
                        {t.unreadForAdmin}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-[var(--muted-foreground)]">
                    {t.lastMessagePreview || t.subject}
                  </span>
                  {t.status === 'active' && t.assignedAdminName && (
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      · {t.assignedAdminName}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread + actions */}
        <div className="flex h-[36rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-[var(--muted-foreground)]">
              <FiLifeBuoy className="mb-2 h-8 w-8" />
              <p className="text-sm">Select a ticket to view the conversation.</p>
            </div>
          ) : (
            <>
              {/* Ticket header + actions */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <FiUser className="h-4 w-4 text-[var(--muted-foreground)]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                    {selected.userName || `User #${selected.userId}`}
                  </p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {selected.userPhone || selected.subject}
                  </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {isUnclaimed && (
                    <button
                      type="button"
                      onClick={doClaim}
                      disabled={claim.isPending}
                      className="rounded-lg bg-[var(--primary-600)] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-700)] disabled:opacity-60"
                    >
                      {claim.isPending ? 'Claiming…' : 'Claim'}
                    </button>
                  )}
                  {isAssignedToMe && selected.status !== 'closed' && (
                    <>
                      <div className="flex items-center gap-1">
                        <select
                          value={transferTo}
                          onChange={(e) =>
                            setTransferTo(e.target.value ? Number(e.target.value) : '')
                          }
                          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)]"
                        >
                          <option value="">Transfer to…</option>
                          {(superAdmins ?? [])
                            .filter((a) => a.id !== myId)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.fullName || `Admin #${a.id}`}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={doTransfer}
                          disabled={!transferTo || transfer.isPending}
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
                        >
                          Transfer
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={doClose}
                        disabled={close.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        <FiX className="h-4 w-4" />
                        End
                      </button>
                    </>
                  )}
                  {selected.status === 'closed' && (
                    <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                      Closed
                    </span>
                  )}
                  {!isUnclaimed && !isAssignedToMe && selected.status !== 'closed' && (
                    <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                      Assigned to {selected.assignedAdminName || 'another admin'}
                    </span>
                  )}
                </div>
              </div>

              {/* Thread */}
              <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {(messages?.items ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                        m.senderRole === 'admin'
                          ? 'rounded-br-sm bg-[var(--primary-600)] text-white'
                          : 'rounded-bl-sm bg-[var(--muted)] text-[var(--foreground)]'
                      }`}
                    >
                      {m.attachment?.url && (
                        <a
                          href={m.attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.attachment.url}
                            alt={m.attachment.name ?? 'attachment'}
                            className="max-h-60 max-w-full rounded-lg object-contain"
                          />
                        </a>
                      )}
                      {m.body && (
                        <span className={m.attachment ? 'mt-1.5 block' : undefined}>{m.body}</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Live "user is typing" preview for the open ticket. */}
                {selected && typing?.ticketId === selected.id && typing.draft.trim() && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm border border-dashed border-[var(--coral)]/50 bg-[var(--coral)]/[0.06] px-3.5 py-2 text-sm text-[var(--muted-foreground)]">
                      <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--coral-700)]">
                        <span className="inline-flex gap-0.5">
                          <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--coral)] [animation-delay:-0.2s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--coral)] [animation-delay:-0.1s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--coral)]" />
                        </span>
                        typing
                      </span>
                      {typing.draft}
                    </div>
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-[var(--border)] p-3">
                {isAssignedToMe && selected.status !== 'closed' ? (
                  <>
                    <div className="flex items-end gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        onChange={onPickFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadAttachment.isPending}
                        title="Attach an image"
                        aria-label="Attach an image"
                        className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiPaperclip className="h-4 w-4" />
                      </button>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        onPaste={onPaste}
                        rows={1}
                        placeholder="Reply to the user, or paste an image…"
                        className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary-500)]"
                      />
                      <button
                        type="button"
                        onClick={send}
                        disabled={!draft.trim() || reply.isPending}
                        className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--primary-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-700)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiSend className="h-4 w-4" />
                        Send
                      </button>
                    </div>
                    {uploadAttachment.isPending && (
                      <p className="mt-2 px-1 text-xs text-[var(--muted-foreground)]">
                        Uploading image…
                      </p>
                    )}
                  </>
                ) : (
                  <p className="py-2 text-center text-xs text-[var(--muted-foreground)]">
                    {isUnclaimed
                      ? 'Claim this ticket to reply.'
                      : selected.status === 'closed'
                        ? 'This session has ended.'
                        : 'Assigned to another admin.'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
