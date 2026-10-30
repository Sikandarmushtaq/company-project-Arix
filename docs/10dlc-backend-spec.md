# Backend spec — Per-user 10DLC SMS campaign registration

**Audience:** prod backend team (`serverconfig/server`).
**Frontend status:** the reskin signup wizard's SMS step now collects a full 10DLC brand + campaign and submits the payload below. Until the backend accepts these fields, `PUT /api/v1/onboarding/:token/sms-campaign` will 422 on the new shape — that's expected.

## Goal

Each customer gets their **own** Telnyx/TCR **Brand** + **Campaign**; their numbers are assigned to **their** campaign so user A's 10DLC campaign is used only for user A. Today all users share one messaging profile and 10DLC is done by hand — replace that with an **admin-gated, API-driven** flow.

## Constraints (agreed with product)
1. **Support Standard (EIN) and Sole Proprietor (no EIN).**
2. **Admin-gated:** signup only **stages** the data. No Telnyx call (and no charge) until an admin clicks **Approve & register**.
3. **Two-phase:** create Brand + Campaign on approval; **assign numbers only after they're purchased/provisioned** (post-Stripe) and on a messaging profile.
4. Each org isolated to its own campaign.

## New submit payload (frontend → backend)

`PUT /api/v1/onboarding/:token/sms-campaign` body (replaces the old `legalCompanyName/companyRegistrationNumber/...` shape):

```jsonc
{
  "registrationType": "standard" | "sole_prop",
  "brand": {
    "legalCompanyName": "string",
    "entityType": "PRIVATE_PROFIT|PUBLIC_PROFIT|NON_PROFIT|GOVERNMENT",  // standard only
    "ein": "12-3456789",                                                 // standard only
    "vertical": "REAL_ESTATE|HEALTHCARE|...",
    "email": "string", "phone": "string",
    "street": "string", "city": "string", "state": "string",
    "postalCode": "string", "country": "US|CA",
    "website": "https://..."                                             // optional
  },
  "campaign": {
    "usecase": "MIXED|MARKETING|CUSTOMER_CARE|2FA|...",
    "description": "string (>=40)",
    "sample1": "string", "sample2": "string",
    "messageFlow": "string (40-2048)",
    "helpMessage": "string",
    "optinKeywords": "START, YES", "optoutKeywords": "STOP, UNSUBSCRIBE", "helpKeywords": "HELP",
    "termsUrl": "https://...", "privacyUrl": "https://...",
    "embeddedLink": false, "embeddedPhone": false, "ageGated": false
  },
  "smsNumbers": ["+1..."],   // which order numbers to register
  "documents": [ { "name": "...", "key": "...", "type": "...", "size": 123 } ]  // optional
}
```

Update `smsCampaignSchema` (`src/modules/onboarding/onboarding.schema.ts`) and `onboardingService.submitSmsCampaign` (`src/modules/onboarding/onboarding.service.ts`) to accept + persist this. **Store only — do not call Telnyx here.** Set `campaign_status = 'staged'`.

## Data model

New table `org_messaging_10dlc` (keyed by `order_id` pre-provision, backfilled with `organization_id` when the org is created):

| column | notes |
|---|---|
| `id`, `order_id`, `organization_id` (nullable until provisioned) | |
| `registration_type` | `standard` \| `sole_prop` |
| brand columns | `legal_company_name`, `entity_type`, `ein`, `vertical`, `email`, `phone`, `street`, `city`, `state`, `postal_code`, `country`, `website` |
| campaign columns | `usecase`, `description`, `sample1`, `sample2`, `message_flow`, `help_message`, `optin_keywords`, `optout_keywords`, `help_keywords`, `terms_url`, `privacy_url`, `embedded_link`, `embedded_phone`, `age_gated` |
| `sms_numbers` (JSON) | E.164 numbers to assign once provisioned |
| `telnyx_brand_id`, `telnyx_campaign_id` | filled on approval |
| `brand_status`, `campaign_status` | `staged`→`brand_created`→`campaign_pending`→`campaign_approved`/`rejected` |
| `vetting_score` (nullable) | from brand vetting |
| `admin_approved_at`, `admin_approved_by` | |
| timestamps | |

