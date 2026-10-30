import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-aware routing for the arixcall.com subdomain split.
 *
 *   app.arixcall.com   → the dialer  (/phone)
 *   admin.arixcall.com → the portals (/org, /admin)
 *
 * One codebase / one deploy serves both. Each managed path has ONE canonical
 * host; whenever a managed path is requested on any *other* arixcall.com host
 * — the wrong subdomain, the bare apex (arixcall.com), or www — this bounces it
 * to the canonical host, preserving path + query. Auth carries across via the
 * shared `.arixcall.com` SSO cookie (see lib/auth-cookie.ts), so the bounce
 * lands already-signed-in.
 *
 * SCOPE / SAFETY: it only acts on the arixcall.com domain family. On the
 * sslip.io test box, localhost, and nuxcall.com it is a no-op — every route
 * serves unchanged. Unmanaged paths (marketing, /login, …) are never touched:
 * they stay on whatever arixcall host was requested.
 */

const APP_HOST = 'app.arixcall.com';
const ADMIN_HOST = 'admin.arixcall.com';

// Portal routes belong on admin.; dialer routes belong on app.
const ADMIN_PREFIXES = ['/org', '/admin'];
const APP_PREFIXES = ['/phone'];

// Any host in the arixcall.com family (apex, www, or any subdomain). A leading
// `(^|\.)` guards against look-alikes like "evilarixcall.com".
const ARIX_DOMAIN = /(^|\.)arixcall\.com$/i;

function hostname(req: NextRequest): string {
  // Behind Cloudflare + nginx the real host is in the Host header (proxy sets
  // proxy_set_header Host $host). Strip any :port for comparison.
  return (req.headers.get('host') || '').split(':')[0].toLowerCase();
}

function matches(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const host = hostname(req);

  // Only the arixcall.com family is split. Everything else is untouched.
  if (!ARIX_DOMAIN.test(host)) {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;

  // Canonical host for this path (null = not a managed path → leave it alone).
  const canonicalHost = matches(pathname, ADMIN_PREFIXES)
    ? ADMIN_HOST
    : matches(pathname, APP_PREFIXES)
      ? APP_HOST
      : null;

  if (canonicalHost && host !== canonicalHost) {
    return NextResponse.redirect(`https://${canonicalHost}${pathname}${search}`);
  }

  // Bare root of an app subdomain is not a marketing page — the landing lives on
  // the apex (arixcall.com). Send it to /login, which then routes onward by role
  // (signed-in → the app home, signed-out → the login form). The apex + www keep
  // their landing (they aren't split hosts).
  if (pathname === '/' && (host === APP_HOST || host === ADMIN_HOST)) {
    return NextResponse.redirect(`https://${host}/login`);
  }

  return NextResponse.next();
}

// Only run for the routes that can be on the wrong host. Static assets, _next,
// and the API proxy are excluded so nothing hot-path pays for this.
export const config = {
  matcher: ['/', '/org/:path*', '/admin/:path*', '/phone/:path*'],
};
