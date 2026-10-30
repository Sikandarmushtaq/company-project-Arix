'use client';

import { useEffect } from 'react';
import { debugLogger } from '@/lib/debug-logger';
import { isClientDebugEnabled } from '@/lib/clientDebug';

export function DebugLoggerInit() {
  useEffect(() => {
    // Dev, or production with the debug flag set → keep console output.
    if (isClientDebugEnabled()) {
      if (process.env.NODE_ENV === 'development') debugLogger.init();
      return;
    }
    // Production (no debug flag): silence ALL console output on the client so
    // end users never see internal logs — SIP message traces, call details,
    // [RealtimeSync]/[SipProvider]/[ICE] noise, diagnostics. Runs client-side
    // only (in useEffect), so server/SSR logging is untouched. Re-enable for a
    // single browser with ?debug=1 or localStorage nuxcall_debug=1.
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    console.error = noop;
  }, []);

  return null;
}
