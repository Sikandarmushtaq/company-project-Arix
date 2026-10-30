'use client';

import React, { useState } from 'react';
import {
  FiAlertTriangle,
  FiArrowRight,
  FiLoader,
  FiShield,
  FiCheckCircle,
  FiXCircle,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useGenerateFailoverCode, useKamailioFailover, usePostgresFailover } from '@/lib/hooks';
import type { HAClusterState, HAFailoverEvent } from '@/lib/api/services/ha.service';

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatTimeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

interface FailoverDialogProps {
  isOpen: boolean;
  component: 'kamailio' | 'postgresql';
  currentActive: 'primary' | 'secondary';
  targetServer: 'primary' | 'secondary';
  confirmationCode: string;
  onConfirm: (code: string, reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function FailoverDialog({
  isOpen,
  component,
  currentActive,
  targetServer,
  confirmationCode,
  onConfirm,
  onCancel,
  isPending,
}: FailoverDialogProps) {
  const [inputCode, setInputCode] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode === confirmationCode) {
      onConfirm(inputCode, reason);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
              <FiAlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Confirm {component === 'kamailio' ? 'Kamailio' : 'PostgreSQL'} Failover
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                This will switch traffic to the {targetServer} server
              </p>
            </div>
          </div>

          <div className="p-4 mb-4 rounded-lg bg-[var(--muted)]/50">
            <div className="flex items-center justify-between text-sm">
              <div className="text-center">
                <span className="text-[10px] uppercase text-[var(--muted-foreground)] block">
                  Current
                </span>
                <span className="font-mono font-medium uppercase text-[var(--foreground)]">
                  {currentActive}
                </span>
              </div>
              <FiArrowRight className="w-5 h-5 text-[var(--primary)]" />
              <div className="text-center">
                <span className="text-[10px] uppercase text-[var(--muted-foreground)] block">
                  Target
                </span>
                <span className="font-mono font-medium uppercase text-[var(--foreground)]">
                  {targetServer}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Enter confirmation code:
                <span className="ml-2 font-mono text-lg text-[var(--primary)]">
                  {confirmationCode}
                </span>
              </label>
              <Input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="font-mono text-center text-lg tracking-widest"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Reason (optional):
              </label>
              <Input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Scheduled maintenance"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={inputCode !== confirmationCode || isPending}
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Failover'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline last-event indicator
// ---------------------------------------------------------------------------

function LastEventBadge({ event }: { event: HAFailoverEvent }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mt-2 pt-2 border-t border-[var(--border)]/50">
      {event.success ? (
        <FiCheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
      ) : (
        <FiXCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
      )}
      <span className="font-mono uppercase">{event.fromServer}</span>
      <FiArrowRight className="w-2.5 h-2.5" />
      <span className="font-mono uppercase">{event.toServer}</span>
      <span className="ml-auto">{formatTimeAgo(new Date(event.timestamp))}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface FailoverControlPanelProps {
  status: HAClusterState;
  events?: HAFailoverEvent[];
}

export function FailoverControlPanel({ status, events = [] }: FailoverControlPanelProps) {
  const [showKamailioDialog, setShowKamailioDialog] = useState(false);
  const [showPostgresDialog, setShowPostgresDialog] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');

  const generateCode = useGenerateFailoverCode();
  const kamailioFailover = useKamailioFailover();
  const postgresFailover = usePostgresFailover();

  const activeKamailio: 'primary' | 'secondary' =
    status.floatingIP.assignedTo === 'unknown' ? 'primary' : status.floatingIP.assignedTo;
  const inactiveKamailio: 'primary' | 'secondary' =
    activeKamailio === 'primary' ? 'secondary' : 'primary';
  const isKamailioStateUnknown = status.floatingIP.assignedTo === 'unknown';

  const activePostgres =
    status.postgresql.primary.patroniRole === 'leader' ? 'primary' : 'secondary';
  const inactivePostgres = activePostgres === 'primary' ? 'secondary' : 'primary';

  const lastKamailioEvent = events.find((e) => e.component === 'kamailio');
  const lastPostgresEvent = events.find((e) => e.component === 'postgresql');

  const handleKamailioSwitch = async () => {
    try {
      const result = await generateCode.mutateAsync('kamailio');
      setConfirmationCode(result.code);
      setShowKamailioDialog(true);
    } catch {
      // toast handled by hook
    }
  };

  const handlePostgresSwitch = async () => {
    try {
      const result = await generateCode.mutateAsync('postgresql');
      setConfirmationCode(result.code);
      setShowPostgresDialog(true);
    } catch {
      // toast handled by hook
    }
  };

  const handleKamailioConfirm = async (code: string, reason: string) => {
    try {
      await kamailioFailover.mutateAsync({
        target: inactiveKamailio,
        confirmationCode: code,
        reason: reason || undefined,
      });
      setShowKamailioDialog(false);
    } catch {
      // toast handled by hook
    }
  };

  const handlePostgresConfirm = async (code: string, reason: string) => {
    try {
      await postgresFailover.mutateAsync({
        target: inactivePostgres,
        confirmationCode: code,
        reason: reason || undefined,
      });
      setShowPostgresDialog(false);
    } catch {
      // toast handled by hook
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FiShield className="w-4 h-4" />
            Cluster Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Kamailio Control */}
          <div className="p-3 rounded-lg bg-[var(--muted)]/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-[var(--foreground)]">Kamailio SIP Proxy</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${isKamailioStateUnknown ? 'bg-gray-400' : 'bg-green-500'}`}
                  />
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Active:{' '}
                    <span className="font-mono font-medium text-[var(--foreground)] uppercase">
                      {activeKamailio}
                    </span>
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleKamailioSwitch}
                disabled={
                  isKamailioStateUnknown ||
                  generateCode.isPending ||
                  status.kamailio[inactiveKamailio].status !== 'healthy'
                }
                className="text-xs"
              >
                {generateCode.isPending ? (
                  <FiLoader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    Switch to {inactiveKamailio}
                    <FiArrowRight className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
            {lastKamailioEvent && <LastEventBadge event={lastKamailioEvent} />}
          </div>

          {/* PostgreSQL Control */}
          <div className="p-3 rounded-lg bg-[var(--muted)]/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-[var(--foreground)]">PostgreSQL Database</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Leader:{' '}
                    <span className="font-mono font-medium text-[var(--foreground)] uppercase">
                      {activePostgres}
                    </span>
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePostgresSwitch}
                disabled={
                  generateCode.isPending || status.postgresql[inactivePostgres].status !== 'healthy'
                }
                className="text-xs"
              >
                {generateCode.isPending ? (
                  <FiLoader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    Switchover
                    <FiArrowRight className="w-3.5 h-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
            {lastPostgresEvent && <LastEventBadge event={lastPostgresEvent} />}
          </div>

          {/* Rate-limit note */}
          <p className="text-[11px] text-[var(--muted-foreground)] flex items-start gap-1.5">
            <FiAlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Failover requires confirmation code. Rate-limited to once per 5 min per component.
          </p>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <FailoverDialog
        isOpen={showKamailioDialog}
        component="kamailio"
        currentActive={activeKamailio}
        targetServer={inactiveKamailio}
        confirmationCode={confirmationCode}
        onConfirm={handleKamailioConfirm}
        onCancel={() => setShowKamailioDialog(false)}
        isPending={kamailioFailover.isPending}
      />
      <FailoverDialog
        isOpen={showPostgresDialog}
        component="postgresql"
        currentActive={activePostgres}
        targetServer={inactivePostgres}
        confirmationCode={confirmationCode}
        onConfirm={handlePostgresConfirm}
        onCancel={() => setShowPostgresDialog(false)}
        isPending={postgresFailover.isPending}
      />
    </>
  );
}
