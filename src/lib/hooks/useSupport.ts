'use client';

/**
 * Support chat React Query hooks + key factory.
 *
 * @module lib/hooks/useSupport
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi, type SupportTicketStatus, type DutyState } from '@/lib/api/services/support.api';

export const supportKeys = {
  all: ['support'] as const,
  myTicket: () => [...supportKeys.all, 'my-ticket'] as const,
  myMessages: (id: number) => [...supportKeys.all, 'my-messages', id] as const,
  adminTickets: (status?: string) =>
    status
      ? ([...supportKeys.all, 'admin-tickets', status] as const)
      : ([...supportKeys.all, 'admin-tickets'] as const),
  adminMessages: (id: number) => [...supportKeys.all, 'admin-messages', id] as const,
  superAdmins: () => [...supportKeys.all, 'super-admins'] as const,
};

// ---- USER ------------------------------------------------------------------

export function useMyTicket() {
  return useQuery({
    queryKey: supportKeys.myTicket(),
    queryFn: () => supportApi.getMyTicket(),
    staleTime: 10_000,
  });
}

export function useMyMessages(ticketId: number | null | undefined) {
  return useQuery({
    queryKey: supportKeys.myMessages(ticketId ?? 0),
    queryFn: () => supportApi.getMyMessages(ticketId as number),
    enabled: !!ticketId,
    staleTime: 5_000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => supportApi.createTicket(message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supportKeys.myTicket() });
    },
  });
}

export function useSendMyMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: number; body: string }) =>
      supportApi.sendMyMessage(ticketId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: supportKeys.myMessages(vars.ticketId) });
      qc.invalidateQueries({ queryKey: supportKeys.myTicket() });
    },
  });
}

export function useDuty() {
  return useQuery({
    queryKey: [...supportKeys.all, 'duty'] as const,
    queryFn: () => supportApi.getDuty(),
    staleTime: 30_000,
  });
}

export function useSetDuty() {
  const qc = useQueryClient();
  const key = [...supportKeys.all, 'duty'] as const;
  return useMutation({
    mutationFn: (onDuty: boolean) => supportApi.setDuty(onDuty),
    // Optimistic: flip my state instantly; the server response then corrects the
    // authoritative on-duty count. Roll back if the request fails.
    onMutate: async (onDuty) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DutyState>(key);
      qc.setQueryData<DutyState>(key, (old) => (old ? { ...old, onDuty } : old));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}

export function useCloseMyTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number) => supportApi.closeMyTicket(ticketId),
    onSuccess: (ticket) => qc.setQueryData(supportKeys.myTicket(), ticket),
  });
}

export function useRequestCallback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, email }: { ticketId: number; email?: string }) =>
      supportApi.requestCallback(ticketId, email),
    // The response is the fresh ticket (with callbackEmail/callbackRequestedAt);
    // write it straight into the myTicket cache so the UI flips to confirmed.
    onSuccess: (ticket) => {
      qc.setQueryData(supportKeys.myTicket(), ticket);
    },
  });
}

export function useMarkMyRead() {
  return useMutation({ mutationFn: (ticketId: number) => supportApi.markMyRead(ticketId) });
}

export function useUploadMyAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) =>
      supportApi.uploadMyAttachment(file, caption),
    onSuccess: (data) => {
      if (data?.ticket?.id) {
        qc.invalidateQueries({ queryKey: supportKeys.myMessages(data.ticket.id) });
      }
      qc.invalidateQueries({ queryKey: supportKeys.myTicket() });
    },
  });
}

// ---- SUPER-ADMIN -----------------------------------------------------------

export function useAdminTickets(status: SupportTicketStatus | 'all' = 'open') {
  return useQuery({
    queryKey: supportKeys.adminTickets(status),
    queryFn: () => supportApi.listTickets(status),
    staleTime: 5_000,
  });
}

export function useAdminMessages(ticketId: number | null | undefined) {
  return useQuery({
    queryKey: supportKeys.adminMessages(ticketId ?? 0),
    queryFn: () => supportApi.getAdminMessages(ticketId as number),
    enabled: !!ticketId,
    staleTime: 5_000,
  });
}

export function useSuperAdmins() {
  return useQuery({
    queryKey: supportKeys.superAdmins(),
    queryFn: () => supportApi.listSuperAdmins(),
    staleTime: 60_000,
  });
}

export function useClaimTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number) => supportApi.claim(ticketId),
    onSuccess: () => qc.invalidateQueries({ queryKey: supportKeys.adminTickets() }),
  });
}

export function useAdminReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: number; body: string }) =>
      supportApi.adminReply(ticketId, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: supportKeys.adminMessages(vars.ticketId) });
      qc.invalidateQueries({ queryKey: supportKeys.adminTickets() });
    },
  });
}

export function useMarkAdminRead() {
  return useMutation({ mutationFn: (ticketId: number) => supportApi.markAdminRead(ticketId) });
}

export function useUploadAdminAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, file, caption }: { ticketId: number; file: File; caption?: string }) =>
      supportApi.uploadAdminAttachment(ticketId, file, caption),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: supportKeys.adminMessages(vars.ticketId) });
      qc.invalidateQueries({ queryKey: supportKeys.adminTickets() });
    },
  });
}

export function useTransferTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, toAdminId }: { ticketId: number; toAdminId: number }) =>
      supportApi.transfer(ticketId, toAdminId),
    onSuccess: () => qc.invalidateQueries({ queryKey: supportKeys.adminTickets() }),
  });
}

export function useCloseTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number) => supportApi.close(ticketId),
    onSuccess: () => qc.invalidateQueries({ queryKey: supportKeys.adminTickets() }),
  });
}
