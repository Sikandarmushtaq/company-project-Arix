/**
 * Client-side debug gate.
 *
 * Controls whether ANY console output (SIP.js message traces, app logs, call
 * details) is shown in the end user's browser. In production the console is
 * fully silenced — end users never see internal logs. Support/devs can
 * re-enable console output for a single browser, WITHOUT a redeploy, by either:
 *   - appending `?debug=1` to the URL (persists for that browser), or
 *   - setting localStorage `nuxcall_debug` = `1`.
 * Clear it with localStorage.removeItem('nuxcall_debug').
 *
 * @module lib/clientDebug
 */

/**
 * True when verbose client logging is allowed.
 * - Development: always true.
 * - Production: only when the debug flag is present (URL `?debug=1` or
 *   localStorage `nuxcall_debug=1`). Server-side (SSR): false.
 */
export function isClientDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).has('debug')) {
      // Persist so it survives SPA navigation within this browser.
      window.localStorage.setItem('nuxcall_debug', '1');
      return true;
    }
    return window.localStorage.getItem('nuxcall_debug') === '1';
  } catch {
    return false;
  }
}
