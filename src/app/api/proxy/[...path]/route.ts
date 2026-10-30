import { NextRequest, NextResponse } from 'next/server';
import { Agent } from 'undici';
import { lookup as dnsLookup } from 'dns';

/**
 * Backend URL from environment variable
 * Configure via NEXT_PUBLIC_SOCKET_URL or BACKEND_URL
 * Falls back to localhost for development
 */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || process.env.BACKEND_URL || 'http://localhost:3500';

/**
 * DEV-ONLY DNS override map for the proxy fetch.
 *
 * Why this exists: in production the proxy fetches the backend by its public
 * hostname (e.g. `manual.bitnexdial.com`). On a developer machine, that
 * lookup goes through the OS resolver — which on some Windows setups returns
 * NXDOMAIN even when Google/Cloudflare DNS resolve the same name correctly
 * (ISP-side caching, VPN interception, etc.). The result is every
 * `/api/proxy/*` route returning 502 with "fetch failed (ENOTFOUND)" and the
 * dev can't even log in.
 *
 * The override below pins specific hostnames to known IPs at the TCP layer
 * ONLY. TLS SNI and cert validation still use the URL hostname, so HTTPS
 * stays fully validated end-to-end. Add a hostname here only if its IP is
 * stable enough to hardcode (servers we control, with documented IPs).
 *
 * NOT used in production (`NODE_ENV === 'production'` skips the dispatcher).
 */
const DEV_DNS_OVERRIDES: Record<string, string> = {
  'manual.bitnexdial.com': '209.38.63.154',
};

