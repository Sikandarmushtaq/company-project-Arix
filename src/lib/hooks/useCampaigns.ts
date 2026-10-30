'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  autodialerService,
  type Campaign,
  type CampaignStats,
  type CampaignQueryParams,
  type AiAgent,
  type AiAgentStatus,
  type AiCall,
  type AiCallStatus,
  type AiCallMessage,
  type DncEntry,
  type CreateAgentRequest,
  type UpdateAgentRequest,
  type AiVoice,
} from '@/lib/api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';

// Query keys
export const campaignsKeys = {
  all: ['campaigns'] as const,
  list: () => [...campaignsKeys.all, 'list'] as const,
  listPaginated: (params: CampaignQueryParams) => [...campaignsKeys.all, 'list', params] as const,
  detail: (id: number) => [...campaignsKeys.all, 'detail', id] as const,
  stats: (id: number) => [...campaignsKeys.all, 'stats', id] as const,
};

/**
 * Hook to fetch campaigns with pagination
 * Uses real-time config - data updated via WebSocket events
 */
export function useCampaignsPaginated(params: CampaignQueryParams = {}) {
  return useQuery({
    queryKey: campaignsKeys.listPaginated(params),
    queryFn: () => autodialerService.getCampaignsPaginated(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch all campaigns (legacy - no pagination)
 * @deprecated Use useCampaignsPaginated for better performance
 */
export function useCampaigns() {
  return useQuery({
    queryKey: campaignsKeys.list(),
    queryFn: async () => {
      const result = await autodialerService.getCampaigns();
      return result.campaigns;
    },
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch campaign stats
 * Uses real-time config - stats updated via WebSocket CAMPAIGN_STATS event
 */
export function useCampaignStats(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: campaignsKeys.stats(campaignId),
    queryFn: () => autodialerService.getCampaignStats(campaignId),
    enabled,
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to fetch stats for all campaigns
 * Uses real-time config - stats updated via WebSocket CAMPAIGN_STATS event
 */
export function useAllCampaignStats(campaignIds: number[]) {
  return useQuery({
    queryKey: [...campaignsKeys.all, 'all-stats', campaignIds],
    queryFn: async () => {
      const statsPromises = campaignIds.map(async (id) => {
        try {
          const stats = await autodialerService.getCampaignStats(id);
          return { id, stats };
        } catch {
          return { id, stats: null };
        }
      });

      const results = await Promise.all(statsPromises);
      const statsMap: Record<number, CampaignStats> = {};
      results.forEach(({ id, stats }) => {
        if (stats) statsMap[id] = stats;
      });
      return statsMap;
    },
    enabled: campaignIds.length > 0,
    ...REALTIME_QUERY_CONFIG,
  });
}

/**
 * Hook to create a campaign
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof autodialerService.createCampaign>[0]) =>
      autodialerService.createCampaign(data),
    onSuccess: (newCampaign) => {
      // Add to cache with duplicate prevention
      // (WebSocket event might have already added this campaign)
      queryClient.setQueryData<Campaign[]>(campaignsKeys.list(), (old) => {
        if (!old) return [newCampaign];
        const exists = old.some((c) => c.id === newCampaign.id);
        if (exists) {
          return old.map((c) => (c.id === newCampaign.id ? newCampaign : c));
        }
        return [newCampaign, ...old];
      });
    },
  });
}

/**
 * Hook to start a campaign
 */
export function useStartCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => autodialerService.startCampaign(id),
    onSuccess: (updatedCampaign) => {
      queryClient.setQueryData<Campaign[]>(campaignsKeys.list(), (old) =>
        old?.map((c) => (c.id === updatedCampaign.id ? updatedCampaign : c))
      );
    },
    onSettled: (_data, _error, id) => {
      queryClient.invalidateQueries({ queryKey: campaignsKeys.stats(id) });
    },
  });
}

/**
 * Hook to pause a campaign
 */
export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => autodialerService.pauseCampaign(id),
    onSuccess: (updatedCampaign) => {
      queryClient.setQueryData<Campaign[]>(campaignsKeys.list(), (old) =>
        old?.map((c) => (c.id === updatedCampaign.id ? updatedCampaign : c))
      );
    },
  });
}

/**
 * Hook to resume a campaign
 */
export function useResumeCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => autodialerService.resumeCampaign(id),
    onSuccess: (updatedCampaign) => {
      queryClient.setQueryData<Campaign[]>(campaignsKeys.list(), (old) =>
        old?.map((c) => (c.id === updatedCampaign.id ? updatedCampaign : c))
      );
    },
  });
}

