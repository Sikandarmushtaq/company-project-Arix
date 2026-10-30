'use client';

import { type ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import { useAuthStore } from '@/lib/stores/auth';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Auth hydration guard - prevents flash of login page on refresh
 * Shows a loading screen until zustand has hydrated from localStorage
 */
function AuthHydrationGuard({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Root providers component
 * Wraps the app with all necessary context providers
 */
export function Providers({ children }: ProvidersProps) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // If Google Client ID is not configured, render without Google OAuth
  if (!googleClientId) {
    return (
      <QueryProvider>
        <AuthHydrationGuard>{children}</AuthHydrationGuard>
      </QueryProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryProvider>
        <AuthHydrationGuard>{children}</AuthHydrationGuard>
      </QueryProvider>
    </GoogleOAuthProvider>
  );
}
