'use client';

/**
 * Phone Page
 *
 * Main softphone interface with dialpad, call controls, and recent calls.
 * Handles call management, recording, and transfers.
 * SIP connection is managed by SipProvider in the layout.
 *
 * @module app/phone/page
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiWifiOff } from 'react-icons/fi';
import { type Call } from '@/lib/api';
import { useSipStore, CALL_END_LOCK_MS } from '@/lib/stores/sip';
import { useAuthStore } from '@/lib/stores/auth';
import { useSipConnection } from '@/lib/providers/SipProvider';
import { useConnectionGrace } from '@/lib/hooks/useConnectionGrace';
import { useCalls, useBlockContact, useVoicemailCounts } from '@/lib/hooks';
import { toast } from '@/lib/stores/toast';
import type { DTMFTone } from '@/lib/sip/types';
import { callAudioService } from '@/lib/sip';
import { downloadRecordingBlob } from '@/lib/utils/download';
import { isOwnNumber, toE164 } from '@/lib/utils/phone';
import { DEFAULT_PHONE_REGION, type CountryCode } from '@/lib/utils/phone-format';

// Import modular phone components
import {
  ConnectionStatus,
  RecentCalls,
  CallControls,
  Dialpad,
  MultiCallStrip,
} from '@/components/phone';
import { FiSettings, FiPhone, FiVoicemail } from 'react-icons/fi';
import { TrialMinutesLeft, CallsBlockedBanner } from '@/components/phone/TrialLimitBanner';
import { CallerIdNameSetupModal } from '@/components/phone/CallerIdNameSetupModal';
import { CallsList, CallDetailPane, AddContactFlow } from '@/components/phone/chrome/CallsPanel';
import { VoicemailList, VoicemailDetailPane } from '@/components/phone/chrome/VoicemailPanel';
import {
  RecordingsList,
  RecordingDetailPane,
  RecordingsSummary,
} from '@/components/phone/chrome/RecordingsPanel';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { NotSubscribed } from '@/components/NotSubscribed';
import type { Voicemail, Recording } from '@/lib/api';

type PhoneTab = 'keypad' | 'calls' | 'voicemail' | 'recordings';
type PhoneSubTab = { id: PhoneTab; label: string; badge?: number };

// On-screen countdown for the anti-spam end-call lock. The ENFORCEMENT (and SSOT for
// the window) lives in the sip store's endCall via CALL_END_LOCK_MS; this just drives
// the visible countdown on the End button for outbound answered calls.
const END_LOCK_SECONDS = CALL_END_LOCK_MS / 1000;

export default function PhonePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const blockContact = useBlockContact();
  const { data: vmCounts } = useVoicemailCounts();
  // SSOT recordings entitlement — same check the /phone/recordings route gate
  // (ModuleGate in layout.tsx) uses. The phone-panel Recordings sub-tab lives at
  // /phone, so the route gate never covers it; gate it here with the same flag.
  const { isModuleEnabled } = usePermissions();
  const recordingsEnabled = isModuleEnabled('recordings');

  // SIP connection managed by SipProvider - get status from context
  const { isConnecting } = useSipConnection();

  const {
    isRegistered,
    registrationError,
    lines,
    activeLineId,
    incomingCall,
    isOnline,
    callStats,
    lastAutoRecording,
    makeCall,
    endCall,
    holdCall,
    unholdCall,
    switchToLine,
    muteCall,
    unmuteCall,
    sendDTMF,
    transferCall,
    startRecording,
    stopRecording,
    startAttendedTransfer,
    completeAttendedTransfer,
    cancelAttendedTransfer,
    mergeLines,
    splitConference,
    addConferenceParty,
    capabilities,
    clearLastAutoRecording,
    attendedTransferLineId,
    isCallBusy,
    isHoldBusy,
  } = useSipStore();

  // Grace-buffered registration: during a brief WSS blip (self-heals in ~1-2s)
  // keep the dialer usable instead of hard-disabling it. Only the transient
  // "reconnecting" window counts as still-usable; a real drop (grace elapsed)
  // or hard error falls back to the raw `isRegistered` (dialer disabled).
  const connUi = useConnectionGrace();
  const uiRegistered = isRegistered || connUi === 'reconnecting';

  // Get current user to prevent self-calling
  const user = useAuthStore((state) => state.user);

  const cardWrapperRef = useRef<HTMLDivElement>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  // Double-submit lock. makeCall() is async (registration probe + SIP INVITE),
  // and `isCallBusy` only flips true once the call line exists — a brief gap in
  // which extra clicks would otherwise each start ANOTHER call (the multi-call UI
  // the user saw). This synchronous ref is set before the await and checked
  // first, so rapid repeat clicks are silently dropped. No spinner: the dialer
  // transitions to the call view on its own (a spinner would wrongly read as slow).
  const placingCallRef = useRef(false);
  // Fixed dial region (the country selector was removed); toE164 still uses it.
  const [dialCountry] = useState<CountryCode>(DEFAULT_PHONE_REGION);
  const [lastDialed, setLastDialed] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [lastRecording, setLastRecording] = useState<Blob | null>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [dtmfDigits, setDtmfDigits] = useState('');
  // Phone-panel sub-tabs — all four render inline (Keypad · Calls · Voicemail · Recordings).
  const [tab, setTab] = useState<PhoneTab>('keypad');
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [selectedVoicemail, setSelectedVoicemail] = useState<Voicemail | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [addContactNumber, setAddContactNumber] = useState<string | null>(null);
  // Recent-calls right pane can be dismissed via its X. Stays dismissed until the
  // page reloads (component remount) or the user clicks "Show recent calls" — it
  // does NOT re-open on tab switches.
  const [recentsClosed, setRecentsClosed] = useState(false);

  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read phone number from URL params (for deep linking from contacts)
  useEffect(() => {
    const dialFromUrl = searchParams.get('dial');
    if (dialFromUrl) {
      // Strip all non-digit characters for clean phone number
      const cleanNumber = dialFromUrl.replace(/\D/g, '');
      setPhoneNumber(cleanNumber);
    }
  }, [searchParams]);

  // Use TanStack Query for recent calls
  const {
    data: recentCalls = [],
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchRecentCalls,
  } = useCalls(10);

  // Get active line
  const activeLine = lines.find((l) => l.id === activeLineId);
  // An unanswered inbound call is stored as the active line (activeLineId ===
  // incomingCall.lineId) but must NOT drive the in-call UI — while it's still
  // ringing, the only surface is the DialerTopBar incoming pill. Treating it as
  // "in call" here would render the full call panel (and a duplicate top-bar
  // widget) on top of the pill. Once answered, the store clears incomingCall,
  // so this guard releases and the call panel takes over normally.
  const isRingingIncoming = !!incomingCall && incomingCall.lineId === activeLineId;
  const isInCall =
    !!activeLine &&
    !isRingingIncoming &&
    ['dialing', 'ringing', 'connecting', 'established', 'holding', 'held'].includes(
      activeLine.state
    );

  // Update call duration - derives from answerTime (talk time, not ring time)
  useEffect(() => {
    const updateDuration = () => {
      // Use answerTime for duration display - this is when the call was actually connected
      // Not startTime which is when ringing began
      if (activeLine?.answerTime) {
        const elapsed = Math.floor((Date.now() - new Date(activeLine.answerTime).getTime()) / 1000);
        setCallDuration(elapsed);
      }
    };

    if (activeLine?.state === 'established' && activeLine.answerTime) {
      // Set initial duration immediately (handles remount case)
      updateDuration();
      // Then update every second
      durationIntervalRef.current = setInterval(updateDuration, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [activeLine?.state, activeLine?.answerTime]);

  // Auto-download recording when call ends during recording
  useEffect(() => {
    if (lastAutoRecording) {
      downloadRecordingBlob(lastAutoRecording.blob, 'call-recording');
      toast.success('Recording auto-downloaded');
      clearLastAutoRecording();
    }
  }, [lastAutoRecording, clearLastAutoRecording]);

  // Handlers
  const handleKeyPress = (key: string) => {
    setPhoneNumber((prev) => prev + key);
    if (isInCall && activeLineId) {
      sendDTMF(activeLineId, key as DTMFTone);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (phoneNumber.length === 0) return; // nothing typed — nothing to do

    // A call is already being placed / in progress — ignore extra clicks (this is
    // the anti-double-dial guard, not an error).
    if (isCallBusy || placingCallRef.current) return;

    // Line isn't registered — tell the user WHY nothing happens instead of a silent
    // no-op (the old behavior looked like a dead button on a flaky connection).
    if (!uiRegistered) {
      toast.error('Reconnecting to the phone service — please try again in a moment.');
      return;
    }

    // Prevent calling own number
    if (isOwnNumber(phoneNumber, user?.senderPhone, user?.phoneNumbers)) {
      toast.error('You cannot call your own number');
      return;
    }

    placingCallRef.current = true;
    // Safety watchdog: guarantee the lock releases even if makeCall never settles
    // (e.g. a dead transport). Without this a single hung attempt would silently
    // block every later press until a page refresh — the reported bug.
    const watchdog = setTimeout(() => {
      placingCallRef.current = false;
    }, 25000);
    try {
      // Dial the E.164 for the selected country; pass feature/short codes (*67)
      // through untouched.
      const dialTarget = /[*#]/.test(phoneNumber)
        ? phoneNumber
        : toE164(phoneNumber, dialCountry) || phoneNumber;
      await makeCall(dialTarget);
      setLastDialed(phoneNumber);
      setPhoneNumber('');
    } catch (error) {
      console.error('Failed to make call:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to make call. Please try again.'
      );
    } finally {
      // Release the lock once makeCall settles — by now the line exists so
      // `isCallBusy` keeps the button disabled through the rest of the call.
      clearTimeout(watchdog);
      placingCallRef.current = false;
    }
  };

  const handleHangUp = async () => {
    if (activeLineId && !isCallBusy) {
      // Enforcement of the anti-spam end-call lock lives in the sip store's endCall
      // (the single chokepoint for every End button); here we just drive the
      // on-screen countdown via endLockRemaining below.
      await endCall(activeLineId);
      setDtmfDigits('');
      setShowKeypad(false);
    }
  };

  const handleMuteToggle = () => {
    if (!activeLineId) return;
    if (activeLine?.isMuted) {
      unmuteCall(activeLineId);
    } else {
      muteCall(activeLineId);
    }
  };

  const handleHoldToggle = async () => {
    if (!activeLineId) return;
    if (activeLine?.isHeld) {
      // If there are multiple calls, use switchToLine which atomically holds the other
      // and unholds this one. Otherwise, just unhold.
      const otherActive = lines.find(
        (l) => l.id !== activeLineId && l.state === 'established' && !l.isHeld
      );
      if (otherActive) {
        await switchToLine(activeLineId);
      } else {
        await unholdCall(activeLineId);
      }
    } else {
      await holdCall(activeLineId);
    }
  };

  const handleCallFromHistory = (call: Call) => {
    const number = call.direction === 'inbound' ? call.caller : call.callee;
    setPhoneNumber(number.replace(/\D/g, ''));
  };

  const handleRecordToggle = async () => {
    if (!activeLineId) return;
    try {
      if (activeLine?.isRecording) {
        const recording = await stopRecording(activeLineId);
        // Clear auto-recording since user manually stopped
        clearLastAutoRecording();
        if (recording) {
          setLastRecording(recording);
          toast.success('Recording saved');
        }
      } else {
        await startRecording(activeLineId);
        toast.info('Recording started (will auto-download if call ends)');
      }
    } catch (error) {
      console.error('Recording error:', error);
      toast.error(error instanceof Error ? error.message : 'Recording operation failed');
    }
  };

  const handleDownloadRecording = () => {
    if (!lastRecording) return;
    try {
      downloadRecordingBlob(lastRecording, 'manual-recording');
      setLastRecording(null);
      toast.success('Recording downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download recording');
    }
  };

  const handleTransfer = async (number: string, mode: 'blind' | 'attended') => {
    if (!activeLineId) return;
    if (isOwnNumber(number, user?.senderPhone, user?.phoneNumbers)) {
      toast.error('You cannot transfer to your own number');
      return;
    }
    if (mode === 'blind') {
      await transferCall(activeLineId, number);
    } else {
      await startAttendedTransfer(activeLineId, number);
    }
  };

  const handleCompleteAttendedTransfer = async () => {
    if (!attendedTransferLineId) return;
    try {
      await completeAttendedTransfer(attendedTransferLineId);
      toast.success('Transfer completed successfully');
    } catch (error) {
      console.error('Complete transfer failed:', error);
      toast.error('Failed to complete transfer');
    }
  };

  const handleCancelAttendedTransfer = async () => {
    if (!attendedTransferLineId) return;
    try {
      await cancelAttendedTransfer(attendedTransferLineId);
      toast.info('Transfer cancelled');
    } catch (error) {
      console.error('Cancel transfer failed:', error);
      toast.error('Failed to cancel transfer');
    }
  };

  const handleMergeLines = async () => {
    const activeLines = lines.filter(
      (l) => l.state === 'established' || l.state === 'held' || l.state === 'holding'
    );
    if (activeLines.length >= 2) {
      try {
        await mergeLines(activeLines[0].id, activeLines[1].id);
        toast.success('Calls merged into conference');
      } catch (error) {
        console.error('Merge failed:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to merge calls');
      }
    }
  };

  const handleSplitConference = () => {
    if (activeLineId) {
      splitConference(activeLineId);
    }
  };

  const handleAddCall = async (number: string) => {
    if (!activeLineId) return;
    if (isOwnNumber(number, user?.senderPhone, user?.phoneNumbers)) {
      toast.error('You cannot call your own number');
      return;
    }
    try {
      if (capabilities.instantConference) {
        // Instant-conference engine (LiveKit): dial the party straight into the
        // current room — the SFU mixes it in. No hold, no second line, no merge.
        await addConferenceParty(number);
        toast.info('Adding party to the call...');
      } else {
        // SIP model: hold the current call, place a second line, then the user
        // merges the two into a conference.
        await holdCall(activeLineId);
        await makeCall(number);
        toast.info('First call on hold. Dialing second call...');
      }
    } catch (error) {
      console.error('Add call failed:', error);
      throw error;
    }
  };

  const handleKeypadToggle = () => {
    setShowKeypad((prev) => {
      if (prev) setDtmfDigits(''); // Clear digits when closing keypad
      return !prev;
    });
  };

  const handleDTMF = (key: string) => {
    if (activeLineId) {
      callAudioService.playDTMF(key);
      sendDTMF(activeLineId, key as DTMFTone);
      setDtmfDigits((prev) => prev + key);
    }
  };

  const handleSpeedDial = async (speedDialNumber: string) => {
    if (!uiRegistered) return;

    // Prevent calling own number
    if (isOwnNumber(speedDialNumber, user?.senderPhone, user?.phoneNumbers)) {
      toast.error('You cannot call your own number');
      return;
    }

    try {
      await makeCall(speedDialNumber);
      toast.info('Speed dialing...');
    } catch (error) {
      console.error('Speed dial failed:', error);
      toast.error(error instanceof Error ? error.message : 'Speed dial failed. Please try again.');
    }
  };

  // --- Calls tab (Phase 3) detail actions — reuse existing SIP/block logic ---
  const handleDetailCall = async (c: Call) => {
    const num = c.direction === 'inbound' ? c.caller : c.callee;
    if (isOwnNumber(num, user?.senderPhone, user?.phoneNumbers)) {
      toast.error('You cannot call your own number');
      return;
    }
    try {
      await makeCall(num);
      setTab('keypad');
    } catch {
      toast.error('Failed to make call');
    }
  };
  const handleDetailMessage = (c: Call) => {
    const num = c.direction === 'inbound' ? c.caller : c.callee;
    router.push(`/phone/messages?phone=${encodeURIComponent(num)}`);
  };
  const handleBlockNumber = (num: string) => {
    blockContact.mutate(num, {
      onSuccess: () => toast.success('Number blocked'),
      onError: () => toast.error('Failed to block number'),
    });
  };
  // Number-based variants for the Voicemail / Recordings detail panes.
  const callNumber = async (num: string) => {
    if (isOwnNumber(num, user?.senderPhone, user?.phoneNumbers)) {
      toast.error('You cannot call your own number');
      return;
    }
    try {
      await makeCall(num);
      setTab('keypad');
    } catch {
      toast.error('Failed to make call');
    }
  };
  const messageNumber = (num: string) => {
    router.push(`/phone/messages?phone=${encodeURIComponent(num)}`);
  };

  // Robot call state
  const robotCallState: 'idle' | 'dialing' | 'connected' | 'hold' | 'error' | 'ended' = !isInCall
    ? 'idle'
    : activeLine?.state === 'established'
      ? 'connected'
      : activeLine?.state === 'holding' || activeLine?.state === 'held'
        ? 'hold'
        : activeLine?.state === 'error'
          ? 'error'
          : activeLine?.state === 'ended'
            ? 'ended'
            : 'dialing';

  // Expose phone state for the global robot (in layout)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__phoneDigitCount = phoneNumber.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__phoneCardRef = cardWrapperRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__phoneCallState = robotCallState;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__phoneDigitCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__phoneCardRef = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__phoneCallState = 'idle';
    };
  }, [phoneNumber.length, robotCallState]);

  // The four phone sub-tabs. They all fit within the 364px panel, so they render
  // inline with no ▾ overflow (Notes was dropped 2026-08-04; with it gone there's
  // no longer anything to overflow).
  const TABS: PhoneSubTab[] = [
    { id: 'keypad', label: 'Keypad' },
    { id: 'calls', label: 'Calls' },
    { id: 'voicemail', label: 'Voicemail', badge: vmCounts?.unread || undefined },
    // Recordings tab always shown (upsell) — gated content behind <NotSubscribed>
    // when the tenant's 'recordings' module is off (SSOT: isModuleEnabled).
    { id: 'recordings', label: 'Recordings' },
  ];

  return (
    // Edge-to-edge: <main> is `relative`, so `absolute inset-0` fills its whole
    // box (ignoring padding) — the phone panel sits flush against the rail
    // (RingCentral layout), with no bottom gap. Panel (left) + main area (right).
    <div className="absolute inset-0 flex min-h-0">
      {/* First-run: prompt the owner/manager to set their caller-ID name (CNAM)
          before the first call, if the active number has none yet. */}
      <CallerIdNameSetupModal />
      {/* Incoming call now surfaces as a compact pill in the DialerTopBar
          (see DialerTopBar), replacing the old full-screen overlay. */}

      {/* ===== PHONE PANEL (left) ===== */}
      <section
        ref={cardWrapperRef}
        className="w-full md:w-[320px] md:shrink-0 flex flex-col min-h-0 bg-[var(--card)] md:border-r border-[var(--border)]"
      >
        {/* Header — "Phone" + settings */}
        <div className="flex items-center justify-between px-5 pt-3.5 pb-1.5">
          <h1 className="text-[21px] font-black text-[var(--foreground)]">Phone</h1>
          <div className="flex items-center gap-0.5">
            <Link
              href="/phone/settings"
              title="Settings"
              aria-label="Phone settings"
              className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <FiSettings className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </div>

        {/* Sub-tabs — all four fit inline, so no ▾ overflow is needed. */}
        <div className="flex items-center gap-5 px-5 border-b border-[var(--border)]">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${
                  on
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {t.label}
                {t.badge ? <span className="ml-1 text-[var(--foreground)]">({t.badge})</span> : null}
                {on && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2.5px] rounded bg-[var(--coral)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Offline strip */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-xs font-medium overflow-hidden"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <FiWifiOff className="w-4 h-4 shrink-0" />
              You are offline — calls resume when you&apos;re back online.
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Keypad tab ---- */}
        {tab === 'keypad' && (
          <div className="flex-1 flex flex-col min-h-0 px-5 pt-3 pb-4">
            {/* Connection indicator — hidden during a call (RC keeps the in-call
                panel sleek). The country selector was removed per request. */}
            {!isInCall && (
              <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                {/* KYC trial: remaining call minutes today (capped orgs only —
                    renders nothing otherwise, keeping Ready pinned right). */}
                <div className="flex items-center min-w-0">
                  <TrialMinutesLeft />
                </div>
                <ConnectionStatus
                  isConnecting={isConnecting}
                  isRegistered={isRegistered}
                  registrationError={registrationError}
                />
              </div>
            )}

            {/* Hidden call soft-cap: neutral "calling unavailable — contact admin"
                header. Renders only when the org is blocked; never shows a limit. */}
            <CallsBlockedBanner className="mb-2" />

            {/* Dialpad ↔ Call UI — fills, Call button pins to the bottom */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Instant swap + quick fade-in (no exit-then-enter gap) so the
                  call UI shows the moment you tap Call. */}
              {!isInCall ? (
                  <motion.div
                    key="dialpad-view"
                    className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.12 }}
                  >
                    <Dialpad
                      phoneNumber={phoneNumber}
                      isRegistered={uiRegistered}
                      isInCall={false}
                      collapsed={false}
                      isCallBusy={isCallBusy}
                      onKeyPress={handleKeyPress}
                      onBackspace={handleBackspace}
                      onCall={handleCall}
                      onNumberChange={setPhoneNumber}
                      onSpeedDial={handleSpeedDial}
                      dialCountry={dialCountry}
                      lastDialedNumber={lastDialed}
                      onRecallLast={() => setPhoneNumber(lastDialed)}
                    />
                  </motion.div>
                ) : activeLine && activeLineId ? (
                  <motion.div
                    key="call-view"
                    className="flex-1 min-h-0 flex flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.12 }}
                  >
                    {/* RingCentral-style multi-call / conference strip — pinned at
                        the top, so the controls + End Call below never get pushed
                        around by call-count changes. Renders nothing for one call. */}
                    <MultiCallStrip
                      lines={lines}
                      activeLineId={activeLineId}
                      isInConference={!!activeLine.isInConference}
                      conferenceParticipants={
                        capabilities.instantConference
                          ? [
                              { name: activeLine.remoteName, number: activeLine.remoteNumber },
                              ...(activeLine.conferenceParties ?? []).map((n) => ({ number: n })),
                            ]
                          : lines
                              .filter((l) => l.isInConference)
                              .map((l) => ({ name: l.remoteName, number: l.remoteNumber }))
                      }
                      canMerge={
                        capabilities.conference &&
                        lines.filter(
                          (l) =>
                            l.state === 'established' ||
                            l.state === 'held' ||
                            l.state === 'holding'
                        ).length >= 2
                      }
                      canSplit={!!activeLine.isInConference && !capabilities.instantConference}
                      onSwitchToLine={async (lineId) => {
                        try {
                          await switchToLine(lineId);
                        } catch (error) {
                          console.error('Failed to switch line:', error);
                          toast.error('Failed to switch call');
                        }
                      }}
                      onMerge={handleMergeLines}
                      onSplit={handleSplitConference}
                    />
                    <div className="flex-1 min-h-0 overflow-y-auto">
                    <CallControls
                      activeLine={activeLine}
                      activeLineId={activeLineId}
                      lines={lines}
                      lastRecording={lastRecording}
                      showKeypad={showKeypad}
                      userPhoneNumber={user?.senderPhone}
                      onMuteToggle={handleMuteToggle}
                      onHoldToggle={handleHoldToggle}
                      holdBusy={isHoldBusy}
                      onHangUp={handleHangUp}
                      onRecordToggle={handleRecordToggle}
                      onTransfer={handleTransfer}
                      onCompleteAttendedTransfer={handleCompleteAttendedTransfer}
                      onCancelAttendedTransfer={handleCancelAttendedTransfer}
                      onDownloadRecording={handleDownloadRecording}
                      onKeypadToggle={handleKeypadToggle}
                      onDTMF={handleDTMF}
                      onAddCall={handleAddCall}
                      callDuration={callDuration}
                      endLockRemaining={
                        // Org policy: no countdown when the end-call lock is disabled
                        // (e.g. the org is on Tozcall). Absent/null → locked (fail-safe).
                        user?.endCallLockEnabled !== false &&
                        user?.endCallLockEnabled !== 0 &&
                        activeLine.direction === 'outbound' &&
                        activeLine.answerTime
                          ? Math.max(0, END_LOCK_SECONDS - callDuration)
                          : 0
                      }
                      callStats={callStats[activeLine.id]}
                      dtmfDigits={dtmfDigits}
                    />
                    </div>
                  </motion.div>
                ) : null}
            </div>
          </div>
        )}

        {/* ---- Calls tab ---- */}
        {tab === 'calls' && (
          <CallsList
            selectedId={selectedCall?.id ?? null}
            onSelect={setSelectedCall}
            onCall={handleDetailCall}
            onMessage={handleDetailMessage}
            onDeleted={(ids) => {
              if (selectedCall && ids.includes(selectedCall.id)) setSelectedCall(null);
            }}
            onAddContact={setAddContactNumber}
            onBlock={handleBlockNumber}
          />
        )}

        {/* ---- Voicemail tab ---- */}
        {tab === 'voicemail' && (
          <VoicemailList
            selectedId={selectedVoicemail?.id ?? null}
            onSelect={setSelectedVoicemail}
            onDeleted={(ids) => {
              if (selectedVoicemail && ids.includes(selectedVoicemail.id)) setSelectedVoicemail(null);
            }}
          />
        )}

        {/* ---- Recordings tab (▾ overflow) ---- */}
        {tab === 'recordings' &&
          (recordingsEnabled ? (
            <RecordingsList
              selectedId={selectedRecording?.id ?? null}
              onSelect={setSelectedRecording}
              onDeleted={(ids) => {
                if (selectedRecording && ids.includes(selectedRecording.id))
                  setSelectedRecording(null);
              }}
              onCall={callNumber}
              onMessage={messageNumber}
              onAddContact={setAddContactNumber}
              onBlock={handleBlockNumber}
            />
          ) : (
            // Mobile: the list panel is the whole view; show the upsell here.
            // Desktop shows it in the wider main area (right) instead.
            <div className="flex flex-1 md:hidden">
              <NotSubscribed feature="Recordings" />
            </div>
          ))}

      </section>

      {/* Mobile: the right detail pane is hidden, so a tapped call opens here as a
          full-screen takeover over the list (CallDetailPane's header X = back).
          Voicemail/Recordings play inline in the list, so only Calls needs this. */}
      {tab === 'calls' && selectedCall && (
        <div className="md:hidden absolute inset-0 z-30 flex flex-col bg-[var(--background)]">
          <CallDetailPane
            call={selectedCall}
            userNumber={user?.senderPhone}
            onClose={() => setSelectedCall(null)}
            onCall={handleDetailCall}
            onMessage={handleDetailMessage}
            onAddContact={setAddContactNumber}
            onBlock={handleBlockNumber}
          />
        </div>
      )}

      {/* ===== MAIN AREA (right) — detail pane per tab / recents / campaign ===== */}
      <div className="hidden md:flex flex-1 min-h-0 flex-col bg-[var(--background)]">
        {tab === 'calls' ? (
          selectedCall ? (
            <CallDetailPane
              call={selectedCall}
              userNumber={user?.senderPhone}
              onClose={() => setSelectedCall(null)}
              onCall={handleDetailCall}
              onMessage={handleDetailMessage}
              onAddContact={setAddContactNumber}
              onBlock={handleBlockNumber}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-center text-[var(--muted-foreground)] px-6">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] grid place-items-center mx-auto mb-3">
                  <FiPhone className="w-7 h-7 opacity-60" />
                </div>
                <p className="text-sm">Select a call to see its details.</p>
              </div>
            </div>
          )
        ) : tab === 'voicemail' ? (
          selectedVoicemail ? (
            <VoicemailDetailPane
              vm={selectedVoicemail}
              userNumber={user?.senderPhone}
              onClose={() => setSelectedVoicemail(null)}
              onCall={callNumber}
              onMessage={messageNumber}
              onAddContact={setAddContactNumber}
              onBlock={handleBlockNumber}
              onDeleted={(id) => {
                if (selectedVoicemail?.id === id) setSelectedVoicemail(null);
              }}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-center text-[var(--muted-foreground)] px-6">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] grid place-items-center mx-auto mb-3">
                  <FiVoicemail className="w-7 h-7 opacity-60" />
                </div>
                <p className="text-sm">Select a voicemail to listen and read details.</p>
              </div>
            </div>
          )
        ) : tab === 'recordings' ? (
          !recordingsEnabled ? (
            <NotSubscribed feature="Recordings" />
          ) : selectedRecording ? (
            <RecordingDetailPane
              rec={selectedRecording}
              userNumber={user?.senderPhone}
              onClose={() => setSelectedRecording(null)}
              onCall={callNumber}
              onMessage={messageNumber}
              onAddContact={setAddContactNumber}
              onBlock={handleBlockNumber}
            />
          ) : (
            <RecordingsSummary />
          )
        ) : recentsClosed ? (
          <div className="flex-1 grid place-items-center text-center text-[var(--muted-foreground)] px-6">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] grid place-items-center mx-auto mb-3">
                <FiPhone className="w-7 h-7 opacity-60" />
              </div>
              <p className="text-sm mb-3">Recent calls hidden.</p>
              <button
                type="button"
                onClick={() => setRecentsClosed(false)}
                className="text-[13px] font-bold text-[var(--foreground)] hover:underline"
              >
                Show recent calls
              </button>
            </div>
          </div>
        ) : (
          <RecentCalls
            calls={recentCalls}
            isLoading={isLoadingHistory}
            error={historyError}
            isRegistered={uiRegistered}
            onRefresh={() => refetchRecentCalls()}
            onCallFromHistory={handleCallFromHistory}
            onClose={() => setRecentsClosed(true)}
          />
        )}
      </div>

      {/* Add-contact flow (from row ⋯ menu / detail pane) */}
      {addContactNumber && (
        <AddContactFlow number={addContactNumber} onClose={() => setAddContactNumber(null)} />
      )}
    </div>
  );
}
