/**
 * Human-facing outcome for a FAILED outbound call.
 *
 * When an outbound INVITE is rejected, the agent should see a short, professional
 * reason — a dead number reads as "Not in Service", not a bare "Call failed".
 * This maps the SIP rejection (status code + reason phrase) to that label.
 *
 * Returns `null` for anything that should stay silent — a user-initiated cancel
 * (487) or an unrecognised code — so the store shows no toast for those.
 *
 * @module lib/sip/call-outcome
 */

/**
 * Derive a user-facing outcome label from a rejected outbound INVITE.
 *
 * @param status       SIP status code of the final failure response (e.g. 404).
 * @param reasonPhrase SIP reason phrase, used as a secondary signal when the
 *                     code alone is ambiguous (carriers vary).
 * @returns A short label to show the agent, or `null` to stay silent.
 */
export function callFailureOutcome(status?: number, reasonPhrase?: string): string | null {
  const rp = (reasonPhrase ?? '').toLowerCase();

  // Not in service / unallocated / unrouteable number.
  // FreeSWITCH maps Q.850 cause 1 (UNALLOCATED_NUMBER) → SIP 404; some carriers
  // use 484 or 604. Match the reason phrase too, in case the code varies.
  if (
    status === 404 ||
    status === 484 ||
    status === 604 ||
    rp.includes('unallocated') ||
    rp.includes('not in service') ||
    rp.includes('no route') ||
    rp.includes('does not exist')
  ) {
    return 'Not in Service';
  }

  switch (status) {
    case 486: // Busy Here
    case 600: // Busy Everywhere
      return 'Busy';
    case 603: // Decline — the far end declined
      return 'Declined';
    case 403: // Forbidden — carrier / caller-ID rejected
      return 'Rejected';
    case 408: // Request Timeout
    case 480: // Temporarily Unavailable
      return 'No Answer';
    case 500:
    case 502:
    case 503:
      return 'Service Unavailable';
    // 487 Request Terminated = the agent cancelled — nothing to announce.
    default:
      return null;
  }
}
