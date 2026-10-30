/**
 * SIP Recording Manager
 *
 * Handles call recording by mixing local and remote audio streams.
 *
 * @module lib/sip/managers/SipRecordingManager
 */

import { SessionState } from 'sip.js';
import { CallError, MediaError, SipErrorCode } from '../errors';
import type { SipManagerContext } from './types';
import { sipLogger as logger } from '../logger';

export class SipRecordingManager {
  private ctx: SipManagerContext;

  // Recording state
  private mediaRecorders: Map<number, MediaRecorder> = new Map();
  private recordingChunks: Map<number, Blob[]> = new Map();
  private recordingStreams: Map<number, MediaStream> = new Map();
  private recordingAudioNodes: Map<
    number,
    {
      sources: MediaStreamAudioSourceNode[];
      destination: MediaStreamAudioDestinationNode;
    }
  > = new Map();

  // Shared AudioContext (created lazily)
  private audioContext: AudioContext | null = null;

  constructor(ctx: SipManagerContext) {
    this.ctx = ctx;
  }

  /**
   * Start recording a call
   */
  async startRecording(lineId: number): Promise<void> {
    const session = this.ctx.sessions.get(lineId);
    if (!session || session.state !== SessionState.Established) {
      throw new CallError('Call not established', SipErrorCode.INVALID_CALL_STATE, { lineId });
    }

    if (this.mediaRecorders.has(lineId)) {
      logger.warn(`Recording already in progress for line ${lineId}`);
      return;
    }

    try {
      const combinedStream = await this.createCombinedStream(lineId);
      if (!combinedStream) {
        throw new MediaError('Failed to create combined stream', SipErrorCode.MEDIA_DEVICE_ERROR);
      }

      this.recordingStreams.set(lineId, combinedStream);
      this.recordingChunks.set(lineId, []);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: this.getSupportedMimeType(),
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const chunks = this.recordingChunks.get(lineId) || [];
          chunks.push(event.data);
          this.recordingChunks.set(lineId, chunks);
        }
      };

      mediaRecorder.onstop = () => {
        logger.info(`Recording stopped for line ${lineId}`);
      };

      mediaRecorder.start(1000);
      this.mediaRecorders.set(lineId, mediaRecorder);
      this.ctx.updateLineState(lineId, { isRecording: true });

      this.ctx.emit({ type: 'recordingStarted', lineId });
      logger.info(`Recording started for line ${lineId}`);
    } catch (error) {
      logger.error('Failed to start recording:', error);
      throw new MediaError('Failed to start recording', SipErrorCode.MEDIA_DEVICE_ERROR, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Stop recording and return the recording blob
   */
  async stopRecording(lineId: number): Promise<Blob | null> {
    const mediaRecorder = this.mediaRecorders.get(lineId);
    if (!mediaRecorder) {
      logger.warn(`No recording in progress for line ${lineId}`);
      return null;
    }

    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const chunks = this.recordingChunks.get(lineId) || [];
        const blob = new Blob(chunks, { type: this.getSupportedMimeType() });

        this.cleanupRecording(lineId);
        this.ctx.updateLineState(lineId, { isRecording: false });
        this.ctx.emit({ type: 'recordingStopped', lineId, recording: blob });

        logger.info(`Recording stopped for line ${lineId}, size: ${blob.size} bytes`);
        resolve(blob);
      };

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      } else {
        const chunks = this.recordingChunks.get(lineId) || [];
        const blob = new Blob(chunks, { type: this.getSupportedMimeType() });
        this.cleanupRecording(lineId);
        this.ctx.updateLineState(lineId, { isRecording: false });
        resolve(blob);
      }
    });
  }

  /**
   * Check if a line is being recorded
   */
  isRecording(lineId: number): boolean {
    return this.mediaRecorders.has(lineId);
  }

  /**
   * Create a combined stream of local and remote audio
   */
  private async createCombinedStream(lineId: number): Promise<MediaStream | null> {
    const session = this.ctx.sessions.get(lineId);
    if (!session) return null;

    const pc = this.ctx.getPeerConnection(session);
    if (!pc) return null;

    try {
      const audioContext = await this.getOrCreateAudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const sources: MediaStreamAudioSourceNode[] = [];

      // Get remote audio
      const remoteStream = new MediaStream();
      pc.getReceivers().forEach((receiver) => {
        if (receiver.track && receiver.track.kind === 'audio') {
          remoteStream.addTrack(receiver.track);
        }
      });

      if (remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(destination);
        sources.push(remoteSource);
      }

      // Get local audio
      const localStream = new MediaStream();
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          localStream.addTrack(sender.track);
        }
      });

      if (localStream.getAudioTracks().length > 0) {
        const localSource = audioContext.createMediaStreamSource(localStream);
        localSource.connect(destination);
        sources.push(localSource);
      }

      this.recordingAudioNodes.set(lineId, { sources, destination });
      return destination.stream;
    } catch (error) {
      logger.error('Failed to create combined stream:', error);
      return null;
    }
  }

  /**
   * Get supported recording MIME type
   */
  private getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  /**
   * Cleanup recording resources including audio nodes
   */
  cleanupRecording(lineId: number): void {
    const audioNodes = this.recordingAudioNodes.get(lineId);
    if (audioNodes) {
      audioNodes.sources.forEach((source) => {
        try {
          source.disconnect();
        } catch {
          // Already disconnected
        }
      });
      this.recordingAudioNodes.delete(lineId);
    }

    const stream = this.recordingStreams.get(lineId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.recordingStreams.delete(lineId);
    }

    this.mediaRecorders.delete(lineId);
    this.recordingChunks.delete(lineId);
  }

  /**
   * Get or create AudioContext
   */
  async getOrCreateAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Check if any line has an active recording
   */
  hasActiveRecordings(): boolean {
    return this.mediaRecorders.size > 0;
  }

  /**
   * Stop all recordings
   */
  async stopAllRecordings(): Promise<void> {
    for (const lineId of this.mediaRecorders.keys()) {
      try {
        await this.stopRecording(lineId);
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  /**
   * Full cleanup
   */
  async destroy(): Promise<void> {
    await this.stopAllRecordings();
    this.recordingAudioNodes.clear();
    this.recordingChunks.clear();
    this.recordingStreams.clear();

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
