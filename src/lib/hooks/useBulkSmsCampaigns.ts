'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bulkSmsCampaignService,
  type BulkSmsCampaignQueryParams,
  type CreateBulkSmsCampaignRequest,
  type UpdateBulkSmsCampaignRequest,
} from '@/lib/api/services/bulk-sms-campaign.service';

export const bulkSmsCampaignKeys = {
  all: ['bulk-sms-campaigns'] as const,
  list: (params: BulkSmsCampaignQueryParams) =>
    [...bulkSmsCampaignKeys.all, 'list', params] as const,
  detail: (id: number) => [...bulkSmsCampaignKeys.all, 'detail', id] as const,
  recipients: (id: number, page: number) =>
    [...bulkSmsCampaignKeys.all, 'recipients', id, page] as const,
};

/** Paginated campaign history. */
export function useBulkSmsCampaigns(params: BulkSmsCampaignQueryParams = {}) {
  return useQuery({
    queryKey: bulkSmsCampaignKeys.list(params),
    queryFn: () => bulkSmsCampaignService.list(params),
    staleTime: 15_000,
  });
}

/** Create a campaign record when a run starts. */
export function useCreateBulkSmsCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBulkSmsCampaignRequest) => bulkSmsCampaignService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkSmsCampaignKeys.all });
    },
  });
}

/** Patch a campaign's status / counts. */
export function useUpdateBulkSmsCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBulkSmsCampaignRequest }) =>
      bulkSmsCampaignService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkSmsCampaignKeys.all });
    },
  });
}

/** A single campaign by id (used for deep-linking from a chat's attribution). */
export function useBulkSmsCampaign(id: number | null) {
  return useQuery({
    queryKey: bulkSmsCampaignKeys.detail(id ?? 0),
    queryFn: () => bulkSmsCampaignService.get(id as number),
    enabled: id != null,
    staleTime: 15_000,
  });
}

/** A campaign's recipient roster (delivery status + replied), paginated. */
export function useBulkSmsCampaignRecipients(id: number | null, page = 1) {
  return useQuery({
    queryKey: bulkSmsCampaignKeys.recipients(id ?? 0, page),
    queryFn: () => bulkSmsCampaignService.getRecipients(id as number, { page }),
    enabled: id != null,
    staleTime: 15_000,
  });
}

/** Delete a campaign from history. */
export function useDeleteBulkSmsCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => bulkSmsCampaignService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkSmsCampaignKeys.all });
    },
  });
}
