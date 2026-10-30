'use client';

/**
 * ModalErrorBoundary Component
 *
 * Specialized error boundary for modal/dialog components.
 * Provides a compact error UI that fits within modal contexts
 * and allows users to close the modal gracefully.
 *
 * @module components/ui/ModalErrorBoundary
 */

import { Component, type ReactNode } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import * as Sentry from '@/lib/capture';

interface Props {
  children: ReactNode;
  /** Callback to close the modal when error occurs */
  onClose?: () => void;
  /** Custom class name for the error container */
  className?: string;
  /** Modal title for error context */
  modalTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ModalErrorBoundary catches errors in modal content and displays
 * a compact error UI with the option to close the modal.
 *
 * @example
 * <Modal isOpen={isOpen} onClose={handleClose}>
 *   <ModalErrorBoundary onClose={handleClose} modalTitle="Edit Contact">
 *     <EditContactForm />
 *   </ModalErrorBoundary>
 * </Modal>
 */
export class ModalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error
    console.error('[ModalErrorBoundary] Caught error in modal:', error, errorInfo);

    // Report to Sentry with modal context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'modal');
      if (this.props.modalTitle) {
        scope.setTag('modalTitle', this.props.modalTitle);
      }
      scope.setExtra('componentStack', errorInfo.componentStack);
      Sentry.captureException(error);
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleClose = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className={`flex flex-col items-center justify-center p-6 ${this.props.className || ''}`}
          role="alert"
          aria-live="assertive"
        >
          <div
            className="w-10 h-10 mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"
            aria-hidden="true"
          >
            <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>

          <h4 className="text-base font-semibold text-[var(--foreground)] mb-1">
            Something went wrong
          </h4>

          <p className="text-sm text-[var(--muted-foreground)] text-center mb-4 max-w-[280px]">
            {this.props.modalTitle
              ? `Unable to load ${this.props.modalTitle.toLowerCase()}. Please try again.`
              : 'Unable to load this content. Please try again.'}
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-4 w-full">
              <summary className="cursor-pointer text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                Error details
              </summary>
              <pre className="mt-2 p-2 bg-[var(--muted)] rounded text-xs overflow-auto max-h-20 text-red-600 dark:text-red-400">
                {this.state.error.message}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={this.handleRetry}
              className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-md hover:opacity-90 transition-opacity"
              aria-label="Try loading again"
            >
              Try Again
            </button>
            {this.props.onClose && (
              <button
                onClick={this.handleClose}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--muted)] text-[var(--foreground)] rounded-md hover:bg-[var(--border)] transition-colors"
                aria-label="Close this dialog"
              >
                <FiX className="w-4 h-4" aria-hidden="true" />
                Close
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ModalErrorBoundary;
