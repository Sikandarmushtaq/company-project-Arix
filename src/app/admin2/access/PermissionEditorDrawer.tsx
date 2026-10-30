'use client';

/**
 * Per-user permission editor (Access Control). Shows the platform permission
 * catalog grouped by category with the user's EFFECTIVE state; a toggle writes
 * the minimal override — if the desired state matches the role default we REVOKE
 * the override (back to default), otherwise we GRANT an explicit override. Reuses
 * the deployed permissions API. super_admin is full-access and read-only.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { permissionsService, type Permission } from '@/lib/api/services/permissions.service';
import { Btn, StatusDot } from '../_components/ui';

const CATEGORY_LABEL: Record<string, string> = {
  viewing: 'Viewing', managing: 'Managing', system: 'System', security: 'Security', reporting: 'Reporting',
};

export function PermissionEditorDrawer({
  user,
  onClose,
}: {
  user: { id: number; fullName: string; email: string; role: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isSuper = user.role === 'super_admin';

  const catalogQ = useQuery({
    queryKey: ['admin2', 'perm-catalog'],
    queryFn: () => permissionsService.getAllPermissions(),
    staleTime: 5 * 60_000,
  });
  const userPermsQ = useQuery({
    queryKey: ['admin2', 'user-perms', user.id],
    queryFn: () => permissionsService.getUserPermissions(user.id),
    enabled: !isSuper,
    staleTime: 10_000,
  });

  const perms = catalogQ.data?.data ?? [];
  const up = userPermsQ.data?.data;
  const effective = up?.effectivePermissions ?? {};
  const roleDefaults = useMemo(() => new Set(up?.roleDefaults ?? []), [up]);

  const groups = useMemo(() => {
    const byCat = new Map<string, Permission[]>();
    for (const p of perms) {
      const arr = byCat.get(p.category) ?? [];
      arr.push(p);
      byCat.set(p.category, arr);
    }
    return [...byCat.entries()];
  }, [perms]);

  const set = useMutation({
    mutationFn: async ({ code, desired }: { code: string; desired: boolean }) => {
      // Minimal override: if desired == role default, remove the override;
      // otherwise write an explicit grant/deny.
      if (desired === roleDefaults.has(code)) {
        await permissionsService.revokePermission(user.id, code);
      } else {
        await permissionsService.grantPermission(user.id, { permissionCode: code, granted: desired });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin2', 'user-perms', user.id] }),
  });

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-lg overflow-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-lg font-black">{user.fullName || user.email}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{user.email} · <span className="capitalize font-semibold">{user.role.replace('_', ' ')}</span></div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800">×</button>
        </div>

        {isSuper ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            Super admin — full platform access. Permissions are not editable for this role.
          </div>
        ) : catalogQ.isLoading || userPermsQ.isLoading ? (
          <div className="space-y-2">{[0,1,2,3,4].map((i)=><div key={i} className="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />)}</div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Toggles write the minimal override: matching the role default removes the override; differing creates an explicit grant/deny. {set.isError && <span className="font-semibold text-red-600">Last change failed — retry.</span>}
            </p>
            {groups.map(([cat, list]) => (
              <div key={cat} className="mb-4">
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">{CATEGORY_LABEL[cat] ?? cat}</div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {list.map((p) => {
                    const on = !!effective[p.code];
                    const isDefault = roleDefaults.has(p.code);
                    const overridden = on !== isDefault;
                    return (
                      <div key={p.code} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {p.name}
                            {p.isAdminOnly && <span className="ml-2 rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">admin-only</span>}
                            {overridden && <span className="ml-2 rounded bg-[#FF6542]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#b8462c] dark:text-[#ffb09a]">override</span>}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">{p.code}</div>
                        </div>
                        <button
                          type="button"
                          disabled={set.isPending}
                          onClick={() => set.mutate({ code: p.code, desired: !on })}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-[#FF6542]' : 'bg-slate-300 dark:bg-slate-700'}`}
                          aria-pressed={on}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <span className="inline-flex items-center gap-2"><StatusDot health="warn" label="" /> {up?.overrides.length ?? 0} override(s) · defaults from role <b className="capitalize">{user.role.replace('_', ' ')}</b></span>
              <Btn size="sm" onClick={onClose}>Done</Btn>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
