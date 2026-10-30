'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  FiMoon,
  FiGrid,
  FiSearch,
  FiPhone,
  FiPhoneOff,
  FiPhoneIncoming,
  FiMic,
  FiMicOff,
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/stores';
import { useSocket } from '@/lib/providers/SocketProvider';
import { crossAppHref } from '@/lib/utils/routing';
import { ProfilePanel } from './ProfilePanel';
import { NotificationDropdown } from '@/components/layout/NotificationDropdown';
import { useDndStatus } from '@/lib/hooks/useUserSettings';
import { useCommandPalette } from '@/components/ui/CommandPalette';
import { useSipStore } from '@/lib/stores/sip';
import { useContactDisplayName } from '@/lib/hooks';
import { isMonitoringCall } from '@/lib/utils/call-status';
import { formatDuration } from '@/lib/utils/formatting';
import { formatPhoneUS } from '@/lib/utils/phone';

/**
 * DialerTopBar — Phase 1 top bar (new UI). Full-width ArixCall brand bar
 * (blue→teal gradient, echoing the logo). ALL logic is reused from the old
 * Header: auth, socket presence, DND, PhoneSelector, NotificationDropdown,
 * command palette, admin button. Only look/layout new. (Theme toggle and logout
 * now live in Settings, not the top bar.)
 */
