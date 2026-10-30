'use client';

/**
 * ContactLookupProvider - Syncs contacts with the lookup store
 *
 * This provider fetches all contacts and keeps the contact lookup store
 * in sync. It should be placed high in the component tree (e.g., in the
 * phone layout) so contacts are available everywhere.
 *
 * Features:
 * - Fetches contacts with loading state indication
 * - Error handling with automatic retry (3 attempts)
 * - Toast notifications for loading/error states
 * - Manual retry option on failure
 * - Syncs with React Query cache
 * - Real-time updates via query invalidation
 *
 * @module lib/providers/ContactLookupProvider
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useContactLookupStore } from '@/lib/stores/contactLookup';
import { useContactsPaginated, contactsKeys } from '@/lib/hooks/useContacts';
import { useToast } from '@/lib/stores/toast';

interface ContactLookupProviderProps {
  children: React.ReactNode;
}

/** Max contacts to fetch - prevents memory issues */
const MAX_CONTACTS_LIMIT = 5000;

/**
 * ContactLookupProvider - Keeps contact lookup store in sync
 */
export function ContactLookupProvider({ children }: ContactLookupProviderProps) {
  const toast = useToast();
  const setContacts = useContactLookupStore((state) => state.setContacts);
  const setLoading = useContactLookupStore((state) => state.setLoading);
  const setError = useContactLookupStore((state) => state.setError);
  const isInitialized = useContactLookupStore((state) => state.isInitialized);

  // Track error toast to avoid duplicates
  const hasShownErrorToast = useRef(false);

  // Fetch contacts with React Query's built-in retry (3 attempts by default)
  const {
    data: contactsData,
    isSuccess,
    isLoading: isQueryLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useContactsPaginated({
    page: 1,
    limit: MAX_CONTACTS_LIMIT,
  });

  // Retry handler
  const handleRetry = useCallback(() => {
    hasShownErrorToast.current = false;
    setError(null);
    setLoading(true);
    refetch();
  }, [refetch, setError, setLoading]);

  // Sync loading state
  useEffect(() => {
    if (isQueryLoading && !isInitialized) {
      setLoading(true);
    }
  }, [isQueryLoading, isInitialized, setLoading]);

  // Sync contacts to lookup store when data changes
  useEffect(() => {
    if (isSuccess && contactsData?.contacts) {
      setContacts(contactsData.contacts);
    }
  }, [isSuccess, contactsData?.contacts, setContacts]);

  // Handle errors with retry option
  useEffect(() => {
    if (isError && error && !hasShownErrorToast.current) {
      hasShownErrorToast.current = true;
      const errorMessage = error instanceof Error ? error.message : 'Failed to load contacts';
      setError(errorMessage);

      // Show error toast with retry action
      toast.error('Failed to load contacts. Tap to retry.', {
        duration: 10000,
        action: {
          label: 'Retry',
          onClick: handleRetry,
        },
      });

      console.error('[ContactLookupProvider] Error loading contacts:', error);
    }
  }, [isError, error, setError, toast, handleRetry]);

  return <>{children}</>;
}

/**
 * Hook to manually refresh the contact lookup cache
 * Useful after bulk operations or when you need to force a refresh
 */
export function useRefreshContactLookup() {
  const queryClient = useQueryClient();

  return () => {
    // Invalidate contacts query to trigger a refetch
    queryClient.invalidateQueries({ queryKey: contactsKeys.all });
  };
}

export default ContactLookupProvider;
