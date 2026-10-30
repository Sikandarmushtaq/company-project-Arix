/**
 * Support Chat API service
 *
 * Thin wrappers over apiClient for the internal support chat. apiClient returns
 * the raw `{ success, data }` envelope (it does NOT unwrap), so every call reads
 * `.data` — same as the SMS/WhatsApp services. Returning the envelope directly
 * left callers reading `.id`/`.items` off `{ success, data }` (→ `undefined`).
 *
 * @module lib/api/services/support.api
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export type SupportTicketStatus = 'open' | 'active' | 'closed';
export type SupportSenderRole = 'user' | 'admin';

export interface SupportTicket {
  id: number;
  userId: number;
  organizationId: number | null;
  subject: string;
  status: SupportTicketStatus;
  assignedAdminId: number | null;
  lastMessageAt: string | null;
  unreadForAdmin: number;
  unreadForUser: number;
  createdAt: string;
  updatedAt: string;
  /** Set when a waiting user asked to be emailed on reply; drives the confirmed UI. */
  callbackEmail?: string | null;
  callbackRequestedAt?: string | null;
  userName?: string | null;
  userPhone?: string | null;
  assignedAdminName?: string | null;
  lastMessagePreview?: string | null;
}

export interface SupportAttachment {
  /** Short-lived signed URL (regenerated on every fetch — never cache long-term). */
  url: string;
  type: string | null;
  name: string | null;
}

export interface SupportMessage {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderRole: SupportSenderRole;
  body: string;
  read: boolean;
  createdAt: string;
  attachment?: SupportAttachment | null;
}

export interface TicketAndMessage {
  ticket: SupportTicket;
  message: SupportMessage;
}

export interface PaginatedMessages {
  items: SupportMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedTickets {
  items: SupportTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SuperAdminSummary {
  id: number;
  fullName: string | null;
}

export const supportApi = {
  // ---- user ----
  createTicket: (message: string) =>
    apiClient
      .post<ApiResponse<TicketAndMessage>>('/support/tickets', { message })
      .then((r) => r.data),
  getMyTicket: () =>
    apiClient.get<ApiResponse<SupportTicket | null>>('/support/tickets/mine').then((r) => r.data),
  getMyMessages: (ticketId: number, page = 1, limit = 100) =>
    apiClient
      .get<
        ApiResponse<PaginatedMessages>
      >(`/support/tickets/${ticketId}/messages?page=${page}&limit=${limit}`)
      .then((r) => r.data),
  sendMyMessage: (ticketId: number, body: string) =>
    apiClient
      .post<ApiResponse<TicketAndMessage>>(`/support/tickets/${ticketId}/messages`, { body })
      .then((r) => r.data),
  markMyRead: (ticketId: number) =>
    apiClient
      .post<ApiResponse<{ ok: boolean }>>(`/support/tickets/${ticketId}/read`)
      .then((r) => r.data),
  /** End my own support session. */
  closeMyTicket: (ticketId: number) =>
    apiClient
      .post<ApiResponse<SupportTicket>>(`/support/tickets/${ticketId}/close`)
      .then((r) => r.data),
  /** Ask to be emailed when we reply. Omit `email` to use the login email. */
  requestCallback: (ticketId: number, email?: string) =>
    apiClient
      .post<ApiResponse<SupportTicket>>(
        `/support/tickets/${ticketId}/request-callback`,
        email ? { email } : {}
      )
      .then((r) => r.data),
  /** Send an image (opens or continues the caller's ticket). Optional caption. */
  uploadMyAttachment: (file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption && caption.trim()) form.append('body', caption.trim());
    return apiClient
      .post<ApiResponse<TicketAndMessage>>('/support/tickets/attachments', form)
      .then((r) => r.data);
  },

  // ---- super-admin ----
  listTickets: (status: SupportTicketStatus | 'all' = 'open') =>
    apiClient
      .get<ApiResponse<PaginatedTickets>>(`/support/admin/tickets?status=${status}&limit=100`)
      .then((r) => r.data),
  getAdminMessages: (ticketId: number, page = 1, limit = 100) =>
    apiClient
      .get<
        ApiResponse<PaginatedMessages>
      >(`/support/admin/tickets/${ticketId}/messages?page=${page}&limit=${limit}`)
      .then((r) => r.data),
  claim: (ticketId: number) =>
    apiClient
      .post<ApiResponse<SupportTicket>>(`/support/admin/tickets/${ticketId}/claim`)
      .then((r) => r.data),
  adminReply: (ticketId: number, body: string) =>
    apiClient
      .post<ApiResponse<TicketAndMessage>>(`/support/admin/tickets/${ticketId}/messages`, { body })
      .then((r) => r.data),
  markAdminRead: (ticketId: number) =>
    apiClient
      .post<ApiResponse<{ ok: boolean }>>(`/support/admin/tickets/${ticketId}/read`)
      .then((r) => r.data),
  /** Reply with an image on a claimed ticket. Optional caption. */
  uploadAdminAttachment: (ticketId: number, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption && caption.trim()) form.append('body', caption.trim());
    return apiClient
      .post<ApiResponse<TicketAndMessage>>(`/support/admin/tickets/${ticketId}/attachments`, form)
      .then((r) => r.data);
  },
  transfer: (ticketId: number, toAdminId: number) =>
    apiClient
      .post<
        ApiResponse<SupportTicket>
      >(`/support/admin/tickets/${ticketId}/transfer`, { toAdminId })
      .then((r) => r.data),
  close: (ticketId: number) =>
    apiClient
      .post<ApiResponse<SupportTicket>>(`/support/admin/tickets/${ticketId}/close`)
      .then((r) => r.data),
  listSuperAdmins: () =>
    apiClient
      .get<ApiResponse<SuperAdminSummary[]>>('/support/admin/super-admins')
      .then((r) => r.data),
  /** My punch-in state + how many agents are on duty. */
  getDuty: () =>
    apiClient.get<ApiResponse<DutyState>>('/support/admin/duty').then((r) => r.data),
  /** Punch in (true) / out (false). */
  setDuty: (onDuty: boolean) =>
    apiClient.post<ApiResponse<DutyState>>('/support/admin/duty', { onDuty }).then((r) => r.data),
};

export interface DutyState {
  onDuty: boolean;
  onDutyCount: number;
}
