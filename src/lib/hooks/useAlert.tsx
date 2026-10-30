'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';

export interface AlertOptions {
  title?: string;
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  buttonText?: string;
}

interface AlertState extends AlertOptions {
  isOpen: boolean;
}

interface AlertContextValue {
  alert: (options: AlertOptions | string) => Promise<void>;
  success: (message: string, title?: string) => Promise<void>;
  error: (message: string, title?: string) => Promise<void>;
  warning: (message: string, title?: string) => Promise<void>;
  info: (message: string, title?: string) => Promise<void>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

const variantIcons = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

const variantColors = {
  success: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  error: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  warning: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
  info: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
};

const variantTitles = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Information',
};

/**
 * Provider component that enables useAlert hook throughout the app.
 * Should be placed near the root of the app (e.g., in layout.tsx).
 */
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
    buttonText: 'OK',
  });

  const [resolveRef, setResolveRef] = useState<(() => void) | null>(null);

  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    const opts = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      setResolveRef(() => resolve);
      setState({
        isOpen: true,
        title: opts.title || variantTitles[opts.variant || 'info'],
        message: opts.message,
        variant: opts.variant || 'info',
        buttonText: opts.buttonText || 'OK',
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolveRef) {
      resolveRef();
      setResolveRef(null);
    }
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [resolveRef]);

  const success = useCallback(
    (message: string, title?: string) => showAlert({ message, title, variant: 'success' }),
    [showAlert]
  );

  const error = useCallback(
    (message: string, title?: string) => showAlert({ message, title, variant: 'error' }),
    [showAlert]
  );

  const warning = useCallback(
    (message: string, title?: string) => showAlert({ message, title, variant: 'warning' }),
    [showAlert]
  );

  const info = useCallback(
    (message: string, title?: string) => showAlert({ message, title, variant: 'info' }),
    [showAlert]
  );

  const Icon = variantIcons[state.variant || 'info'];

  return (
    <AlertContext.Provider value={{ alert: showAlert, success, error, warning, info }}>
      {children}
      <Modal
        isOpen={state.isOpen}
        onClose={handleClose}
        title={state.title || 'Alert'}
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)] transition-colors"
            >
              {state.buttonText}
            </button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${variantColors[state.variant || 'info']}`}>
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-[var(--muted-foreground)] pt-1.5">{state.message}</p>
        </div>
      </Modal>
    </AlertContext.Provider>
  );
}

/**
 * Hook to show alert dialogs.
 * Returns a promise that resolves when the user acknowledges the alert.
 *
 * @example
 * ```tsx
 * const { alert, success, error } = useAlert();
 *
 * // Generic alert
 * await alert('Something happened');
 *
 * // With options
 * await alert({
 *   title: 'Custom Title',
 *   message: 'Your action was successful!',
 *   variant: 'success',
 * });
 *
 * // Shorthand methods
 * await success('Item saved successfully!');
 * await error('Failed to save item');
 * await warning('This action cannot be undone');
 * await info('Please check your email');
 * ```
 */
export function useAlert(): AlertContextValue {
  const context = useContext(AlertContext);

  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }

  return context;
}
