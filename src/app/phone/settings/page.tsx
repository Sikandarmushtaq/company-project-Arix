'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiUser,
  FiPhone,
  FiVolume2,
  FiMic,
  FiSpeaker,
  FiCheckCircle,
  FiAlertCircle,
  FiPlay,
  FiStopCircle,
  FiRefreshCw,
  FiWifi,
  FiWifiOff,
  FiMusic,
  FiEye,
  FiMousePointer,
  FiMoon,
  FiZap,
  FiX,
  FiPlus,
  FiTrash2,
  FiShield,
  FiChevronDown,
  FiChevronLeft,
  FiCheck,
  FiDroplet,
  FiLogOut,
} from 'react-icons/fi';
import { Button, Input, StyledSelect } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSipStore } from '@/lib/stores/sip';
import { useNotificationSettings } from '@/lib/stores/notificationSettings';
import { callAudioService, AVAILABLE_RINGTONES, type AudioSettings } from '@/lib/sip';
import { remoteAudioBoost, BOOST_MAX, type VolumeBoostSettings } from '@/lib/sip/remote-audio-boost';
import {
  useDndStatus,
  useToggleDnd,
  useSpeedDial,
  useSetSpeedDial,
  useRemoveSpeedDial,
  useContacts,
  useBlockedContacts,
  useBlockContact,
  useUnblockContact,
  useWaStatus,
} from '@/lib/hooks';
import { FaWhatsapp } from 'react-icons/fa';
import type { SpeedDialEntry } from '@/lib/api';
import { formatPhoneUS, normalizePhone } from '@/lib/utils/phone';
import { formatRelativeTime } from '@/lib/utils/datetime';
import { PageTransition } from '@/components/phone';
import { toast } from '@/lib/stores/toast';
import { ThemeSelector } from '@/components/ui';

// ─── Reusable bits ───────────────────────────────────────────

function ToggleSwitch({ enabled, onChange, disabled = false }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-[var(--primary-600)]' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[13px] font-black uppercase tracking-wide text-[var(--muted-foreground)] mb-2 px-1">{title}</h3>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--foreground)]">{value}</span>
        {icon}
      </div>
    </div>
  );
}

function SettingRow({ icon, iconBg, label, description, children }: { icon: React.ReactNode; iconBg: string; label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
          <p className="text-xs text-[var(--muted-foreground)] truncate">{description}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function DeviceSelect({ icon, label, value, options, onChange }: { icon: React.ReactNode; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] mb-2">{icon}{label}</label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full h-10 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] hover:border-[var(--primary-400)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] transition-colors"
        >
          <span className="truncate text-left">{selected?.label ?? 'System Default'}</span>
          <FiChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div role="listbox" className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg py-1">
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isSel ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 text-[var(--foreground)] dark:text-[var(--primary-300)]' : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
                  }`}
                >
                  <FiCheck className={`w-4 h-4 flex-shrink-0 text-[var(--foreground)] ${isSel ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[var(--foreground)]">{label}</span>
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${enabled ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}

// Cross-browser AudioContext.
function makeAudioContext(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AC();
}

/** Test microphone — live input-level meter (client-side Web Audio). */
function MicTest({ deviceId }: { deviceId: string }) {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const startingRef = useRef(false); // guards against overlapping starts (double-click)

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setLevel(0);
    setTesting(false);
  }, []);

  const start = useCallback(async () => {
    // Prevent overlapping sessions (rapid double-click before the async
    // getUserMedia resolves) — that would open a second mic stream and leak it.
    if (cleanupRef.current || startingRef.current) return;
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      const ctx = makeAudioContext();
      await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let raf = 0;
      let displayed = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const n = (buf[i] - 128) / 128;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / buf.length);
        // Perceptual (dB) scale: audio is logarithmic, so raw RMS barely moves
        // for normal speech. Map ~-50 dB → 0 and ~-5 dB → full.
        const db = 20 * Math.log10(rms || 1e-7);
        const target = Math.max(0, Math.min(1, (db + 50) / 45));
        // Snappy rise, smooth fall — reads lively without jitter.
        displayed = target > displayed ? target : displayed * 0.86 + target * 0.14;
        setLevel(displayed);
        raf = requestAnimationFrame(tick);
      };
      tick();
      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      };
      setTesting(true);
    } catch {
      toast.error('Could not access the microphone');
    } finally {
      startingRef.current = false;
    }
  }, [deviceId]);

  useEffect(() => () => cleanupRef.current?.(), []);

  return (
    <div className="flex items-center gap-3 mt-3">
      <button
        type="button"
        onClick={testing ? stop : start}
        className={`text-[13px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
          testing
            ? 'border-red-400 text-red-500'
            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/20'
        }`}
      >
        {testing ? 'Stop test' : 'Test microphone'}
      </button>
      <div className="flex-1 h-2.5 rounded-full bg-[var(--muted)] overflow-hidden" aria-hidden="true">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
    </div>
  );
}

