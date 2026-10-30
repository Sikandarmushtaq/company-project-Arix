'use client';

/**
 * Admin Global WhatsApp Numbers Manager.
 *
 * Platform-wide WhatsApp numbers management for super-admins only.
 * Manages global number syncing and assignment across all organizations.
 *
 * This is completely separate from per-org number management.
 * Extracted for consistency with the component architecture.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiRefreshCw, FiPhone } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { StyledSelect } from '@/components/ui';
import { whatsappAdminService } from '@/lib/api/services/whatsapp.service';
import { adminService } from '@/lib/api/services/admin.service';
import type { WaNumber } from '@/lib/api/services/whatsapp-types';
import { toast } from 'sonner';

function getQualityColor(rating: string | null): string {
  switch (rating?.toUpperCase()) {
    case 'GREEN':
      return 'bg-green-500/20 text-green-400';
    case 'YELLOW':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'RED':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function AdminGlobalNumbersManager() {
  const queryClient = useQueryClient();
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const { data: numbers, isLoading } = useQuery({
    queryKey: ['wa-numbers'],
    queryFn: () => whatsappAdminService.getNumbers(),
    staleTime: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const response = await adminService.getUsers({ page: 1, limit: 1000 });
      return response.users;
    },
    staleTime: 60000,
  });

  const syncMutation = useMutation({
    mutationFn: () => whatsappAdminService.syncNumbers(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wa-numbers'] });
      toast.success(`Synced ${result.count} number(s) from Meta`);
    },
    onError: (err) => {
      toast.error(`Failed to sync: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ numberId, userId }: { numberId: number; userId: number | null }) =>
      whatsappAdminService.assignNumber(numberId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-numbers'] });
      toast.success('Number assignment updated');
      setAssigningId(null);
    },
    onError: () => {
      toast.error('Failed to assign number');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaWhatsapp className="text-green-500" />
            Global WhatsApp Numbers
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Platform-wide WhatsApp Business numbers management (legacy global system)
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <FiRefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync from Meta'}
        </button>
      </div>

      {/* Numbers Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
        </div>
      ) : !numbers || numbers.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <FiPhone className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-3" />
          <h3 className="text-lg font-semibold mb-1">No WhatsApp numbers found</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Click &quot;Sync from Meta&quot; to import your registered WhatsApp numbers.
          </p>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Sync from Meta
          </button>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                  <th className="px-4 py-3 text-left">Phone Number</th>
                  <th className="px-4 py-3 text-left">Verified Name</th>
                  <th className="px-4 py-3 text-center">Quality</th>
                  <th className="px-4 py-3 text-center">Messaging Limit</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((num) => (
                  <tr
                    key={num.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--background)]/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FaWhatsapp className="w-4 h-4 text-green-500" />
                        <div>
                          <div className="font-medium">{num.displayPhone}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            ID: {num.waPhoneNumberId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{num.verifiedName || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getQualityColor(num.qualityRating)}`}
                      >
                        {num.qualityRating || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs">{num.messagingLimitTier || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {num.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StyledSelect
                        value={num.assignedUserId ? String(num.assignedUserId) : ''}
                        onChange={(v) => {
                          const userId = v ? Number(v) : null;
                          assignMutation.mutate({ numberId: num.id, userId });
                        }}
                        className="bg-[var(--background)] min-w-[150px] w-auto"
                      >
                        <option value="">Unassigned</option>
                        {users?.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName || u.email} {u.senderPhone ? `(${u.senderPhone})` : ''}
                          </option>
                        ))}
                      </StyledSelect>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">How it works</h2>
        <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">1.</span>
            Click <span className="text-[var(--foreground)]">Sync from Meta</span> to import your
            registered WhatsApp Business numbers
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">2.</span>
            Assign each number to a user using the dropdown — that user will be able to send and
            receive WhatsApp messages
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">3.</span>
            Make sure the user also has <span className="text-[var(--foreground)]">
              WA Enabled
            </span>{' '}
            turned on in user management
          </li>
        </ul>
      </div>

      {/* Legacy Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FiPhone className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-amber-400">Legacy Global Numbers</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              This is the legacy platform-wide WhatsApp numbers management. Organizations now have
              per-org number management that takes precedence. This interface serves as fallback and
              cross-org oversight for super-admins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
