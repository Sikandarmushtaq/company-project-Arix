/**
 * Status Styles - SINGLE SOURCE OF TRUTH
 * Shared Tailwind class mappings for status badges across superadmin and org pages.
 */

/** Order status styles (signup_orders.status) */
export const ORDER_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  numbers_selected: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  checkout_pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  payment_processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  provisioning: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  pending_verification: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

/** SMS review status styles (sms_campaign_reviews.status) */
export const REVIEW_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  in_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  more_info_needed: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

/** Number provisioning status styles */
export const NUMBER_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  purchased: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  configured: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  released: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

/** User role badge styles (admin_users.role) */
export const ROLE_BADGE_STYLES: Record<string, string> = {
  superadmin: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  owner: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  user: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

/** User role display names */
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrator',
  owner: 'Owner',
  manager: 'Manager',
  user: 'User',
};

/** Format status string for display (snake_case -> Title Case) */
export function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
