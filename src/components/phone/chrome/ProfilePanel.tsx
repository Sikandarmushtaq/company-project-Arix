'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FiX, FiPhone, FiMail, FiBriefcase, FiHash, FiLogOut } from 'react-icons/fi';
import { formatPhoneUS } from '@/lib/utils/phone';
import { useAuthStore } from '@/lib/stores/auth';

/**
 * ProfilePanel — the signed-in user's own profile card, opened from the top-bar
 * avatar (RingCentral-style). Centered modal via a portal to document.body.
 * Closes on backdrop-click / Escape / the X. Includes Log out (reuses the auth
 * store's logout, same as Settings).
 */
export interface ProfileUser {
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  organizationName?: string | null;
  senderPhone?: string | null;
  sipUsername?: string | null;
}

function Field({
  icon,
  label,
  value,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {icon ? (
        <span className="mt-0.5 shrink-0 text-[var(--muted-foreground)]">{icon}</span>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
        <div
          className={`text-sm font-semibold break-words ${
            accent ? 'text-[var(--primary-600)] dark:text-[var(--primary-400)]' : 'text-[var(--foreground)]'
          }`}
        >
          {value?.trim() ? value : '—'}
        </div>
      </div>
    </div>
  );
}

export function ProfilePanel({ user, onClose }: { user: ProfileUser; onClose: () => void }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal target only exists on the client. This component is only rendered
  // after a click (never during SSR), but guard anyway to stay render-safe.
  if (typeof document === 'undefined') return null;

  const name = user.fullName?.trim() || user.email?.trim() || 'User';
  const initials =
    name
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  const role = user.role?.trim();
  const direct = user.senderPhone ? formatPhoneUS(user.senderPhone) : '';

  const handleLogout = () => {
    onClose();
    logout();
    router.push('/login');
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-hidden="true" />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your profile"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-2xl shadow-black/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-[15px] font-bold">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Identity — subtly greyed banner, with Log out on the right */}
        <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--muted)] px-6 py-3.5">
          <div className="relative shrink-0">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--primary-600)] text-xl font-black text-white">
              {initials}
            </div>
            <span className="absolute -right-0.5 -bottom-0.5 h-[18px] w-[18px] rounded-full border-2 border-[var(--card)] bg-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold text-[var(--foreground)]">{name}</div>
            {role && <div className="text-xs capitalize text-[var(--muted-foreground)]">{role}</div>}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-semibold text-[var(--danger)] transition-colors hover:border-transparent hover:bg-red-500/10"
          >
            <FiLogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>

        {/* Details — two columns split by a vertical divider (matches the reference) */}
        <div className="grid grid-cols-2">
          <div className="px-6 py-7">
            <Field
              icon={<FiBriefcase className="h-4 w-4" />}
              label="Company"
              value={user.organizationName}
            />
          </div>
          <div className="space-y-6 border-l border-[var(--border)] px-6 py-7">
            <Field
              icon={<FiHash className="h-4 w-4" />}
              label="Extension"
              value={user.sipUsername}
              accent
            />
            <Field
              icon={<FiPhone className="h-4 w-4" />}
              label="Direct number"
              value={direct}
              accent
            />
            <Field icon={<FiMail className="h-4 w-4" />} label="Email" value={user.email} accent />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
