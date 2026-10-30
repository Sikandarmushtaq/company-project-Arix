/**
 * Call Group API service — admin/org CRUD for ring groups ("Call Groups").
 *
 * A call group is a set of users that ring together (or in sequence) when its
 * group extension — or a virtual number pointing at it — is dialed. The ring
 * logic runs in FusionPBX's own ring-group engine; this layer only manages the
 * group + its members from the dialer.
 *
 * @module lib/api/services/call-group.api
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * Ring strategies map 1:1 to FusionPBX's ring-group strategies. Plain-language
 * labels for the UI live in the page (STRATEGY_OPTIONS).
 */
export type RingStrategy = 'simultaneous' | 'sequence' | 'rollover' | 'enterprise' | 'random';

/** What happens if nobody in the group answers before the ring timeout. */
export type FallbackType = 'voicemail' | 'external' | 'hangup';

export interface CallGroupMember {
  userId: number;
  extension: string;
  fullName: string | null;
  /** Position in the ring order (used by sequence/rollover/random). */
  order: number;
  /** Seconds to wait before this member starts ringing (sequential strategies). */
  delay?: number;
  /** Seconds this member rings for. */
  timeout?: number;
}

export interface CallGroup {
  id: number;
  organizationId: number | null;
  name: string;
  /** The dial number for the group (auto-allocated, e.g. 9000–9099). */
  groupExtension: string;
  strategy: RingStrategy;
  /** Total seconds the group rings before the fallback fires. */
  ringTimeout: number;
  fallbackType: FallbackType;
  /** External number when fallbackType === 'external'. */
  fallbackValue: string | null;
  members: CallGroupMember[];
  enabled: boolean;
  /** A virtual number (DID) routed to this group, if one is assigned. */
  assignedNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallGroupInput {
  name: string;
  strategy: RingStrategy;
  ringTimeout: number;
  fallbackType: FallbackType;
  fallbackValue?: string | null;
  members: Array<{ userId: number; order: number; delay?: number; timeout?: number }>;
  enabled?: boolean;
  /**
   * Inbound DID that routes external callers to this group ('' / null = none).
   * NOTE: persisting + FusionPBX inbound routing is a pending backend task — the
   * API stores this only once the call-group controller accepts it.
   */
  assignedNumber?: string | null;
}

/** A user with a SIP extension, eligible to be a group member. */
export interface AvailableGroupMember {
  userId: number;
  fullName: string | null;
  senderPhone: string | null;
  extension: string;
}

export const callGroupApi = {
  async list(): Promise<CallGroup[]> {
    const res = await apiClient.get<ApiResponse<CallGroup[]>>('/admin/call-groups');
    return res.data ?? [];
  },
  async create(input: CallGroupInput): Promise<CallGroup> {
    const res = await apiClient.post<ApiResponse<CallGroup>>('/admin/call-groups', input);
    return res.data as CallGroup;
  },
  async update(id: number, input: Partial<CallGroupInput>): Promise<CallGroup> {
    const res = await apiClient.put<ApiResponse<CallGroup>>(`/admin/call-groups/${id}`, input);
    return res.data as CallGroup;
  },
  async remove(id: number): Promise<void> {
    await apiClient.delete<ApiResponse<{ message: string }>>(`/admin/call-groups/${id}`);
  },
  async availableMembers(): Promise<AvailableGroupMember[]> {
    const res = await apiClient.get<ApiResponse<AvailableGroupMember[]>>(
      '/admin/call-groups/available-members'
    );
    return res.data ?? [];
  },
};
