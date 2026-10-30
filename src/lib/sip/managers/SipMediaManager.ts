/**
 * SIP Media Manager
 *
 * Handles audio device enumeration, input/output device switching,
 * device preference persistence, and media permission requests.
 *
 * @module lib/sip/managers/SipMediaManager
 */

import { getMediaConstraints, type AudioConstraints } from '../config';
import { MediaError, SipErrorCode } from '../errors';
import type { SipManagerContext } from './types';
import { sipLogger as logger } from '../logger';

export class SipMediaManager {
  private ctx: SipManagerContext;

  // Audio device state
  private _audioDevices: MediaDeviceInfo[] = [];
  private _selectedInputDeviceId: string | null = null;
  private _selectedOutputDeviceId: string | null = null;
  private localStream: MediaStream | null = null;

  // Set once the mic has been granted this page session. Used to SKIP the
  // getUserMedia permission probe on reconnects — re-probing re-triggers the OS
  // mic prompt on iOS/WebKit every time the page returns to the foreground after
  // an app switch.
  private micGranted = false;

  // Mutex for device switching (prevents overlapping replaceTrack calls)
  private deviceSwitchInProgress = false;

  // Event listener handlers (stored for cleanup)
  private deviceChangeHandler: (() => void) | null = null;

  constructor(ctx: SipManagerContext) {
    this.ctx = ctx;
    this.loadDevicePreferences();
    this.setupDeviceChangeListener();
  }

  // Getters
  get audioDevices(): MediaDeviceInfo[] {
    return this._audioDevices;
  }

  get selectedInputDeviceId(): string | null {
    return this._selectedInputDeviceId;
  }

  get selectedOutputDeviceId(): string | null {
    return this._selectedOutputDeviceId;
  }

  /**
   * Request microphone permission.
   *
   * IMPORTANT (iOS): this is a one-shot getUserMedia "probe" (acquire → stop)
   * used on connect to verify a working mic before registering. It is called on
   * EVERY connect(), including the reconnect that fires when the page returns to
   * the foreground after an app switch. On iOS/WebKit, re-calling getUserMedia
   * re-triggers the OS permission prompt every time — so once granted we skip
   * the probe entirely. An actual call still acquires the stream lazily, so a
   * genuine prompt (if the OS revoked access) happens at call time, not on every
   * tab return.
   */
  async requestMediaPermission(): Promise<void> {
    // Already granted this session — don't re-probe.
    if (this.micGranted) return;

    // If the Permissions API can confirm the grant, skip the probe too. (Not
    // supported on older iOS/Safari — we fall through to the probe there.)
    try {
      const status = await (navigator.permissions as Permissions | undefined)?.query?.({
        name: 'microphone' as PermissionName,
      });
      if (status?.state === 'granted') {
        this.micGranted = true;
        return;
      }
    } catch {
      // Permissions API / 'microphone' name unsupported — fall through to probe.
    }

    try {
      const config = this.ctx.getConfig();
      const stream = await navigator.mediaDevices.getUserMedia(
        getMediaConstraints(config.audioConstraints)
      );
      stream.getTracks().forEach((track) => track.stop());
      this.micGranted = true;
    } catch (error) {
      const { message, code } = this.classifyMediaError(error);
      throw new MediaError(message, code, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Turn a getUserMedia failure into a user-actionable message + error code.
   * Critically distinguishes "no microphone hardware" (NotFoundError — e.g. a
   * desktop with no mic/headset) from "permission blocked" (NotAllowedError),
   * because the previous code labelled BOTH as "permission denied" — which sent
   * users with no mic down the wrong path (and looked like a network/region
   * issue when it was simply a missing device).
   */
  private classifyMediaError(error: unknown): { message: string; code: SipErrorCode } {
    const name = error instanceof Error ? error.name : '';
    if (
      name === 'NotFoundError' ||
      name === 'DevicesNotFoundError' ||
      name === 'OverconstrainedError'
    ) {
      return {
        message:
          'No microphone detected. Connect a microphone or headset to make and receive calls.',
        code: SipErrorCode.MEDIA_DEVICE_ERROR,
      };
    }
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      name === 'SecurityError'
    ) {
      return {
        message:
          'Microphone access is blocked. Allow microphone access for this site in your browser settings.',
        code: SipErrorCode.MEDIA_PERMISSION_DENIED,
      };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        message: 'Your microphone is in use by another application. Close it and try again.',
        code: SipErrorCode.MEDIA_DEVICE_ERROR,
      };
    }
    return {
      message: 'Microphone unavailable. Check that a microphone is connected and allowed.',
      code: SipErrorCode.MEDIA_DEVICE_ERROR,
    };
  }

  /**
   * Acquire a MediaStream with a timeout + automatic fallback.
   *
   * getUserMedia() can hang indefinitely on some systems (stuck drivers,
   * Bluetooth issues, permission prompts that never resolve). This wrapper:
   *
   * 1. Races getUserMedia against a 5s timeout
   * 2. On timeout/failure → retries once with basic audio-only constraints
   * 3. If both attempts fail → throws MediaError with a user-friendly message
   *
   * Use this for call acceptance/origination where hanging = bad UX.
   */
  async acquireMediaWithTimeout(
    constraints: MediaStreamConstraints,
    timeoutMs = 5000
  ): Promise<MediaStream> {
    const attemptAcquire = (cs: MediaStreamConstraints): Promise<MediaStream> => {
      return new Promise<MediaStream>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('getUserMedia timeout'));
        }, timeoutMs);

