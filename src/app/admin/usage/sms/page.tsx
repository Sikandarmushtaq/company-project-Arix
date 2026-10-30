/**
 * Usage hub → SMS tab.
 *
 * Re-exports the existing admin SMS-usage page component so it renders under the
 * /admin/usage tabbed shell without duplicating its ~900 lines. The original route
 * (/admin/sms/usage) still resolves and is also imported by the org SMS-usage page,
 * so nothing that referenced it breaks.
 */
export { default } from '@/app/admin/sms/usage/page';
