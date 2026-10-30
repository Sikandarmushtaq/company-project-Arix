'use client';

/**
 * In-app Support page (/phone/support).
 *
 * Our OWN internal support chat (replaced Tawk.to). The user describes an issue
 * in a single message; it opens a ticket that rings every super-admin until one
 * picks it up. Messages flow both ways in real time. Falls back to email below.
 *
 * If a request sits unclaimed for a while, we offer an email callback so the
 * user isn't stuck watching a "Waiting" spinner — they can leave and we email
 * them the moment an agent replies.
 *
 * @module app/phone/support/page
 */

import { useEffect, useRef, useState } from 'react';
import {
  FiHelpCircle,
  FiMessageCircle,
  FiMail,
  FiBookOpen,
  FiSend,
  FiPaperclip,
  FiCheck,
  FiClock,
} from 'react-icons/fi';
import {
  useMyTicket,
  useMyMessages,
  useCreateTicket,
  useSendMyMessage,
  useMarkMyRead,
  useUploadMyAttachment,
  useRequestCallback,
  useCloseMyTicket,
} from '@/lib/hooks/useSupport';
import { useRealtimeSupportSync } from '@/lib/hooks/useRealtimeSupportSync';
import { compressImage } from '@/lib/utils/image-compress';

const SUPPORT_EMAIL = 'support@arixcall.com';

/** How long a request may sit unclaimed before we offer the email callback. */
const OFFER_CALLBACK_AFTER_MS = 90_000;

