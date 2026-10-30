'use client';

/**
 * Toast Notification Component
 *
 * Displays toast notifications from the toast store.
 * Should be placed once at the app root level.
 *
 * @example
 * // In layout.tsx
 * <ToastContainer />
 *
 * // In any component
 * import { toast } from '@/lib/stores/toast';
 * toast.success('Saved!');
 * toast.error('Failed to save');
 */

import { useToastStore, type Toast, type ToastType } from '@/lib/stores/toast';
import { FiX, FiCheckCircle, FiXCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { useEffect, useState } from 'react';

/**
 * Get icon and colors for toast type
 */
function getToastStyles(type: ToastType): {
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  borderColor: string;
} {
  switch (type) {
    case 'success':
      return {
        icon: <FiCheckCircle className="w-5 h-5" />,
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-green-800 dark:text-green-200',
        borderColor: 'border-green-200 dark:border-green-800',
      };
    case 'error':
      return {
        icon: <FiXCircle className="w-5 h-5" />,
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        textColor: 'text-red-800 dark:text-red-200',
        borderColor: 'border-red-200 dark:border-red-800',
      };
    case 'warning':
      return {
        icon: <FiAlertCircle className="w-5 h-5" />,
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        textColor: 'text-yellow-800 dark:text-yellow-200',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
      };
    case 'info':
    default:
      return {
        icon: <FiInfo className="w-5 h-5" />,
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        textColor: 'text-blue-800 dark:text-blue-200',
        borderColor: 'border-blue-200 dark:border-blue-800',
      };
  }
}

/**
 * Single Toast Item
 */
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const styles = getToastStyles(toast.type);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Animate out before removal
  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(onRemove, 200);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-center gap-3 p-4 rounded-lg border shadow-lg
        transition-all duration-200 ease-out
        ${styles.bgColor} ${styles.textColor} ${styles.borderColor}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <span className="flex-shrink-0">{styles.icon}</span>
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="flex-shrink-0 px-3 py-1 text-sm font-semibold rounded-md bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Toast Container - Renders all active toasts
 *
 * Place this component once at the app root level (e.g., in layout.tsx).
 */
export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}