## Telnyx service methods (new, in `src/integrations/telnyx/telnyx.service.ts`)

Base `https://api.telnyx.com/v2`, auth `Bearer ${TELNYX_API_KEY}` (same provisioning key already used).

- `createBrand(brand)` → `POST /10dlc/brand` → returns `brandId`. Map our fields directly (`entityType`, `displayName` = legalCompanyName, `companyName`, `ein`, `phone`, `email`, `street`, `city`, `state`, `postalCode`, `country`, `vertical`).
- `createSoleProprietorBrand(brand)` → sole-prop brand + Telnyx phone-OTP verification flow (`entityType: SOLE_PROPRIETOR`, no `ein`). **The OTP target is `brand.phone`** — in sole-prop mode the frontend labels that field "Mobile number (for verification)". Handle the OTP send/verify sub-steps.
- `requestVetting(brandId)` → `POST /10dlc/brand/{brandId}/vetting` (`vettingProvider: "AEGIS"`, `vettingClass: "STANDARD"`). Optional.
- `createCampaign(campaign)` → `POST /10dlc/campaignBuilder` (`brandId`, `usecase`, `description`, `sample1`, `sample2`, `messageFlow`, `helpMessage`, `optinKeywords`, `optoutKeywords`, `helpKeywords`, `embeddedLink`, `ageGated`, + terms/privacy in the CTA/message-flow per TCR). **Hardcode `subscriberOptin: true`, `subscriberOptout: true`, `subscriberHelp: true`** — the form always collects the keywords + messages, so all three flows are present. Returns `campaignId`, status **pending carrier approval**.
- `assignNumberToCampaign(phoneNumber, campaignId)` → `POST /10dlc/phoneNumberCampaign`. **Number must already be purchased + on a messaging profile.**
- `getBrand(brandId)` / `getCampaign(campaignId)` → status polling (`vettingScore`, campaign approval state).

## Endpoints

1. **Stage** (extend existing): `PUT /onboarding/:token/sms-campaign` — validate + store, `campaign_status='staged'`. No Telnyx.
2. **Admin list/detail:** `GET /admin/10dlc` + `GET /admin/10dlc/:id` — super-admin only, for review.
3. **Admin approve:** `POST /admin/10dlc/:id/approve` — the only place that spends money:
   - `createBrand` (or `createSoleProprietorBrand`) → store `telnyx_brand_id`, `brand_status='brand_created'`.
   - optional `requestVetting`.
   - `createCampaign` → store `telnyx_campaign_id`, `campaign_status='campaign_pending'`.
   - Do **not** assign numbers yet (not provisioned).
   - Record `admin_approved_at/by`.
4. **Admin reject:** `POST /admin/10dlc/:id/reject` — mark rejected, no Telnyx.

## Post-provisioning hook (Stripe/provisioning phase)

After a number is purchased and attached to a messaging profile (the existing/next provisioning path), for each number in `sms_numbers` with a `telnyx_campaign_id`, call `assignNumberToCampaign`. Retry/queue since provisioning is async.

## Status sync + send gating

- Poll `getCampaign`/`getBrand` (cron) or wire the Telnyx 10DLC webhook to update `campaign_status`/`vetting_score`.
- **SMS send gate** (`src/modules/sms/telnyx-sms-client.ts` / `sms.service.ts`): a `from` number registered to a per-user campaign may only send once `campaign_status='campaign_approved'`. Until then, block with a clear "SMS pending carrier approval" error (or fall back to the shared `TELNYX_MESSAGING_PROFILE_ID` only if explicitly allowed).

## Notes
- **US-only:** 10DLC/TCR applies to US numbers only; the frontend fixes the brand country to `US`. If a customer selected a Canadian number in the number step, it can't be 10DLC-registered — either exclude CA numbers from `smsNumbers` or surface that in review.
- **EIN** arrives as 9 bare digits (frontend strips the formatting dash).
- Telnyx account must be 10DLC-enabled for `TELNYX_API_KEY`.
- Costs (per org): brand ~$4 one-time, campaign ~$1.50–$10/mo by use case, vetting ~$40 optional — incurred **only on admin approve**.
- Field enums the frontend sends match TCR/Telnyx exactly (see `src/components/signup/tenDlcOptions.ts` in the reskin).
