import React from 'react';
import { FiCheck, FiInfo, FiSliders, FiShield, FiPhoneCall, FiRadio } from 'react-icons/fi';
import { ManagerPermissions, OrganizationConfig, DEFAULT_MANAGER_PERMISSIONS } from './types';
import { Toggle } from '@/components/ui';

interface ManagerAccessEditorProps {
  mode: 'standard' | 'custom';
  permissions: ManagerPermissions;
  onModeChange: (mode: 'standard' | 'custom') => void;
  onPermissionChange: (key: keyof ManagerPermissions, value: boolean) => void;
  organization: OrganizationConfig;
}

export function ManagerAccessEditor({
  mode,
  permissions,
  onModeChange,
  onPermissionChange,
  organization,
}: ManagerAccessEditorProps) {
  const recordingsModuleEnabled = organization.enabledModules.recordings;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
          <FiShield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Manager Access
        </h4>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Choose what this Manager can monitor or manage. This does not make them an Organization Owner.
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onModeChange('standard')}
          className={`flex flex-col text-left p-3 rounded-xl border transition-all ${mode === 'standard'
            ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm ring-1 ring-blue-500'
            : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)]">Standard Manager</span>
            {mode === 'standard' && <FiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
            Default oversight access: live calls, recordings, analytics, and operational tools.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('custom')}
          className={`flex flex-col text-left p-3 rounded-xl border transition-all ${mode === 'custom'
            ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm ring-1 ring-blue-500'
            : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--foreground)]/30'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--foreground)]">Custom Access</span>
            <FiSliders className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
            Customize specific monitoring, recording, or operations permissions individually.
          </p>
        </button>
      </div>

      {/* Standard Manager Summary Card */}
      {mode === 'standard' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3.5 text-xs space-y-2">
          <div className="font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <FiCheck className="w-4 h-4 text-emerald-500" />
            Standard Manager Permissions:
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[var(--muted-foreground)] pl-1">
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Monitoring: Dashboard, Live Calls, Analytics</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Operations: Active User Sessions</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Recording &amp; QA: Team Call Recordings</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Workspace: Full Softphone Dialer Access</span>
            </li>
          </ul>
        </div>
      )}

      {/* Custom Access Grouped Toggles */}
      {mode === 'custom' && (
        <div className="space-y-4 pt-1">
          {/* Group 1: Monitoring */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Monitoring
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
              <PermissionRow
                label="Dashboard"
                description="View administrative overview and tenant activity summary"
                checked={permissions.dashboard}
                onChange={(checked) => onPermissionChange('dashboard', checked)}
              />
              <PermissionRow
                label="Live Calls"
                description="Real-time call oversight and live listening/whisper capabilities"
                checked={permissions.liveCalls}
                onChange={(checked) => onPermissionChange('liveCalls', checked)}
              />
              <PermissionRow
                label="Analytics"
                description="View call volume, SMS traffic, and agent performance reports"
                checked={permissions.analytics}
                onChange={(checked) => onPermissionChange('analytics', checked)}
              />
            </div>
          </div>

          {/* Group 2: Team Operations */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Team Operations
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
              <PermissionRow
                label="Sessions"
                description="View active user logins and disconnect stalled sessions"
                checked={permissions.sessions}
                onChange={(checked) => onPermissionChange('sessions', checked)}
              />
              <PermissionRow
                label="Call Groups"
                description="Manage ring groups, rollover strategies, and team ringing queues"
                checked={permissions.callGroups}
                onChange={(checked) => onPermissionChange('callGroups', checked)}
              />
            </div>
          </div>

          {/* Group 3: Recording & QA */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Recording &amp; QA
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
              <PermissionRow
                label="Recordings"
                description="Listen to and inspect all organization call recordings"
                checked={recordingsModuleEnabled && permissions.recordings}
                disabled={!recordingsModuleEnabled}
                disabledReason={!recordingsModuleEnabled ? 'Recordings module not enabled for organization' : undefined}
                onChange={(checked) => onPermissionChange('recordings', checked)}
              />
              <PermissionRow
                label="Voicemail Audit"
                description="Review flagged voicemail dispositions and QA discrepancies"
                checked={permissions.voicemailAudit}
                onChange={(checked) => onPermissionChange('voicemailAudit', checked)}
              />
              <PermissionRow
                label="Delete Recordings"
                description="Permanently delete recorded calls (requires Recordings enabled)"
                checked={recordingsModuleEnabled && permissions.recordings && permissions.deleteRecordings}
                disabled={!recordingsModuleEnabled || !permissions.recordings}
                disabledReason={
                  !recordingsModuleEnabled
                    ? 'Recordings module not enabled'
                    : !permissions.recordings
                      ? 'Requires Recordings permission to be enabled'
                      : undefined
                }
                onChange={(checked) => onPermissionChange('deleteRecordings', checked)}
              />
            </div>
          </div>

          {/* Group 4: Workspace */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Workspace Access
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <PermissionRow
                label="Dialer Access"
                description="Permit softphone usage. If disabled, manager operates admin tools only"
                checked={permissions.dialerAccess}
                onChange={(checked) => onPermissionChange('dialerAccess', checked)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionRow({
  label,
  description,
  checked,
  disabled = false,
  disabledReason,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={`p-3 flex items-start justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0 pr-2">
        <div className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
          <span>{label}</span>
          {disabledReason && (
            <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
              ({disabledReason})
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        size="sm"
        aria-label={`Toggle ${label} permission`}
      />
    </div>
  );
}
