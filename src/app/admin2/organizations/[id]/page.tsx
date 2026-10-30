'use client';

/**
 * Page 2 — Organization Detail. Tabs: Overview · Users · Numbers · Usage · Services.
 * Wired to real endpoints: useOrganization, useOrganizationUsers, useOrganizationStats,
 * entitlementApi (modules). Numbers list + Add User + Activity are backend-gated
 * (need new admin endpoints) and clearly marked — not faked.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth';
import { useOrganization, useOrganizationUsers, useOrganizationStats, adminKeys } from '@/lib/hooks/useAdmin';
import { entitlementApi } from '@/lib/api/services/entitlement.api';
import { adminAccountApi, type OrgNumber } from '@/lib/api/services/admin-account.api';
import { adminService } from '@/lib/api/services/admin.service';
import { AddUserModal } from './AddUserModal';
import { AddNumberModal } from '../../phone-numbers/_components/AddNumberModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { MemberAdminDrawer, type ManageMember } from './MemberAdminDrawer';
import { EditOrgModal } from './EditOrgModal';
import { ResetOrgModal } from './ResetOrgModal';
import { SmsPackageCard } from './SmsPackageCard';
import { BillingControlsCard } from './BillingControlsCard';
import { InvoicesCard } from './InvoicesCard';
import { SubscriptionCard } from './SubscriptionCard';
import { InfrastructureTab } from './InfrastructureTab';
import { ActivityTab } from './ActivityTab';
import { OrgCallUsagePanel } from './OrgCallUsagePanel';
import { BillingCycleBanner } from './BillingCycleBanner';
import { SmsCapCounter } from './SmsCapCounter';
import { AccountStatusCard } from './AccountStatusCard';
import { PlanCard } from './PlanCard';
import { CustomPlanCard } from './CustomPlanCard';
import { SmsAddonManagerCard } from './SmsAddonManagerCard';
import {
  Btn,
  Card,
  ErrorState,
  HealthRow,
  Metric,
  Modal,
  SectionTitle,
  StatusDot,
  SubscriptionBadge,
  Tabs,
  ToggleRow,
} from '../../_components/ui';

type TabKey = 'overview' | 'users' | 'numbers' | 'usage' | 'services' | 'infrastructure' | 'activity';
const TAB_KEYS: TabKey[] = ['overview', 'users', 'numbers', 'usage', 'services', 'infrastructure', 'activity'];

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orgId = Number(params?.id);
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'superadmin';
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>('overview');

  // Deep-link to a tab via ?tab=usage (e.g. "Manage cap"). Read AFTER mount —
  // reading window in the useState initializer is unreliable under SSR/hydration
  // (server has no window → commits 'overview', client result discarded).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as TabKey | null;
    if (t && TAB_KEYS.includes(t)) setTab(t);
  }, []);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addNumberOpen, setAddNumberOpen] = useState(false);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [resetUser, setResetUser] = useState<{ id: number; fullName: string | null; email: string | null } | null>(null);
  const [manageMember, setManageMember] = useState<ManageMember | null>(null);

  const numbersQ = useQuery({
    queryKey: ['admin2', 'org-numbers', orgId],
    queryFn: () => adminAccountApi.listOrgNumbers(orgId),
    enabled: isSuperAdmin && Number.isFinite(orgId) && orgId > 0,
    staleTime: 15_000,
  });

  // Usage-tab activity range (calls/SMS by created_at). Separate from the
  // all-time page stats so the Overview tiles aren't affected by the filter.
  const [usageFrom, setUsageFrom] = useState('');
  const [usageTo, setUsageTo] = useState('');
  const usageStatsQ = useQuery({
    queryKey: ['admin2', 'org-usage-stats', orgId, usageFrom, usageTo],
    queryFn: () =>
      adminService.getOrganizationStats(orgId, { from: usageFrom || undefined, to: usageTo || undefined }),
    enabled: isSuperAdmin && Number.isFinite(orgId) && orgId > 0,
    staleTime: 15_000,
  });
  const usageStats = usageStatsQ.data;
  const usageRanged = !!(usageFrom || usageTo);
  const setUsagePreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setUsageFrom(from.toISOString().slice(0, 10));
    setUsageTo(to.toISOString().slice(0, 10));
  };

  const { data: org, isLoading, isError } = useOrganization(Number.isFinite(orgId) ? orgId : 0);
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useOrganizationUsers(Number.isFinite(orgId) ? orgId : 0, { page: 1, limit: 200 });
  const { data: stats } = useOrganizationStats(Number.isFinite(orgId) ? orgId : 0);
  const users = usersData?.users ?? [];

  // After adding/removing a user or number, refresh BOTH the lists AND the org
  // detail/stats — the tab badges + Overview metrics read org.userCount /
  // org.numberCount (the org detail query), not the list length, so refetching
  // only the list leaves the "Users N" badge stale.
  const refreshOrgData = () => {
    refetchUsers();
    numbersQ.refetch();
    qc.invalidateQueries({ queryKey: adminKeys.organizationDetail(orgId) });
    qc.invalidateQueries({ queryKey: adminKeys.organizationStats(orgId) });
  };

  // Assign an EXISTING org number to a member (or unassign) — super-admin parity
  // with the orgadmin. Reuses the server-side assignNumber engine.
  const [assignTarget, setAssignTarget] = useState<OrgNumber | null>(null);
  const [assignSel, setAssignSel] = useState<string>('');
  const assignNumberMut = useMutation({
    mutationFn: ({ numberId, userId }: { numberId: number; userId: number | null }) =>
      adminAccountApi.assignOrgNumber(orgId, numberId, userId),
    onSuccess: () => {
      setAssignTarget(null);
      refreshOrgData();
    },
  });
  const openAssign = (n: OrgNumber) => {
    setAssignSel(n.assignedUserId ? String(n.assignedUserId) : '');
    assignNumberMut.reset();
    setAssignTarget(n);
  };

  // Entitlements (Services tab) — module catalog + this org's module flags.
  const entitlements = useQuery({
    queryKey: ['admin2', 'entitlements'],
    queryFn: () => entitlementApi.list(),
    enabled: isSuperAdmin && Number.isFinite(orgId),
    staleTime: 30_000,
  });
  const setModule = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) =>
      entitlementApi.setModule(orgId, module, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin2', 'entitlements'] }),
  });
  const tenant = entitlements.data?.tenants.find((t) => t.organizationId === orgId);

  // Org lifecycle status for the Enable/Disable control. 'disabled' keeps
  // is_active=1, so derive from the explicit status (falling back to isActive).
  const orgStatus = org?.status ?? (org?.isActive ? 'active' : 'closed');
  type LifecycleAction = 'disable' | 'enable' | 'close' | 'reactivate' | 'purge';
  const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOrgOpen, setResetOrgOpen] = useState(false);
  const lifecycle = useMutation({
    mutationFn: (action: LifecycleAction) => {
      switch (action) {
        case 'disable':
          return adminService.disableOrganization(orgId);
        case 'enable':
          return adminService.enableOrganization(orgId);
        case 'close':
          return adminService.deleteOrganization(orgId);
        case 'reactivate':
          return adminService.reactivateOrganization(orgId);
        case 'purge':
          return adminService.purgeOrganization(orgId);
      }
    },
    onSuccess: (_r, action) => {
      setConfirmAction(null);
      // A hard purge removes the org entirely — leave the detail page.
      if (action === 'purge') {
        router.push('/admin2/organizations');
        return;
      }
      qc.invalidateQueries({ queryKey: adminKeys.organizationDetail(orgId) });
      qc.invalidateQueries({ queryKey: adminKeys.organizations() });
    },
  });

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const back = (
    <button type="button" onClick={() => router.push('/admin2/organizations')} className="mb-4 text-sm font-semibold text-slate-500 hover:text-[#FF6542] dark:text-slate-400">
      ← Back to Organizations
    </button>
  );

  if (!isSuperAdmin) return <section>{back}<Card className="p-8 text-sm text-slate-500">Organization detail is available to platform super-admins.</Card></section>;
  if (isError) return <section>{back}<ErrorState>Organization could not be loaded.</ErrorState></section>;
  if (isLoading || !org) return <section>{back}<div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /></section>;

  return (
    <section>
      {back}

      {/* Hero */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FF6542]/10 text-lg font-black text-[#b7472f] dark:text-[#ffb09a]">
            {org.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight">{org.name}</h1>
              {orgStatus !== 'pending' && <SubscriptionBadge status={org.billingStatus} />}
              {orgStatus === 'suspended' ? (
                <StatusDot health="warn" label="Disabled" />
              ) : orgStatus === 'closed' ? (
                <StatusDot health="bad" label="Closed" />
              ) : orgStatus === 'pending' ? (
                <StatusDot health="warn" label="Pending (incomplete signup)" />
              ) : (
                <StatusDot health={org.isActive ? 'ok' : 'off'} label={org.isActive ? 'Active' : 'Inactive'} />
              )}
            </div>
            <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{org.slug} · org #{org.id}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => setAddUserOpen(true)}>+ Add User</Btn>
          <Btn onClick={() => setTab('numbers')}>+ Add Number</Btn>
          <Btn onClick={() => router.push(`/admin2/diagnostics?org=${orgId}`)}>Run Diagnostics</Btn>
          <Btn onClick={() => setEditOpen(true)}>Edit</Btn>
          {org.slug !== 'default' && (
            <Btn variant="danger" onClick={() => setResetOrgOpen(true)}>
              Reset
            </Btn>
          )}
          {orgStatus === 'active' && (
            <Btn variant="danger" onClick={() => setConfirmAction('disable')}>Disable</Btn>
          )}
          {orgStatus === 'suspended' && (
            <Btn variant="primary" onClick={() => setConfirmAction('enable')}>Enable</Btn>
          )}
          {/* 'pending' = an incomplete/failed signup. The backend close() has no
              status precondition, so allow Close here too — it's the path to wind one
              down and then Delete permanently (otherwise a failed signup is stuck with
              no lifecycle controls at all). */}
          {(orgStatus === 'active' || orgStatus === 'suspended' || orgStatus === 'pending') && (
            <Btn variant="danger" onClick={() => setConfirmAction('close')}>Close</Btn>
          )}
          {orgStatus === 'closed' && (
            <>
              <Btn variant="primary" onClick={() => setConfirmAction('reactivate')}>Reactivate</Btn>
              <Btn variant="danger" onClick={() => setConfirmAction('purge')}>Delete permanently</Btn>
            </>
          )}
        </div>
      </div>

      {confirmAction &&
        (() => {
          const copy: Record<
            LifecycleAction,
            { title: string; btn: string; variant: 'danger' | 'primary'; body: React.ReactNode }
          > = {
            disable: {
              title: `Disable ${org.name}?`,
              btn: 'Disable organization',
              variant: 'danger',
              body: (
                <div className="space-y-2 text-sm">
                  <p>This temporarily locks the workspace. <span className="font-bold">Members (managers &amp; users) are signed out immediately and can&apos;t log back in.</span></p>
                  <p>The <span className="font-bold">owner can still sign in</span> but is kept out of the dialer until you re-enable. The org&apos;s phone extensions stop registering.</p>
                  <p className="text-slate-500 dark:text-slate-400">Reversible — click Enable to restore. Not the same as closing/deleting the org.</p>
                </div>
              ),
            },
            enable: {
              title: `Enable ${org.name}?`,
              btn: 'Enable organization',
              variant: 'primary',
              body: <p className="text-sm">This restores full access — members can log in again and the owner regains the dialer. Phone extensions are re-enabled.</p>,
            },
            close: {
              title: `Close ${org.name}?`,
              btn: 'Close organization',
              variant: 'danger',
              body: (
                <div className="space-y-2 text-sm">
                  <p>The workspace is <span className="font-bold">closed</span>: everyone is signed out and the org stops working. This is <span className="font-bold">reversible for 30 days</span> (Reactivate), after which the daily reaper hard-purges it.</p>
                  <p className="text-slate-500 dark:text-slate-400">Use this to wind an org down. To remove it immediately and irreversibly, close it then Delete permanently.</p>
                </div>
              ),
            },
            reactivate: {
              title: `Reactivate ${org.name}?`,
              btn: 'Reactivate organization',
              variant: 'primary',
              body: <p className="text-sm">Restores a closed org within its 30-day grace window — members can log in again and telephony resumes.</p>,
            },
            purge: {
              title: `Permanently delete ${org.name}?`,
              btn: 'Delete permanently',
              variant: 'danger',
              body: (
                <div className="space-y-2 text-sm">
                  <p className="font-bold text-red-600 dark:text-red-400">This cannot be undone.</p>
                  <p>The organization and <span className="font-bold">all its data</span> are hard-deleted; its Telnyx numbers/sub-account are released. Only a <span className="font-bold">closed</span> org can be purged.</p>
                </div>
              ),
            },
          };
          const c = copy[confirmAction];
          return (
            <Modal
              title={c.title}
              onClose={() => !lifecycle.isPending && setConfirmAction(null)}
              footer={
                <>
                  <Btn onClick={() => setConfirmAction(null)} disabled={lifecycle.isPending}>Cancel</Btn>
                  <Btn variant={c.variant} onClick={() => lifecycle.mutate(confirmAction)} disabled={lifecycle.isPending}>
                    {lifecycle.isPending ? 'Working…' : c.btn}
                  </Btn>
                </>
              }
            >
              {c.body}
              {lifecycle.isError && (
                <p className="mt-3 text-xs font-semibold text-red-600">{(lifecycle.error as Error)?.message || 'Action failed.'}</p>
              )}
            </Modal>
          );
        })()}

      {addUserOpen && (
        <AddUserModal orgId={orgId} onClose={() => setAddUserOpen(false)} onCreated={() => refreshOrgData()} />
      )}
      {addNumberOpen && (
        <AddNumberModal
          orgId={orgId}
          orgName={org.name}
          onClose={() => setAddNumberOpen(false)}
          onDone={() => { setAddNumberOpen(false); refreshOrgData(); }}
        />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onDone={() => { }} />
      )}
      {planEditorOpen && (
        <Modal
          title="Custom plan"
          subtitle={`${org.name ?? `org#${orgId}`} — set this customer’s price & limits`}
          size="lg"
          onClose={() => setPlanEditorOpen(false)}
        >
          <CustomPlanCard orgId={orgId} bare onSaved={() => setPlanEditorOpen(false)} />
        </Modal>
      )}
      {assignTarget && (
        <Modal
          title={assignTarget.assignedUserId ? 'Reassign number' : 'Assign number'}
          onClose={() => !assignNumberMut.isPending && setAssignTarget(null)}
          footer={
            <>
              <Btn onClick={() => setAssignTarget(null)} disabled={assignNumberMut.isPending}>Cancel</Btn>
              <Btn
                variant="primary"
                onClick={() => assignNumberMut.mutate({ numberId: assignTarget.id, userId: assignSel ? Number(assignSel) : null })}
                disabled={
                  assignNumberMut.isPending ||
                  assignSel === (assignTarget.assignedUserId ? String(assignTarget.assignedUserId) : '')
                }
              >
                {assignNumberMut.isPending ? 'Saving…' : assignSel ? 'Assign' : 'Unassign'}
              </Btn>
            </>
          }
        >
          <p className="text-sm">
            <span className="font-mono font-bold">{assignTarget.phoneNumber}</span>
            {assignTarget.assignedUserName ? (
              <> — currently <span className="font-semibold">{assignTarget.assignedUserName}</span></>
            ) : (
              <> — currently <span className="font-semibold text-amber-600 dark:text-amber-400">Available</span></>
            )}
          </p>
          <label className="mt-3 block text-xs font-bold text-slate-500 dark:text-slate-400">
            Assign to
            <select
              value={assignSel}
              onChange={(e) => setAssignSel(e.target.value)}
              disabled={assignNumberMut.isPending}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">— Unassign (Available) —</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {(u.fullName || u.email || `User ${u.id}`) + (u.senderPhone ? ` · ${u.senderPhone}` : '')}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Provisions the member&apos;s extension caller-ID, sub-account keycard, and inbound route via the same engine the owner uses. Reassigning moves the number from its current owner.
          </p>
          {assignNumberMut.isError && (
            <p className="mt-3 text-xs font-semibold text-red-600">
              {(assignNumberMut.error as Error)?.message || 'Assignment failed.'}
            </p>
          )}
        </Modal>
      )}
      {manageMember && (
        <MemberAdminDrawer
          member={manageMember}
          orgId={orgId}
          onClose={() => setManageMember(null)}
          onChanged={() => refreshOrgData()}
        />
      )}
      {editOpen && (
        <EditOrgModal
          org={{ id: orgId, name: org.name, slug: org.slug, maxUsers: org.maxUsers, maxPhoneNumbers: org.maxPhoneNumbers }}
          onClose={() => setEditOpen(false)}
        />
      )}
      {resetOrgOpen && (
        <ResetOrgModal
          org={{ id: orgId, name: org.name }}
          onClose={() => setResetOrgOpen(false)}
        />
      )}

      <Tabs<TabKey>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'users', label: <>Users <span className="text-slate-400">{org.userCount ?? users.length}</span></> },
          { key: 'numbers', label: <>Numbers <span className="text-slate-400">{org.numberCount ?? 0}</span></> },
          { key: 'usage', label: 'Usage' },
          { key: 'services', label: 'Services' },
          { key: 'infrastructure', label: 'Infrastructure' },
          { key: 'activity', label: 'Activity' },
        ]}
      />

      {/* Overview */}
      {tab === 'overview' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Metric label="Users" value={<>{org.userCount ?? users.length} <span className="text-slate-400">/ {org.maxUsers}</span></>} sub={`${org.maxUsers} seats`} subTone="off" />
            <Metric label="Phone Numbers" value={<>{org.numberCount ?? 0} <span className="text-slate-400">/ {org.maxPhoneNumbers}</span></>} sub="allocation" subTone="off" />
            <Metric label="Calls (period)" value={(stats?.totalCalls ?? 0).toLocaleString()} sub="connected" />
            <Metric label="SMS (period)" value={(stats?.totalSms ?? 0).toLocaleString()} sub="delivered" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle>Services</SectionTitle>
              {(entitlements.data?.modules ?? []).map((m) => (
                <HealthRow key={m.code} label={m.label}>
                  <StatusDot health={tenant?.modules[m.code] ? 'ok' : 'off'} label={tenant?.modules[m.code] ? 'Enabled' : 'Disabled'} />
                </HealthRow>
              ))}
              {entitlements.isLoading && <div className="py-3 text-sm text-slate-400">Loading services…</div>}
            </Card>
            <Card className="p-5">
              <SectionTitle>Infrastructure health</SectionTitle>
              <HealthRow label="Subscription"><SubscriptionBadge status={org.billingStatus} /></HealthRow>
              <HealthRow label="State"><StatusDot health={org.isActive ? 'ok' : 'off'} label={org.isActive ? 'Active' : 'Inactive'} /></HealthRow>
              <HealthRow label="Inbound gateway / routing"><span className="text-xs text-slate-500">Check in Diagnostics</span></HealthRow>
              <div className="pt-3"><Btn size="sm" onClick={() => router.push(`/admin2/diagnostics?org=${orgId}`)}>Run diagnostics</Btn></div>
            </Card>
          </div>
        </>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">Organization Users</h2>
            <Btn variant="primary" onClick={() => setAddUserOpen(true)}>+ Add User</Btn>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Extension</th>
                    <th className="px-4 py-3">Created At</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {usersLoading ? (
                    [0, 1, 2].map((i) => (
                      <tr key={i} className="animate-pulse">
                        {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        No users in this organization yet.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-4">
                          <div className="font-extrabold">{u.fullName || '—'}</div>
                          <div className="mt-1 text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-4 py-4 capitalize">{u.role}</td>
                        <td className="px-4 py-4">{u.senderPhone || <span className="text-slate-400">Unassigned</span>}</td>
                        <td className="px-4 py-4 font-mono text-xs">{u.extension || '—'}</td>
                        <td className="px-4 py-4 text-xs tabular-nums text-slate-600 dark:text-slate-400">
                          {u.createdAt ? (
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {new Date(u.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {new Date(u.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusDot health={u.banned ? 'bad' : u.isActive ? 'ok' : 'off'} label={u.banned ? 'Banned' : u.isActive ? 'Active' : 'Inactive'} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setManageMember({ id: u.id, fullName: u.fullName, email: u.email, role: u.role })} className="rounded-lg bg-[#FF6542] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">Manage</button>
                            <button type="button" onClick={() => setResetUser({ id: u.id, fullName: u.fullName, email: u.email })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Reset password</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Add User provisions a team member inside this org — auto extension, number assignment, sub keycard, and inbound routing — so they can call out and receive calls immediately.
          </p>
        </div>
      )}

      {/* Numbers */}
      {tab === 'numbers' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">Phone Numbers</h2>
            <Btn variant="primary" onClick={() => setAddNumberOpen(true)}>+ Add Number</Btn>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Metric label="Numbers held" value={<>{numbersQ.data?.length ?? org.numberCount ?? 0} <span className="text-slate-400">/ {org.maxPhoneNumbers}</span></>} sub="allocation" subTone="off" />
            <Metric label="Assigned to users" value={(numbersQ.data ?? []).filter((n) => n.assignedUserId).length} sub="with an agent" subTone="off" />
          </div>

          <Card className="mt-4 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                  <tr><th className="px-4 py-3">Number</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">State</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {numbersQ.isLoading ? (
                    [0, 1].map((i) => <tr key={i} className="animate-pulse">{[0, 1, 2, 3, 4].map((j) => <td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>)}</tr>)
                  ) : (numbersQ.data ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No numbers yet — add one above.</td></tr>
                  ) : (
                    (numbersQ.data ?? []).map((n) => (
                      <tr key={n.id}>
                        <td className="px-4 py-3 font-mono font-bold">{n.phoneNumber}</td>
                        <td className="px-4 py-3">{n.assignedUserName ?? <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Available</span>}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{n.numberType}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-2 text-xs font-bold ${n.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${n.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{n.isActive ? 'Active' : 'Inactive'}</span></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={() => openAssign(n)} className="text-xs font-bold text-[#FF6542] hover:underline">{n.assignedUserId ? 'Reassign' : 'Assign'}</button>
                            <button type="button" onClick={() => router.push(`/admin2/diagnostics?number=${n.phoneNumber.replace(/\D/g, '')}`)} className="text-xs font-bold text-[#FF6542] hover:underline">Diagnose →</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Reassign a number or run its full health check from the <button type="button" onClick={() => router.push('/admin2/phone-numbers')} className="font-bold text-[#FF6542] hover:underline">Phone Numbers</button> inventory, or Diagnose directly above.</p>
        </div>
      )}

      {/* Usage */}
      {tab === 'usage' && (
        <div className="space-y-4">
          {/* Date/time range filter for the activity tiles (calls + SMS). */}
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              From
              <input type="date" value={usageFrom} max={usageTo || undefined} onChange={(e) => setUsageFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              To
              <input type="date" value={usageTo} min={usageFrom || undefined} onChange={(e) => setUsageTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>
            <div className="flex gap-1.5">
              <Btn size="sm" onClick={() => setUsagePreset(7)}>7d</Btn>
              <Btn size="sm" onClick={() => setUsagePreset(30)}>30d</Btn>
              <Btn size="sm" onClick={() => setUsagePreset(90)}>90d</Btn>
              {usageRanged && <Btn size="sm" onClick={() => { setUsageFrom(''); setUsageTo(''); }}>Clear</Btn>}
            </div>
            <span className="ml-auto text-xs font-semibold text-slate-400">
              {usageStatsQ.isFetching ? 'Updating…' : usageRanged ? 'Filtered' : 'All time'}
            </span>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total users" value={(stats?.totalUsers ?? org.userCount ?? 0).toLocaleString()} sub={`${stats?.activeUsers ?? 0} active`} />
            <Metric label="Calls" value={(usageStats?.totalCalls ?? 0).toLocaleString()} sub={usageRanged ? 'in range' : 'all time'} subTone="off" />
            <Metric label="SMS" value={(usageStats?.totalSms ?? 0).toLocaleString()} sub={usageRanged ? 'in range' : 'all time'} subTone="off" />
            <Metric label="Recordings" value={(usageStats?.recordingCount ?? 0).toLocaleString()} sub={usageRanged ? 'in range' : 'all time'} subTone="off" />
          </div>
          {/* One billing cycle for all admin-set limits — shown once, above the cards. */}
          <BillingCycleBanner orgId={orgId} />
          {/* Trial ↔ Live: lifts/re-applies the trial caps. Sits above the counters
              because it decides which tier (and thus which caps) they reflect. */}
          <AccountStatusCard orgId={orgId} />
          {/* Plan (upgrade now / schedule downgrade) — sits with Account status since
              both set the tier the counters below reflect. */}
          <PlanCard orgId={orgId} />
          {/* Custom plan editor — renders only for orgs on the super-admin-built
              custom plan (price/seats/devices/SMS/included numbers). */}
          {/* Custom plan — collapsed (the full form open inline cluttered the tab).
              One control opens the SAME CustomPlanCard (SSOT) in a focused modal. */}
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Custom plan</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Set this customer’s own price, seats, devices and numbers.
              </div>
            </div>
            <Btn size="sm" onClick={() => setPlanEditorOpen(true)}>Change plan</Btn>
          </Card>
          {/* Live usage counters (current period, always): call-minute fair-use cap
              + management, and the SMS allowance counter (shared by all org users). */}
          <div className="grid gap-4 lg:grid-cols-2">
            <OrgCallUsagePanel orgId={orgId} />
            <SmsCapCounter orgId={orgId} />
          </div>
          {/* Sales-assisted Custom SMS Addons (one-time / recurring pool additions) */}
          <SmsAddonManagerCard orgId={orgId} />
          {/* Org-wide SMS package: assign / switch / remove (metered orgs). */}
          <SmsPackageCard orgId={orgId} />
          {/* Super-admin billing controls: anchor override + trial caps. */}
          <BillingControlsCard orgId={orgId} />
          {/* Subscription status + cancel/reactivate. */}
          <SubscriptionCard orgId={orgId} />
          {/* Recent Stripe invoices (read-only). */}
          <InvoicesCard orgId={orgId} />
        </div>
      )}

      {/* Services (entitlements) */}
      {tab === 'services' && (
        <div className="max-w-2xl">
          <SectionTitle>Enabled services (tenant modules)</SectionTitle>
          {entitlements.isError ? (
            <ErrorState>Could not load entitlements.</ErrorState>
          ) : entitlements.isLoading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => (<div key={i} className="h-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />))}</div>
          ) : (
            <>
              {(entitlements.data?.modules ?? []).map((m) => (
                <ToggleRow
                  key={m.code}
                  title={m.label}
                  description={<>Module <span className="font-mono">{m.code}</span> — cascades to everyone in this org.</>}
                  checked={!!tenant?.modules[m.code]}
                  disabled={setModule.isPending}
                  onChange={(v) => setModule.mutate({ module: m.code, enabled: v })}
                />
              ))}
              {setModule.isError && <p className="mt-2 text-sm font-semibold text-red-600">Failed to update — try again.</p>}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Changes apply immediately (saved per toggle).</p>
            </>
          )}
        </div>
      )}

      {/* Infrastructure */}
      {tab === 'infrastructure' && (
        <InfrastructureTab orgId={orgId} billingStatus={org.billingStatus ?? 'active'} isActive={org.isActive} />
      )}

      {/* Activity */}
      {tab === 'activity' && <ActivityTab orgId={orgId} />}
    </section>
  );
}
