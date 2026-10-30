'use client';

/**
 * /admin/whatsapp/billing — manager monthly billing, inside the admin shell.
 * Same per-org component owners use at /org/whatsapp/billing. The backend
 * scopes everything to the caller's organization.
 */
import { OrgWaBillingManager } from '@/components/whatsapp';

export default function AdminWhatsAppBillingPage() {
  return <OrgWaBillingManager />;
}