/** Test speaker — plays a short tone through the selected output device. */
function SpeakerTest({ deviceId }: { deviceId: string }) {
  const [playing, setPlaying] = useState(false);
  const play = useCallback(async () => {
    if (playing) return;
    try {
      const ctx = makeAudioContext();
      await ctx.resume().catch(() => {});
      // Route to the chosen output where supported (experimental API).
      const sinkable = ctx as unknown as { setSinkId?: (id: string) => Promise<void> };
      if (deviceId && sinkable.setSinkId) {
        try {
          await sinkable.setSinkId(deviceId);
        } catch {
          /* fall back to system default */
        }
      }
      // A pleasant ascending chime (C5–E5–G5–C6 major arpeggio) rather than a
      // flat beep — triangle waves with soft bell-like envelopes.
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const step = 0.16;
      const tail = 0.32;
      notes.forEach((freq, i) => {
        const t = now + i * step;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(1, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + tail + 0.02);
      });
      const totalMs = ((notes.length - 1) * step + tail + 0.1) * 1000;
      setPlaying(true);
      window.setTimeout(() => {
        ctx.close().catch(() => {});
        setPlaying(false);
      }, totalMs);
    } catch {
      toast.error('Could not play the test sound');
    }
  }, [deviceId, playing]);

  return (
    <button
      type="button"
      onClick={play}
      disabled={playing}
      className="mt-3 text-[13px] font-bold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--primary-50)] dark:hover:bg-[var(--primary-900)]/20 transition-colors disabled:opacity-50"
    >
      {playing ? 'Playing…' : 'Test speaker'}
    </button>
  );
}