const devProxyDispatcher =
  process.env.NODE_ENV !== 'production'
    ? new Agent({
        // `connect.lookup` is typed as undici's stricter `LookupFunction`,
        // which is narrower than Node's runtime DNS lookup signature
        // (Node's typing allows `family: 'IPv4' | 'IPv6'` strings, undici's
        // doesn't). We forward whatever undici hands us untouched, so the
        // runtime shape is fine; just cast the connect block so TS doesn't
        // try to reconcile the two.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connect: {
          // Undici calls this with either the legacy single-result signature
          // `(err, address, family)` OR — when `options.all === true` — the
          // multi-result `(err, addresses)` form where addresses is an array
          // of `{address, family}`. We have to match whichever shape it's
          // asking for; returning a string when it wants an array gives
          // "Invalid IP address: undefined".
          lookup(
            hostname: string,
            opts: { all?: boolean; family?: number; hints?: number } | number,
            cb: (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) => void
          ) {
            const override = DEV_DNS_OVERRIDES[hostname];
            if (override) {
              const wantAll = typeof opts === 'object' && opts?.all === true;
              if (wantAll) {
                cb(null, [{ address: override, family: 4 }]);
              } else {
                cb(null, override, 4);
              }
              return;
            }
            // Fall back to the OS resolver for any other hostname. Cast
            // around the strict overload — Node's typings narrow `opts`
            // by overload but we forward whatever undici handed us.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (dnsLookup as any)(hostname, opts, cb);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
    : undefined;

/**
 * Only log in development mode to prevent leaking sensitive data in production
 * SECURITY: Never log authorization headers, cookies, or request bodies in production
 */
const isDev = process.env.NODE_ENV === 'development';

// ── Cross-subdomain session cookie (BFF pattern) ─────────────────────────────
// The reskin runs on app.arixcall.com (dialer) + admin.arixcall.com (portals);
// localStorage is per-origin, so a login on one wouldn't carry to the other.
// Instead of mirroring the JWT into a JS-readable cookie (XSS-exposed, and
// dropped by Chrome's cookie protections), this BFF delivers the JWT in an
// HttpOnly, Domain=.arixcall.com, SameSite=Lax cookie. JS can't read it, so we
// read it here server-side and forward it upstream as the Bearer token. This is
// the OWASP-recommended SPA auth shape (HttpOnly cookie + backend-for-frontend).
const SESSION_COOKIE = 'arix_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Read one cookie value out of a raw Cookie header, or null. */
function readCookieHeader(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

/** Is the browser-facing host part of the arixcall.com family? */
function isArixHost(host: string | null): boolean {
  return !!host && /(^|\.)arixcall\.com$/i.test(host.split(':')[0]);
}

// Log backend URL once on first request (helps debug connection issues)
let backendUrlLogged = false;

async function proxyRequest(request: NextRequest, path: string) {
  // Build URL with query params.
  //
  // Token-injection for media streaming: `<audio>`/`<video>` elements can't set
  // an Authorization header, so authenticated stream URLs carry the Bearer session
  // token as a `?token=` query param instead. For those we pull it out, turn it
  // into an Authorization header below, and STRIP it from the query forwarded
  // upstream so the backend never sees the session token in its URL / logs.
  //
  // CRITICAL: this must apply ONLY to media-stream paths. Other endpoints carry a
  // `token` QUERY param as DATA, not as a session credential — notably the public
  // `auth/reset-password/validate?token=<resetToken>`. Stripping it there sent the
  // backend an empty query (`token` undefined) → it returned {valid:false} → the UI
  // showed "This reset link has expired or is invalid" for every link, even valid
  // ones. So scope the strip/inject to media paths; everyone else keeps their
  // `token` query param intact. (Guest support already sidesteps this with `?gt=`.)
  const isMediaStreamPath = path.startsWith('recordings') || path.startsWith('voicemail');
  const forwardedParams = new URLSearchParams(request.nextUrl.searchParams);
  const injectedToken = isMediaStreamPath ? forwardedParams.get('token') : null;
  if (injectedToken) forwardedParams.delete('token');
  const searchParams = forwardedParams.toString();
  const queryString = searchParams ? `?${searchParams}` : '';

  // Handle special routes - map frontend endpoints to backend /api/v1/ endpoints
  let url: string;

  if (path === 'auth/login') {
    // Login endpoint
    url = `${BACKEND_URL}/api/v1/auth/login${queryString}`;
  } else if (path === 'auth/logout') {
    url = `${BACKEND_URL}/api/v1/auth/logout${queryString}`;
  } else if (path.startsWith('auth/')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else if (path.startsWith('calls')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else if (path.startsWith('voicemail')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else if (path.startsWith('contacts')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else if (path.startsWith('sms')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else if (path.startsWith('recordings')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else if (path.startsWith('autodialer')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else if (path.startsWith('admin')) {
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  } else {
    // Default: use /api/v1/ prefix
    url = `${BACKEND_URL}/api/v1/${path}${queryString}`;
  }

  // Log backend URL once to help debug connection issues
  if (!backendUrlLogged) {
    console.log(`[Proxy] Backend URL: ${BACKEND_URL}`);
    backendUrlLogged = true;
  }

  if (isDev) {
    console.log(`[Proxy] ${request.method} ${url}`);
  }

  // Forward cookies from the request
  const cookieHeader = request.headers.get('cookie') || '';
  const authHeader = request.headers.get('authorization') || '';
  const requestContentType = request.headers.get('content-type') || '';

  // Prepare headers
  const headers: Record<string, string> = {};

  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  // ── Authoritative credential selection (BFF pattern) ────────────────────────
  // The server-managed HttpOnly `arix_session` cookie is the SOURCE OF TRUTH for
  // authenticating a proxied request. It is XSS-safe, shared across every
  // *.arixcall.com subdomain, and re-minted on every auth response, so it is
  // always at least as fresh as any per-origin `localStorage` token. Precedence:
  //
  //   1. arix_session cookie      (authoritative — must WIN over a client Bearer)
  //   2. client Authorization     (legacy / sessions minted before the cookie)
  //   3. media ?token= injection  (for <audio>/<video>, which can't set headers)
  //
  // Why the cookie must OUTRANK the client Bearer: `localStorage` is per-origin,
  // so a STALE token left on one subdomain would otherwise shadow the valid
  // shared cookie and 401 a perfectly good session — the cross-subdomain "domain
  // jumping" / "dialer can't open the portal" bug. Letting the cookie win makes a
  // stale localStorage token harmless. (OWASP BFF guidance: a same-domain SPA
  // authenticates by the HttpOnly cookie, not a JS-readable token.)
  const sessionCookieToken = readCookieHeader(cookieHeader, SESSION_COOKIE);
  let usedCookieCredential = false;
  if (sessionCookieToken) {
    headers['Authorization'] = `Bearer ${sessionCookieToken}`;
    usedCookieCredential = true;
  } else if (authHeader) {
    headers['Authorization'] = authHeader;
  } else if (injectedToken) {
    // Media stream request (no forwardable header) — authenticate via the token
    // that rode in on `?token=` (already stripped from the upstream query above).
    headers['Authorization'] = `Bearer ${injectedToken}`;
  }

  // Forward Range so media (audio recordings) can stream progressively /
  // seek — the backend returns 206 Partial Content and the browser plays
  // before the whole file has transferred.
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  // Forward the caller's origin so the backend can brand-route by funnel
  // (e.g. arixcall.com signups get ArixCall email templates + the ArixCall
  // Resend account, links on arixcall.com). Without this, every backend
  // request looks origin-less and defaults to NuxCall. The browser's Origin
  // is preferred; we fall back to this deployment's own Host (this proxy
  // runs on the brand's domain, so Host is a reliable brand signal even when
  // the browser omits Origin, e.g. on same-origin GETs). Referer is passed
  // through too as a secondary signal.
  const callerOrigin = request.headers.get('origin');
  const callerReferer = request.headers.get('referer');
  const callerHost = request.headers.get('host');
  if (callerOrigin) {
    headers['Origin'] = callerOrigin;
  } else if (callerHost) {
    headers['Origin'] = `https://${callerHost}`;
  }
  if (callerReferer) {
    headers['Referer'] = callerReferer;
  }

  // Handle request body based on content type
  let body: BodyInit | null = null;

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    if (requestContentType.includes('multipart/form-data')) {
      // For multipart/form-data (file uploads), pass through as ArrayBuffer
      // and preserve the original Content-Type with boundary
      body = await request.arrayBuffer();
      headers['Content-Type'] = requestContentType;
      if (isDev) {
        console.log(
          `[Proxy] Multipart upload, body size: ${(body as ArrayBuffer).byteLength} bytes`
        );
      }
    } else if (requestContentType.includes('application/json')) {
      // JSON requests
      try {
        const jsonBody = await request.json();
        body = JSON.stringify(jsonBody);
        headers['Content-Type'] = 'application/json';
        // SECURITY: Never log request bodies - they may contain passwords
      } catch {
        // Silently ignore JSON parse errors
      }
    } else if (requestContentType) {
      // Other content types - pass through as-is
      body = await request.arrayBuffer();
      headers['Content-Type'] = requestContentType;
    } else {
      // No content type - try to read as text
      try {
        body = await request.text();
        if (body) {
          headers['Content-Type'] = 'text/plain';
        }
      } catch {
        // Silently ignore body read errors
      }
    }
  }

  // Make the request to the backend
  let backendResponse: Response;
  try {
    backendResponse = await fetch(url, {
      method: request.method,
      headers,
      body: body || undefined,
      // Dev-only DNS override (see DEV_DNS_OVERRIDES). `undefined` in
      // production → standard fetch path, no behavior change.
      // @ts-expect-error -- undici dispatcher is accepted by Node's fetch
      // at runtime but isn't in the lib-dom RequestInit type yet.
      dispatcher: devProxyDispatcher,
    });
  } catch (fetchError) {
    console.error(`[Proxy] Fetch error for ${url}:`, fetchError);
    return new NextResponse(
      JSON.stringify({
        error: 'Backend connection failed',
        message: String(fetchError),
        url,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (isDev) {
    console.log(`[Proxy] Backend response: ${backendResponse.status}`);
  }

  // Get response content type
  const contentType = backendResponse.headers.get('content-type') || '';

  // Handle binary responses (images, audio, video, downloads, ZIP files) differently
  const isBinaryResponse =
    contentType.includes('image/') ||
    contentType.includes('audio/') ||
    contentType.includes('video/') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/zip') ||
    path.includes('/stream') ||
    path.includes('/download') ||
    path.includes('/audio') ||
    path.includes('bulk-download');

  let response: NextResponse;
  // Buffered text body (non-binary only) — reused below to mint the session
  // cookie from an auth response's `data.token`.
  let responseData: string | null = null;

  if (isBinaryResponse) {
    // Stream the body straight through instead of buffering the whole file
    // here. This pipelines backend→proxy→browser (no full server-side buffer
    // wait) and lets audio start playing progressively / honor Range (206).
    response = new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
    });
  } else {
    // Handle text/JSON responses
    responseData = await backendResponse.text();
    response = new NextResponse(responseData, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
    });
  }

  // Set content type
  if (contentType) {
    response.headers.set('Content-Type', contentType);
  }

  // Set content length for binary responses
  const contentLength = backendResponse.headers.get('content-length');
  if (contentLength) {
    response.headers.set('Content-Length', contentLength);
  }

  // Forward range/partial-content headers so the browser can stream + seek.
  const acceptRanges = backendResponse.headers.get('accept-ranges');
  if (acceptRanges) {
    response.headers.set('Accept-Ranges', acceptRanges);
  }
  const contentRange = backendResponse.headers.get('content-range');
  if (contentRange) {
    response.headers.set('Content-Range', contentRange);
  }

  // Forward Content-Disposition header for downloads
  const contentDisposition = backendResponse.headers.get('content-disposition');
  if (contentDisposition) {
    response.headers.set('Content-Disposition', contentDisposition);
  }

  // Forward Set-Cookie headers from backend (important for session)
  const setCookieHeaders = backendResponse.headers.getSetCookie();
  if (setCookieHeaders && setCookieHeaders.length > 0) {
    for (const cookie of setCookieHeaders) {
      // Remove domain, secure flags, and fix path for localhost development
      const modifiedCookie = cookie
        .replace(/Domain=[^;]+;?\s*/gi, '')
        .replace(/Secure;?\s*/gi, '')
        .replace(/SameSite=None;?\s*/gi, 'SameSite=Lax;')
        .replace(/Path=[^;]+;?\s*/gi, 'Path=/; '); // Set path to root so cookie works for all routes

      response.headers.append('Set-Cookie', modifiedCookie);
    }
  }

  // ── BFF session cookie management ──────────────────────────────────────────
  // Mint the HttpOnly cross-subdomain session cookie from an auth response's
  // token, and clear it on logout. Only scoped to .arixcall.com on an arixcall
  // host; elsewhere (sslip.io test box, localhost) it's host-only, so no other
  // environment is affected. Secure only in production (so http://localhost dev
  // still works). SameSite=Lax carries the cookie across the app.↔admin. hop and
  // blocks cross-site state-changing requests (CSRF), backed by the existing
  // double-submit CSRF tokens.
  const cookieHostArix = isArixHost(callerHost);
  const domainAttr = cookieHostArix ? ' Domain=.arixcall.com;' : '';
  const secureAttr = process.env.NODE_ENV === 'production' ? ' Secure;' : '';

  // Expire arix_session in BOTH forms — host-only AND Domain=.arixcall.com. A
  // cookie set under an earlier build (or on a different host) can exist in the
  // OTHER form than the one we would set now; a purge that clears only one form
  // leaves the dead cookie behind — exactly what forces users to clear site-data
  // by hand. Clearing both guarantees the session self-heals automatically.
  const appendSessionClear = () => {
    response.headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;${secureAttr}`
    );
    if (cookieHostArix) {
      response.headers.append(
        'Set-Cookie',
        `${SESSION_COOKIE}=; Path=/; Domain=.arixcall.com; Max-Age=0; HttpOnly; SameSite=Lax;${secureAttr}`
      );
    }
  };

  if (path === 'auth/logout') {
    appendSessionClear();
  } else if (path.startsWith('auth/') && backendResponse.ok && responseData) {
    try {
      const parsed = JSON.parse(responseData) as { data?: { token?: unknown } };
      const token = parsed?.data?.token;
      if (typeof token === 'string' && token.length > 0) {
        response.headers.append(
          'Set-Cookie',
          `${SESSION_COOKIE}=${token}; Path=/;${domainAttr} Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Lax;${secureAttr}`
        );
      }
    } catch {
      // Non-JSON or tokenless auth response (e.g. an OTP-required step) — nothing to mint.
    }
  } else if (
    backendResponse.status === 401 &&
    usedCookieCredential &&
    (path === 'auth/me' || path === 'auth/refresh-token')
  ) {
    // Self-heal a DEAD session cookie — but ONLY on the session validate/renew
    // endpoints (`/auth/me`, `/auth/refresh-token`), where a 401 unambiguously
    // means the arix_session token itself is bad (expired, evicted, stale
    // pre-cutover). Purging it there lets the user sign in fresh WITHOUT clearing
    // site-data. We deliberately do NOT purge on a 401 from a data endpoint
    // (/calls, /sms, /admin, …) or from /auth/login: those can 401 for reasons
    // unrelated to the session — a transient session-store/Redis blip, a backend
    // restart mid-request, an endpoint misusing 401 for authorization, or a wrong
    // password — and nuking a VALID shared cookie there would log a healthy user
    // out of BOTH subdomains. Purge both forms (host-only AND Domain=.arixcall.com)
    // so no dead cookie survives in the other form.
    appendSessionClear();
  }

  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    return proxyRequest(request, path.join('/'));
  } catch (error) {
    console.error('[Proxy GET Error]', error);
    return new NextResponse(JSON.stringify({ error: 'Proxy error', message: String(error) }), {
      status: 500,
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    if (isDev) {
      console.log('[Proxy POST] Path:', path.join('/'));
    }
    return proxyRequest(request, path.join('/'));
  } catch {
    return new NextResponse(JSON.stringify({ error: 'Proxy error' }), { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}
