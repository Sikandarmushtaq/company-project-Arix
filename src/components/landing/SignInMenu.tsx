'use client';

import Link from 'next/link';

/**
 * Landing-page "Sign in" link. ONE neutral login for everyone — after
 * authenticating, the user is routed by role to the right app (dialer vs portal)
 * by postLoginHref, so there is no destination to pick up front. Relative
 * `/login` keeps them on the current host (the apex landing).
 */
export default function SignInMenu() {
  return (
    <Link
      href="/login"
      className="hidden items-center justify-center rounded-full bg-[#17120e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--coral)] sm:inline-flex"
    >
      Sign in
    </Link>
  );
}