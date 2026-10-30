'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import {
  FiCheck,
  FiMessageSquare,
  FiMic,
  FiMoreHorizontal,
  FiPhoneCall,
  FiPhoneIncoming,
  FiPlay,
  FiSend,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

type Channel = 'sip' | 'whatsapp' | 'sms' | 'ai' | 'recording';

const tabs: {
  id: Channel;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  accent: string;
  text: string;
}[] = [
  {
    id: 'sip',
    label: 'Voice Calls',
    icon: FiPhoneCall,
    accent: 'from-[var(--primary-600)] to-[var(--primary-700)]',
    text: 'text-[var(--foreground)]',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: FaWhatsapp,
    accent: 'from-[#25D366] to-[#128c7e]',
    text: 'text-[#128c7e] dark:text-[#25D366]',
  },
  {
    id: 'sms',
    label: 'Bulk SMS',
    icon: FiMessageSquare,
    accent: 'from-amber-500 to-amber-600',
    text: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'ai',
    label: 'AI Agent',
    icon: HiSparkles,
    accent: 'from-[#8b5cf6] to-[#6d28d9]',
    text: 'text-[#7c3aed] dark:text-[#a78bfa]',
  },
  {
    id: 'recording',
    label: 'Recording',
    icon: FiMic,
    accent: 'from-[var(--accent-500)] to-[var(--accent-600)]',
    text: 'text-[var(--accent-600)]',
  },
];

