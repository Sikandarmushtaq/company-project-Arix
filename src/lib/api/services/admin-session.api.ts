/**
 * Admin Session API Service
 * Session management, WebSocket connections, and IP bans
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import { downloadCsv } from './admin-user.api';

// ============================================================
// Types
// ============================================================

export interface WebSocketConnection {
  socketId: string;
  userId: number;
  userPhone: string;
  userRole: string;
  connectedAt: string;
  rooms: string[];
}

export interface Session {
  id: string;
  sessionId: string;
  userId: number;
  fullName: string;
  userEmail: string;
  userRole: string;
  senderPhone: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActive: string;
  createdAt: string;
}

export interface SessionStats {
  totalActive: number;
  expiringSoon: number;
  averageDuration: number;
}

// ============================================================
// Session API Methods
// ============================================================

export async function getSessions(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}
): Promise<{
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const response = await apiClient.get<
    ApiResponse<{
      sessions: Session[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  >('/admin/sessions', {
    params: {
      page: params.page || 1,
      limit: params.limit || 50,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return response.data;
}

export async function getSessionStats(): Promise<SessionStats> {
  const response = await apiClient.get<ApiResponse<SessionStats>>('/admin/sessions/stats');
  return response.data;
}

export async function logoutSession(sessionId: string): Promise<void> {
  await apiClient.post(`/admin/sessions/${sessionId}/logout`, {});
}

export async function logoutAllSessions(): Promise<number> {
  const response = await apiClient.post<ApiResponse<{ terminatedSessions: number }>>(
    '/admin/sessions/logout-all',
    {}
  );
  return response.data.terminatedSessions;
}

// WebSocket Connections
export async function getConnections(): Promise<WebSocketConnection[]> {
  const response = await apiClient.get<ApiResponse<WebSocketConnection[]>>('/admin/connections');
  return response.data;
}

export async function kickConnection(socketId: string): Promise<void> {
  await apiClient.post('/admin/connections/kick', { socketId });
}

export async function kickUserConnections(userId: number): Promise<number> {
  const response = await apiClient.post<ApiResponse<{ kickedCount: number }>>(
    `/admin/connections/kick-user/${userId}`,
    {}
  );
  return response.data.kickedCount;
}

export async function banIpFromConnection(
  socketId: string,
  reason?: string
): Promise<{ banned: boolean; ip?: string }> {
  const response = await apiClient.post<ApiResponse<{ banned: boolean; ip?: string }>>(
    '/admin/connections/ban-ip',
    { socketId, reason }
  );
  return response.data;
}

export async function getIpBans(): Promise<
  Array<{
    id: number;
    ipAddress: string;
    reason: string | null;
    bannedBy: number | null;
    createdAt: string;
    expiresAt: string | null;
  }>
> {
  const response = await apiClient.get<
    ApiResponse<
      Array<{
        id: number;
        ipAddress: string;
        reason: string | null;
        bannedBy: number | null;
        createdAt: string;
        expiresAt: string | null;
      }>
    >
  >('/admin/ip-bans');
  return response.data;
}

export async function unbanIp(ipAddress: string): Promise<boolean> {
  const response = await apiClient.delete<ApiResponse<{ unbanned: boolean }>>(
    `/admin/ip-bans/${encodeURIComponent(ipAddress)}`
  );
  return response.data.unbanned;
}

// Exports
export async function exportSessions(): Promise<void> {
  await downloadCsv('sessions', `sessions-${Date.now()}.csv`);
}