type SectionId = 'general' | 'phone' | 'audio' | 'speeddial' | 'blocked' | 'themes';
const NAV: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <FiUser className="w-[18px] h-[18px]" /> },
  { id: 'phone', label: 'Phone', icon: <FiPhone className="w-[18px] h-[18px]" /> },
  { id: 'audio', label: 'Audio', icon: <FiVolume2 className="w-[18px] h-[18px]" /> },
  { id: 'speeddial', label: 'Speed dial', icon: <FiZap className="w-[18px] h-[18px]" /> },
  { id: 'blocked', label: 'Blocked numbers', icon: <FiShield className="w-[18px] h-[18px]" /> },
  { id: 'themes', label: 'Themes', icon: <FiDroplet className="w-[18px] h-[18px]" /> },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data: waStatus } = useWaStatus();

  const handleLogout = useCallback(() => {
    logout();
    router.push('/login');
  }, [logout, router]);
  const { isModuleEnabled } = usePermissions();
  const {
    audioDevices,
    selectedAudioInput,
    selectedAudioOutput,
    refreshAudioDevices,
    setAudioInput,
    setAudioOutput,
    audioConstraints,
    setAudioConstraints,
    currentServer,
    connectionState,
    isRegistered,
  } = useSipStore();

  const { autoMarkOnView, autoMarkOnScroll, setSetting } = useNotificationSettings();

  const [activeSection, setActiveSection] = useState<SectionId>('general');
  // Mobile drill-in: below md the nav list and the content are separate screens.
  // Tapping a section opens the content full-screen; Back returns to the list.
  // On md+ both panes are always shown, so this flag is ignored there.
  const [mobileSectionOpen, setMobileSectionOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => callAudioService.getSettings());
  const [boost, setBoost] = useState<VolumeBoostSettings>(() => remoteAudioBoost.getSettings());
  const [isPlayingRingback, setIsPlayingRingback] = useState(false);
  const [previewingRingtoneId, setPreviewingRingtoneId] = useState<string | null>(null);

  // Theme UI now lives in the shared <ThemeSelector /> (SSOT — see lib/theme).

  useEffect(() => {
    refreshAudioDevices();
    callAudioService.initialize().then(() => setAudioSettings(callAudioService.getSettings()));
  }, [refreshAudioDevices]);

  const handleAudioSettingsChange = useCallback((updates: Partial<AudioSettings>) => {
    callAudioService.updateSettings(updates);
    setAudioSettings(callAudioService.getSettings());
  }, []);

  const handlePreviewRingtone = useCallback(
    (ringtoneId: string) => {
      if (previewingRingtoneId === ringtoneId) {
        callAudioService.stopPreview();
        setPreviewingRingtoneId(null);
      } else {
        callAudioService.stopAll();
        setIsPlayingRingback(false);
        callAudioService.previewRingtone(ringtoneId);
        setPreviewingRingtoneId(ringtoneId);
        setTimeout(() => {
          callAudioService.stopPreview();
          setPreviewingRingtoneId(null);
        }, 5000);
      }
    },
    [previewingRingtoneId]
  );

  const handleSelectRingtone = useCallback(
    (ringtoneId: string) => handleAudioSettingsChange({ selectedRingtone: ringtoneId }),
    [handleAudioSettingsChange]
  );

  const handleTestRingback = useCallback(() => {
    if (isPlayingRingback) {
      callAudioService.stopRingback();
      setIsPlayingRingback(false);
    } else {
      callAudioService.stopAll();
      setPreviewingRingtoneId(null);
      callAudioService.playRingback();
      setIsPlayingRingback(true);
      setTimeout(() => {
        callAudioService.stopRingback();
        setIsPlayingRingback(false);
      }, 6000);
    }
  }, [isPlayingRingback]);

  useEffect(() => () => callAudioService.stopAll(), []);

  const inputDevices = audioDevices.filter((d) => d.kind === 'audioinput');
  const outputDevices = audioDevices.filter((d) => d.kind === 'audiooutput');

  const { data: dndStatus, isLoading: dndLoading } = useDndStatus();
  const toggleDnd = useToggleDnd();

  const { data: speedDialEntries, isLoading: speedDialLoading } = useSpeedDial();
  const setSpeedDial = useSetSpeedDial();
  const removeSpeedDial = useRemoveSpeedDial();
  useContacts();

  const [editingSpeedDial, setEditingSpeedDial] = useState<number | null>(null);
  const [speedDialNumber, setSpeedDialNumber] = useState('');
  const [speedDialName, setSpeedDialName] = useState('');

  const { data: blockedContacts, isLoading: blockedLoading } = useBlockedContacts();
  const blockContact = useBlockContact();
  const unblockContact = useUnblockContact();
  const [blockNumberInput, setBlockNumberInput] = useState('');

  const handleBlockNumber = useCallback(() => {
    const normalized = normalizePhone(blockNumberInput);
    if (!normalized) return;
    blockContact.mutate(normalized, {
      onSuccess: () => {
        toast.success('Number blocked');
        setBlockNumberInput('');
      },
      onError: () => toast.error('Failed to block number'),
    });
  }, [blockContact, blockNumberInput]);

  const handleToggleDnd = useCallback(async () => {
    if (dndStatus) await toggleDnd.mutateAsync(!dndStatus.enabled);
  }, [dndStatus, toggleDnd]);

  const handleSetSpeedDial = useCallback(
    async (position: number) => {
      if (!speedDialNumber.trim()) return;
      await setSpeedDial.mutateAsync({ position, phoneNumber: speedDialNumber.trim(), name: speedDialName.trim() || undefined });
      setEditingSpeedDial(null);
      setSpeedDialNumber('');
      setSpeedDialName('');
    },
    [setSpeedDial, speedDialNumber, speedDialName]
  );

  const handleRemoveSpeedDial = useCallback(async (position: number) => removeSpeedDial.mutateAsync(position), [removeSpeedDial]);

  const handleEditSpeedDial = useCallback((position: number, entry?: SpeedDialEntry) => {
    setEditingSpeedDial(position);
    setSpeedDialNumber(entry?.phoneNumber || '');
    setSpeedDialName(entry?.name || '');
  }, []);

  const handleCancelSpeedDialEdit = useCallback(() => {
    setEditingSpeedDial(null);
    setSpeedDialNumber('');
    setSpeedDialName('');
  }, []);

  const getSpeedDialEntry = useCallback(
    (position: number) => speedDialEntries?.find((e) => e.position === position),
    [speedDialEntries]
  );

  return (
    <PageTransition className="absolute inset-0 overflow-hidden p-4 md:p-6">
      <div className="flex h-full min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {/* ===== SUB-NAV ===== */}
        <nav className={`w-full md:w-[280px] md:shrink-0 ${mobileSectionOpen ? 'hidden md:flex' : 'flex'} flex-col min-h-0 md:border-r border-[var(--border)]`}>
          <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5">
            <h1 className="text-[21px] font-black text-[var(--foreground)]">Settings</h1>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                isRegistered
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : connectionState === 'connecting'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              }`}
            >
              {isRegistered ? <FiWifi className="w-3 h-3" /> : <FiWifiOff className="w-3 h-3" />}
              {isRegistered ? 'Connected' : connectionState === 'connecting' ? 'Connecting…' : 'Offline'}
            </div>
          </div>
          <div className="flex-1 overflow-auto px-2 pb-3">
            {NAV.map((n) => {
              const on = activeSection === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { setActiveSection(n.id); setMobileSectionOpen(true); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-colors ${
                    on ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 text-[var(--foreground)]' : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
                  }`}
                >
                  {n.icon}
                  {n.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ===== CONTENT ===== */}
        <div className={`${mobileSectionOpen ? 'flex' : 'hidden md:flex'} flex-1 min-h-0 flex-col bg-[var(--background)]`}>
          <div className="flex items-center gap-2 px-5 md:px-8 pt-4 md:pt-5 pb-2">
            <button
              type="button"
              onClick={() => setMobileSectionOpen(false)}
              aria-label="Back to settings"
              className="md:hidden grid place-items-center w-9 h-9 -ml-1.5 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-[22px] font-black text-[var(--foreground)]">
              {NAV.find((n) => n.id === activeSection)?.label}
            </h2>
          </div>
          <div className="flex-1 overflow-auto px-8 pb-10 max-w-3xl">
            {/* ─── GENERAL ─── */}
            {activeSection === 'general' && (
              <>
                <Section title="Profile">
                  <InfoRow label="Name" value={user?.fullName || 'Not set'} />
                  <InfoRow label="Email" value={user?.email || 'Not set'} />
                  <InfoRow label="Role" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'} />
                  <InfoRow label="Caller ID" value={user?.senderPhone ? formatPhoneUS(user.senderPhone) : 'No number assigned'} />
                  <InfoRow
                    label="Phone"
                    value={user?.sipUsername ? 'Active' : 'Not configured'}
                    icon={<FiCheckCircle className={`w-4 h-4 ${user?.sipUsername ? 'text-green-500' : 'text-gray-400'}`} />}
                  />
                  {waStatus?.assignedNumber && (
                    <InfoRow label="WhatsApp Number" value={formatPhoneUS(waStatus.assignedNumber.displayPhone)} icon={<FaWhatsapp className="w-4 h-4 text-green-500" />} />
                  )}
                </Section>

                <Section title="Connection">
                  <InfoRow
                    label="Status"
                    value={isRegistered ? 'Registered' : connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}
                    icon={isRegistered ? <FiCheckCircle className="w-4 h-4 text-green-500" /> : <FiAlertCircle className="w-4 h-4 text-yellow-500" />}
                  />
                  {currentServer && (
                    <InfoRow
                      label="Health"
                      value={currentServer.isHealthy ? 'Healthy' : 'Unhealthy'}
                      icon={currentServer.isHealthy ? <FiCheckCircle className="w-4 h-4 text-green-500" /> : <FiAlertCircle className="w-4 h-4 text-red-500" />}
                    />
                  )}
                </Section>

                <Section title="Features">
                  <FeatureBadge label="SMS Messaging" enabled={(user?.smsEnabled ?? false) && isModuleEnabled('sms')} />
                  <FeatureBadge label="Standard SMS" enabled={(user?.smsType === 'standard' || user?.smsType === 'both') && isModuleEnabled('sms')} />
                  {/* Auto SMS is an ORG-level capability (needs the `sms` + `auto_sms`
                      tenant modules). It is NOT per-user `smsType` — that only selects
                      the sending gateway. Mirror the exact gate the Bulk SMS page uses. */}
                  <FeatureBadge label="Auto SMS Campaign" enabled={isModuleEnabled('sms') && isModuleEnabled('auto_sms')} />
                  <FeatureBadge label="WhatsApp" enabled={(waStatus?.waEnabled ?? false) && isModuleEnabled('whatsapp')} />
                  <FeatureBadge label="Auto-Dialer" enabled={(user?.autoDialerEnabled ?? false) && isModuleEnabled('autodialer')} />
                </Section>

                <Section title="Account">
                  <SettingRow
                    icon={<FiLogOut className="w-4 h-4 text-red-600 dark:text-red-400" />}
                    iconBg="bg-red-100 dark:bg-red-900/30"
                    label="Log out"
                    description="Sign out of your account on this device"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Log out
                    </Button>
                  </SettingRow>
                </Section>
              </>
            )}

            {/* ─── PHONE ─── */}
            {activeSection === 'phone' && (
              <Section title="Call preferences">
                <div className="space-y-5">
                  {dndLoading ? (
                    <div className="flex items-center justify-center py-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--border)] border-t-transparent" />
                    </div>
                  ) : (
                    <SettingRow
                      icon={<FiMoon className={`w-4 h-4 ${dndStatus?.enabled ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`} />}
                      iconBg={dndStatus?.enabled ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}
                      label="Do Not Disturb"
                      description={dndStatus?.enabled ? 'All incoming calls are blocked' : 'Calls will ring normally'}
                    >
                      <ToggleSwitch enabled={dndStatus?.enabled ?? false} onChange={handleToggleDnd} disabled={toggleDnd.isPending} />
                    </SettingRow>
                  )}
                  <div className="border-t border-[var(--border)]" />
                  <SettingRow icon={<FiEye className="w-4 h-4 text-blue-600 dark:text-blue-400" />} iconBg="bg-blue-100 dark:bg-blue-900/30" label="Mark Read on View" description="Mark all as read when opening History">
                    <ToggleSwitch enabled={autoMarkOnView} onChange={() => setSetting('autoMarkOnView', !autoMarkOnView)} />
                  </SettingRow>
                  <SettingRow icon={<FiMousePointer className="w-4 h-4 text-purple-600 dark:text-purple-400" />} iconBg="bg-purple-100 dark:bg-purple-900/30" label="Mark Read on Scroll" description="Mark as read when scrolling into view">
                    <ToggleSwitch enabled={autoMarkOnScroll} onChange={() => setSetting('autoMarkOnScroll', !autoMarkOnScroll)} />
                  </SettingRow>
                </div>
              </Section>
            )}

            {/* ─── AUDIO ─── */}
            {activeSection === 'audio' && (
              <>
                <Section title="Devices">
                  <div className="flex items-center justify-end -mt-1 mb-2">
                    <button onClick={() => refreshAudioDevices()} className="text-[13px] font-bold text-[var(--foreground)] flex items-center gap-1">
                      <FiRefreshCw className="w-4 h-4" /> Refresh
                    </button>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <DeviceSelect
                        icon={<FiMic className="w-4 h-4 text-[var(--muted-foreground)]" />}
                        label="Microphone"
                        value={selectedAudioInput || ''}
                        options={[{ value: '', label: 'System Default' }, ...inputDevices.map((d) => ({ value: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }))]}
                        onChange={setAudioInput}
                      />
                      <MicTest deviceId={selectedAudioInput || ''} />
                    </div>
                    <div>
                      <DeviceSelect
                        icon={<FiSpeaker className="w-4 h-4 text-[var(--muted-foreground)]" />}
                        label="Speaker"
                        value={selectedAudioOutput || ''}
                        options={[{ value: '', label: 'System Default' }, ...outputDevices.map((d) => ({ value: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 8)}` }))]}
                        onChange={setAudioOutput}
                      />
                      <SpeakerTest deviceId={selectedAudioOutput || ''} />
                    </div>

                    {/* Mic processing — applies to live calls + persists.
                        Noise-suppression controls are intentionally NOT exposed
                        to clients: noise suppression is handled carrier-side by
                        Krisp on Telnyx (both directions), so a client-facing NS
                        toggle would be redundant and confusing. The browser mic-NS
                        default (OFF) lives in DEFAULT_AUDIO_CONSTRAINTS, and the
                        GTCRN engine (remoteAudioBoost) is retained in code as a
                        fallback — just no longer surfaced in the UI. Only mic
                        auto-gain (level control, not noise removal) stays. */}
                    <div className="border-t border-[var(--border)] pt-4 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)]">Automatically adjust my mic level</p>
                          <p className="text-xs text-[var(--muted-foreground)]">Auto-gain keeps your voice at a steady volume on calls</p>
                        </div>
                        <ToggleSwitch
                          enabled={audioConstraints.autoGainControl}
                          onChange={() => setAudioConstraints({ autoGainControl: !audioConstraints.autoGainControl })}
                        />
                      </div>
                    </div>
                  </div>
                </Section>

                <Section title="Call Volume Boost">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                        <FiVolume2 className="w-4 h-4 text-[var(--foreground)]" /> Boost call volume
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        Amplify the other person&apos;s voice above the normal 100% limit — useful for quiet callers or noisy surroundings.
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={boost.enabled}
                      onChange={() => {
                        remoteAudioBoost.setEnabled(!boost.enabled);
                        setBoost(remoteAudioBoost.getSettings());
                      }}
                    />
                  </div>
                  <div className={`mt-4 ${!boost.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-[var(--foreground)]">Boost level</label>
                      <span className="text-sm tabular-nums text-[var(--muted-foreground)]">{Math.round(boost.gain * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={Math.round(BOOST_MAX * 100)}
                      step={10}
                      value={Math.round(boost.gain * 100)}
                      onChange={(e) => {
                        remoteAudioBoost.setGain(parseInt(e.target.value, 10) / 100);
                        setBoost(remoteAudioBoost.getSettings());
                      }}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--primary-600)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
                      <span>100%</span>
                      <span>{Math.round(BOOST_MAX * 100)}%</span>
                    </div>
                    {boost.gain >= 3 && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                        High boost can distort loud callers — lower it if the audio sounds harsh.
                      </p>
                    )}
                  </div>
                </Section>

                <Section title="Sounds">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                      <FiMusic className="w-4 h-4 text-[var(--foreground)]" /> All sounds
                    </div>
                    <ToggleSwitch enabled={audioSettings.enabled} onChange={() => handleAudioSettingsChange({ enabled: !audioSettings.enabled })} />
                  </div>
                  <div className={`space-y-5 ${!audioSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[var(--foreground)]">Volume</label>
                        <span className="text-sm tabular-nums text-[var(--muted-foreground)]">{Math.round(audioSettings.volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(audioSettings.volume * 100)}
                        onChange={(e) => handleAudioSettingsChange({ volume: parseInt(e.target.value) / 100 })}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--primary-600)]"
                      />
                    </div>
                    <div className="border-t border-[var(--border)]" />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--foreground)]">Incoming Ringtone</p>
                        <ToggleSwitch enabled={audioSettings.ringtoneEnabled} onChange={() => handleAudioSettingsChange({ ringtoneEnabled: !audioSettings.ringtoneEnabled })} />
                      </div>
                      {audioSettings.ringtoneEnabled && (
                        <div className="flex items-center gap-2">
                          <StyledSelect value={audioSettings.selectedRingtone} onChange={(v) => handleSelectRingtone(v)} className="flex-1">
                            {AVAILABLE_RINGTONES.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </StyledSelect>
                          <button
                            onClick={() => handlePreviewRingtone(audioSettings.selectedRingtone)}
                            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${previewingRingtoneId === audioSettings.selectedRingtone ? 'bg-red-500 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                            aria-label={previewingRingtoneId === audioSettings.selectedRingtone ? 'Stop preview' : 'Preview ringtone'}
                          >
                            {previewingRingtoneId === audioSettings.selectedRingtone ? <FiStopCircle className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-[var(--border)]" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleTestRingback}
                          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isPlayingRingback ? 'bg-red-500 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                          aria-label={isPlayingRingback ? 'Stop ringback' : 'Preview ringback'}
                        >
                          {isPlayingRingback ? <FiStopCircle className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                        </button>
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">Outgoing Ringback</p>
                          <p className="text-xs text-[var(--muted-foreground)]">Sound while waiting for answer</p>
                        </div>
                      </div>
                      <ToggleSwitch enabled={audioSettings.ringbackEnabled} onChange={() => handleAudioSettingsChange({ ringbackEnabled: !audioSettings.ringbackEnabled })} />
                    </div>
                  </div>
                </Section>
              </>
            )}

            {/* ─── SPEED DIAL ─── */}
            {activeSection === 'speeddial' && (
              <Section title="Speed dial">
                <p className="text-xs text-[var(--muted-foreground)] -mt-1 mb-3">Long-press 1–9 on the dialpad</p>
                {speedDialLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--border)] border-t-transparent" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) => {
                      const entry = getSpeedDialEntry(position);
                      const isEditing = editingSpeedDial === position;
                      return (
                        <div key={position} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex-shrink-0 flex items-center justify-center text-sm font-semibold text-[var(--foreground)]">{position}</div>
                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-2">
                              <Input placeholder="Phone number" value={speedDialNumber} onChange={(e) => setSpeedDialNumber(e.target.value)} className="flex-1 h-8 text-sm" />
                              <Input placeholder="Name (optional)" value={speedDialName} onChange={(e) => setSpeedDialName(e.target.value)} className="flex-1 h-8 text-sm" />
                              <Button variant="ghost" size="icon-sm" onClick={() => handleSetSpeedDial(position)} disabled={setSpeedDial.isPending || !speedDialNumber.trim()}>
                                <FiCheckCircle className="w-4 h-4 text-green-500" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={handleCancelSpeedDialEdit}>
                                <FiX className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : entry ? (
                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[var(--foreground)] truncate">{entry.name || entry.phoneNumber}</p>
                                {entry.name && <p className="text-xs text-[var(--muted-foreground)] truncate">{entry.phoneNumber}</p>}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon-sm" onClick={() => handleEditSpeedDial(position, entry)}>
                                  <FiPhone className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveSpeedDial(position)} disabled={removeSpeedDial.isPending}>
                                  <FiTrash2 className="w-3 h-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="flex-1 justify-start text-[var(--muted-foreground)]" onClick={() => handleEditSpeedDial(position)}>
                              <FiPlus className="w-3 h-3 mr-1" /> Add speed dial
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            )}

            {/* ─── BLOCKED ─── */}
            {activeSection === 'blocked' && (
              <Section title={`Blocked numbers${blockedContacts && blockedContacts.length > 0 ? ` (${blockedContacts.length})` : ''}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    placeholder="Phone number to block"
                    value={blockNumberInput}
                    onChange={(e) => setBlockNumberInput(e.target.value)}
                    className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBlockNumber(); }}
                  />
                  <Button size="sm" onClick={handleBlockNumber} disabled={blockContact.isPending || !blockNumberInput.trim()}>Block</Button>
                </div>
                {blockedLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--border)] border-t-transparent" />
                  </div>
                ) : blockedContacts && blockedContacts.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {blockedContacts.map((blocked) => (
                      <div key={blocked.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--muted)]">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">{formatPhoneUS(blocked.phoneNumber)}</p>
                          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                            {blocked.name && <span>{blocked.name}</span>}
                            <span>{formatRelativeTime(blocked.blockedAt)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unblockContact.mutate(blocked.id, { onSuccess: () => toast.success('Number unblocked'), onError: () => toast.error('Failed to unblock number') })}
                          disabled={unblockContact.isPending}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)] text-center py-4">No blocked numbers</p>
                )}
              </Section>
            )}

            {/* ─── THEMES ─── */}
            {activeSection === 'themes' && (
              <Section title="Color theme">
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                  Choose a light or dark theme, or follow your system setting.
                </p>
                <ThemeSelector />
              </Section>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
