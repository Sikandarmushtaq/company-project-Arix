/**
 * SIP Transfer Manager
 *
 * Handles attended (consultation) transfer state machine.
 *
 * @module lib/sip/managers/SipTransferManager
 */

import { SessionState } from 'sip.js';
import { CallError, SipErrorCode } from '../errors';
import type { SipManagerContext } from './types';
import { sipLogger as logger } from '../logger';

// Attended transfer: max time to wait for terminal NOTIFY before reverting
const ATTENDED_TRANSFER_TIMEOUT_MS = 30_000;
// Attended transfer: delay after 200 OK before ending local calls
const ATTENDED_TRANSFER_END_DELAY_MS = 1_000;

export class SipTransferManager {
  private ctx: SipManagerContext;

  // Attended transfer state: consultLineId -> { originalLineId, consultLineId }
  private attendedTransferState: Map<number, { originalLineId: number; consultLineId: number }> =
    new Map();

  // Transfer timeout timers for attended transfers
  private transferTimeoutTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  constructor(ctx: SipManagerContext) {
    this.ctx = ctx;
  }

  /**
   * Start an attended transfer (consultation transfer)
   * 1. Put current call on hold
   * 2. Make consultation call to target
   * 3. User can complete or cancel transfer
   */
  async startAttendedTransfer(lineId: number, targetNumber: string): Promise<number> {
    const callMgr = this.ctx.getCallManager();

    // Put current call on hold
    await callMgr.holdCall(lineId);

    // Make consultation call
    const consultLineId = await callMgr.makeCall(targetNumber);

    // Track the transfer state
    this.attendedTransferState.set(consultLineId, {
      originalLineId: lineId,
      consultLineId,
    });

    logger.info(
      `Started attended transfer from line ${lineId} to ${targetNumber} on line ${consultLineId}`
    );
    return consultLineId;
  }

