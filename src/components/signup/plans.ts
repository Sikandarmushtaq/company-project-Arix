/**
 * Signup plan catalog — mirrors the landing Pricing tiers so the funnel and the
 * marketing page never drift. Two tiers: Basic (self-serve Stripe checkout,
 * monthly-only) and Pro (contact-sales — routes to a lead form / support, no
 * card charge). Basic keeps the internal slug 'starter' and Pro keeps 'custom'
 * so backend price-env keys and lead-form routing stay stable.
 *
 * Prices are display-only here; the ACTUAL charge is the Stripe recurring Price
 * the backend maps from (planSlug, billingPeriod). See docs/plans-backend-spec.md.
 */

export type PlanSlug = 'starter' | 'professional' | 'custom';
export type BillingPeriod = 'monthly' | 'yearly';

export interface Plan {
  name: string;
  slug: PlanSlug;
  monthly: number | null; // null = custom (no fixed price)
  description: string;
  channels: { sip: boolean; whatsapp: boolean; ai: boolean; recording: boolean; sms: boolean };
  features: string[];
  highlighted: boolean;
  /** Self-serve via Stripe checkout. Custom is false → lead form. */
  selfServe: boolean;
  /** Explicit PKR list price in minor units (paisa) */
  monthlyPkrMinor?: number | null;
  /** Frozen Stripe USD amount in cents */
  stripeUsdAmountCents?: number | null;
}

export const YEARLY_DISCOUNT = 0.2;

export const PLANS: Plan[] = [
  {
    name: 'Basic',
    slug: 'starter',
    monthly: 59,
    stripeUsdAmountCents: 5900,
    monthlyPkrMinor: 1652000,
    description: 'Calls + SMS to get your team started.',
    channels: { sip: true, whatsapp: false, ai: false, recording: true, sms: true },
    features: [
      'Multi Devices',
      'Unlimited domestic calls',
      'SMS enabled',
      'Call recording',
      'Email support',
    ],
    highlighted: true,
    selfServe: true,
  },
  {
    name: 'Pro',
    slug: 'custom',
    monthly: null,
    stripeUsdAmountCents: null,
    monthlyPkrMinor: null,
    description: 'Higher limits and dedicated support for growing teams.',
    channels: { sip: true, whatsapp: true, ai: false, recording: true, sms: true },
    features: [
      'Everything in Basic',
      'Unlimited domestic calling + volume SMS packages',
      'Instant SMS activation',
      'Custom user & usage limits',
      'Advanced analytics',
      'Dedicated support + SLA',
    ],
    highlighted: false,
    selfServe: false,
  },
];

export function getPlan(slug: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.slug === slug);
}

/** Display price for a plan+billing (yearly applies the discount, shown as /mo). */
export function planPriceLabel(plan: Plan, billing: BillingPeriod): string {
  if (plan.monthly === null) return 'Custom';
  const perMonth = billing === 'yearly' ? Math.round(plan.monthly * (1 - YEARLY_DISCOUNT)) : plan.monthly;
  return `$${perMonth}`;
}

