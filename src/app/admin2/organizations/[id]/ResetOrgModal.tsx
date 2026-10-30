'use client';

/**
 * Reset Organization Modal — admin2 Org Detail.
 *
 * Designed with Apple Human Interface Guidelines:
 * - Subtle frosted glass backdrop with soft ambient blur
 * - Clear typographic hierarchy and calm, authoritative tone
 * - Inset grouped status card with SF-style iconography
 * - Safe-guarantee footnote for phone number inventory
 * - Refined, tactile action controls
 */

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiRotateCcw,
  FiPhoneCall,
  FiUsers,
  FiSliders,
  FiShield,
  FiAlertTriangle,
  FiLoader,
  FiX,
} from 'react-icons/fi';
import { adminService } from '@/lib/api/services/admin.service';
import { adminKeys } from '@/lib/hooks/useAdmin';
import { toast } from '@/lib/stores/toast';

export function ResetOrgModal({
  org,
  onClose,
}: {
  org: { id: number; name: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const resetMut = useMutation({
    mutationFn: () => adminService.resetOrganization(org.id),
    onSuccess: (res) => {
      if (res.recordingsCleared) {
        toast.success(
          `Organization reset complete. ${res.subUsersDeleted} sub-user(s) removed, comms & usage reset.`
        );
      } else {
        toast.warning(
          `Database reset completed, but external media cleanup needs attention: ${res.externalCleanupWarnings.join('; ')}`,
          10000
        );
      }
      // Refresh all org-related queries on the page
      qc.invalidateQueries({ queryKey: adminKeys.organizationDetail(org.id) });
      qc.invalidateQueries({ queryKey: adminKeys.organizationUsers(org.id) });
      qc.invalidateQueries({ queryKey: adminKeys.organizationStats(org.id) });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-numbers', org.id] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-usage-stats', org.id] });
      qc.invalidateQueries({ queryKey: ['admin2', 'org-verification', org.id] });
      qc.invalidateQueries({ queryKey: ['admin2', 'soft-cap', org.id] });
      qc.invalidateQueries({ queryKey: ['admin2', 'sms-soft-cap', org.id] });
      qc.invalidateQueries({ queryKey: ['admin2', 'sms-usage-ledger'] });
      qc.invalidateQueries({ queryKey: ['admin2', 'call-usage-ledger'] });
      qc.invalidateQueries({ queryKey: adminKeys.organizations() });
      onClose();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Could not reset organization');
    },
  });

  // Handle Escape key to dismiss gracefully
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !resetMut.isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, resetMut.isPending]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => {
        if (!resetMut.isPending) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div
        className="w-full max-w-[480px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl transition-all dark:border-white/10 dark:bg-[#1c1c1e]/95 dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400">
              <FiRotateCcw className="h-5 w-5 stroke-[2.25]" />
            </div>
            <div>
              <h2
                id="reset-modal-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
              >
                Reset Organization
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Org #{org.id} · {org.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={resetMut.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
            aria-label="Close dialog"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Narrative Description */}
        <p className="mt-3.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          This will restore the organization to a clean trial state for a new client.
          Communications history and sub-users will be permanently erased.
        </p>

        {/* Inset Grouped Section (Apple Settings / Sheet style) */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/70 divide-y divide-slate-200/70 dark:border-white/10 dark:bg-white/[0.03] dark:divide-white/[0.06]">
          {/* Row 1: Communications & Media */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <FiPhoneCall className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Communications & Activity
                </span>
                <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  Erase
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                Call records, messages, recordings, voicemails, and contacts will be permanently deleted.
              </p>
            </div>
          </div>

          {/* Row 2: Sub-Users */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <FiUsers className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Sub-User Accounts
                </span>
                <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Delete
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                All secondary users and their extensions are removed. The owner account is preserved.
              </p>
            </div>
          </div>

          {/* Row 3: Trial Limits */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <FiSliders className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  Trial Allowances
                </span>
                <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  100 / 100
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                Usage counters reset to 0, base limits reset to 100 call minutes and 100 SMS, and billing anchor refreshes to today.
              </p>
            </div>
          </div>
        </div>

        {/* Protection Guarantee Note */}
        <div className="mt-3.5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 text-[12px] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <FiShield className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">
            Phone numbers remain safe in your organization inventory and will not be released.
          </span>
        </div>

        {/* Reset prerequisites and external-system caveat */}
        <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">Before resetting</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
              Cancel active call packages and SMS add-ons first. If PBX or media storage is
              temporarily unavailable, the database reset will complete and you will receive a
              cleanup warning that requires attention.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={resetMut.isPending}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-200/80 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.98] active:bg-red-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            {resetMut.isPending ? (
              <>
                <FiLoader className="h-3.5 w-3.5 animate-spin" />
                <span>Resetting…</span>
              </>
            ) : (
              <span>Reset Organization</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