  /**
   * Complete the attended transfer
   * Connects the original caller to the consultation party via REFER.
   * Uses onNotify to wait for the actual transfer result (not just 202 Accepted).
   */
  async completeAttendedTransfer(consultLineId: number): Promise<void> {
    const transferState = this.attendedTransferState.get(consultLineId);
    if (!transferState) {
      throw new CallError('No attended transfer in progress', SipErrorCode.INVALID_CALL_STATE);
    }

    const { originalLineId } = transferState;
    const originalSession = this.ctx.sessions.get(originalLineId);
    const consultSession = this.ctx.sessions.get(consultLineId);

    if (!originalSession || !consultSession) {
      throw new CallError('Transfer sessions not found', SipErrorCode.CALL_NOT_FOUND);
    }

    try {
      // Consultation session must be established for attended transfer (REFER with Replaces).
      // SIP.js requires the target session to have an active dialog so it can extract
      // the Call-ID, to-tag, and from-tag for the Replaces header.
      if (consultSession.state !== SessionState.Established) {
        throw new CallError(
          'Consultation call must be answered before completing transfer',
          SipErrorCode.INVALID_CALL_STATE
        );
      }

      const callMgr = this.ctx.getCallManager();

      // Update line state to show transfer in progress
      this.ctx.updateLineState(originalLineId, { state: 'transferring' });

      // Start transfer timeout
      this.startTransferTimeout(consultLineId, originalLineId);

      // REFER with Replaces: pass the consultation Session (not a URI).
      // SIP.js generates Refer-To with Replaces header containing the consultation
      // call's dialog info. FreeSWITCH bridges the two existing legs seamlessly —
      // no disconnect/reconnect for the remote parties.
      await originalSession.refer(consultSession, {
        onNotify: (notification) => {
          const sipFrag = notification.request.body;

          if (sipFrag.includes('200 OK') || sipFrag.includes('SIP/2.0 200')) {
            // Transfer completed successfully — end both calls after a short delay
            this.clearTransferTimeout(consultLineId);
            logger.info(`Attended transfer completed for line ${originalLineId}`);
            this.ctx.emit({
              type: 'transferCompleted',
              lineId: originalLineId,
              target: String(consultLineId),
            });

            setTimeout(() => {
              callMgr.endCall(consultLineId).catch((err) => {
                logger.warn(`Failed to end consult call after transfer: ${err}`);
              });
              callMgr.endCall(originalLineId).catch((err) => {
                logger.warn(`Failed to end original call after transfer: ${err}`);
              });
              this.attendedTransferState.delete(consultLineId);
            }, ATTENDED_TRANSFER_END_DELAY_MS);
          } else if (/SIP\/2\.0 [4-6]\d{2}/.test(sipFrag)) {
            // Transfer failed — revert: end consult call, unhold original
            this.clearTransferTimeout(consultLineId);
            logger.warn(`Attended transfer failed for line ${originalLineId}: ${sipFrag}`);

            this.ctx.updateLineState(originalLineId, { state: 'established' });
            this.ctx.emit({ type: 'transferFailed', lineId: originalLineId, reason: sipFrag });

            callMgr.endCall(consultLineId).catch((err) => {
              logger.warn(`Failed to end consult call after transfer reject: ${err}`);
            });
            callMgr.unholdCall(originalLineId).catch((err) => {
              logger.warn(`Failed to unhold original call after transfer reject: ${err}`);
            });
            this.attendedTransferState.delete(consultLineId);
          }
          // Intermediate responses (100, 180, 183) — ignore, transfer is in progress
        },
      });

      logger.info(`Attended transfer REFER with Replaces sent for line ${originalLineId}`);
    } catch (error) {
      this.clearTransferTimeout(consultLineId);
      logger.error('Failed to complete attended transfer:', error);
      throw new CallError('Failed to complete transfer', SipErrorCode.CALL_FAILED, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Cancel the attended transfer
   * Resumes the original call first, then ends the consultation call.
   *
   * CRITICAL: The original call MUST be unholded BEFORE the consultation session
   * is ended. When SIP.js disposes the consultation session, SDH.close() stops
   * all sender tracks and closes the PeerConnection. This corrupts the original
   * session's PeerConnection state (createOffer produces m=audio 0), causing
   * FreeSWITCH to reject the unhold re-INVITE with 488. By unholdling first,
   * the original PeerConnection is still in a clean state.
   */
  async cancelAttendedTransfer(consultLineId: number): Promise<void> {
    const transferState = this.attendedTransferState.get(consultLineId);

    if (!transferState) {
      logger.info(`Cancel attended transfer: state already cleaned up for line ${consultLineId}`);
      return;
    }

    const { originalLineId } = transferState;

    try {
      this.clearTransferTimeout(consultLineId);
      const callMgr = this.ctx.getCallManager();

      // Delete transfer state BEFORE any call operations so that handleLineCleanup
      // (which runs synchronously inside endCall → cleanupLine) finds nothing and
      // does NOT emit transferFailed. This keeps attendedTransferLineId set in the
      // store, so the callEnded handler's isAttendedTransferEnd guard correctly
      // suppresses auto-unhold.
      this.attendedTransferState.delete(consultLineId);

      // Step 1: Resume the original call while consultation session is still alive.
      const originalSession = this.ctx.sessions.get(originalLineId);
      if (originalSession) {
        try {
          await callMgr.unholdCall(originalLineId);
          logger.info(`Resumed original call on line ${originalLineId} after transfer cancel`);
        } catch (unholdErr) {
          logger.error(`Failed to unhold original call on line ${originalLineId}:`, unholdErr);
        }
      }

      // Step 2: End the consultation call (safe now — original is already resumed).
      await callMgr.endCall(consultLineId);
    } catch (error) {
      logger.error('Failed to cancel attended transfer:', error);
      throw error;
    }
  }

  /**
   * Check if a line is part of an attended transfer
   */
  getAttendedTransferState(
    lineId: number
  ): { originalLineId: number; consultLineId: number } | null {
    return this.attendedTransferState.get(lineId) || null;
  }

  /**
   * Clean up transfer state for a line.
   * Only cleans up internal state — the store's callEnded handler
   * handles auto-unholding the remaining call to avoid double re-INVITE races.
   * Emits transferFailed so the UI clears the attended transfer controls.
   */
  handleLineCleanup(lineId: number): void {
    const transferState = this.attendedTransferState.get(lineId);
    if (transferState) {
      this.clearTransferTimeout(lineId);
      this.attendedTransferState.delete(lineId);
      this.ctx.emit({
        type: 'transferFailed',
        lineId: transferState.originalLineId,
        reason: 'Consultation call ended',
      });
      logger.info(`Cleaned up attended transfer state for line ${lineId}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Transfer Timeout
  // ---------------------------------------------------------------------------

  private startTransferTimeout(consultLineId: number, originalLineId: number): void {
    this.clearTransferTimeout(consultLineId);
    const timer = setTimeout(() => {
      const transferState = this.attendedTransferState.get(consultLineId);
      if (transferState) {
        logger.warn(
          `Attended transfer timeout (${ATTENDED_TRANSFER_TIMEOUT_MS}ms) for line ${originalLineId}, reverting`
        );
        this.ctx.updateLineState(originalLineId, { state: 'established' });
        this.ctx.emit({
          type: 'transferFailed',
          lineId: originalLineId,
          reason: 'Transfer timed out',
        });
        this.attendedTransferState.delete(consultLineId);
      }
      this.transferTimeoutTimers.delete(consultLineId);
    }, ATTENDED_TRANSFER_TIMEOUT_MS);
    this.transferTimeoutTimers.set(consultLineId, timer);
  }

  private clearTransferTimeout(consultLineId: number): void {
    const timer = this.transferTimeoutTimers.get(consultLineId);
    if (timer) {
      clearTimeout(timer);
      this.transferTimeoutTimers.delete(consultLineId);
    }
  }

  /**
   * Full cleanup
   */
  destroy(): void {
    for (const timer of this.transferTimeoutTimers.values()) {
      clearTimeout(timer);
    }
    this.transferTimeoutTimers.clear();
    this.attendedTransferState.clear();
  }
}
