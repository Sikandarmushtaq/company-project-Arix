/**
 * Contacts Service
 * API service for contact operations
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * Contact - matches backend Contact (camelCase)
 * @see server/src/modules/contacts/contact.repository.ts
 */
export interface Contact {
  id: number;
  owner: string;
  contact: string; // The contact's phone number
  name: string;
  type: string;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
}

/**
 * Blocked contact - matches backend BlockedContact
 * @see server/src/modules/contacts/contact.repository.ts
 */
export interface BlockedContact {
  id: number;
  owner: string;
  phoneNumber: string;
  name: string | null;
  reason: string | null;
  blockedAt: string;
}

/**
 * Create contact request - matches backend expectations
 */
export interface CreateContactRequest {
  contact: string; // Phone number
  name: string;
  type?: string;
  notes?: string;
  isFavorite?: boolean;
}

export interface UpdateContactRequest extends Partial<CreateContactRequest> {}

/**
 * Pagination parameters
 */
export interface ContactsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
}

/**
 * Paginated response from contacts API
 */
export interface PaginatedContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class ContactsService {
  /**
   * Get contacts with pagination
   * Backend returns: { success: true, data: { contacts: [...], total, page, limit, totalPages } }
   */
  async getContactsPaginated(params: ContactsQueryParams = {}): Promise<PaginatedContactsResponse> {
    const response = await apiClient.get<ApiResponse<PaginatedContactsResponse>>('/contacts', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.search ? { search: params.search } : {}),
        ...(params.type ? { type: params.type } : {}),
      },
    });
    return response.data;
  }

  /**
   * Get all contacts (legacy - returns only array)
   * @deprecated Use getContactsPaginated instead
   */
  async getContacts(search?: string): Promise<Contact[]> {
    const response = await this.getContactsPaginated({ search, limit: 1000 });
    return response.contacts;
  }

  /**
   * Get single contact
   */
  async getContact(id: number): Promise<Contact> {
    const response = await apiClient.get<ApiResponse<Contact>>(`/contacts/${id}`);
    return response.data;
  }

  /**
   * Create a new contact
   */
  async createContact(data: CreateContactRequest): Promise<Contact> {
    const response = await apiClient.post<ApiResponse<Contact>>('/contacts', data);
    return response.data;
  }

  /**
   * Update a contact
   */
  async updateContact(id: number, data: UpdateContactRequest): Promise<Contact> {
    const response = await apiClient.put<ApiResponse<Contact>>(`/contacts/${id}`, data);
    return response.data;
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: number): Promise<void> {
    await apiClient.delete(`/contacts/${id}`);
  }

  /**
   * Delete multiple contacts
   */
  async deleteContacts(ids: number[]): Promise<void> {
    await apiClient.delete('/contacts', { params: { ids: ids.join(',') } });
  }

  /**
   * Import contacts
   */
  async importContacts(
    contacts: CreateContactRequest[]
  ): Promise<{ imported: number; failed: number }> {
    const response = await apiClient.post<ApiResponse<{ imported: number; failed: number }>>(
      '/contacts/import',
      { contacts },
      { timeout: 0 } // bulk import — never abort mid-flight (partial-apply risk)
    );
    return response.data;
  }

  /**
   * Get blocked contacts
   */
  async getBlockedContacts(): Promise<BlockedContact[]> {
    const response = await apiClient.get<ApiResponse<BlockedContact[]>>('/contacts/blocked');
    return response.data;
  }

  /**
   * Block a contact
   */
  async blockContact(phoneNumber: string, reason?: string): Promise<void> {
    await apiClient.post('/contacts/block', { phoneNumber, reason });
  }

  /**
   * Unblock a contact
   */
  async unblockContact(id: number): Promise<void> {
    await apiClient.delete(`/contacts/blocked/${id}`);
  }

  /**
   * Check if a number is blocked
   */
  async checkBlocked(phoneNumber: string): Promise<boolean> {
    const response = await apiClient.get<ApiResponse<{ blocked: boolean }>>(
      `/contacts/check-blocked/${encodeURIComponent(phoneNumber)}`
    );
    return response.data.blocked;
  }

  /**
   * Get favorite contacts
   */
  async getFavorites(): Promise<Contact[]> {
    const response = await apiClient.get<ApiResponse<Contact[]>>('/contacts/favorites');
    return response.data;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: number, isFavorite: boolean): Promise<Contact> {
    const response = await apiClient.post<ApiResponse<Contact>>(`/contacts/${id}/favorite`, {
      isFavorite,
    });
    return response.data;
  }
}

export const contactsService = new ContactsService();
