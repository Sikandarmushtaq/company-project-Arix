'use client';

/**
 * SipErrorBoundary Component
 *
 * Specialized error boundary for SIP/WebRTC components.
 * Provides targeted error handling for VoIP-related errors like
 * media device failures, network issues, and WebRTC connection problems.
 *
 * @module components/ui/SipErrorBoundary
 */

import { Component, type ReactNode } from 'react';
import { FiPhoneOff, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import * as Sentry from '@/lib/capture';

/**
 * Known SIP/WebRTC error types for better error messages
 */
type SipErrorType = 'media' | 'network' | 'registration' | 'call' | 'unknown';

interface Props {
  children: ReactNode;
  /** Optional callback when retry is attempted */
  onRetry?: () => void;
  /** Optional callback when error occurs */
  onError?: (error: Error, errorType: SipErrorType) => void;
  /** Custom class name for the error container */
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: SipErrorType;
}

/**
 * Categorize SIP/WebRTC errors for better user messaging
 */
function categorizeError(error: Error): SipErrorType {
  const message = error.message.toLowerCase();

  if (
    message.includes('media') ||
    message.includes('permission') ||
    message.includes('microphone') ||
    message.includes('camera') ||
    message.includes('getusermedia') ||
    message.includes('not allowed')
  ) {
    return 'media';
  }

  if (
    message.includes('network') ||
    message.includes('websocket') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('unreachable')
  ) {
    return 'network';
  }

  if (
    message.includes('register') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('authentication')
  ) {
    return 'registration';
  }

  if (
    message.includes('call') ||
    message.includes('invite') ||
    message.includes('bye') ||
    message.includes('486') ||
    message.includes('busy')
  ) {
    return 'call';
  }

  return 'unknown';
}

/**
 * Get user-friendly error message based on error type
 */
function getErrorMessage(errorType: SipErrorType): { title: string; description: string } {
  switch (errorType) {
    case 'media':
      return {
        title: 'Microphone Access Issue',
        description:
          'Unable to access your microphone. Please check your browser permissions and ensure your microphone is connected.',
      };
    case 'network':
      return {
        title: 'Connection Problem',
        description:
          'Unable to connect to the VoIP server. Please check your internet connection and try again.',
      };
    case 'registration':
      return {
        title: 'Phone Registration Failed',
        description:
          'Unable to register your phone. Please check your credentials and try signing in again.',
      };
    case 'call':
      return {
        title: 'Call Error',
        description:
          'There was a problem with the call. The other party may be unavailable or busy.',
      };
    default:
      return {
        title: 'Phone System Error',
        description:
          'An unexpected error occurred with the phone system. Please try again or contact support.',
      };
  }
}

/**
 * SipErrorBoundary catches errors in SIP/WebRTC components and displays
 * a helpful error UI with specific guidance based on the error type.
 *
 * @example
 * <SipErrorBoundary onRetry={handleReconnect}>
 *   <SipProvider>
 *     <PhoneUI />
 *   </SipProvider>
 * </SipErrorBoundary>
 */
export class SipErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorType: 'unknown' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorType = categorizeError(error);
    return { hasError: true, error, errorType };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const errorType = categorizeError(error);

    // Log error
    console.error('[SipErrorBoundary] Caught SIP/WebRTC error:', error, errorInfo);

    // Report to Sentry with SIP context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'sip');
      scope.setTag('sipErrorType', errorType);
      scope.setExtra('componentStack', errorInfo.componentStack);
      Sentry.captureException(error);
    });

    // Notify parent component
    this.props.onError?.(error, errorType);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorType: 'unknown' });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { title, description } = getErrorMessage(this.state.errorType);

      return (
        <div
          className={`flex flex-col items-center justify-center p-6 bg-[var(--card)] border border-[var(--border)] rounded-lg ${this.props.className || ''}`}
          role="alert"
          aria-live="assertive"
        >
          <div
            className="w-12 h-12 mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"
            aria-hidden="true"
          >
            {this.state.errorType === 'network' ? (
              <FiPhoneOff className="w-6 h-6 text-red-600 dark:text-red-400" />
            ) : (
              <FiAlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            )}
          </div>

          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">{title}</h3>

          <p className="text-sm text-[var(--muted-foreground)] text-center mb-4 max-w-xs">
            {description}
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-4 w-full max-w-xs">
              <summary className="cursor-pointer text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-[var(--muted)] rounded text-xs overflow-auto max-h-24 text-red-600 dark:text-red-400">
                {this.state.error.message}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
            aria-label="Try reconnecting"
          >
            <FiRefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SipErrorBoundary;
