'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  smsTemplateService,
  type CreateSmsTemplateRequest,
  type UpdateSmsTemplateRequest,
} from '@/lib/api/services/sms-template.service';

export const smsTemplateKeys = {
  all: ['sms-templates'] as const,
  list: () => [...smsTemplateKeys.all, 'list'] as const,
};

/** The org's saved SMS templates. */
export function useSmsTemplates(enabled = true) {
  return useQuery({
    queryKey: smsTemplateKeys.list(),
    queryFn: () => smsTemplateService.list(),
    staleTime: 30_000,
    enabled,
  });
}

export function useCreateSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSmsTemplateRequest) => smsTemplateService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsTemplateKeys.all }),
  });
}

export function useUpdateSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSmsTemplateRequest }) =>
      smsTemplateService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsTemplateKeys.all }),
  });
}

export function useDeleteSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => smsTemplateService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsTemplateKeys.all }),
  });
}
