'use client';

import React, { useState } from 'react';
import { FiDownload, FiCheck, FiX } from 'react-icons/fi';

interface ExportButtonProps {
  onExport: () => Promise<void>;
  label?: string;
  className?: string;
}

export function ExportButton({
  onExport,
  label = 'Export CSV',
  className = '',
}: ExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleExport = async () => {
    if (status === 'loading') return;

    setStatus('loading');
    try {
      await onExport();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('Export failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Exporting...</span>
          </>
        );
      case 'success':
        return (
          <>
            <FiCheck className="h-4 w-4" />
            <span>Downloaded!</span>
          </>
        );
      case 'error':
        return (
          <>
            <FiX className="h-4 w-4" />
            <span>Failed</span>
          </>
        );
      default:
        return (
          <>
            <FiDownload className="h-4 w-4" />
            <span>{label}</span>
          </>
        );
    }
  };

  const getButtonClasses = () => {
    const baseClasses =
      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors';

    switch (status) {
      case 'success':
        return `${baseClasses} bg-green-600 text-white cursor-default`;
      case 'error':
        return `${baseClasses} bg-red-600 text-white cursor-default`;
      case 'loading':
        return `${baseClasses} bg-gray-600 text-white cursor-wait`;
      default:
        return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700`;
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={status === 'loading'}
      className={`${getButtonClasses()} ${className}`}
    >
      {getButtonContent()}
    </button>
  );
}

export default ExportButton;