/**
 * Hook to stop a campaign
 */
export function useStopCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => autodialerService.stopCampaign(id),
    onSuccess: (updatedCampaign) => {
      queryClient.setQueryData<Campaign[]>(campaignsKeys.list(), (old) =>
        old?.map((c) => (c.id === updatedCampaign.id ? updatedCampaign : c))
      );
    },
  });
}

/**
 * Hook to delete a campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => autodialerService.deleteCampaign(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: campaignsKeys.list() });

      const previousCampaigns = queryClient.getQueryData<Campaign[]>(campaignsKeys.list());

      queryClient.setQueryData<Campaign[]>(campaignsKeys.list(), (old) =>
        old?.filter((c) => c.id !== id)
      );

      return { previousCampaigns };
    },
    onError: (_err, _id, context) => {
      if (context?.previousCampaigns) {
        queryClient.setQueryData(campaignsKeys.list(), context.previousCampaigns);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: campaignsKeys.list() });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  AI AGENTS
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  VOICES
// ═══════════════════════════════════════════════════════════════════════

export const voiceKeys = {
  all: ['voices'] as const,
};

export function useVoices() {
  return useQuery({
    queryKey: voiceKeys.all,
    queryFn: () => autodialerService.getVoices(),
    staleTime: 5 * 60 * 1000, // voices don't change often — cache 5 min
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  AI AGENTS
// ═══════════════════════════════════════════════════════════════════════

export const agentKeys = {
  all: ['ai-agents'] as const,
  list: (params?: { page?: number; limit?: number; status?: AiAgentStatus }) =>
    [...agentKeys.all, 'list', params] as const,
  detail: (id: number) => [...agentKeys.all, 'detail', id] as const,
};

export function useAgents(params?: { page?: number; limit?: number; status?: AiAgentStatus }) {
  return useQuery({
    queryKey: agentKeys.list(params),
    queryFn: () => autodialerService.getAgents(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useAgent(agentId: number, enabled = true) {
  return useQuery({
    queryKey: agentKeys.detail(agentId),
    queryFn: () => autodialerService.getAgent(agentId),
    enabled,
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentRequest) => autodialerService.createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: number; data: UpdateAgentRequest }) =>
      autodialerService.updateAgent(agentId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(agentKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: number) => autodialerService.deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  AI CALLS
// ═══════════════════════════════════════════════════════════════════════

export const aiCallKeys = {
  all: ['ai-calls'] as const,
  byCampaign: (
    campaignId: number,
    params?: { page?: number; limit?: number; status?: AiCallStatus }
  ) => [...aiCallKeys.all, 'campaign', campaignId, params] as const,
  detail: (callId: number) => [...aiCallKeys.all, 'detail', callId] as const,
  transcript: (callId: number) => [...aiCallKeys.all, 'transcript', callId] as const,
};

export function useAiCalls(
  campaignId: number,
  params?: { page?: number; limit?: number; status?: AiCallStatus }
) {
  return useQuery({
    queryKey: aiCallKeys.byCampaign(campaignId, params),
    queryFn: () => autodialerService.getAiCalls(campaignId, params),
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useAiCall(callId: number, enabled = true) {
  return useQuery({
    queryKey: aiCallKeys.detail(callId),
    queryFn: () => autodialerService.getAiCall(callId),
    enabled,
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useAiCallTranscript(callId: number, enabled = true) {
  return useQuery({
    queryKey: aiCallKeys.transcript(callId),
    queryFn: () => autodialerService.getAiCallTranscript(callId),
    enabled,
    ...REALTIME_QUERY_CONFIG,
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  DNC (Do Not Call)
// ═══════════════════════════════════════════════════════════════════════

export const dncKeys = {
  all: ['dnc'] as const,
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    [...dncKeys.all, 'list', params] as const,
};

export function useDncList(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: dncKeys.list(params),
    queryFn: () => autodialerService.getDncList(params),
    ...REALTIME_QUERY_CONFIG,
  });
}

export function useAddDnc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phoneNumbers, reason }: { phoneNumbers: string[]; reason?: string }) =>
      autodialerService.addDncEntries(phoneNumbers, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dncKeys.all });
    },
  });
}

export function useRemoveDnc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => autodialerService.removeDncEntries(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dncKeys.all });
    },
  });
}
