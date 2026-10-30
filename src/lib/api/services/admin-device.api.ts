/**
 * Admin Device API Service
 * Device management and exports
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';
import { downloadCsv } from './admin-user.api';

// ============================================================
// Types
// ============================================================

export interface Device {
  aor: string;
  contact: string;
  userAgent: string;
  expires: number;
  lastRegistered: string;
}

// ============================================================
// Device API Methods
// ============================================================

export async function getDevices(): Promise<Device[]> {
  const response = await apiClient.get<ApiResponse<Device[]>>('/admin/devices');
  return response.data;
}

export async function getUserDevices(aor: string): Promise<Device[]> {
  const response = await apiClient.get<ApiResponse<Device[]>>(
    `/admin/devices/user/${encodeURIComponent(aor)}`
  );
  return response.data;
}

export async function kickDevice(contact: string): Promise<void> {
  await apiClient.post('/admin/devices/kick', { contact });
}

export async function banDevice(contact: string, duration?: number): Promise<void> {
  await apiClient.post('/admin/devices/ban', { contact, duration });
}

// Export
export async function exportDevices(): Promise<void> {
  await downloadCsv('devices', `devices-${Date.now()}.csv`);
}
