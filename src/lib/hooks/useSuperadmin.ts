/**
 * Superadmin React Query Hooks
 * Typed queries/mutations for pricing plans, orders, and SMS reviews.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  superadminApiService,
  type CreatePricingPlanData,
  type UpdatePricingPlanData,
  type PricingPlan,
  type SignupOrder,
  type SmsReview,
  type RevenueStats,
  type SmsReviewStats,
} from '@/lib/api/services/superadmin.service';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const superadminKeys = {
  all: ['superadmin'] as const,
  pricing: ['superadmin', 'pricing'] as const,
  orders: (params?: { page?: number; status?: string; search?: string }) =>
    ['superadmin', 'orders', params] as const,
  order: (id: number) => ['superadmin', 'orders', id] as const,
  revenueStats: ['superadmin', 'revenue-stats'] as const,
  smsReviews: (params?: { status?: string; page?: number }) =>
    ['superadmin', 'sms-reviews', params] as const,
  smsReview: (id: number) => ['superadmin', 'sms-reviews', id] as const,
  smsReviewStats: ['superadmin', 'sms-review-stats'] as const,
};

// ---------------------------------------------------------------------------
// Pricing Plan Hooks
// ---------------------------------------------------------------------------

export function usePricingPlans() {
  return useQuery<PricingPlan[]>({
    queryKey: superadminKeys.pricing,
    queryFn: async () => {
      const res = await superadminApiService.getPricingPlans();
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useCreatePricingPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePricingPlanData) =>
      superadminApiService.createPricingPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superadminKeys.pricing });
    },
  });
}

export function useUpdatePricingPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePricingPlanData }) =>
      superadminApiService.updatePricingPlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superadminKeys.pricing });
    },
  });
}

export function useDeletePricingPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => superadminApiService.deletePricingPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superadminKeys.pricing });
    },
  });
}

// ---------------------------------------------------------------------------
// Order Hooks
// ---------------------------------------------------------------------------

export function useSignupOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: superadminKeys.orders(params),
    queryFn: () => superadminApiService.getOrders(params),
    staleTime: 30_000,
  });
}

export function useSignupOrder(id: number) {
  return useQuery<SignupOrder>({
    queryKey: superadminKeys.order(id),
    queryFn: async () => {
      const res = await superadminApiService.getOrder(id);
      return res.data;
    },
    enabled: id > 0,
    staleTime: 30_000,
  });
}

export function useRevenueStats() {
  return useQuery<RevenueStats>({
    queryKey: superadminKeys.revenueStats,
    queryFn: async () => {
      const res = await superadminApiService.getRevenueStats();
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// SMS Review Hooks
// ---------------------------------------------------------------------------

export function useSmsReviews(params?: { status?: string; page?: number }) {
  return useQuery<SmsReview[]>({
    queryKey: superadminKeys.smsReviews(params),
    queryFn: async () => {
      const res = await superadminApiService.getSmsReviews(params);
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useSmsReview(id: number) {
  return useQuery<SmsReview>({
    queryKey: superadminKeys.smsReview(id),
    queryFn: async () => {
      const res = await superadminApiService.getSmsReview(id);
      return res.data;
    },
    enabled: id > 0,
    staleTime: 30_000,
  });
}

export function useSmsReviewStats() {
  return useQuery<SmsReviewStats>({
    queryKey: superadminKeys.smsReviewStats,
    queryFn: async () => {
      const res = await superadminApiService.getSmsReviewStats();
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useApproveSmsReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      superadminApiService.approveSmsReview(id, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: superadminKeys.smsReview(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      queryClient.invalidateQueries({ queryKey: superadminKeys.smsReviewStats });
    },
  });
}

export function useRejectSmsReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: number; rejectionReason: string }) =>
      superadminApiService.rejectSmsReview(id, rejectionReason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: superadminKeys.smsReview(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      queryClient.invalidateQueries({ queryKey: superadminKeys.smsReviewStats });
    },
  });
}

export function useRequestMoreInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      superadminApiService.requestMoreInfo(id, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: superadminKeys.smsReview(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'sms-reviews'] });
      queryClient.invalidateQueries({ queryKey: superadminKeys.smsReviewStats });
    },
  });
}

export function useAuthorizeOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, enableSms }: { orderId: number; enableSms?: boolean }) =>
      superadminApiService.authorizeOrder(orderId, enableSms),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: superadminKeys.order(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: superadminKeys.revenueStats });
    },
  });
}
