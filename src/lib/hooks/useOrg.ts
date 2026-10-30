/**
 * Organization Portal React Query Hooks
 * Typed queries/mutations for org dashboard, users, numbers, SMS campaign, settings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  orgApiService,
  type OrgDashboard,
  type OrgNumber,
  type OrgSmsCampaign,
  type OrgCallVerification,
  type OrgCallVerificationReview,
  type OrgBilling,
  type OrgSettings,
  type CreateOrgUserData,
  type UpdateOrgUserData,
} from '@/lib/api/services/org.service';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const orgKeys = {
  all: ['org'] as const,
  dashboard: ['org', 'dashboard'] as const,
  users: (params?: { page?: number; limit?: number }) =>
    ['org', 'users', params] as const,
  numbers: ['org', 'numbers'] as const,
  numberCap: ['org', 'numbers', 'cap'] as const,
  smsCampaign: ['org', 'sms-campaign'] as const,
  callVerification: ['org', 'call-verification'] as const,
  callVerificationReview: ['org', 'call-verification', 'review'] as const,
  billing: ['org', 'billing'] as const,
  settings: ['org', 'settings'] as const,
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useOrgDashboard() {
  return useQuery<OrgDashboard>({
    queryKey: orgKeys.dashboard,
    queryFn: async () => {
      const res = await orgApiService.getDashboard();
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function useOrgUsers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: orgKeys.users(params),
    queryFn: () => orgApiService.getUsers(params),
    staleTime: 30_000,
  });
}

export function useCreateOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrgUserData) => orgApiService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard });
    },
  });
}

export function useUpdateOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateOrgUserData }) =>
      orgApiService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
    },
  });
}

export function useDeleteOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, purgeData }: { id: number; purgeData?: boolean }) =>
      orgApiService.deleteUser(id, purgeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'users'] });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
    },
  });
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function useOrgNumbers() {
  return useQuery<OrgNumber[]>({
    queryKey: orgKeys.numbers,
    queryFn: async () => {
      const res = await orgApiService.getNumbers();
      return res.data;
    },
    staleTime: 30_000,
  });
}

/**
 * The org's phone-number cap (admin-configured) + current usage. Drives the
 * Numbers page's "used of cap" display and the Buy gate. Kept live by the
 * `org:limits_updated` WS event (see the Numbers page) — no polling.
 */
export function useOrgNumberCap() {
  return useQuery<{ cap: number; used: number }>({
    queryKey: orgKeys.numberCap,
    queryFn: async () => (await orgApiService.getNumberCap()).data,
    staleTime: 30_000,
  });
}

export function useNumberHistory(numberId: number | null) {
  return useQuery({
    queryKey: ['org', 'numbers', 'history', numberId],
    queryFn: async () => (await orgApiService.getNumberHistory(numberId as number)).data,
    enabled: numberId != null,
    staleTime: 10_000,
  });
}

export function useAssignNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      numberId,
      userId,
      importHistory,
    }: {
      numberId: number;
      userId: number | null;
      importHistory?: boolean;
    }) => orgApiService.assignNumber(numberId, userId, importHistory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
      // Assigning a number changes the member's Phone (and the owner's), so the
      // Users list + dashboard must refetch. The app runs with refetchOnMount:false,
      // so a plain invalidate would leave those (currently inactive) queries stale
      // until a manual refresh when you navigate to them — refetchType:'all' forces
      // them to refetch NOW, so the Users page is fresh the moment you open it.
      queryClient.invalidateQueries({ queryKey: ['org', 'users'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard, refetchType: 'all' });
    },
  });
}

export function useSearchOrgNumbers() {
  return useMutation({
    mutationFn: (params: {
      country_code: string;
      locality?: string;
      area_code?: string;
      number_type?: string;
      limit?: number;
    }) => orgApiService.searchNumbers(params),
  });
}

export function useBuyNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      phoneNumber: string;
      countryCode: string;
      numberType: 'local' | 'toll_free' | 'national';
    }) => orgApiService.buyNumber(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: orgKeys.billing });
    },
  });
}

export function useUpdateCallerIdName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ numberId, callerIdName }: { numberId: number; callerIdName: string }) =>
      orgApiService.updateCallerIdName(numberId, callerIdName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
    },
  });
}

export function useSetInboundCallerName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ numberId, enabled }: { numberId: number; enabled: boolean }) =>
      orgApiService.setInboundCallerName(numberId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.numbers });
    },
  });
}

// ---------------------------------------------------------------------------
// SMS Campaign
// ---------------------------------------------------------------------------

export function useOrgSmsCampaign() {
  return useQuery<OrgSmsCampaign>({
    queryKey: orgKeys.smsCampaign,
    queryFn: async () => {
      const res = await orgApiService.getSmsCampaign();
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useSubmitOrgSmsCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof orgApiService.submitSmsCampaign>[0]) =>
      orgApiService.submitSmsCampaign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.smsCampaign });
    },
  });
}

// ---------------------------------------------------------------------------
// Call Verification (business KYC)
// ---------------------------------------------------------------------------

export function useOrgCallVerification() {
  return useQuery<OrgCallVerification>({
    queryKey: orgKeys.callVerification,
    queryFn: async () => {
      const res = await orgApiService.getCallVerification();
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useOrgCallVerificationReview() {
  return useQuery<OrgCallVerificationReview>({
    queryKey: orgKeys.callVerificationReview,
    queryFn: async () => {
      const res = await orgApiService.getCallVerificationReview();
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useSubmitOrgCallVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof orgApiService.submitCallVerification>[0]) =>
      orgApiService.submitCallVerification(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.callVerification });
      queryClient.invalidateQueries({ queryKey: orgKeys.callVerificationReview });
    },
  });
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export function useOrgBilling() {
  return useQuery<OrgBilling>({
    queryKey: orgKeys.billing,
    queryFn: async () => {
      const res = await orgApiService.getBilling();
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => orgApiService.cancelSubscription(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.billing }),
  });
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => orgApiService.reactivateSubscription(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.billing }),
  });
}

export function usePurchaseSeats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ seats, notes }: { seats: number; notes?: string }) =>
      orgApiService.purchaseSeats(seats, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.billing });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard, refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['org', 'users'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: orgKeys.numberCap });
    },
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function useOrgSettings() {
  return useQuery<OrgSettings>({
    queryKey: orgKeys.settings,
    queryFn: async () => {
      const res = await orgApiService.getSettings();
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string }) => orgApiService.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.settings });
      queryClient.invalidateQueries({ queryKey: orgKeys.dashboard });
    },
  });
}
