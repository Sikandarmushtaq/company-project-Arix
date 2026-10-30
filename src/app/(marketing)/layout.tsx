import ConsentBanner from '@/components/landing/ConsentBanner';
import Footer from '@/components/landing/Footer';
import MarketingErrorBoundary from '@/components/landing/MarketingErrorBoundary';
import NavBar from '@/components/landing/NavBar';
import TawkScript from '@/components/TawkScript';
import { ThemeProvider } from '@/components/landing/ThemeProvider';
import { OrganizationSchema, WebSiteSchema } from '@/lib/seo/schemas';

// Shared chrome for all marketing routes — landing, about, contact, privacy,
// terms, security. Deliberately minimal: nav + content + footer on a clean warm
// canvas. The old decorative layer (animated mesh, cursor pulse, scroll bar,
// section-dot rail, floating demo pill, confetti, back-to-top) was removed for a
// simpler, more professional feel — motion now lives only where it explains the
// product (inside sections).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrganizationSchema />
      <WebSiteSchema />
      {/* Anti-flash theme restore is mounted once site-wide in the root layout. */}
      <ThemeProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--card)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--foreground)] focus:shadow-lg"
        >
          Skip to content
        </a>

        <NavBar />
        <MarketingErrorBoundary>{children}</MarketingErrorBoundary>
        <Footer />

        <ConsentBanner />
        <TawkScript />
      </ThemeProvider>
    </>
  );
}
