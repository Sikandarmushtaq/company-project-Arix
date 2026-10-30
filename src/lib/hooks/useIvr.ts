/**
 * Call Menu (IVR) hooks — Phase 0.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ivrApi, type IvrFlow, type IvrFlowRecord } from '@/lib/api/services/ivr.api';

const ivrKeys = {
  all: ['ivr'] as const,
  default: ['ivr', 'default'] as const,
  readiness: (id: number) => ['ivr', 'readiness', id] as const,
};

/** The builder loads (and lazily creates) the org's default call menu. */
export function useDefaultIvrFlow() {
  return useQuery<IvrFlowRecord>({
    queryKey: ivrKeys.default,
    queryFn: () => ivrApi.getDefault(),
    staleTime: 30_000,
    // Fail fast instead of hammering: when the backend module isn't deployed yet
    // the builder drops into a local preview mode (see the page), so retrying the
    // 404 gains nothing.
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateIvrFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, flow }: { id: number; name?: string; flow?: IvrFlow }) =>
      ivrApi.update(id, { name, flow }),
    onSuccess: (result) => {
      // Keep the default-flow cache in step with the just-saved version.
      queryClient.setQueryData(ivrKeys.default, result.flow);
    },
  });
}

/** Publish gate — refetches whenever the builder is opened / a save happens. */
export function useIvrReadiness(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ivrKeys.readiness(id ?? 0),
    queryFn: () => ivrApi.readiness(id as number),
    enabled: !!id && enabled,
    staleTime: 15_000,
  });
}

/** Upload a greeting recording (returns the stored audio key). */
export function useUploadIvrPrompt() {
  return useMutation({ mutationFn: (file: File) => ivrApi.uploadPrompt(file) });
}

/** Available TTS voices for the greeting voice picker. */
export function useIvrVoices() {
  return useQuery({
    queryKey: ['ivr', 'voices'],
    queryFn: () => ivrApi.voices(),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** People + teams a step can route to (drives the inspector's target pickers). */
export function useIvrTargets() {
  return useQuery({
    queryKey: ['ivr', 'targets'],
    queryFn: () => ivrApi.targets(),
    staleTime: 60_000,
    // Match useDefaultIvrFlow: fail fast when the backend module isn't reachable
    // (preview mode) instead of retrying the 404.
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Dry-run preview of what publishing would write (fetched when the dialog opens). */
export function useIvrPreview(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['ivr', 'preview', id ?? 0],
    queryFn: () => ivrApi.preview(id as number),
    enabled: !!id && enabled,
    staleTime: 0,
  });
}

export function usePublishIvr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, number }: { id: number; number?: string }) => ivrApi.publish(id, number),
    onSuccess: (record) => {
      queryClient.setQueryData(ivrKeys.default, record);
      queryClient.invalidateQueries({ queryKey: ivrKeys.readiness(record.id) });
    },
  });
}

export function useUnpublishIvr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ivrApi.unpublish(id),
    onSuccess: (record) => {
      queryClient.setQueryData(ivrKeys.default, record);
      queryClient.invalidateQueries({ queryKey: ivrKeys.readiness(record.id) });
    },
  });
}
