'use client';

/**
 * Toast Store - Zustand store for toast notifications
 *
 * Provides a simple API for showing toast notifications:
 * - toast.success('Message saved')
 * - toast.error('Failed to save')
 * - toast.info('Processing...')
 * - toast.warning('Low storage')
 * - toast.undo('Item deleted', onUndo) // With undo action
 *
 * @module lib/stores/toast
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number, action?: ToastAction) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const DEFAULT_DURATION = 5000; // 5 seconds
const UNDO_DURATION = 8000; // 8 seconds for undo toasts

/**
 * Generate unique toast ID
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (
    type: ToastType,
    message: string,
    duration = DEFAULT_DURATION,
    action?: ToastAction
  ) => {
    const id = generateId();
    const toast: Toast = { id, type, message, duration, action };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

/**
 * Toast options for advanced usage
 */
export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

/**
 * Convenience methods for showing toasts
 */
export const toast = {
  success: (message: string, options?: ToastOptions | number) => {
    const opts = typeof options === 'number' ? { duration: options } : options;
    return useToastStore.getState().addToast('success', message, opts?.duration, opts?.action);
  },

  error: (message: string, options?: ToastOptions | number) => {
    const opts = typeof options === 'number' ? { duration: options } : options;
    return useToastStore
      .getState()
      .addToast('error', message, opts?.duration ?? 8000, opts?.action);
  },

  info: (message: string, options?: ToastOptions | number) => {
    const opts = typeof options === 'number' ? { duration: options } : options;
    return useToastStore.getState().addToast('info', message, opts?.duration, opts?.action);
  },

  warning: (message: string, options?: ToastOptions | number) => {
    const opts = typeof options === 'number' ? { duration: options } : options;
    return useToastStore
      .getState()
      .addToast('warning', message, opts?.duration ?? 6000, opts?.action);
  },

  /**
   * Dismiss a toast by ID
   */
  dismiss: (id: string) => {
    useToastStore.getState().removeToast(id);
  },

  /**
   * Show a toast with an undo action button
   * @param message - Message to display
   * @param onUndo - Callback when undo is clicked
   * @param duration - Duration in ms (default 8s for undo)
   */
  undo: (message: string, onUndo: () => void, duration = UNDO_DURATION) => {
    const id = useToastStore.getState().addToast('info', message, duration, {
      label: 'Undo',
      onClick: () => {
        onUndo();
        useToastStore.getState().removeToast(id);
      },
    });
    return id;
  },
};

/**
 * Hook to use toast notifications in components
 * Returns the toast methods for showing notifications
 */
export function useToast() {
  return toast;
}
