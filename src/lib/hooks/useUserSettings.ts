/**
 * User Settings Hooks
 * React Query hooks for DND and Speed Dial
 * Includes fallback logic for when endpoints aren't deployed (production)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  userSettingsService,
  type DndStatus,
  type SpeedDialEntry,
  type SetSpeedDialInput,
} from '@/lib/api';

// Query keys
export const userSettingsKeys = {
  all: ['user-settings'] as const,
  dnd: () => [...userSettingsKeys.all, 'dnd'] as const,
  speedDial: () => [...userSettingsKeys.all, 'speed-dial'] as const,
  speedDialPosition: (position: number) => [...userSettingsKeys.speedDial(), position] as const,
};

/**
 * Helper to check if error is a 404
 */
function is404Error(error: unknown): boolean {
  if (error instanceof Error && 'status' in error) {
    return (error as { status: number }).status === 404;
  }
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status === 404;
  }
  return false;
}

/**
 * Default DND status (feature not available)
 */
const DEFAULT_DND_STATUS: DndStatus = {
  enabled: false,
  isCurrentlyActive: false,
};

// ============ DND Hooks ============

/**
 * Get DND status
 * Falls back to disabled if endpoint not available
 */
export function useDndStatus() {
  return useQuery({
    queryKey: userSettingsKeys.dnd(),
    queryFn: async () => {
      try {
        return await userSettingsService.getDndStatus();
      } catch (error) {
        if (is404Error(error)) {
          console.warn('[useDndStatus] Endpoint not available, using default');
          return DEFAULT_DND_STATUS;
        }
        throw error;
      }
    },
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Toggle DND on/off
 */
export function useToggleDnd() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => userSettingsService.toggleDnd(enabled),
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKeys.dnd(), data);
    },
  });
}

// ============ Speed Dial Hooks ============

/**
 * Get all speed dial entries
 * Falls back to empty array if endpoint not available
 */
export function useSpeedDial() {
  return useQuery({
    queryKey: userSettingsKeys.speedDial(),
    queryFn: async () => {
      try {
        return await userSettingsService.getSpeedDial();
      } catch (error) {
        if (is404Error(error)) {
          console.warn('[useSpeedDial] Endpoint not available, returning empty array');
          return [] as SpeedDialEntry[];
        }
        throw error;
      }
    },
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Get speed dial by position
 * Falls back to null if endpoint not available
 */
export function useSpeedDialByPosition(position: number) {
  return useQuery({
    queryKey: userSettingsKeys.speedDialPosition(position),
    queryFn: async () => {
      try {
        return await userSettingsService.getSpeedDialByPosition(position);
      } catch (error) {
        if (is404Error(error)) {
          return null;
        }
        throw error;
      }
    },
    enabled: position >= 1 && position <= 9,
  });
}

/**
 * Set speed dial entry
 */
export function useSetSpeedDial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetSpeedDialInput) => userSettingsService.setSpeedDial(data),
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKeys.speedDial(), data);
    },
  });
}

/**
 * Remove speed dial entry
 */
export function useRemoveSpeedDial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (position: number) => userSettingsService.removeSpeedDial(position),
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKeys.speedDial(), data);
    },
  });
}

/**
 * Clear all speed dial entries
 */
export function useClearSpeedDial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userSettingsService.clearSpeedDial(),
    onSuccess: () => {
      queryClient.setQueryData(userSettingsKeys.speedDial(), []);
    },
  });
}

// Re-export types
export type { DndStatus, SpeedDialEntry, SetSpeedDialInput };
