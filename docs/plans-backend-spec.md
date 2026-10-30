# Backend spec — Signup plans (Starter / Professional / Custom) + plan billing

**Audience:** prod backend team (`serverconfig/server`).
**Frontend status:** the signup funnel now starts with a **Choose plan** step (Starter $60/mo, Professional $120/mo, Custom). Starter/Professional are self-serve → the chosen plan is what Stripe must charge. Custom → the existing **lead** flow (`createLead`) into admin. The number is **included in the plan** (search now only surfaces standard ~$1 numbers and shows them as "Included").

## Goal
Charge the **selected plan** (a Stripe recurring subscription, monthly or yearly) at checkout — not the per-number $1. The first phone number is **included** in the plan.

## 1. Store the plan on the order
`createOrder` now receives two new optional fields:
```jsonc
{ ...existing, "planSlug": "starter"|"professional", "billingPeriod": "monthly"|"yearly" }
```
Extend `createOrderSchema` + persist on the signup order. Add columns `plan_slug`, `billing_period` (and expose them on `getOrder` / `SignupOrderData` as `planSlug`, `billingPeriod`, plus `planMonthlyCents` for the review display).

## 2. Stripe Products / Prices (need to be created)
Create recurring Stripe **Prices** for each plan × billing and map them:
| plan | monthly | yearly |
|---|---|---|
| starter | $60/mo | $60 × 12 × (1 − 0.20) annually |
| professional | $120/mo | $120 × 12 × (1 − 0.20) annually |

Yearly = 20% off (`YEARLY_DISCOUNT = 0.2`, matches the landing + `plans.ts`). Store the four price IDs in config/env and map `(planSlug, billingPeriod) → priceId`.

## 3. Checkout charges the plan (number included)
In `createCheckout` (`onboarding.service.ts`), build the Stripe Checkout Session from the order's `plan_slug` + `billing_period`:
- **Line item = the plan's recurring price** (subscription mode — already supported).
- **Number is included** → do **not** add the $1/mo number price as a charged line item. (Keep provisioning the number, just don't bill it separately.) If you later meter extra numbers, add them only beyond the included quantity.
- Keep `success_url`/`cancel_url` from the frontend `returnUrl` (already wired).

## 4. Number pricing / search
The number is included, so the frontend filters search to standard (~$1) numbers and hides the price. Backend: ensure provisioning still assigns the number; just don't bill it as a separate recurring item. (Optional: mark the included number's line item `$0`.)

## 5. Custom plan → lead (already exists)
Custom is **not** self-serve. The frontend routes it to the existing `LeadSignupForm` → `POST /onboarding/lead` (`createLead`), which already lands in the admin Signups view. Requirement: the admin should show these under a **"Custom" tab/filter** (leads with no order/payment, carrying `interestedFeatures` + `quantityOfDialers` + WhatsApp/email). If not already distinguishable, tag lead-type signups so admin can filter them.

## 6. Provisioning / entitlements (tie-in)
When provisioning after payment, set the org's module entitlements from the plan:
- **Starter**: calling + recording (manual). No WhatsApp/SMS.
- **Professional**: calling + auto-recording + WhatsApp + SMS + campaigns + analytics.
Use the existing `tenant_module_entitlements` so the reskin's per-page gating reflects the plan.

## Notes
- Plan catalog SSOT on the frontend: `src/components/signup/plans.ts` (slugs, prices, `YEARLY_DISCOUNT`). Keep the Stripe prices in sync with it.
- Until this ships, `createOrder` will accept `planSlug`/`billingPeriod` only after the schema is extended; checkout will still charge the old number line until step 3 lands.
