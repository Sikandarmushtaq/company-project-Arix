// Reusable JSON-LD schema components for SEO. Each renders a <script
// type="application/ld+json"> tag with safely-escaped content (any "</script>"
// substring inside a string value is escaped to prevent the browser from
// interpreting it as a closing tag and breaking out of the script block).
//
// Usage from any server component:
//
//   <OrganizationSchema />
//   <FAQPageSchema items={faqs} />
//   <BreadcrumbListSchema items={[{ name: 'Home', url: '/' }, ...]} />

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arixcall.com';

function safeStringify(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function Ld({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeStringify(data) }}
    />
  );
}

// ─── Organization ─────────────────────────────────────────────────────────────

export function OrganizationSchema() {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'ArixCall',
        alternateName: 'Arixcall',
        legalName: 'Bitnex Technologies',
        url: SITE_URL,
        logo: `${SITE_URL}/arix-icon-512.png`,
        image: `${SITE_URL}/arix-icon-512.png`,
        description:
          'Cloud dialer combining unlimited SIP voice calling, bulk SMS and call recording in one softphone.',
        foundingDate: '2024',
        sameAs: [
          'https://instagram.com/bitnextechnologies',
          'https://www.linkedin.com/company/bitnex-technologies/',
          'https://facebook.com/bitnextechnologies',
        ],
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'sales',
            email: 'sales@arixcall.com',
            availableLanguage: ['English'],
          },
          {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: 'support@arixcall.com',
            availableLanguage: ['English'],
          },
          {
            '@type': 'ContactPoint',
            contactType: 'security',
            email: 'security@arixcall.com',
            availableLanguage: ['English'],
          },
        ],
      }}
    />
  );
}

// ─── WebSite (with site-wide SearchAction potential) ─────────────────────────

export function WebSiteSchema() {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'ArixCall',
        alternateName: 'Arixcall',
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-US',
      }}
    />
  );
}

// ─── SoftwareApplication (the product) ───────────────────────────────────────

export function SoftwareApplicationSchema() {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: 'ArixCall',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'CommunicationApplication',
        operatingSystem: 'Web, iOS, Android',
        url: SITE_URL,
        description:
          'Cloud dialer for revenue teams. Unlimited SIP voice calling, bulk SMS campaigns and compliance-grade call recording — all in one softphone.',
        publisher: { '@id': `${SITE_URL}/#organization` },
        featureList: [
          'Unlimited SIP voice calling',
          'Bulk SMS campaigns',
          'Compliance-grade call recording',
          'Multi-tenant organization isolation',
          'TLS / SRTP encryption',
        ],
        offers: [
          {
            '@type': 'Offer',
            name: 'Basic',
            price: '59',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: '59',
              priceCurrency: 'USD',
              billingDuration: 'P1M',
              billingIncrement: 1,
              unitCode: 'MON',
            },
            url: `${SITE_URL}/#pricing`,
          },
          {
            '@type': 'Offer',
            name: 'Pro',
            url: `${SITE_URL}/#pricing`,
          },
        ],
      }}
    />
  );
}

// ─── FAQPage (auto-generated from the FAQ content array) ─────────────────────

export interface FAQItem {
  q: string;
  a: string;
}

export function FAQPageSchema({ items }: { items: FAQItem[] }) {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a,
          },
        })),
      }}
    />
  );
}

// ─── ContactPage ─────────────────────────────────────────────────────────────

export function ContactPageSchema() {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        '@id': `${SITE_URL}/contact#contactpage`,
        url: `${SITE_URL}/contact`,
        name: 'Contact ArixCall',
        about: { '@id': `${SITE_URL}/#organization` },
        mainEntity: { '@id': `${SITE_URL}/#organization` },
      }}
    />
  );
}

// ─── BreadcrumbList (per-page trail) ─────────────────────────────────────────

export interface BreadcrumbItem {
  name: string;
  /** Path relative to site root (e.g. "/about") or absolute URL. */
  url: string;
}

export function BreadcrumbListSchema({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: item.name,
          item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
        })),
      }}
    />
  );
}
