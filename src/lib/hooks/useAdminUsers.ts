/**
 * Admin User Hooks
 * React Query hooks for user management (queries + mutations)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminService,
  type UserParams,
  type CreateUserData,
  type UpdateUserData,
} from '@/lib/api/services/admin.service';
import { adminKeys } from './useAdminKeys';

// ============================================================
// User Query Hooks
// ============================================================

export function useAdminUsers(params?: UserParams) {
  return useQuery({
    queryKey: adminKeys.usersList(params),
    queryFn: () => adminService.getUsers(params),
    staleTime: 30 * 1000,
  });
}

export function useAdminUser(id: number) {
  return useQuery({
    queryKey: adminKeys.userDetail(id),
    queryFn: () => adminService.getUser(id),
    enabled: id > 0,
  });
}

export function useUserExtensionSettings(id: number) {
  return useQuery({
    queryKey: adminKeys.userExtensionSettings(id),
    queryFn: () => adminService.getUserExtensionSettings(id),
    enabled: id > 0,
    staleTime: 30 * 1000,
  });
}

export function useUnassignedUsers() {
  return useQuery({
    queryKey: adminKeys.unassignedUsers(),
    queryFn: () => adminService.getUnassignedUsers(),
    staleTime: 30 * 1000,
  });
}

// ============================================================
// User Mutation Hooks
// ============================================================

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => adminService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) =>
      adminService.updateUser(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useSetBanStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, banned, reason }: { id: number; banned: boolean; reason?: string }) =>
      adminService.setBanStatus(id, banned, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.bannedUsers() });
    },
  });
}

export function useToggleSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      adminService.toggleSms(id, enabled),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useToggleAutoDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      adminService.toggleAutoDialer(id, enabled),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useUpdateUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      adminService.updateUserPassword(id, password),
  });
}

export function useForceLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminService.forceLogout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
    },
  });
}

// ============================================================
// Ban Hooks
// ============================================================

export function useBannedUsers(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}
) {
  return useQuery({
    queryKey: [...adminKeys.bannedUsers(), params.page, params.limit, params.search],
    queryFn: () => adminService.getBannedUsers(params),
    staleTime: 60 * 1000,
  });
}

export function useTempBans() {
  return useQuery({
    queryKey: adminKeys.tempBans(),
    queryFn: () => adminService.getTempBans(),
    staleTime: 60 * 1000,
  });
}

export function useDeviceBans() {
  return useQuery({
    queryKey: adminKeys.deviceBans(),
    queryFn: () => adminService.getDeviceBans(),
    staleTime: 60 * 1000,
  });
}

export function useIpBans() {
  return useQuery({
    queryKey: adminKeys.ipBans(),
    queryFn: () => adminService.getIpBans(),
    staleTime: 60 * 1000,
  });
}

export function useBanIpFromConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ socketId, reason }: { socketId: string; reason?: string }) =>
      adminService.banIpFromConnection(socketId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.connections() });
      queryClient.invalidateQueries({ queryKey: adminKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ipBans() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useUnbanIp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ipAddress: string) => adminService.unbanIp(ipAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.ipBans() });
    },
  });
}

// ============================================================
// Bulk Operations Hooks
// ============================================================

export function useBulkBanUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userIds, reason }: { userIds: number[]; reason?: string }) =>
      adminService.bulkBanUsers(userIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useBulkUnbanUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkUnbanUsers(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useBulkEnableSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkEnableSms(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkDisableSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkDisableSms(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkEnableAutoDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkEnableAutoDialer(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkDisableAutoDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkDisableAutoDialer(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkDeleteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkDeleteUsers(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useBulkEnableWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkEnableWhatsApp(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useBulkDisableWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: number[]) => adminService.bulkDisableWhatsApp(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

// ============================================================
// Export Hooks
// ============================================================

export function useExportUsers() {
  return useMutation({
    mutationFn: (filters?: {
      search?: string;
      role?: string;
      banned?: string;
      organizationId?: string;
    }) => adminService.exportUsers(filters),
  });
}
