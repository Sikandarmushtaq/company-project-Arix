/**
 * SIP Conference Manager
 *
 * Handles 3-way conference calling with client-side audio mixing.
 *
 * @module lib/sip/managers/SipConferenceManager
 */

import { SessionState } from 'sip.js';
import { CallError, SipErrorCode } from '../errors';
import type { SipManagerContext } from './types';
import { sipLogger as logger } from '../logger';

// Default gain levels for mixing (prevent clipping)
const CONFERENCE_GAIN = 0.8;

export class SipConferenceManager {
  private ctx: SipManagerContext;

  private audioContext: AudioContext | null = null;
  private conferencedLines: Set<number> = new Set();
  private originalTracks: Map<number, MediaStreamTrack> = new Map();
  private conferenceAudioNodes: Map<
    number,
    {
      sources: MediaStreamAudioSourceNode[];
      gains: GainNode[];
      destinations: MediaStreamAudioDestinationNode[];
      clonedTracks: MediaStreamTrack[];
    }
  > = new Map();
  // Mixed audio element for user A (plays B + C combined)
  private conferenceAudioElement: HTMLAudioElement | null = null;

  constructor(ctx: SipManagerContext) {
    this.ctx = ctx;
  }

  /**
   * Merge two calls into a 3-way conference
   */
  async mergeLines(lineId1: number, lineId2: number): Promise<void> {
    if (lineId1 === lineId2) {
      throw new CallError('Cannot merge a line with itself', SipErrorCode.INVALID_CALL_STATE);
    }

    if (this.conferencedLines.has(lineId1) || this.conferencedLines.has(lineId2)) {
      throw new CallError(
        'One or both lines are already in a conference',
        SipErrorCode.INVALID_CALL_STATE
      );
    }

    const session1 = this.ctx.sessions.get(lineId1);
    const session2 = this.ctx.sessions.get(lineId2);

    if (!session1 || !session2) {
      throw new CallError('Both lines must be active', SipErrorCode.CALL_NOT_FOUND);
    }

    if (
      session1.state !== SessionState.Established &&
      session1.state !== SessionState.Establishing
    ) {
      throw new CallError(
        `Line ${lineId1} is not in a valid state for conferencing`,
        SipErrorCode.INVALID_CALL_STATE
      );
    }
    if (
      session2.state !== SessionState.Established &&
      session2.state !== SessionState.Establishing
    ) {
      throw new CallError(
        `Line ${lineId2} is not in a valid state for conferencing`,
        SipErrorCode.INVALID_CALL_STATE
      );
    }

    // Unhold any held calls first
    const line1State = this.ctx.lineStates.get(lineId1);
    const line2State = this.ctx.lineStates.get(lineId2);

    if (line1State?.isHeld) {
      await this.ctx.getCallManager().unholdCall(lineId1);
    }
    if (line2State?.isHeld) {
      await this.ctx.getCallManager().unholdCall(lineId2);
    }

    // Wait for unhold to complete — poll lineStates rather than a magic delay
    await new Promise<void>((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        const l1 = this.ctx.lineStates.get(lineId1);
        const l2 = this.ctx.lineStates.get(lineId2);
        if ((!l1?.isHeld && !l2?.isHeld) || elapsed >= 2000) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    try {
      const audioContext = await this.getOrCreateAudioContext();

      const pc1 = this.ctx.getPeerConnection(session1);
      const pc2 = this.ctx.getPeerConnection(session2);

      if (!pc1 || !pc2) {
        throw new CallError('Failed to get peer connections', SipErrorCode.CALL_FAILED);
      }

      const sender1 = pc1.getSenders().find((s) => s.track?.kind === 'audio');
      const sender2 = pc2.getSenders().find((s) => s.track?.kind === 'audio');

      if (!sender1?.track || !sender2?.track) {
        throw new CallError('No local audio tracks found', SipErrorCode.MEDIA_DEVICE_ERROR);
      }

      // Store original tracks for restoration on split
      this.originalTracks.set(lineId1, sender1.track);
      this.originalTracks.set(lineId2, sender2.track);

      const remoteTrackB = this.getRemoteAudioTrack(pc1);
      const remoteTrackC = this.getRemoteAudioTrack(pc2);

      if (!remoteTrackB || !remoteTrackC) {
        throw new CallError('Could not get remote audio tracks', SipErrorCode.MEDIA_DEVICE_ERROR);
      }

      const audioNodes = this.createConferenceAudioGraph(
        audioContext,
        sender1.track,
        remoteTrackB,
        remoteTrackC
      );

      this.conferenceAudioNodes.set(lineId1, audioNodes);

      // B will receive: A's voice + C's voice
      await sender1.replaceTrack(audioNodes.destinations[0].stream.getAudioTracks()[0]);
      // C will receive: A's voice + B's voice
      await sender2.replaceTrack(audioNodes.destinations[1].stream.getAudioTracks()[0]);

      // User A hears B + C via a single mixed HTMLAudioElement (destinations[2])
      this.setupLocalMixedOutput(audioNodes.destinations[2].stream, lineId1, lineId2);

      this.conferencedLines.add(lineId1);
      this.conferencedLines.add(lineId2);

      this.ctx.updateLineState(lineId1, { isInConference: true });
      this.ctx.updateLineState(lineId2, { isInConference: true });

      this.ctx.emit({ type: 'conferenceStarted', lineIds: [lineId1, lineId2] });
      logger.info(`Conference established: Lines ${lineId1} and ${lineId2} merged`);
    } catch (error) {
      this.cleanupConferenceResources(lineId1);
      logger.error('Failed to merge lines:', error);
      throw new CallError('Failed to create conference', SipErrorCode.CALL_FAILED, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Split a conference - separate calls back to individual lines
   */
  async splitConference(lineIdToKeep: number): Promise<void> {
    if (!this.conferencedLines.has(lineIdToKeep)) {
      throw new CallError('Line is not in a conference', SipErrorCode.INVALID_CALL_STATE);
    }

    const conferencedLineIds = Array.from(this.conferencedLines);

    // Stop the mixed conference audio first
    this.cleanupConferenceAudioElement();

    for (const lineId of conferencedLineIds) {
      await this.restoreOriginalTrack(lineId);
    }

    for (const lineId of conferencedLineIds) {
      this.cleanupConferenceResources(lineId);
    }

    const otherLineId = conferencedLineIds.find((id) => id !== lineIdToKeep);

    // Re-enable per-line audio for the kept line
    const keptAudioEl = this.ctx.remoteAudioElements.get(lineIdToKeep);
    if (keptAudioEl) {
      keptAudioEl.play().catch((err) => logger.warn('Failed to resume per-line audio', err));
    }

    if (otherLineId) {
      await this.ctx.getCallManager().holdCall(otherLineId);
      this.ctx.updateLineState(otherLineId, { isInConference: false });
    }

    this.ctx.updateLineState(lineIdToKeep, { isInConference: false });
    this.conferencedLines.clear();

    this.ctx.emit({ type: 'conferenceSplit', lineId: lineIdToKeep });
    logger.info(`Conference split, keeping line ${lineIdToKeep} active`);
  }

  /**
   * Check if a line is in a conference
   */
  isInConference(lineId: number): boolean {
    return this.conferencedLines.has(lineId);
  }

  /**
   * Get all conferenced line IDs
   */
  getConferencedLines(): number[] {
    return Array.from(this.conferencedLines);
  }

  /**
   * Handle line cleanup when a call ends
   */
  async handleLineCleanup(lineId: number): Promise<void> {
    this.cleanupConferenceAudioElement();

    if (this.conferencedLines.has(lineId)) {
      for (const otherId of this.conferencedLines) {
        if (otherId !== lineId) {
          // Await track restoration before cleaning up nodes that the track depends on
          await this.restoreOriginalTrack(otherId);
          this.ctx.updateLineState(otherId, { isInConference: false });
          this.cleanupConferenceResources(otherId);
          // Re-enable per-line audio for the remaining line
          const audioEl = this.ctx.remoteAudioElements.get(otherId);
          if (audioEl) {
            audioEl.play().catch((err) => logger.warn('Failed to resume per-line audio', err));
          }
        }
      }
      this.conferencedLines.clear();
    }
    this.cleanupConferenceResources(lineId);
  }

  private async getOrCreateAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  private getRemoteAudioTrack(pc: RTCPeerConnection): MediaStreamTrack | null {
    for (const receiver of pc.getReceivers()) {
      if (receiver.track && receiver.track.kind === 'audio') {
        return receiver.track;
      }
    }
    return null;
  }

  /**
   * Build the full 3-way conference audio graph.
   *
   * Returns tracked nodes for cleanup. Destinations layout:
   *   [0] mix for B (A + C)
   *   [1] mix for C (A + B)
   *   [2] mix for local user A (B + C)
   */
  private createConferenceAudioGraph(
    ctx: AudioContext,
    localTrack: MediaStreamTrack,
    remoteBTrack: MediaStreamTrack,
    remoteCTrack: MediaStreamTrack
  ): {
    sources: MediaStreamAudioSourceNode[];
    gains: GainNode[];
    destinations: MediaStreamAudioDestinationNode[];
    clonedTracks: MediaStreamTrack[];
  } {
    const sources: MediaStreamAudioSourceNode[] = [];
    const gains: GainNode[] = [];
    const destinations: MediaStreamAudioDestinationNode[] = [];
    const clonedTracks: MediaStreamTrack[] = [];

    const createSource = (track: MediaStreamTrack): MediaStreamAudioSourceNode => {
      const clonedTrack = track.clone();
      clonedTracks.push(clonedTrack);
      const stream = new MediaStream([clonedTrack]);
      const source = ctx.createMediaStreamSource(stream);
      sources.push(source);
      return source;
    };

    const createGain = (): GainNode => {
      const gain = ctx.createGain();
      gain.gain.value = CONFERENCE_GAIN;
      gains.push(gain);
      return gain;
    };

    // Mix for B: A's audio + C's audio
    const destForB = ctx.createMediaStreamDestination();
    destinations.push(destForB);

    const localSourceForB = createSource(localTrack);
    const remoteCSourceForB = createSource(remoteCTrack);
    const gainLocalForB = createGain();
    const gainCForB = createGain();

    localSourceForB.connect(gainLocalForB);
    remoteCSourceForB.connect(gainCForB);
    gainLocalForB.connect(destForB);
    gainCForB.connect(destForB);

    // Mix for C: A's audio + B's audio
    const destForC = ctx.createMediaStreamDestination();
    destinations.push(destForC);

    const localSourceForC = createSource(localTrack);
    const remoteBSourceForC = createSource(remoteBTrack);
    const gainLocalForC = createGain();
    const gainBForC = createGain();

    localSourceForC.connect(gainLocalForC);
    remoteBSourceForC.connect(gainBForC);
    gainLocalForC.connect(destForC);
    gainBForC.connect(destForC);

    // Mix for local user A: B's audio + C's audio
    const destForA = ctx.createMediaStreamDestination();
    destinations.push(destForA);

    const remoteBSourceForA = createSource(remoteBTrack);
    const remoteCSourceForA = createSource(remoteCTrack);
    const gainBForA = createGain();
    const gainCForA = createGain();

    remoteBSourceForA.connect(gainBForA);
    remoteCSourceForA.connect(gainCForA);
    gainBForA.connect(destForA);
    gainCForA.connect(destForA);

    return { sources, gains, destinations, clonedTracks };
  }

  /**
   * Play the mixed B+C stream for the local user and pause the per-line elements.
   */
  private setupLocalMixedOutput(mixedStream: MediaStream, ...lineIds: number[]): void {
    this.cleanupConferenceAudioElement();
    this.conferenceAudioElement = new Audio();
    this.conferenceAudioElement.srcObject = mixedStream;
    this.conferenceAudioElement
      .play()
      .catch((err) => logger.error('Failed to play conference mixed audio', err));
    for (const id of lineIds) {
      const el = this.ctx.remoteAudioElements.get(id);
      if (el) el.pause();
    }
  }

  private cleanupConferenceAudioElement(): void {
    if (this.conferenceAudioElement) {
      this.conferenceAudioElement.pause();
      this.conferenceAudioElement.srcObject = null;
      this.conferenceAudioElement = null;
    }
  }

  private async restoreOriginalTrack(lineId: number): Promise<void> {
    const originalTrack = this.originalTracks.get(lineId);
    const session = this.ctx.sessions.get(lineId);

    if (originalTrack && session) {
      const pc = this.ctx.getPeerConnection(session);
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          try {
            await sender.replaceTrack(originalTrack);
            logger.info(`Restored original track for line ${lineId}`);
          } catch (error) {
            logger.warn(`Failed to restore track for line ${lineId}:`, error);
          }
        }
      }
    }
  }

  private cleanupConferenceResources(lineId: number): void {
    const nodes = this.conferenceAudioNodes.get(lineId);
    if (nodes) {
      nodes.clonedTracks.forEach((track) => {
        try {
          track.stop();
        } catch {
          // Track already stopped
        }
      });

      nodes.sources.forEach((source) => {
        try {
          source.disconnect();
        } catch {
          // Already disconnected
        }
      });

      nodes.gains.forEach((gain) => {
        try {
          gain.disconnect();
        } catch {
          // Already disconnected
        }
      });

      this.conferenceAudioNodes.delete(lineId);
    }

    this.originalTracks.delete(lineId);
  }

  /**
   * Full cleanup
   */
  async destroy(): Promise<void> {
    this.cleanupConferenceAudioElement();

    for (const lineId of this.conferencedLines) {
      this.cleanupConferenceResources(lineId);
    }
    this.conferencedLines.clear();
    this.originalTracks.clear();
    this.conferenceAudioNodes.clear();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        // Ignore close errors
      }
      this.audioContext = null;
    }
  }
}
