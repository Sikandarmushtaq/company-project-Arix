import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { DebugLoggerInit } from '@/components/DebugLoggerInit';
import { MetaPixel } from '@/components/MetaPixel';
import { Providers } from '@/components/Providers';
import NoFlashTheme from '@/components/landing/NoFlashTheme';
import { SupportWidget } from '@/components/support/SupportWidget';
import { ToastContainer } from '@/components/ui/Toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', // Performance: prevent FOIT (Flash of Invisible Text)
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arixcall.com'),
  title: {
    default: 'ArixCall — Cloud Dialer with Unlimited Calling, Bulk SMS & Recording',
    template: '%s · ArixCall',
  },
  description:
    'ArixCall — the all-in-one cloud softphone: unlimited calling, bulk SMS and call recording. Connect · Communicate · Convert.',
  applicationName: 'ArixCall',
  // Favicon / app icons resolve from the App Router file conventions:
  // src/app/{icon.png, apple-icon.png}. PWA icons come from src/app/manifest.ts.
  // No manual `icons` here so those aren't overridden.
};

// Mobile viewport. `viewportFit: 'cover'` is REQUIRED for the
// `env(safe-area-inset-*)` helpers (Android gesture nav / notches) to resolve
// to non-zero values. We deliberately do NOT set maximumScale/userScalable —
// pinch-to-zoom stays enabled for accessibility.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffdfc' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Meta (Facebook) Pixel — PUBLIC/marketing pages only; never inside the
            authenticated app (privacy + its CSP-blocked click tracking was swallowing
            in-app button actions). See components/MetaPixel.tsx. */}
        <MetaPixel />
        {/* Restore the saved theme before paint — site-wide, so refresh keeps it. */}
        <NoFlashTheme />
        <DebugLoggerInit />
        <Providers>
          {children}
          {/* Public support bubble — self-hides for logged-in users. */}
          <SupportWidget />
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
