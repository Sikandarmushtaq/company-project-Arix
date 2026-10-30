/**
 * Call Disposition Hooks
 *
 * React Query hooks for the post-call outcome picker.
 *
 * @module lib/hooks/useCallDisposition
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callDispositionService, type SetDispositionRequest } from '@/lib/api';

export const dispositionKeys = {
  catalog: ['call-dispositions', 'catalog'] as const,
  audit: ['call-dispositions', 'audit'] as const,
  list: ['call-dispositions', 'list'] as const,
  settings: ['call-dispositions', 'settings'] as const,
};

/** The outcome catalog + QA thresholds (rarely changes → cached). */
export function useDispositionCatalog() {
  return useQuery({
    queryKey: dispositionKeys.catalog,
    queryFn: () => callDispositionService.getCatalog(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Submit an agent's outcome for a call. */
export function useSetDisposition() {
  return useMutation({
    mutationFn: ({ callId, body }: { callId: number; body: SetDispositionRequest }) =>
      callDispositionService.setDisposition(callId, body),
  });
}

/** Feature B — "Leave Voicemail & Drop": record the voicemail outcome. */
export function useVoicemailDrop() {
  return useMutation({
    mutationFn: ({ callId, clientDurationSecs }: { callId: number; clientDurationSecs?: number }) =>
      callDispositionService.dropVoicemail(callId, { clientDurationSecs }),
  });
}

/** The tenant QA settings (owner/admin only). */
export function useQaSettings() {
  return useQuery({
    queryKey: dispositionKeys.settings,
    queryFn: () => callDispositionService.getSettings(),
  });
}

export function useSaveQaSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      voicemailAuditThresholdSecs: number;
      voicemailLockoutThresholdSecs: number;
    }) => callDispositionService.saveSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(dispositionKeys.settings, data);
      // The catalog carries settings too (used by the disposition modal gate).
      queryClient.invalidateQueries({ queryKey: dispositionKeys.catalog });
    },
  });
}

/** The audit queue — flagged voicemails (manager/owner/admin only). */
export function useAuditQueue(page = 1, limit = 25) {
  return useQuery({
    queryKey: [...dispositionKeys.audit, page, limit],
    queryFn: () => callDispositionService.getAudit({ page, limit }),
  });
}

/** All dispositions with optional outcome/flagged/date/agent filters (oversight only). */
export function useDispositions(params: {
  page?: number;
  limit?: number;
  outcome?: string;
  flagged?: boolean;
  from?: string;
  to?: string;
  agentUserId?: number;
}) {
  return useQuery({
    queryKey: [...dispositionKeys.list, params],
    queryFn: () => callDispositionService.listDispositions(params),
  });
}
