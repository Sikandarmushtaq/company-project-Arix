/**
 * CRM Webhook Config Hooks (admin).
 *
 * @module lib/hooks/useCrmWebhook
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmWebhookService, type SaveCrmWebhookInput } from '@/lib/api';

export const crmWebhookKeys = {
  config: ['crm-webhook', 'config'] as const,
};

export function useCrmWebhookConfig() {
  return useQuery({
    queryKey: crmWebhookKeys.config,
    queryFn: () => crmWebhookService.getConfig(),
  });
}

export function useSaveCrmWebhookConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveCrmWebhookInput) => crmWebhookService.saveConfig(input),
    onSuccess: (data) => {
      queryClient.setQueryData(crmWebhookKeys.config, data);
    },
  });
}

export function useGenerateCrmApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => crmWebhookService.generateApiKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmWebhookKeys.config });
    },
  });
}