        navigator.mediaDevices
          .getUserMedia(cs)
          .then((stream) => {
            clearTimeout(timer);
            // A real call acquired the mic — record the grant so the connect
            // probe stays skipped (avoids re-prompting on iOS tab returns).
            this.micGranted = true;
            resolve(stream);
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      });
    };

    // Attempt 1: original constraints
    try {
      return await attemptAcquire(constraints);
    } catch (err) {
      logger.warn('getUserMedia failed on first attempt, retrying with basic audio', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Attempt 2: simplest possible audio (no echo cancellation, noise suppression, etc.)
    try {
      return await attemptAcquire({ audio: true, video: false });
    } catch (err) {
      const { message, code } = this.classifyMediaError(err);
      throw new MediaError(message, code, { cause: err instanceof Error ? err : undefined });
    }
  }

  /**
   * Enumerate available audio devices
   */
  async enumerateAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this._audioDevices = devices.filter(
        (d) => d.kind === 'audioinput' || d.kind === 'audiooutput'
      );
      this.ctx.emit({ type: 'audioDevicesChanged', devices: this._audioDevices });
      return this._audioDevices;
    } catch (error) {
      logger.error('Failed to enumerate audio devices:', error);
      return [];
    }
  }

  /**
   * Set the audio input device (microphone)
   */
  async setAudioInputDevice(deviceId: string): Promise<void> {
    this._selectedInputDeviceId = deviceId;
    this.saveDevicePreferences();
    this.ctx.emit({ type: 'audioInputChanged', deviceId });

    if (this.localStream) {
      await this.updateLocalStreamDevice(deviceId);
    }

    logger.info(`Audio input device set to: ${deviceId}`);
  }

  /**
   * Set the audio output device (speaker)
   */
  async setAudioOutputDevice(deviceId: string): Promise<void> {
    this._selectedOutputDeviceId = deviceId;
    this.saveDevicePreferences();
    this.ctx.emit({ type: 'audioOutputChanged', deviceId });

    for (const [lineId, audioElement] of this.ctx.remoteAudioElements) {
      try {
        if ('setSinkId' in audioElement) {
          await (
            audioElement as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }
          ).setSinkId(deviceId);
          logger.info(`Output device set for line ${lineId}`);
        }
      } catch (error) {
        logger.error(`Failed to set output device for line ${lineId}:`, error);
      }
    }

    logger.info(`Audio output device set to: ${deviceId}`);
  }

  /**
   * Get the current call-audio processing constraints (noise suppression,
   * auto-gain, echo cancellation) that new getUserMedia captures will use.
   */
  getAudioConstraints(): AudioConstraints {
    return this.ctx.getConfig().audioConstraints;
  }

  /**
   * Update the call-audio processing constraints (e.g. noiseSuppression,
   * autoGainControl). Mutates the shared config so subsequent captures use
   * them, persists the preference, and re-captures the live call's mic track
   * via the same proven, mutex-guarded path as a device switch.
   */
  async setAudioConstraints(partial: Partial<AudioConstraints>): Promise<void> {
    const config = this.ctx.getConfig();
    config.audioConstraints = { ...config.audioConstraints, ...partial };
    // The preference is saved unconditionally; it always applies to the NEXT
    // capture. Applying it to a LIVE call is best-effort — a re-capture failure
    // (e.g. mic permission revoked mid-call) must not reject the setting.
    this.saveDevicePreferences();
    if (this.localStream) {
      try {
        await this.updateLocalStreamDevice(this._selectedInputDeviceId || '');
      } catch (error) {
        logger.warn('Live re-capture for constraint change failed (applies next call):', error);
      }
    }
    logger.info('Audio constraints updated:', partial);
  }

  /**
   * Update local stream with new input device.
   * Guarded by mutex to prevent overlapping replaceTrack calls — rapid device
   * switching (e.g. user clicking through a dropdown) would otherwise cause
   * concurrent getUserMedia + replaceTrack sequences that corrupt the track state.
   */
  private async updateLocalStreamDevice(deviceId: string): Promise<void> {
    if (this.deviceSwitchInProgress) {
      logger.warn(`Device switch already in progress, skipping switch to ${deviceId}`);
      return;
    }

    this.deviceSwitchInProgress = true;
    try {
      const config = this.ctx.getConfig();
      const constraints = getMediaConstraints(config.audioConstraints);
      // Only pin a deviceId when one is chosen; an empty id means "system
      // default", and `{ exact: '' }` is an invalid constraint that fails
      // getUserMedia. (Also lets setAudioConstraints re-capture on default.)
      if (typeof constraints.audio === 'object' && deviceId) {
        constraints.audio.deviceId = { exact: deviceId };
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = newStream.getAudioTracks()[0];

      for (const [lineId, session] of this.ctx.sessions) {
        const pc = this.ctx.getPeerConnection(session);
        if (pc) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
          if (sender && newTrack) {
            await sender.replaceTrack(newTrack);
            logger.info(`Replaced audio track for line ${lineId}`);
          }
        }
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
      }
      this.localStream = newStream;
    } catch (error) {
      logger.error('Failed to update local stream device:', error);
      throw new MediaError('Failed to switch audio input device', SipErrorCode.MEDIA_DEVICE_ERROR, {
        cause: error instanceof Error ? error : undefined,
      });
    } finally {
      this.deviceSwitchInProgress = false;
    }
  }

  /**
   * Save device preferences to localStorage
   */
  private saveDevicePreferences(): void {
    if (typeof localStorage !== 'undefined') {
      const ac = this.ctx.getConfig().audioConstraints;
      const prefs = {
        inputDeviceId: this._selectedInputDeviceId,
        outputDeviceId: this._selectedOutputDeviceId,
        noiseSuppression: ac.noiseSuppression,
        autoGainControl: ac.autoGainControl,
        // Marks that the one-time Krisp NS-default realignment has run for this
        // browser (see loadDevicePreferences). Present on every save so a later
        // deliberate mic-NS choice is honored from then on.
        nsKrispMigrated: true,
      };
      localStorage.setItem('sip-audio-devices', JSON.stringify(prefs));
    }
  }

  /**
   * Load device + constraint preferences from localStorage
   */
  loadDevicePreferences(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const prefs = JSON.parse(localStorage.getItem('sip-audio-devices') || '{}');
        this._selectedInputDeviceId = prefs.inputDeviceId || null;
        this._selectedOutputDeviceId = prefs.outputDeviceId || null;
        const ac = this.ctx.getConfig().audioConstraints;

        // One-time realignment (2026-09): browser mic noise suppression now
        // defaults OFF because arix calls run carrier-side Krisp Viva Pro NS on
        // both directions (see DEFAULT_AUDIO_CONSTRAINTS). Older browsers persisted
        // the previous ON default merely as a side effect of changing an audio
        // device — not a deliberate choice — so on the first load after this change
        // we drop that stale flag and let the new default apply. A user who later
        // re-enables mic NS keeps it: the migration flag is then set, so their
        // choice is honored on every subsequent load.
        if (prefs.nsKrispMigrated !== true) {
          delete prefs.noiseSuppression;
        }

        if (typeof prefs.noiseSuppression === 'boolean') ac.noiseSuppression = prefs.noiseSuppression;
        if (typeof prefs.autoGainControl === 'boolean') ac.autoGainControl = prefs.autoGainControl;

        // Persist the migration flag (and the resolved default NS state) once so it
        // doesn't re-run on every load.
        if (prefs.nsKrispMigrated !== true) {
          this.saveDevicePreferences();
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  /**
   * Setup device change listener
   */
  private setupDeviceChangeListener(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      this.deviceChangeHandler = async () => {
        logger.info('Audio devices changed');
        await this.enumerateAudioDevices();
      };
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
    }
  }

  /**
   * Remove device change listener
   */
  removeDeviceChangeListener(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && this.deviceChangeHandler) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
      this.deviceChangeHandler = null;
    }
  }

  /**
   * Cleanup local stream
   */
  cleanupLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Full cleanup
   */
  destroy(): void {
    this.removeDeviceChangeListener();
    this.cleanupLocalStream();
  }
}
