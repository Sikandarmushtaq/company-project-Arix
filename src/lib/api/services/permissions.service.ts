/**
 * Permissions Service
 * API service for permission management operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

// ============================================================
// Types
// ============================================================

export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: 'viewing' | 'managing' | 'system' | 'security' | 'reporting';
  isAdminOnly: boolean;
  createdAt: string;
}

export interface PermissionGroup {
  category: string;
  categoryName: string;
  permissions: Permission[];
}

export interface UserPermission {
  id: number;
  userId: number;
  permissionCode: string;
  granted: boolean;
  grantedBy: number;
  grantedAt: string;
  expiresAt: string | null;
  notes: string | null;
}

export interface UserPermissionsResponse {
  userId: number;
  username: string;
  role: string;
  effectivePermissions: Record<string, boolean>;
  overrides: UserPermission[];
  roleDefaults: string[];
}

export interface UserWithPermissions {
  id: number;
  fullName: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'user' | 'owner';
  effectivePermissions: Record<string, boolean>;
  overrideCount: number;
}

export interface UsersPermissionsListResponse {
  users: UserWithPermissions[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface GrantPermissionRequest {
  permissionCode: string;
  granted?: boolean;
  expiresAt?: string | null;
  notes?: string;
}

export interface BulkPermissionRequest {
  userId: number;
  permissions: Array<{
    code: string;
    granted: boolean;
    expiresAt?: string | null;
    notes?: string;
  }>;
}

export interface RolePermissions {
  admin: string[];
  manager: string[];
  user: string[];
}

export interface PermissionHistoryEntry {
  id: number;
  action: string;
  actionLabel: string;
  permissionCode: string | null;
  permissionsChanged: number | null;
  performedBy: {
    id: number;
    name: string;
  };
  details: Record<string, unknown> | null;
  timestamp: string;
  ipAddress: string | null;
}

// ============================================================
// Service
// ============================================================

export const permissionsService = {
  /**
   * Get all available permission definitions
   * API returns grouped permissions, this flattens them into a single array
   */
  async getAllPermissions(): Promise<ApiResponse<Permission[]>> {
    const response = await apiClient.get<ApiResponse<PermissionGroup[]>>('/permissions');

    // Flatten the grouped permissions into a single array
    const flatPermissions = response.data.flatMap((group) => group.permissions || []);

    return {
      ...response,
      data: flatPermissions,
    };
  },

  /**
   * Get current user's effective permissions
   */
  async getMyPermissions(): Promise<ApiResponse<UserPermissionsResponse>> {
    return apiClient.get<ApiResponse<UserPermissionsResponse>>('/permissions/me');
  },

  /**
   * Get a specific user's permissions
   */
  async getUserPermissions(userId: number): Promise<ApiResponse<UserPermissionsResponse>> {
    return apiClient.get<ApiResponse<UserPermissionsResponse>>(`/permissions/user/${userId}`);
  },

  /**
   * Get a manager's page-access toggle state (Dashboard, Live Calls, Analytics,
   * Sessions, Bans, Recordings). Available to admin/super_admin; org-scoped.
   */
  async getPageAccess(
    userId: number
  ): Promise<ApiResponse<{ pages: Record<string, boolean> }>> {
    return apiClient.get<ApiResponse<{ pages: Record<string, boolean> }>>(
      `/permissions/user/${userId}/page-access`
    );
  },

  /**
   * Set a manager's page-access toggles. `pages` maps page keys to on/off.
   */
  async setPageAccess(
    userId: number,
    pages: Record<string, boolean>
  ): Promise<ApiResponse<{ pages: Record<string, boolean> }>> {
    return apiClient.put<ApiResponse<{ pages: Record<string, boolean> }>>(
      `/permissions/user/${userId}/page-access`,
      { pages }
    );
  },

  /**
   * Get all users with their permission info (paginated)
   */
  async getUsersWithPermissions(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<ApiResponse<UsersPermissionsListResponse>> {
    return apiClient.get<ApiResponse<UsersPermissionsListResponse>>('/permissions/users', {
      params,
    });
  },

  /**
   * Grant a permission to a user
   */
  async grantPermission(
    userId: number,
    data: GrantPermissionRequest
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<ApiResponse<{ message: string }>>(`/permissions/user/${userId}`, data);
  },

  /**
   * Revoke a permission from a user
   */
  async revokePermission(
    userId: number,
    permissionCode: string
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<ApiResponse<{ message: string }>>(
      `/permissions/user/${userId}/${encodeURIComponent(permissionCode)}`
    );
  },

  /**
   * Bulk grant/revoke permissions for a user
   */
  async bulkUpdatePermissions(
    data: BulkPermissionRequest
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<ApiResponse<{ message: string }>>(
      `/permissions/user/${data.userId}/bulk`,
      { permissions: data.permissions }
    );
  },

  /**
   * Get role default permissions
   */
  async getRoleDefaults(): Promise<ApiResponse<RolePermissions>> {
    return apiClient.get<ApiResponse<RolePermissions>>('/permissions/roles');
  },

  /**
   * Get permission change history for a user
   */
  async getUserPermissionHistory(
    userId: number,
    limit: number = 50
  ): Promise<ApiResponse<PermissionHistoryEntry[]>> {
    return apiClient.get<ApiResponse<PermissionHistoryEntry[]>>(
      `/permissions/user/${userId}/history`,
      { params: { limit } }
    );
  },
};
