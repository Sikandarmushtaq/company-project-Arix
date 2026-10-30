'use client';

/**
 * /org/customers — owner+manager customer management.
 *
 * Same component as /admin/customers, rendered inside the org shell so
 * owners and managers can manage the customer pool without crossing into
 * the platform-admin layout. The customer concept is per-org, not
 * platform-wide; the admin shell's version remains for backward compat
 * and the manager flow that lives there.
 */

import CustomersPage from '@/app/admin/customers/page';

export default function OrgCustomersPage() {
  return <CustomersPage />;
}
