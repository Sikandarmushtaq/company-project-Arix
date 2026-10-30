'use client';

/**
 * Meta (Facebook) Pixel — marketing conversion tracking, PUBLIC pages only.
 *
 * The pixel is a MARKETING tool and must never run inside the authenticated app
 * (admin / dialer / org panels). Two reasons:
 *   1. Privacy — admin + customer in-app activity must not be reported to Facebook.
 *   2. The pixel's automatic click/form tracking posts to facebook.com/tr/, which
 *      our CSP (`form-action 'self'`) blocks. On app pages that click interception
 *      was swallowing real button actions (e.g. the admin "Delete user" click never
 *      fired its request). Keeping the pixel off app routes removes that entirely.
 *
 * So we load it only on public/marketing/signup pages and skip it under the app
 * route prefixes below.
 */

import Script from 'next/script';
import { usePathname } from 'next/navigation';

// Authenticated-app route prefixes — the pixel is NOT loaded on these. Note
// '/admin2' must be listed separately: '/admin2/...' does NOT start with '/admin/'.
const APP_PREFIXES = ['/admin', '/admin2', '/phone', '/org'];

const PIXEL_ID = '3595666457276436';

export function MetaPixel() {
  const pathname = usePathname() || '/';
  const isApp = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isApp) return null;

  return (
    <>
      {/* Loads after the page is interactive so it never blocks first paint. */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