export function DialerTopBar() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { status: socketStatus, isConnected } = useSocket();
  const { data: dndStatus } = useDndStatus();
  const { open: openCommandPalette } = useCommandPalette();

  // Active-call widget (matches RingCentral's top bar during a call) plus the
  // incoming-call pill (top-bar inbound UI — replaces the old full-screen modal).
  // The store's isAnswering guards double-answer; monitoring calls are handled by
  // AdminMonitorPanel, so they never surface as a top-bar incoming pill.
  const { lines, activeLineId, muteCall, unmuteCall, endCall, incomingCall, isAnswering, answerCall, rejectCall } =
    useSipStore();
  const activeLine = activeLineId !== null ? lines.find((l) => l.id === activeLineId) : undefined;

  // An unanswered inbound call is stored as the active line, but while it's still
  // ringing the incoming pill (below) is the only surface — don't also render the
  // active-call widget for that same line. Once answered the store clears
  // incomingCall and this widget takes over.
  const isRingingIncoming = !!incomingCall && !!activeLine && incomingCall.lineId === activeLine.id;
  const isInCall =
    !!activeLine &&
    !isRingingIncoming &&
    ['dialing', 'ringing', 'connecting', 'established', 'holding', 'held'].includes(
      activeLine.state
    );
  const incomingName = useContactDisplayName(
    incomingCall?.callerNumber || '',
    incomingCall?.callerName
  );

  const [callDur, setCallDur] = React.useState(0);
  const [profileOpen, setProfileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!activeLine?.answerTime || activeLine.state !== 'established') {
      setCallDur(0);
      return;
    }
    const t = new Date(activeLine.answerTime).getTime();
    const update = () => setCallDur(Math.max(0, Math.floor((Date.now() - t) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeLine?.answerTime, activeLine?.state]);


  const name = user?.fullName || user?.email || 'User';
  const initials =
    name
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const presence =
    socketStatus === 'connected'
      ? 'bg-green-400'
      : socketStatus === 'connecting'
        ? 'bg-yellow-300 animate-pulse'
        : 'bg-gray-300';

  return (
    <header className="nx-topbar h-14 flex items-center gap-3 px-4 text-[var(--foreground)] shrink-0 bg-[var(--card)] border-b border-[var(--border)]">
      {/* Brand + presence avatar. The avatar opens the signed-in user's profile. */}
      <div className="relative flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          aria-label="Your profile"
          aria-expanded={profileOpen}
          className="relative rounded-full outline-none ring-[var(--primary-500)] focus-visible:ring-2 transition-transform hover:scale-105"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--primary-600)] flex items-center justify-center text-[13px] font-black text-white">
            {initials}
          </div>
          <span
            className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-[var(--card)] ${presence}`}
            title={isConnected ? 'Online' : socketStatus === 'connecting' ? 'Connecting' : 'Offline'}
          />
        </button>
        <b
          className="text-[17px] font-black tracking-tight hidden sm:block max-w-[220px] truncate"
          title={user?.organizationName?.trim() || user?.fullName?.trim() || 'ArixCall'}
        >
          {user?.organizationName?.trim() || user?.fullName?.trim() || 'ArixCall'}
        </b>

        {profileOpen && user && (
          <ProfilePanel
            user={{
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              organizationName: user.organizationName,
              senderPhone: user.senderPhone,
              sipUsername: user.sipUsername,
            }}
            onClose={() => setProfileOpen(false)}
          />
        )}
      </div>

      {/* Search — opens the command palette (Cmd/Ctrl+K) */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="flex-1 max-w-[560px] mx-auto flex items-center gap-2.5 px-3.5 h-9 rounded-full bg-[var(--muted)] hover:bg-[var(--muted)]/70 text-[var(--muted-foreground)] border border-[var(--border)] transition-colors text-left"
      >
        <FiSearch className="w-4 h-4 shrink-0" />
        <span className="text-sm truncate">Search people, calls, messages</span>
        <kbd className="ml-auto hidden md:inline text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]">
          Ctrl K
        </kbd>
      </button>

      {/* Right cluster — all reused logic */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Incoming-call pill — inbound now shows here in the top bar (no
            full-screen overlay). Monitoring calls are excluded (AdminMonitorPanel
            owns those). Takes visual priority over the active-call widget. */}
        {incomingCall && !isMonitoringCall(incomingCall.callerName) && (
          <div className="flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-full bg-green-500/10 border border-green-500/60">
            <span className="relative grid place-items-center w-7 h-7 rounded-full bg-green-500 text-white shrink-0">
              <FiPhoneIncoming className="w-3.5 h-3.5" />
              <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />
            </span>
            <div className="hidden min-[400px]:block leading-none mr-0.5 max-w-[160px]">
              <div className="text-[13px] font-bold leading-tight truncate">
                {incomingName || formatPhoneUS(incomingCall.callerNumber) || 'Unknown'}
              </div>
              <div className="text-[11px] text-green-600 dark:text-green-400 font-semibold leading-tight">
                Incoming call
              </div>
            </div>
            <button
              type="button"
              onClick={() => rejectCall(incomingCall.lineId)}
              disabled={isAnswering}
              aria-label="Decline call"
              className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white grid place-items-center transition-colors"
            >
              <FiPhoneOff className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => answerCall(incomingCall.lineId)}
              disabled={isAnswering}
              aria-label="Answer call"
              className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white grid place-items-center transition-colors"
            >
              <FiPhone className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Active-call widget */}
        {isInCall && activeLine && (
          <div className="flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-full bg-[var(--muted)] border border-[var(--border)]">
            <FiPhone className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            {/* Number/duration text is dropped on very narrow screens so the top bar
                (search + widget + right controls) can't overflow during a call —
                mute + end stay reachable; the in-call panel shows full details. */}
            <div className="hidden min-[400px]:block leading-none mr-0.5">
              <div className="text-[13px] font-bold leading-tight">
                {formatPhoneUS(activeLine.remoteNumber)}
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] tabular-nums leading-tight">
                {activeLine.state === 'established'
                  ? formatDuration(callDur)
                  : activeLine.state === 'held' || activeLine.state === 'holding'
                    ? 'On hold'
                    : 'Calling…'}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                activeLineId !== null &&
                (activeLine.isMuted ? unmuteCall(activeLineId) : muteCall(activeLineId))
              }
              aria-label={activeLine.isMuted ? 'Unmute' : 'Mute'}
              aria-pressed={activeLine.isMuted}
              className={`w-8 h-8 rounded-full grid place-items-center transition-colors ${
                activeLine.isMuted
                  ? 'bg-red-500 text-white'
                  : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--muted)]'
              }`}
            >
              {activeLine.isMuted ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => activeLineId !== null && endCall(activeLineId)}
              aria-label="End call"
              className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white grid place-items-center"
            >
              <FiPhoneOff className="w-4 h-4" />
            </button>
          </div>
        )}
        {dndStatus?.enabled && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)]"
            role="status"
            aria-label="Do Not Disturb is active"
          >
            <FiMoon className="w-3.5 h-3.5" />
            <span className="text-xs font-bold hidden sm:inline">DND</span>
          </div>
        )}

        {/* Caller-ID selector moved to the keypad ("My caller ID:" row), matching
            RingCentral — no longer shown in the top bar. */}
        {/* Bell uses currentColor → whitened by .nx-topbar-widget; its inline
            panel keeps its own explicit text colors, so it stays readable. */}
        <div className="nx-topbar-widget">
          <NotificationDropdown />
        </div>

        {(() => {
          // Portal switcher — lets privileged roles jump from the dialer to their
          // portal. Owners → org portal; admin/manager → admin panel. On
          // arixcall.com this crosses to admin.arixcall.com in one hop (SSO
          // cookie carries the session); elsewhere it's an in-app route.
          const role = user?.role;
          const target =
            role === 'owner' ? '/org' : role === 'admin' || role === 'manager' ? '/admin' : null;
          if (!target) return null;
          const label = role === 'owner' ? 'Portal' : role === 'admin' ? 'Admin' : 'Manager';
          const go = () => {
            const href = crossAppHref('admin', target);
            if (href.startsWith('http')) window.location.assign(href);
            else router.push(href);
          };
          return (
            <button
              type="button"
              onClick={go}
              className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-bold border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              title={`${label} Panel`}
            >
              <FiGrid className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })()}
      </div>
    </header>
  );
}
