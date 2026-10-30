/**
 * Admin Device Hooks
 * React Query hooks for device management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/lib/api/services/admin.service';
import { adminKeys } from './useAdminKeys';

// ============================================================
// Device Hooks
// ============================================================

export function useAdminDevices() {
  return useQuery({
    queryKey: adminKeys.devices(),
    queryFn: () => adminService.getDevices(),
    staleTime: 10 * 1000, // 10 seconds - devices change frequently
  });
}

export function useKickDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contact: string) => adminService.kickDevice(contact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.devices() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

// ============================================================
// Export Hooks
// ============================================================

export function useExportDevices() {
  return useMutation({
    mutationFn: () => adminService.exportDevices(),
  });
}
