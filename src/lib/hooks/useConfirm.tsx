'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ConfirmModal } from '@/components/ui/Modal';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * Provider component that enables useConfirm hook throughout the app.
 * Should be placed near the root of the app (e.g., in layout.tsx).
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger',
    resolve: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen: true,
        title: opts.title || 'Confirm',
        message: opts.message,
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        variant: opts.variant || 'danger',
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setState((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setState((prev) => ({ ...prev, isOpen: false }));
    setIsLoading(false);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        isOpen={state.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={state.title || 'Confirm'}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        variant={state.variant}
        loading={isLoading}
      />
    </ConfirmContext.Provider>
  );
}

/**
 * Hook to show confirmation dialogs.
 * Returns a promise that resolves to true if confirmed, false if cancelled.
 *
 * @example
 * ```tsx
 * const { confirm } = useConfirm();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item?',
 *     confirmText: 'Delete',
 *     variant: 'danger',
 *   });
 *
 *   if (confirmed) {
 *     await deleteItem();
 *   }
 * };
 *
 * // Or with a simple string message
 * const confirmed = await confirm('Are you sure?');
 * ```
 */
export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }

  return context;
}
