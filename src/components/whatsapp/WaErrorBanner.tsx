'use client';

/**
 * Friendly error banner for the WA settings/numbers components.
 *
 * Maps raw API errors into a short, actionable user-facing message. Raw
 * error.message strings (e.g. "HTTP 500", "No organization assigned to this
 * user") are deliberately NOT exposed to end users — staff can inspect them
 * via browser DevTools → Network tab if needed.
 *
 * This banner only renders when a request actually FAILED. It must NOT be
 * shown for the legitimate "not configured yet" empty state — that's a
 * friendly setup flow, not an error.
 */

import React from 'react';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { Button } from '@/components/ui';

interface Props {
  /** The error from a useQuery hook. Pass null/undefined to render nothing. */
  error: unknown;
  /** What the user was trying to do — used in the heading. */
  context?: string;
  /** Refetch the failed query. */
  onRetry?: () => void;
}

export function WaErrorBanner({ error, context = 'WhatsApp settings', onRetry }: Props) {
  if (!error) return null;

  const rawMessage = error instanceof Error ? error.message : String(error);
  const friendly = humanizeError(rawMessage, context);

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start gap-3">
        <FiAlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-amber-900 dark:text-amber-100">{friendly.title}</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">{friendly.body}</p>

          {onRetry && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={onRetry}>
                <FiRefreshCw className="w-3.5 h-3.5" /> Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Map raw error messages into friendly user-facing text.
 *
 * The API client throws plain Error("HTTP <status>") or Error(<backend message>),
 * so we pattern-match on the message string. Adding more typed errors to the
 * client would make this nicer, but this works without breaking changes.
 */
function humanizeError(message: string, context: string): { title: string; body: string } {
  const m = message.toLowerCase();

  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network')) {
    return {
      title: "Couldn't connect",
      body: 'Check your internet connection and try again.',
    };
  }

  if (m.includes('http 401') || m.includes('unauthorized') || m.includes('session expired')) {
    return {
      title: 'Your session expired',
      body: 'Please refresh the page to sign in again.',
    };
  }

  if (
    m.includes('http 403') ||
    m.includes('forbidden') ||
    m.includes('no organization') ||
    m.includes("don't have permission") ||
    m.includes('do not have permission')
  ) {
    return {
      title: 'Access not available',
      body: `Your account isn't set up to manage ${context}. Contact your administrator to enable access.`,
    };
  }

  if (m.includes('http 404') || m.includes('not found')) {
    return {
      title: 'Not available right now',
      body: `${capitalise(context)} isn't reachable yet. Try refreshing the page.`,
    };
  }

  if (
    m.includes('http 5') ||
    m.includes('http 500') ||
    m.includes('http 502') ||
    m.includes('http 503') ||
    m.includes('http 504') ||
    m.includes('internal server') ||
    m.includes('service unavailable')
  ) {
    return {
      title: 'Service is having trouble',
      body: `We're having trouble loading ${context} right now. Try again in a moment.`,
    };
  }

  return {
    title: `Couldn't load ${context}`,
    body: 'Try refreshing the page. If this keeps happening, contact your administrator.',
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
