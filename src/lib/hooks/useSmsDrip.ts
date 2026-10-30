'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  smsDripService,
  type CreateDripSequenceRequest,
  type UpdateDripSequenceRequest,
  type EnrollRequest,
  type DripEnrollmentStatus,
} from '@/lib/api/services/sms-drip.service';

export const smsDripKeys = {
  all: ['sms-drip'] as const,
  list: () => [...smsDripKeys.all, 'list'] as const,
  detail: (id: number) => [...smsDripKeys.all, 'detail', id] as const,
  enrollments: (id: number, status?: string) =>
    [...smsDripKeys.all, 'enrollments', id, status ?? 'all'] as const,
};

export function useDripSequences(enabled = true) {
  return useQuery({
    queryKey: smsDripKeys.list(),
    queryFn: () => smsDripService.list(),
    staleTime: 15_000,
    enabled,
  });
}

export function useDripSequence(id: number | null) {
  return useQuery({
    queryKey: smsDripKeys.detail(id ?? 0),
    queryFn: () => smsDripService.get(id as number),
    enabled: id != null,
    staleTime: 15_000,
  });
}

export function useCreateDripSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDripSequenceRequest) => smsDripService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsDripKeys.all }),
  });
}

export function useUpdateDripSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDripSequenceRequest }) =>
      smsDripService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsDripKeys.all }),
  });
}

export function useDeleteDripSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => smsDripService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsDripKeys.all }),
  });
}

export function useEnrollDrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EnrollRequest }) =>
      smsDripService.enroll(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsDripKeys.all }),
  });
}

export function useDripEnrollments(id: number | null, status?: DripEnrollmentStatus) {
  return useQuery({
    queryKey: smsDripKeys.enrollments(id ?? 0, status),
    queryFn: () => smsDripService.enrollments(id as number, { status }),
    enabled: id != null,
    staleTime: 10_000,
  });
}

export function useSetEnrollmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ enrollmentId, status }: { enrollmentId: number; status: DripEnrollmentStatus }) =>
      smsDripService.setEnrollmentStatus(enrollmentId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsDripKeys.all }),
  });
}
