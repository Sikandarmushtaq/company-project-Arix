'use client';

/**
 * useWaOversightAgents
 *
 * Returns the list of agents in the manager's org who have ever sent
 * an outbound WhatsApp message. Drives the "filter by agent" dropdown
 * on the oversight page — bounding to actually-active agents keeps the
 * UI focused (orgs with hundreds of users but few WA agents stay
 * usable).
 *
 * @module lib/hooks/useWaOversightAgents
 */

import { useQuery } from '@tanstack/react-query';
import { getOversightAgents } from '@/lib/api/services/whatsapp.api';
import { REALTIME_QUERY_CONFIG } from '@/lib/constants/query';
import { waOversightKeys } from './useWaOversightConversations';

export function useWaOversightAgents(orgId?: number) {
  return useQuery({
    queryKey: waOversightKeys.agents(orgId),
    queryFn: () => getOversightAgents(orgId),
    ...REALTIME_QUERY_CONFIG,
  });
}
