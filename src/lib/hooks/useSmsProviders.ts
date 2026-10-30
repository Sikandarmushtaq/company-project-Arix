/**
 * SMS Provider Hooks
 * React Query hooks for SMS provider management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/lib/api/services/admin.service';
import { toast } from '@/lib/stores/toast';

const providerKeys = {
  all: ['sms-providers'] as const,
  list: () => [...providerKeys.all, 'list'] as const,
};

export function useSmsProviders() {
  return useQuery({
    queryKey: providerKeys.list(),
    queryFn: () => adminService.getSmsProviders(),
    staleTime: 30 * 1000,
  });
}

export function useUpsertSmsProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      type,
      data,
    }: {
      type: 'standard' | 'auto';
      data: { displayName: string; twilioAccountSid: string; twilioAuthToken: string };
    }) => adminService.upsertSmsProvider(type, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.list() });
      toast.success('SMS provider saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save SMS provider');
    },
  });
}

export function useToggleSmsProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, enabled }: { type: 'standard' | 'auto'; enabled: boolean }) =>
      adminService.toggleSmsProvider(type, enabled),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.list() });
      toast.success(`SMS provider ${variables.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to toggle SMS provider');
    },
  });
}
