/**
 * 10DLC (TCR / Telnyx) option lists + defaults for the SMS campaign step.
 * Values are the exact enum strings Telnyx/TCR expects; labels are human-facing.
 * Keeping them here (not inline) so the form and any future admin/review UI
 * share one source of truth.
 */

/** Brand entity types for a Standard (EIN) brand. Sole-prop is handled by the
 *  registration-type toggle, not this list. */
export const ENTITY_TYPES = [
  { value: 'PRIVATE_PROFIT', label: 'Private company (for-profit)' },
  { value: 'PUBLIC_PROFIT', label: 'Public company (for-profit)' },
  { value: 'NON_PROFIT', label: 'Non-profit' },
  { value: 'GOVERNMENT', label: 'Government' },
] as const;

/** TCR industry verticals (common subset). */
export const VERTICALS = [
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'PROFESSIONAL', label: 'Professional services' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'HOSPITALITY', label: 'Hospitality' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'ENERGY', label: 'Energy & Utilities' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'AGRICULTURE', label: 'Agriculture' },
  { value: 'NGO', label: 'Non-governmental org' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'LEGAL', label: 'Legal' },
] as const;

/** TCR campaign use cases (standard). */
export const USE_CASES = [
  { value: 'MIXED', label: 'Mixed (multiple message types)' },
  { value: 'MARKETING', label: 'Marketing & promotions' },
  { value: 'CUSTOMER_CARE', label: 'Customer care' },
  { value: 'ACCOUNT_NOTIFICATION', label: 'Account notifications' },
  { value: 'DELIVERY_NOTIFICATION', label: 'Delivery notifications' },
  { value: '2FA', label: 'Two-factor auth (2FA)' },
  { value: 'FRAUD_ALERT', label: 'Fraud alerts' },
  { value: 'SECURITY_ALERT', label: 'Security alerts' },
  { value: 'POLLING_VOTING', label: 'Polling & voting' },
  { value: 'PUBLIC_SERVICE_ANNOUNCEMENT', label: 'Public service announcement' },
] as const;

/** Stock exchanges for a publicly-traded (PUBLIC_PROFIT) brand — TCR enum values. */
export const STOCK_EXCHANGES = [
  { value: 'NASDAQ', label: 'NASDAQ' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'AMEX', label: 'NYSE American (AMEX)' },
  { value: 'NYSE_AMERICAN', label: 'NYSE American' },
  { value: 'LSE', label: 'London (LSE)' },
  { value: 'EURONEXT', label: 'Euronext' },
  { value: 'TSX', label: 'Toronto (TSX)' },
  { value: 'ASX', label: 'Australia (ASX)' },
  { value: 'HKEX', label: 'Hong Kong (HKEX)' },
  { value: 'OTHER', label: 'Other' },
] as const;

/** Sensible, editable defaults so customers don't start from a blank campaign. */
export const CAMPAIGN_DEFAULTS = {
  optinKeywords: 'START, YES',
  optoutKeywords: 'STOP, UNSUBSCRIBE',
  helpKeywords: 'HELP',
  helpMessage: 'Reply HELP for help or STOP to unsubscribe. Msg & data rates may apply.',
  // Confirmation messages carriers expect when opt-in / opt-out are attested.
  optinMessage:
    'You are now opted in to messages from our business. Msg & data rates may apply. Reply HELP for help, STOP to unsubscribe.',
  optoutMessage: 'You have been unsubscribed and will receive no further messages. Reply START to opt back in.',
} as const;

export type RegistrationType = 'standard' | 'sole_prop';
