/**
 * Admin User API Service
 * User CRUD, phone numbers, bans, bulk operations, and export
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

// ============================================================
// Types
// ============================================================

export interface AdminUser {
  id: number;
  fullName: string;
  senderPhone: string;
  email: string;
  role: 'admin' | 'user' | 'manager' | 'owner';
  extension: string;
  sipPassword?: string;
  isActive: boolean;
  banned: boolean;
  banReason?: string;
  smsEnabled: boolean;
  autoDialerEnabled: boolean;
  smsLimit: number | null;
  createdAt: string;
  lastLogin?: string;
  organizationId?: number | null;
  organizationName?: string | null;
}

export interface AdminUserMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  banned?: boolean;
}

export interface CreateUserData {
  fullName: string;
  senderPhone: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'user';
  extension: string;
  sipPassword?: string;
  serverPreference?: 'main' | 'backup';
  limitMax?: number;
  callTimeout?: number;
}

export interface ExtensionSettings {
  extension: string;
  effectiveCallerIdName: string | null;
  effectiveCallerIdNumber: string | null;
  outboundCallerIdName: string | null;
  outboundCallerIdNumber: string | null;
  limitMax: number | null;
  callTimeout: number | null;
  enabled: boolean;
}

export interface UpdateUserData {
  fullName?: string;
  email?: string;
  role?: 'admin' | 'user' | 'manager' | 'owner';
  extension?: string;
  isActive?: boolean;
  sipPassword?: string;
  limitMax?: number;
  callTimeout?: number;
}

export interface BannedUser {
  id: number;
  fullName: string;
  email: string;
  banReason: string;
  bannedAt: string;
}

export interface PhoneNumber {
  id: number;
  phoneNumber: string;
  isDefault: boolean;
  userId: number;
}

// ============================================================
// User API Methods
// ============================================================

export async function getUsers(
  params?: UserParams
): Promise<{ users: AdminUser[]; meta: AdminUserMeta }> {
  const response = await apiClient.get<ApiResponse<AdminUser[]> & { meta: AdminUserMeta }>(
    '/admin/users',
    { params: params as Record<string, string | number | boolean | undefined> }
  );
  return { users: response.data, meta: response.meta };
}

export async function getUser(id: number): Promise<AdminUser> {
  const response = await apiClient.get<ApiResponse<AdminUser>>(`/admin/users/${id}`);
  return response.data;
}

export async function getUserExtensionSettings(id: number): Promise<{
  success: boolean;
  data?: ExtensionSettings;
  error?: { message: string };
}> {
  const response = await apiClient.get<{
    success: boolean;
    data?: ExtensionSettings;
    error?: { message: string };
  }>(`/admin/users/${id}/extension-settings`);
  return response;
}

export async function createUser(data: CreateUserData): Promise<AdminUser> {
  const response = await apiClient.post<ApiResponse<AdminUser>>('/admin/users', data);
  return response.data;
}

export async function updateUser(id: number, data: UpdateUserData): Promise<AdminUser> {
  const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`);
}

export async function setBanStatus(
  id: number,
  banned: boolean,
  reason?: string
): Promise<AdminUser> {
  const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/ban`, {
    banned,
    reason,
  });
  return response.data;
}

export async function toggleSms(id: number, enabled: boolean): Promise<AdminUser> {
  const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/sms`, {
    enabled,
  });
  return response.data;
}

export async function toggleAutoDialer(id: number, enabled: boolean): Promise<AdminUser> {
  const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/auto-dialer`, {
    enabled,
  });
  return response.data;
}

export async function updateUserPassword(id: number, password: string): Promise<void> {
  await apiClient.put(`/admin/users/${id}/password`, { password });
}

export async function forceLogout(id: number): Promise<number> {
  const response = await apiClient.put<ApiResponse<{ terminatedSessions: number }>>(
    `/admin/users/${id}/force-logout`,
    {}
  );
  return response.data.terminatedSessions;
}

export async function setSmsLimit(id: number, limit: number | null): Promise<AdminUser> {
  const response = await apiClient.put<ApiResponse<AdminUser>>(`/admin/users/${id}/sms-limit`, {
    limit,
  });
  return response.data;
}

export async function transferPhoneNumber(
  fromUserId: number,
  toUserId: number,
  phoneNumber: string
): Promise<void> {
  await apiClient.post(`/admin/users/${fromUserId}/transfer`, { toUserId, phoneNumber });
}

// Phone Numbers
export async function getUserPhoneNumbers(userId: number): Promise<PhoneNumber[]> {
  const response = await apiClient.get<ApiResponse<PhoneNumber[]>>(
    `/admin/numbers/user/${userId}`
  );
  return response.data;
}

export async function addPhoneNumber(
  userId: number,
  phoneNumber: string,
  isDefault?: boolean
): Promise<PhoneNumber> {
  const response = await apiClient.post<ApiResponse<PhoneNumber>>('/admin/numbers', {
    userId,
    phoneNumber,
    isDefault,
  });
  return response.data;
}

export async function removePhoneNumber(numberId: number): Promise<void> {
  await apiClient.delete(`/admin/numbers/${numberId}`);
}

// Bans
export async function getBannedUsers(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}
): Promise<{
  users: BannedUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const response = await apiClient.get<
    ApiResponse<{
      users: BannedUser[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >('/admin/bans/users', {
    params: {
      page: params.page || 1,
      limit: params.limit || 50,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return response.data;
}

export async function getTempBans(): Promise<
  Array<{ ip: string; reason: string; expiresAt: string }>
> {
  const response = await apiClient.get<
    ApiResponse<Array<{ ip: string; reason: string; expiresAt: string }>>
  >('/admin/bans/temp');
  return response.data;
}

export async function getDeviceBans(): Promise<
  Array<{ contact: string; reason: string; expiresAt: string }>
> {
  const response = await apiClient.get<
    ApiResponse<Array<{ contact: string; reason: string; expiresAt: string }>>
  >('/admin/bans/devices');
  return response.data;
}

// Bulk Operations
export async function bulkBanUsers(
  userIds: number[],
  reason?: string
): Promise<{ affected: number }> {
  const response = await apiClient.post<ApiResponse<{ affected: number }>>(
    '/admin/users/bulk/ban',
    {
      userIds,
      reason,
    }
  );
  return response.data;
}

export async function bulkUnbanUsers(userIds: number[]): Promise<{ affected: number }> {
  const response = await apiClient.post<ApiResponse<{ affected: number }>>(
    '/admin/users/bulk/unban',
    {
      userIds,
    }
  );
  return response.data;
}

export async function bulkEnableSms(userIds: number[]): Promise<{ affected: number }> {
  const response = await apiClient.post<ApiResponse<{ affected: number }>>(
    '/admin/users/bulk/enable-sms',
    {
      userIds,
    }
  );
  return response.data;
}

export async function bulkDisableSms(userIds: number[]): Promise<{ affected: number }> {
  const response = await apiClient.post<ApiResponse<{ affected: number }>>(
    '/admin/users/bulk/disable-sms',
    {
      userIds,
    }
  );
  return response.data;
}

export async function bulkEnableAutoDialer(userIds: number[]): Promise<{ affected: number }> {
  const response = await apiClient.post<ApiResponse<{ affected: number }>>(
    '/admin/users/bulk/enable-autodialer',
    {
      userIds,
    }
  );
  return response.data;
}

export async function bulkDisableAutoDialer(userIds: number[]): Promise<{ affected: number }> {
  const response = await apiClient.post<ApiResponse<{ affected: number }>>(
    '/admin/users/bulk/disable-autodialer',
    {
      userIds,
    }
  );
  return response.data;
}

export async function bulkDeleteUsers(userIds: number[]): Promise<{ affected: number }> {
  const response = await apiClient.post<ApiResponse<{ affected: number }>>(
    '/admin/users/bulk/delete',
    {
      userIds,
    }
  );
  return response.data;
}

// Export
export async function exportUsers(filters?: {
  search?: string;
  role?: string;
  banned?: string;
}): Promise<void> {
  await downloadCsv('users', `users-${Date.now()}.csv`, filters as Record<string, string>);
}

// Unassigned users
export async function getUnassignedUsers(): Promise<AdminUser[]> {
  const response = await apiClient.get<ApiResponse<AdminUser[]>>('/admin/users/unassigned');
  return response.data;
}

// ============================================================
// Shared CSV Download Helper
// ============================================================

export async function downloadCsv(
  endpoint: string,
  filename: string,
  params?: Record<string, string>
): Promise<void> {
  const queryString = params ? `?${new URLSearchParams(params)}` : '';
  const url = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/admin/export/${endpoint}${queryString}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Export failed');
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