function SipMockup() {
  const dialPad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[var(--primary-600)]/8 via-[var(--primary-600)]/4 to-transparent p-5 ring-1 ring-[var(--primary-600)]/20">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-700)] text-white shadow-lg">
            <FiPhoneCall size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">Active call</p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-300">
              +1 (212) 555-0119 · New York
            </p>
          </div>
          <span className="rounded-full bg-[var(--primary-600)]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]">
            HD
          </span>
        </div>
        <div className="mt-4 flex h-14 items-end gap-[3px]">
          <style>
            {`@keyframes nx-wave-sip {
              0%   { transform: scaleY(0.55); }
              22%  { transform: scaleY(1); }
              44%  { transform: scaleY(0.7); }
              66%  { transform: scaleY(0.92); }
              88%  { transform: scaleY(0.6); }
              100% { transform: scaleY(0.85); }
            }`}
          </style>
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              className="block w-[3px] flex-1 rounded-full bg-gradient-to-t from-[var(--primary-700)] to-[var(--primary-500)]"
              style={{
                height: '100%',
                transformOrigin: 'bottom',
                animation: `nx-wave-sip ${(0.9 + (i % 5) * 0.12).toFixed(2)}s ease-in-out ${(i * 0.04).toFixed(2)}s infinite alternate`,
                willChange: 'transform',
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <span className="font-mono">02:14 · recording</span>
          <span className="font-semibold">HD audio</span>
        </div>
      </div>
      <div className="rounded-2xl bg-[#f7f5f3]/80 p-4 dark:bg-white/5">
        <div className="grid grid-cols-3 gap-2">
          {dialPad.map((d) => (
            <button
              key={d}
              type="button"
              className="flex h-12 items-center justify-center rounded-xl bg-white text-base font-bold text-slate-900 shadow-sm transition hover:bg-[var(--primary-600)]/10 hover:text-[var(--foreground)] dark:bg-white/10 dark:text-white"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WhatsAppMockup() {
  const messages = [
    { who: 'them', text: 'Hi! I got your demo email — interesting. We use Twilio Flex right now.' },
    { who: 'me', text: 'Awesome. Want to hop on a quick WhatsApp call to walk through it?' },
    { who: 'them', text: "Yeah let's do it." },
    { who: 'me', text: 'Calling now.' },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[#25D366]/10 via-[#128c7e]/8 to-transparent p-5 ring-1 ring-[#25D366]/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-[#25D366]/40" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128c7e] text-white shadow-lg shadow-[#25D366]/40">
              <FiPhoneIncoming size={20} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              WhatsApp call · incoming
            </p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-300">
              Sarah · Brightline
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#128c7e] dark:text-[#25D366]">
            <FaWhatsapp size={10} /> WA
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white shadow-md"
          >
            Decline
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white shadow-md"
          >
            Accept
          </button>
        </div>
      </div>
      <div className="flex flex-col rounded-2xl bg-[#f7f5f3]/80 p-4 dark:bg-white/5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Conversation
        </p>
        <div className="flex flex-1 flex-col justify-end gap-1.5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-snug ${
                m.who === 'me'
                  ? 'ml-auto bg-[#25D366] text-white'
                  : 'mr-auto bg-white text-slate-800 shadow-sm dark:bg-white/10 dark:text-slate-100'
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 dark:bg-white/10">
          <input
            placeholder="Reply…"
            className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
          <FiSend size={14} className="text-[#25D366]" />
        </div>
      </div>
    </div>
  );
}

function AIMockup() {
  const turns = [
    { who: 'agent', t: 'Hi Sarah, this is Nova from ArixCall. Got a minute?' },
    { who: 'lead', t: 'Sure, what is it about?' },
    { who: 'agent', t: 'Are you currently recording WhatsApp calls?' },
    { who: 'lead', t: "We don't — that's a gap." },
    { who: 'agent', t: 'Got it. Let me hand you to a specialist.' },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[#8b5cf6]/12 via-[#6d28d9]/8 to-transparent p-4 ring-1 ring-[#8b5cf6]/30">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white shadow-lg shadow-[#8b5cf6]/40">
            <HiSparkles size={16} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Nova</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">AI agent · always-on</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Campaign</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Q2 Outreach</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Concurrency</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">5</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Dialed today</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">147</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Qualified</span>
            <span className="font-mono font-semibold text-emerald-600">23</span>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-600">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live · qualifying
        </div>
      </div>
      <div className="flex max-h-[260px] flex-col overflow-hidden rounded-2xl bg-[#f7f5f3]/80 p-4 dark:bg-white/5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Live transcript
        </p>
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {turns.map((tr, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs leading-snug ${
                tr.who === 'agent'
                  ? 'mr-auto bg-[#8b5cf6]/15 text-slate-800 dark:text-slate-100'
                  : 'ml-auto bg-white text-slate-800 shadow-sm dark:bg-white/10 dark:text-slate-100'
              }`}
            >
              {tr.t}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecordingMockup() {
  const recordings = [
    { who: 'Sarah · Brightline', ch: 'wa', dur: '04:32', when: '2m ago' },
    { who: '+1 (212) 555-0119', ch: 'sip', dur: '08:14', when: '12m ago' },
    { who: 'Jordan · Horizon', ch: 'wa', dur: '02:01', when: '34m ago' },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[var(--accent-500)]/10 via-[var(--accent-600)]/6 to-transparent p-5 ring-1 ring-[var(--accent-500)]/30">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Now playing
          </p>
          <span className="rounded-full bg-[var(--accent-500)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-600)]">
            00:42 / 04:32
          </span>
        </div>
        <p className="mt-2 truncate text-sm font-bold text-slate-900 dark:text-white">
          Sarah · Brightline · WA call
        </p>
        <div className="mt-4 flex h-12 items-end gap-[2px]">
          {[
            40, 65, 30, 80, 55, 90, 45, 70, 60, 85, 50, 75, 35, 95, 60, 78, 42, 88, 50, 72, 38, 82,
            55, 92, 48, 70, 30, 86,
          ].map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-sm ${
                i < 6 ? 'bg-[var(--accent-600)]' : 'bg-slate-300/70 dark:bg-white/15'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-600)] px-4 py-2 text-xs font-bold text-white shadow-md"
        >
          <FiPlay size={12} /> Play recording
        </button>
      </div>
      <div className="flex flex-col rounded-2xl bg-[#f7f5f3]/80 p-4 dark:bg-white/5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Library
        </p>
        <div className="space-y-2">
          {recordings.map((r) => (
            <div
              key={r.who}
              className="flex items-center gap-3 rounded-xl bg-white p-2.5 dark:bg-white/10"
            >
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  r.ch === 'wa'
                    ? 'bg-[#25D366]/15 text-[#128c7e] dark:text-[#25D366]'
                    : 'bg-[var(--primary-600)]/15 text-[var(--foreground)]'
                }`}
              >
                {r.ch === 'wa' ? <FaWhatsapp size={14} /> : <FiPhoneCall size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{r.who}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {r.dur} · {r.when}
                </p>
              </div>
              <FiMoreHorizontal className="text-slate-400" size={14} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <FiCheck className="text-emerald-500" size={12} />
          encrypted · transcripts ready
        </div>
      </div>
    </div>
  );
}

function SmsMockup() {
  const sends = [
    { num: '+1 (415) 555-0142', status: 'ok', when: 'now' },
    { num: '+1 (212) 555-0188', status: 'ok', when: '1s ago' },
    { num: '+44 20 7946 0142', status: 'ok', when: '1s ago' },
    { num: '+1 (650) 555-0177', status: 'wait', when: '2s ago' },
    { num: '+1 (303) 555-0136', status: 'fail', when: '3s ago' },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="flex flex-col rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-600/8 to-transparent p-5 ring-1 ring-amber-500/30">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/40">
            <FiMessageSquare size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              Bulk SMS · Q2 Outreach
            </p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-300">847 / 1,000 sent</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            sending
          </span>
        </div>

        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '84.7%' }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200/60 pt-4 dark:border-white/10">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rate
            </p>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">32 / s</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active SIMs
            </p>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">8</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Delivered
            </p>
            <p className="font-mono text-lg font-bold text-emerald-600">95.2%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col rounded-2xl bg-[#f7f5f3]/80 p-4 dark:bg-white/5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Latest sends
        </p>
        <div className="space-y-1.5">
          {sends.map((s, i) => (
            <motion.div
              key={`${s.num}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex items-center gap-2 rounded-lg bg-white p-2 dark:bg-white/10"
            >
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                  s.status === 'ok'
                    ? 'bg-emerald-500'
                    : s.status === 'wait'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                }`}
              />
              <span className="truncate font-mono text-[10px] text-slate-700 dark:text-slate-200">
                {s.num}
              </span>
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
                {s.when}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

const mockup: Record<Channel, React.ReactNode> = {
  sip: <SipMockup />,
  whatsapp: <WhatsAppMockup />,
  sms: <SmsMockup />,
  ai: <AIMockup />,
  recording: <RecordingMockup />,
};

export default function ChannelSwitcher() {
  const [active, setActive] = useState<Channel>('whatsapp');
  const [autoplay, setAutoplay] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const activeTab = tabs.find((t) => t.id === active)!;

  // Auto-rotate tabs every ~5s while the section is in view and the user
  // hasn't taken control. The first user click pauses autoplay permanently
  // for that visit so we never fight their navigation.
  useEffect(() => {
    if (!autoplay) return;
    const el = sectionRef.current;
    if (!el) return;
    let inView = false;
    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    const id = window.setInterval(() => {
      if (!inView) return;
      setActive((current) => {
        const idx = tabs.findIndex((t) => t.id === current);
        return tabs[(idx + 1) % tabs.length].id;
      });
    }, 5200);
    return () => {
      observer.disconnect();
      window.clearInterval(id);
    };
  }, [autoplay]);

  const onTab = (id: Channel) => {
    setAutoplay(false);
    setActive(id);
  };

  return (
    <section ref={sectionRef} id="demo" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]"
          >
            Try it · interactive demo
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
          >
            Click a channel.{' '}
            <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--accent-600)] bg-clip-text text-transparent">
              Watch the dialer
            </span>{' '}
            morph.
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-12"
        >
          {/* Tab strip */}
          <div className="mx-auto mb-6 flex w-fit flex-wrap items-center justify-center gap-1.5 rounded-full border border-slate-200/80 bg-white/60 p-1.5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTab(t.id)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                    isActive ? 'text-white' : `${t.text} hover:bg-[#f0ece8] dark:hover:bg-white/10`
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="channel-tab-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className={`absolute inset-0 -z-0 rounded-full bg-gradient-to-r ${t.accent} shadow-md`}
                    />
                  )}
                  <Icon size={14} />
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mockup frame */}
          <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/80 p-5 shadow-2xl shadow-black/15 backdrop-blur-xl dark:border-white/10 dark:bg-[#1e1e1e]/70 sm:p-7">
            {/* Frame header */}
            <div className="mb-5 flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <div className="flex items-center gap-2">
                <activeTab.icon size={14} />
                <span className={`text-xs font-bold uppercase tracking-widest ${activeTab.text}`}>
                  {activeTab.label} mode
                </span>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">
                live
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                {mockup[active]}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
