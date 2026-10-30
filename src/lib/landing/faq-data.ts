// Single source of truth for FAQ content. Used by:
//   • components/landing/FAQ.tsx — renders the accordion
//   • app/(marketing)/landing/page.tsx — emits FAQPage JSON-LD so Google
//     can show rich-result snippets in SERPs (eligible when at least one
//     question/answer pair is on-page and matches the schema).

export interface FAQItem {
  q: string;
  a: string;
}

export const faqItems: FAQItem[] = [
  {
    q: 'Can I bring my own SIP trunk?',
    a: "Yes. ArixCall is carrier-agnostic. We support direct SIP trunking from any major provider — bring Twilio, Bandwidth, Telnyx, or your own carrier — and route inbound, outbound, or both. Default outbound is via our trunk if you don't bring one.",
  },
  {
    q: 'How does the bulk SIM SMS campaign feature work?',
    a: 'You upload (or sync from CRM) a contact list, write your message, set send rate and active SIMs, and ArixCall handles the rest. Bulk SIM-based delivery means no shortcode rentals or A2P markup, and you get real-time delivery state plus opt-out handling out of the box.',
  },
  {
    q: 'How long does it take to spin up the AI auto-dialer?',
    a: 'A new AI agent takes about 10 minutes to configure: pick a voice, drop in your script, set the qualification questions, set calling hours and concurrency. You can be running a campaign the same day. Powered by best-in-class natural voice AI.',
  },
  {
    q: 'Is call recording legal where I operate?',
    a: 'Recording laws vary by jurisdiction. ArixCall ships per-organization retention rules, two-party consent prompts, and DNC compliance out of the box. For regulated industries (healthcare, finance), we offer encrypted-at-rest storage and per-tenant key management.',
  },
  {
    q: 'What happens if a channel goes down?',
    a: 'Each channel fails independently. Voice runs on a high-availability SIP stack with automatic carrier failover. The AI auto-dialer pauses campaigns and resumes on recovery — no calls are lost mid-flight. Bulk SMS retries failed sends automatically.',
  },
  {
    q: 'Can I white-label it for my clients?',
    a: 'Yes. Enterprise plans include white-label domains, per-tenant theming, and isolated org tenancy from the schema up. Each of your clients gets their own users, contacts, recordings, and billing — you stay branded as the operator.',
  },
];
