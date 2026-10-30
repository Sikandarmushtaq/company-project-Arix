'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  autoReplyService,
  type UpsertAutoReplyRequest,
} from '@/lib/api/services/auto-reply.service';

export const autoReplyKeys = {
  all: ['auto-reply'] as const,
  byNumber: (phone: string) => [...autoReplyKeys.all, phone] as const,
};

export function useAutoReplySettings(phone: string | null) {
  return useQuery({
    queryKey: autoReplyKeys.byNumber(phone ?? ''),
    queryFn: () => autoReplyService.get(phone as string),
    enabled: !!phone,
    staleTime: 15_000,
  });
}

export function useUpsertAutoReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, data }: { phone: string; data: UpsertAutoReplyRequest }) =>
      autoReplyService.upsert(phone, data),
    onSuccess: (_res, vars) =>
      qc.invalidateQueries({ queryKey: autoReplyKeys.byNumber(vars.phone) }),
  });
}
