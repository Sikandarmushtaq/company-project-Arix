'use client';

/**
 * Floating support widget for PUBLIC pages (landing, signup, …).
 *
 * A round bubble bottom-right that opens a live chat. Anonymous visitors give
 * their email + a message (captcha-gated), get a guest token (localStorage), and
 * chat with agents in real time via short polling. Agent replies appear live and
 * are also emailed. Hidden for logged-in users — they use the in-app tab instead.
 *
 * @module components/support/SupportWidget
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiMessageCircle, FiX, FiSend, FiChevronDown } from 'react-icons/fi';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { guestSupportApi } from '@/lib/api/services/guest-support.api';

const TOKEN_KEY = 'arix_support_guest';
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

export function SupportWidget() {
  const pathname = usePathname();
  const qc = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Pre-chat form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [formError, setFormError] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Chat composer
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement | null>(null);
  const typingRef = useRef<{ last: number; timer: ReturnType<typeof setTimeout> | null }>({
    last: 0,
    timer: null,
  });

  // A gentle "Need help?" greeting nudge that pops a few seconds after load to
  // draw the eye (Intercom-style), dismissible and one-shot per session.
  const [nudge, setNudge] = useState(false);
  const nudgeDismissed = useRef(false);
  useEffect(() => {
    if (open || token || nudgeDismissed.current) return;
    const t = setTimeout(() => setNudge(true), 5000);
    return () => clearTimeout(t);
  }, [open, token]);

  useEffect(() => {
    // Client-only: read the persisted guest token after hydration (SSR has no
    // localStorage; the first render must match the server = no token).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe post-hydration init
    setMounted(true);
    try {
      setToken(localStorage.getItem(TOKEN_KEY));
    } catch {
      /* localStorage blocked — widget still works in-session */
    }
  }, []);

  const threadQ = useQuery({
    queryKey: ['guest-support', token],
    queryFn: () => guestSupportApi.thread(token!),
    enabled: !!token && open,
    refetchInterval: open && token ? 4000 : false,
    retry: false,
  });

  // If the token is stale/invalid, drop it and return to the pre-chat form.
  useEffect(() => {
    if (threadQ.isError && token) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- react to a stale/invalid token from the poll
      setToken(null);
    }
  }, [threadQ.isError, token]);

  const ticket = threadQ.data?.ticket;
  const messages = threadQ.data?.messages ?? [];
  const isClosed = ticket?.status === 'closed';
  const activeSession = !!token && !isClosed;

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages.length, open]);

  const startMut = useMutation({
    mutationFn: () =>
      guestSupportApi.start({
        name: name.trim() || undefined,
        email: email.trim(),
        message: message.trim(),
        captchaToken: captcha || undefined,
      }),
    onSuccess: (data) => {
      try {
        localStorage.setItem(TOKEN_KEY, data.guestToken);
      } catch {
        /* ignore */
      }
      qc.setQueryData(['guest-support', data.guestToken], {
        ticket: data.ticket,
        messages: data.messages,
      });
      setToken(data.guestToken);
      setMessage('');
      setFormError('');
    },
    onError: (e) => {
      setFormError(e instanceof Error ? e.message : 'Could not start the chat. Please try again.');
      turnstileRef.current?.reset();
      setCaptcha('');
    },
  });

  const sendMut = useMutation({
    mutationFn: (body: string) => guestSupportApi.send(token!, body),
    onSuccess: () => {
      setDraft('');
      threadQ.refetch();
    },
  });

  const closeMut = useMutation({
    mutationFn: () => guestSupportApi.close(token!),
    onSuccess: () => {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
      setToken(null);
    },
  });

  const submitPrechat = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim() || !message.trim()) {
      setFormError('Please enter your email and a message.');
      return;
    }
    if (TURNSTILE_SITE_KEY && !captcha) {
      setFormError('Please complete the verification.');
      return;
    }
    startMut.mutate();
  };

  // Broadcast the current draft to the agent, throttled (trailing) so a fast
  // typist sends at most ~2/sec. Empty string signals "stopped typing".
  const emitTyping = (text: string) => {
    if (!token) return;
    const THROTTLE = 500;
    const t = typingRef.current;
    if (t.timer) {
      clearTimeout(t.timer);
      t.timer = null;
    }
    const elapsed = Date.now() - t.last;
    const fire = () => {
      t.last = Date.now();
      void guestSupportApi.typing(token, text);
    };
    if (elapsed >= THROTTLE) fire();
    else t.timer = setTimeout(fire, THROTTLE - elapsed);
  };

  const sendChat = () => {
    const text = draft.trim();
    if (!text || sendMut.isPending) return;
    sendMut.mutate(text);
    emitTyping(''); // clear the live preview once sent
  };

  const startNew = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setToken(null);
  };

  // The authenticated app shell (/phone, /admin, /org) has the in-app support
  // tab, so suppress the bubble there. Everywhere else — landing, signup, login,
  // legal pages — the bubble shows for everyone, logged in or not. Also hidden
  // during SSR (no localStorage/pathname yet).
  const isAppRoute = /^\/(phone|admin|admin2|org)(\/|$)/.test(pathname || '');
  if (!mounted || isAppRoute) return null;

  const statusLabel = !ticket
    ? ''
    : ticket.status === 'open'
      ? 'Typically replies within a few minutes'
      : ticket.status === 'active'
        ? `Connected${ticket.assignedAdminName ? ` — ${ticket.assignedAdminName}` : ''}`
        : 'This chat has ended';

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end">
      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="mb-3 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
          >
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-gradient-to-br from-[var(--coral)] to-[var(--coral-700)] px-4 py-3 text-white">
            <FiMessageCircle className="h-5 w-5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">Support</p>
              <p className="truncate text-xs text-white/85">
                {activeSession ? statusLabel : "We're here to help"}
              </p>
            </div>
            {activeSession && (
              <button
                type="button"
                onClick={() => closeMut.mutate()}
                disabled={closeMut.isPending}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-white/90 transition hover:bg-white/15 disabled:opacity-60"
              >
                End chat
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Minimize"
              className="rounded-md p-1 transition hover:bg-white/15"
            >
              <FiChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          {!token ? (
            // Pre-chat form
            <form onSubmit={submitPrechat} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <p className="text-sm text-[var(--muted-foreground)]">
                Start a conversation — tell us how we can help and we&apos;ll reply here and by email.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--coral)]"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--coral)]"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                rows={3}
                className="resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--coral)]"
              />
              {TURNSTILE_SITE_KEY && (
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setCaptcha}
                  onExpire={() => setCaptcha('')}
                  options={{ theme: 'auto', size: 'flexible' }}
                />
              )}
              {formError && <p className="text-xs text-[var(--danger)]">{formError}</p>}
              <button
                type="submit"
                disabled={startMut.isPending}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--coral)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--coral-700)] disabled:opacity-60"
              >
                {startMut.isPending ? 'Starting…' : 'Start chat'}
              </button>
            </form>
          ) : isClosed ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                Thanks for chatting with us! You can start a new conversation any time.
              </p>
              <button
                type="button"
                onClick={startNew}
                className="rounded-lg bg-[var(--coral)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--coral-700)]"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <>
              {/* Thread */}
              <div ref={threadRef} className="flex-1 space-y-2.5 overflow-y-auto bg-[var(--muted)]/20 p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                        m.senderRole === 'user'
                          ? 'rounded-br-sm bg-[var(--coral)] text-white'
                          : 'rounded-bl-sm bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                      }`}
                    >
                      {m.attachment?.url && (
                        <a href={m.attachment.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.attachment.url}
                            alt={m.attachment.name ?? 'attachment'}
                            className="max-h-48 max-w-full rounded-lg object-contain"
                          />
                        </a>
                      )}
                      {m.body && <span className={m.attachment ? 'mt-1.5 block' : undefined}>{m.body}</span>}
                    </div>
                  </div>
                ))}
                {ticket?.status === 'open' && (
                  <p className="pt-1 text-center text-xs text-[var(--muted-foreground)]">
                    Connecting you to our team…
                  </p>
                )}
              </div>
              {/* Composer */}
              <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    emitTyping(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  rows={1}
                  placeholder="Type a message…"
                  className="max-h-24 min-h-[40px] flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--coral)]"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  disabled={!draft.trim() || sendMut.isPending}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--coral)] text-white transition hover:bg-[var(--coral-700)] disabled:opacity-60"
                  aria-label="Send"
                >
                  <FiSend className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Greeting nudge */}
      <AnimatePresence>
        {nudge && !open && (
          <motion.div
            key="nudge"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className="mb-3 flex max-w-[15rem] items-center gap-2 rounded-2xl rounded-br-md border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 shadow-xl"
          >
            <span className="text-sm text-[var(--foreground)]">👋 Hi there! Need any help?</span>
            <button
              type="button"
              onClick={() => {
                setNudge(false);
                nudgeDismissed.current = true;
              }}
              aria-label="Dismiss"
              className="shrink-0 text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble */}
      <div className="relative h-14 w-14">
        {/* Attention pulse — only while closed with no active chat. */}
        {!open && !activeSession && (
          <>
            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[var(--coral)]/30" />
            <span className="pointer-events-none absolute -inset-1.5 rounded-full bg-[var(--coral)]/20 blur-lg" />
          </>
        )}
        <motion.button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setNudge(false);
            nudgeDismissed.current = true;
          }}
          aria-label={open ? 'Close support chat' : 'Open support chat'}
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.25 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[var(--coral)] to-[var(--coral-700)] text-white shadow-lg shadow-[var(--coral)]/50"
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="x"
                initial={{ opacity: 0, rotate: -90, scale: 0.4 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.4 }}
                transition={{ duration: 0.15 }}
              >
                <FiX className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span
                key="msg"
                initial={{ opacity: 0, rotate: 90, scale: 0.4 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: -90, scale: 0.4 }}
                transition={{ duration: 0.15 }}
              >
                <FiMessageCircle className="h-6 w-6" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