export default function SupportPage() {
  useRealtimeSupportSync();

  const { data: ticket, isLoading } = useMyTicket();
  const activeTicket = ticket && ticket.status !== 'closed' ? ticket : null;
  const { data: messages } = useMyMessages(activeTicket?.id);
  const createTicket = useCreateTicket();
  const sendMessage = useSendMyMessage();
  const markRead = useMarkMyRead();
  const uploadAttachment = useUploadMyAttachment();
  const requestCallback = useRequestCallback();
  const closeChat = useCloseMyTicket();

  const handleEndChat = () => {
    if (!activeTicket || closeChat.isPending) return;
    if (!window.confirm('End this support chat? You can start a new one any time.')) return;
    closeChat.mutate(activeTicket.id);
  };

  const [draft, setDraft] = useState('');
  const [offerVisible, setOfferVisible] = useState(false);
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll the thread on new messages.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages?.items?.length, activeTicket?.status]);

  // Clear the user's unread badge when viewing an active ticket.
  useEffect(() => {
    if (activeTicket && activeTicket.unreadForUser > 0) markRead.mutate(activeTicket.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicket?.id, activeTicket?.unreadForUser]);

  // Reveal the email-callback offer once a request has waited long enough.
  // Showing the offer has no side effect (the email is only queued when the user
  // clicks), so a client timer is fine here — the confirmed state and the actual
  // email are both backend-owned.
  const openTicketId = activeTicket?.status === 'open' ? activeTicket.id : null;
  const openTicketCreatedAt = activeTicket?.status === 'open' ? activeTicket.createdAt : null;
  useEffect(() => {
    if (!openTicketId || !openTicketCreatedAt) {
      setOfferVisible(false);
      return;
    }
    const created = Date.parse(openTicketCreatedAt);
    const elapsed = Number.isFinite(created) ? Date.now() - created : 0;
    if (elapsed >= OFFER_CALLBACK_AFTER_MS) {
      setOfferVisible(true);
      return;
    }
    const t = setTimeout(() => setOfferVisible(true), OFFER_CALLBACK_AFTER_MS - elapsed);
    return () => clearTimeout(t);
  }, [openTicketId, openTicketCreatedAt]);

  const busy = createTicket.isPending || sendMessage.isPending || uploadAttachment.isPending;

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (activeTicket) {
      sendMessage.mutate({ ticketId: activeTicket.id, body: text });
    } else {
      createTicket.mutate(text);
    }
    setDraft('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const requestCb = (email?: string) => {
    if (!activeTicket) return;
    requestCallback.mutate(
      { ticketId: activeTicket.id, email },
      {
        onSuccess: () => setEmailEdit(false),
        // If the one-click path fails (e.g. no email on file), reveal the input
        // so the user can type one instead of hitting a dead-end error.
        onError: () => setEmailEdit(true),
      }
    );
  };

  // Compress in the browser, then upload with the current draft as an optional caption.
  const sendImage = async (file: File) => {
    if (busy) return;
    const caption = draft.trim();
    const compressed = await compressImage(file);
    uploadAttachment.mutate(
      { file: compressed, caption: caption || undefined },
      { onSuccess: () => setDraft('') }
    );
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
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

  const statusLine = activeTicket
    ? activeTicket.status === 'open'
      ? 'Connecting you to support…'
      : `Connected${activeTicket.assignedAdminName ? ` — ${activeTicket.assignedAdminName}` : ''}`
    : ticket?.status === 'closed'
      ? 'Your last support session ended. Send a message to start a new one.'
      : 'Describe your issue and we’ll connect you with our team.';

  const isWaiting = activeTicket?.status === 'open';
  const callbackConfirmed = !!activeTicket?.callbackRequestedAt;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--coral)]/10 text-[var(--coral-700)]">
          <FiHelpCircle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Support</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            We&apos;re here to help. Start a chat with our team below.
          </p>
        </div>
      </header>

      {/* Live chat card */}
      <section className="mb-4 flex h-[26rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <FiMessageCircle className="h-5 w-5 text-[var(--coral-700)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Live support</h2>
            <p className="text-xs text-[var(--muted-foreground)]">{statusLine}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isWaiting && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--coral)]/10 px-2.5 py-1 text-xs font-medium text-[var(--coral-700)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--coral)]" />
                Waiting
              </span>
            )}
            {activeTicket && (
              <button
                type="button"
                onClick={handleEndChat}
                disabled={closeChat.isPending}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)] transition hover:border-[var(--danger)]/40 hover:text-[var(--danger)] disabled:opacity-60"
              >
                {closeChat.isPending ? 'Ending…' : 'End chat'}
              </button>
            )}
          </div>
        </div>

        {/* Email-callback offer / confirmation (only while waiting, unclaimed) */}
        {isWaiting && (callbackConfirmed || offerVisible) && (
          <div className="border-b border-[var(--border)] bg-[var(--coral)]/[0.06] px-4 py-3">
            {callbackConfirmed ? (
              <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <FiCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  We&apos;ll email you at{' '}
                  <strong className="break-all">{activeTicket?.callbackEmail}</strong> as soon as we
                  reply — you don&apos;t have to wait here.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--coral-700)]" />
                  <p className="text-sm text-[var(--foreground)]">
                    This is taking a little longer than usual. Want us to email you the moment we
                    reply, so you don&apos;t have to wait here?
                  </p>
                </div>
                {emailEdit ? (
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <input
                      type="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      placeholder="you@example.com"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--coral)]"
                    />
                    <button
                      type="button"
                      onClick={() => requestCb(emailValue.trim() || undefined)}
                      disabled={requestCallback.isPending}
                      className="shrink-0 rounded-lg bg-[var(--coral)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--coral-700)] disabled:opacity-60"
                    >
                      {requestCallback.isPending ? 'Saving…' : 'Notify me'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 pl-6">
                    <button
                      type="button"
                      onClick={() => requestCb()}
                      disabled={requestCallback.isPending}
                      className="rounded-lg bg-[var(--coral)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--coral-700)] disabled:opacity-60"
                    >
                      {requestCallback.isPending ? 'Setting up…' : 'Email me when you reply'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailEdit(true)}
                      className="text-xs font-medium text-[var(--coral-700)] hover:underline"
                    >
                      Use a different email
                    </button>
                  </div>
                )}
                {requestCallback.isError && (
                  <p className="pl-6 text-xs text-[var(--danger)]">
                    Couldn&apos;t set that up — check the email and try again.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Thread */}
        <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <p className="text-center text-sm text-[var(--muted-foreground)]">Loading…</p>
          ) : !activeTicket && !messages?.items?.length ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <FiMessageCircle className="mb-2 h-8 w-8 text-[var(--muted-foreground)]" />
              <p className="text-sm text-[var(--muted-foreground)]">
                No active conversation. Type your issue below to reach our team.
              </p>
            </div>
          ) : (
            (messages?.items ?? []).map((m) => (
              <div
                key={m.id}
                className={`flex ${m.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    m.senderRole === 'user'
                      ? 'rounded-br-sm bg-[var(--coral)] text-white'
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
            ))
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-[var(--border)] p-3">
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
              disabled={busy}
              title="Attach a screenshot"
              aria-label="Attach a screenshot"
              className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPaperclip className="h-4 w-4" />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              rows={1}
              placeholder="Describe your issue, or paste a screenshot…"
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--coral)]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || busy}
              className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--coral)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--coral-700)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSend className="h-4 w-4" />
              Send
            </button>
          </div>
          {uploadAttachment.isPending && (
            <p className="mt-2 px-1 text-xs text-[var(--muted-foreground)]">Uploading image…</p>
          )}
        </div>
      </section>

      {/* Email + help */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[var(--foreground)]">
            <FiMail className="h-5 w-5 text-[var(--coral-700)]" />
            <h2 className="font-semibold">Email us</h2>
          </div>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            Prefer email? Send us the details and we&apos;ll get back to you.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]"
          >
            <FiMail className="h-4 w-4" />
            {SUPPORT_EMAIL}
          </a>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[var(--foreground)]">
            <FiBookOpen className="h-5 w-5 text-[var(--coral-700)]" />
            <h2 className="font-semibold">Before you reach out</h2>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            For call quality issues, check your network and microphone permissions. Include the
            number you were dialing and the approximate time so we can find the call quickly.
          </p>
        </section>
      </div>
    </div>
  );
}
