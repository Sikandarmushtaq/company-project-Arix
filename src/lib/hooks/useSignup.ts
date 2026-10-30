/**
 * Signup React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  onboardingApiService,
  type CreateOrderPayload,
  type CreateLeadPayload,
  type SelectedNumberPayload,
  type SmsCampaignPayload,
  type NumberSearchParams,
  type SignupOrderData,
  type SignupStatusData,
} from '@/lib/api/services/onboarding.service';

export const signupKeys = {
  all: ['signup'] as const,
  order: (token: string) => ['signup', 'order', token] as const,
  status: (token: string) => ['signup', 'status', token] as const,
  numbers: (params: NumberSearchParams) => ['signup', 'numbers', params] as const,
};

export function useSignupOrder(token: string) {
  return useQuery<SignupOrderData>({
    queryKey: signupKeys.order(token),
    queryFn: async () => {
      const res = await onboardingApiService.getOrder(token);
      return res.data;
    },
    enabled: !!token,
    staleTime: 30_000,
    // While the order exists but the email isn't verified yet, poll so the
    // wizard's email-verify gate auto-advances the moment the user clicks the
    // link in their inbox (they may verify in another tab). Stops once verified.
    refetchInterval: (query) =>
      query.state.data && !query.state.data.emailVerified ? 5_000 : false,
  });
}

// Stop polling only once the order is truly settled. NOTE: `pending_verification`
// is NOT terminal here — with auto-activation it's a transient step BEFORE the
// number is purchased and the org/owner are activated (the order then flips to
// `active`). Treating it as terminal made the success page invite sign-in too
// early → "account inactive" + no number. So we poll until `active`/failed.
const TERMINAL_STATUSES = ['active', 'failed', 'cancelled'];

export function useSignupStatus(token: string) {
  return useQuery<SignupStatusData>({
    queryKey: signupKeys.status(token),
    queryFn: async () => {
      const res = await onboardingApiService.getStatus(token);
      return res.data;
    },
    enabled: !!token,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      // Provisioning finishes in seconds; poll every 3s. Safety cap (~3 min) so a
      // stalled order doesn't poll forever — the UI then shows the finalizing
      // state with a support hint rather than hammering the API.
      if (query.state.dataUpdateCount >= 60) return false;
      return 3000;
    },
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (data: CreateOrderPayload) => onboardingApiService.createOrder(data),
  });
}

export function useCreateLead() {
  return useMutation({
    mutationFn: (data: CreateLeadPayload) => onboardingApiService.createLead(data),
  });
}

export function useUpdateBusiness(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateOrderPayload>) =>
      onboardingApiService.updateBusiness(token, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signupKeys.order(token) });
    },
  });
}

export function useSearchNumbers() {
  return useMutation({
    mutationFn: (params: NumberSearchParams) => onboardingApiService.searchNumbers(params),
  });
}

export function useSetNumbers(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (numbers: SelectedNumberPayload[]) =>
      onboardingApiService.setNumbers(token, numbers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signupKeys.order(token) });
    },
  });
}

export function useSubmitSmsCampaign(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SmsCampaignPayload) => onboardingApiService.submitSmsCampaign(token, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signupKeys.order(token) });
    },
  });
}

export function useSkipSmsCampaign(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => onboardingApiService.skipSmsCampaign(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signupKeys.order(token) });
    },
  });
}

export function useCreateCheckout(token: string) {
  return useMutation({
    // Pass this app's origin so Stripe returns the customer to THIS host's
    // success/cancel pages (not the main site).
    mutationFn: () =>
      onboardingApiService.createCheckout(
        token,
        typeof window !== 'undefined' ? window.location.origin : ''
      ),
  });
}

/**
 * Hook for the /signup/verify-email/[verifyToken] page. The verify
 * endpoint POSTs once when the page mounts; useMutation gives us the
 * loading / success / error states without React Query's automatic
 * refetch semantics (which would re-consume the single-use token).
 */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: (verifyToken: string) => onboardingApiService.verifyEmail(verifyToken),
  });
}

/**
 * Resend the verification email. Invalidates the order cache on success
 * so any "verify your email" gate in the wizard re-reads the (still
 * unverified, but freshly emailed) state.
 */
export function useResendVerification(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => onboardingApiService.resendVerification(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signupKeys.order(token) });
    },
  });
}

/**
 * Verify the email via the 6-digit OTP code. On success the order cache is
 * invalidated so the verify gate re-reads the (now verified) order and the
 * wizard advances. A wrong/expired code throws (surfaced inline by the gate).
 */
export function useVerifyEmailCode(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => onboardingApiService.verifyEmailCode(token, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signupKeys.order(token) });
    },
  });
}
