/**
 * No-op stand-in for the parts of `@sentry/nextjs` this app uses.
 *
 * Why this exists: the reskin has no Sentry DSN configured, so `@sentry/nextjs`
 * never reports anything at runtime — but statically importing it drags in the
 * OpenTelemetry auto-instrumentation stack (`require-in-the-middle` /
 * `import-in-the-middle`). Under Next 16 + Turbopack those get externalized under
 * a hashed alias that is missing at runtime, which 500s EVERY cold-loaded dynamic
 * SSR route (the whole signup flow, `/admin/.../[id]`, etc.) with
 * "Failed to load external module require-in-the-middle-<hash>".
 *
 * Routing the app's Sentry calls through this shim keeps `@sentry/nextjs` out of
 * the server bundle entirely. Re-introduce the real SDK only once a DSN is set
 * AND the Turbopack/OTel externalization is resolved.
 *
 * Only the surface the app actually calls is stubbed: captureException,
 * captureMessage, withScope, showReportDialog. All are inert.
 */

export interface Scope {
  setTag: (key: string, value: unknown) => void;
  setExtra: (key: string, value: unknown) => void;
  setContext: (key: string, value: unknown) => void;
  setLevel: (level: string) => void;
}

const noopScope: Scope = {
  setTag: () => {},
  setExtra: () => {},
  setContext: () => {},
  setLevel: () => {},
};

/** Returns a synthetic event id so callers that pass it to showReportDialog don't break. */
export function captureException(_error: unknown, _captureContext?: unknown): string {
  return '';
}

export function captureMessage(_message: string, _captureContext?: unknown): string {
  return '';
}

export function withScope(callback: (scope: Scope) => void): void {
  callback(noopScope);
}

export function showReportDialog(_options?: { eventId?: string }): void {
  /* no-op: no Sentry backend to report to */
}
