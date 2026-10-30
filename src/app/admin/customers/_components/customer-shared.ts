/**
 * Shared types + constants for the /admin/customers page family.
 *
 * Kept in one file so every extracted component (CustomerRow, CustomerForm,
 * CustomerLockoutsSection, etc.) imports from a single source of truth
 * for status enums, palette, and the OrgMember shape.
 */

import type { CustomerStatus } from '@/lib/api/services/customers.api';

/**
 * Minimal user shape used by the assignment dropdowns. Comes from
 * /api/v1/whatsapp/org/users (a deployed-module replacement for the
 * org-portal endpoint that's currently excluded from the build).
 */
export interface OrgMember {
  id: number;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'user';
}

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  new: 'New',
  active: 'Active',
  closed: 'Closed',
  dnc: 'Do not contact',
};

export const STATUS_COLORS: Record<CustomerStatus, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  dnc: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
