/**
 * Call Audio Service
 *
 * Professional audio feedback for call events:
 * - Ringback tone: Played while waiting for remote party to answer
 * - Incoming ringtone: Alert sound for incoming calls (customizable)
 * - DTMF tones: Touch-tone feedback
 *
 * Features:
 * - Multiple ringtone selection from audio files
 * - Volume control with persistence (API + localStorage fallback)
 * - Enable/disable settings
 * - Browser autoplay policy handling
 * - US standard ringback tone (generated)
 *
 * @module lib/sip/call-audio-service
 */

import { sipLogger as logger } from './logger';
import { authApiService } from '@/lib/api/services/auth.service';

/**
 * Audio type identifiers
 */
export type CallAudioType = 'ringback' | 'ringtone' | 'dtmf';

/**
 * Available ringtone definition
 */
export interface RingtoneOption {
  id: string;
  name: string;
  file: string;
}

/**
 * Available ringtones
 */
export const AVAILABLE_RINGTONES: RingtoneOption[] = [
  { id: 'classic', name: 'Classic Phone', file: '/audio/classic-phone-ringtone.mp3' },
  { id: 'ringtone-1', name: 'Ringtone 1', file: '/audio/ringtone-1.mp3' },
  { id: 'ringtone-2', name: 'Ringtone 2', file: '/audio/ringtone-2.mp3' },
  { id: 'telephone', name: 'Telephone', file: '/audio/phone-ringtone-telephone.mp3' },
  { id: 'generated', name: 'Standard Tone', file: '' }, // Generated fallback
];

/**
 * Audio settings
 */
export interface AudioSettings {
  enabled: boolean;
  volume: number; // 0-1
  ringtoneEnabled: boolean;
  ringbackEnabled: boolean;
  selectedRingtone: string; // ringtone id
}

const DEFAULT_SETTINGS: AudioSettings = {
  enabled: true,
  volume: 0.7,
  ringtoneEnabled: true,
  ringbackEnabled: true,
  selectedRingtone: 'classic',
};

const STORAGE_KEY = 'callAudioSettings';

/**
 * DTMF frequency pairs (row, column)
 */
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

/**
 * Call Audio Service
 * Singleton service for managing call-related audio
 */
class CallAudioService {
  private settings: AudioSettings;
  private audioContext: AudioContext | null = null;
  private ringbackAudio: HTMLAudioElement | null = null;
  private ringtoneAudio: HTMLAudioElement | null = null;
  private previewAudio: HTMLAudioElement | null = null;
  private isRingbackPlaying = false;
  private isRingtonePlaying = false;
  private isPreviewPlaying = false;
  private hasUserInteracted = false;
  private isInitialized = false;
  private pendingApiSave: ReturnType<typeof setTimeout> | null = null;

  // Ringback pattern timer (for generated tone fallback)
  private ringbackInterval: ReturnType<typeof setInterval> | null = null;
  private ringtoneInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Load from localStorage immediately (fast startup)
    this.settings = this.loadFromLocalStorage();
    this.initializeAudioElements();

    // Track user interaction for autoplay policy
    if (typeof window !== 'undefined') {
      const handleInteraction = () => {
        this.hasUserInteracted = true;
        this.resumeAudioContext();
      };
      window.addEventListener('click', handleInteraction, { once: true });
      window.addEventListener('keydown', handleInteraction, { once: true });
      window.addEventListener('touchstart', handleInteraction, { once: true });
    }
  }

  /**
   * Initialize settings from API (call this after user is authenticated)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const apiSettings = await authApiService.getAudioSettings();
      this.settings = { ...DEFAULT_SETTINGS, ...apiSettings };
      this.saveToLocalStorage(); // Cache locally
      this.applySettings();
      this.isInitialized = true;
      logger.info('Audio settings loaded from API:', this.settings);
    } catch (error) {
      logger.warn('Failed to load audio settings from API, using local cache:', error);
      // Keep using localStorage settings
      this.isInitialized = true;
    }
  }

  /**
   * Apply current settings to audio elements
   */
  private applySettings(): void {
    if (this.ringbackAudio) {
      this.ringbackAudio.volume = this.settings.volume;
    }
    if (this.ringtoneAudio) {
      this.ringtoneAudio.volume = this.settings.volume;
    }
    if (this.previewAudio) {
      this.previewAudio.volume = this.settings.volume;
    }
    this.loadSelectedRingtone();
  }

  /**
   * Initialize audio elements
   */
  private initializeAudioElements(): void {
    if (typeof window === 'undefined') return;

    // Create ringback audio element (always generated US standard tone)
    this.ringbackAudio = new Audio();
    this.ringbackAudio.loop = true;
    this.ringbackAudio.volume = this.settings.volume;

    // Create ringtone audio element
    this.ringtoneAudio = new Audio();
    this.ringtoneAudio.loop = true;
    this.ringtoneAudio.volume = this.settings.volume;

    // Create preview audio element (for testing tones in settings)
    this.previewAudio = new Audio();
    this.previewAudio.loop = true;
    this.previewAudio.volume = this.settings.volume;

    // Generate ringback tone (US standard)
    this.generateRingbackDataUri().then((uri) => {
      if (this.ringbackAudio) this.ringbackAudio.src = uri;
    });

    // Load selected ringtone
    this.loadSelectedRingtone();
  }

  /**
   * Load the selected ringtone audio file
   */
  private loadSelectedRingtone(): void {
    if (!this.ringtoneAudio) return;

    const ringtone = AVAILABLE_RINGTONES.find((r) => r.id === this.settings.selectedRingtone);

    if (ringtone && ringtone.file) {
      // Use audio file
      this.ringtoneAudio.src = ringtone.file;
      logger.info(`Loaded ringtone: ${ringtone.name}`);
    } else {
      // Use generated tone as fallback
      this.generateRingtoneDataUri().then((uri) => {
        if (this.ringtoneAudio) this.ringtoneAudio.src = uri;
      });
      logger.info('Using generated ringtone');
    }
  }

  /**
   * Generate ringback tone as audio data URI
   * US standard: 440Hz + 480Hz, 2s on, 4s off
   */
  private async generateRingbackDataUri(): Promise<string> {
    return this.generateToneDataUri(440, 480, 2.0, 4.0, 3); // 3 cycles = 18 seconds
  }

  /**
   * Generate ringtone as audio data URI (fallback)
   * More urgent pattern: 440Hz + 480Hz, 1s on, 2s off
   */
  private async generateRingtoneDataUri(): Promise<string> {
    return this.generateToneDataUri(440, 480, 1.0, 2.0, 4); // 4 cycles = 12 seconds
  }

  /**
   * Generate a dual-tone audio data URI
   */
  private async generateToneDataUri(
    freq1: number,
    freq2: number,
    onDuration: number,
    offDuration: number,
    cycles: number
  ): Promise<string> {
    const sampleRate = 44100;
    const cycleDuration = onDuration + offDuration;
    const totalDuration = cycleDuration * cycles;
    const numSamples = Math.floor(totalDuration * sampleRate);

    // Create offline audio context
    const offlineCtx = new OfflineAudioContext(1, numSamples, sampleRate);

    for (let i = 0; i < cycles; i++) {
      const startTime = i * cycleDuration;

      // Oscillator 1
      const osc1 = offlineCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq1;

      // Oscillator 2
      const osc2 = offlineCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq2;

      // Gain for mixing
      const gain = offlineCtx.createGain();
      gain.gain.value = 0.3;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(offlineCtx.destination);

      osc1.start(startTime);
      osc1.stop(startTime + onDuration);
      osc2.start(startTime);
      osc2.stop(startTime + onDuration);
    }

    // Render to buffer
    const buffer = await offlineCtx.startRendering();

    // Convert to WAV
    return this.bufferToWavDataUri(buffer);
  }

  /**
   * Convert AudioBuffer to WAV data URI
   */
  private bufferToWavDataUri(buffer: AudioBuffer): string {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const numSamples = buffer.length;
    const dataSize = numSamples * blockAlign;
    const fileSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(fileSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += bytesPerSample;
    }

    // Convert to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * Load settings from localStorage (fast, synchronous)
   */
  private loadFromLocalStorage(): AudioSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.warn('Failed to load audio settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * Save settings to localStorage (cache)
   */
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      logger.warn('Failed to save audio settings to localStorage:', error);
    }
  }

  /**
   * Save settings to API (debounced)
   */
  private saveToApi(): void {
    // Debounce API saves to avoid too many requests
    if (this.pendingApiSave) {
      clearTimeout(this.pendingApiSave);
    }

    this.pendingApiSave = setTimeout(async () => {
      try {
        await authApiService.updateAudioSettings(this.settings);
        logger.info('Audio settings saved to API');
      } catch (error) {
        logger.warn('Failed to save audio settings to API:', error);
      }
      this.pendingApiSave = null;
    }, 500); // 500ms debounce
  }

  /**
   * Get current audio settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Get available ringtones
   */
  getAvailableRingtones(): RingtoneOption[] {
    return [...AVAILABLE_RINGTONES];
  }

  /**
   * Update audio settings
   */
  updateSettings(settings: Partial<AudioSettings>): void {
    const oldRingtone = this.settings.selectedRingtone;
    this.settings = { ...this.settings, ...settings };

    // Save to localStorage immediately (fast)
    this.saveToLocalStorage();

    // Save to API (debounced)
    this.saveToApi();

    // Update audio element volumes
    if (this.ringbackAudio) {
      this.ringbackAudio.volume = this.settings.volume;
    }
    if (this.ringtoneAudio) {
      this.ringtoneAudio.volume = this.settings.volume;
    }
    if (this.previewAudio) {
      this.previewAudio.volume = this.settings.volume;
    }

    // Reload ringtone if selection changed
    if (settings.selectedRingtone && settings.selectedRingtone !== oldRingtone) {
      this.loadSelectedRingtone();
    }

    logger.info('Audio settings updated:', this.settings);
  }

  /**
   * Set selected ringtone
   */
  setRingtone(ringtoneId: string): void {
    const ringtone = AVAILABLE_RINGTONES.find((r) => r.id === ringtoneId);
    if (ringtone) {
      this.updateSettings({ selectedRingtone: ringtoneId });
    } else {
      logger.warn(`Unknown ringtone ID: ${ringtoneId}`);
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.updateSettings({ volume: Math.max(0, Math.min(1, volume)) });
  }

  /**
   * Enable/disable all audio
   */
  setEnabled(enabled: boolean): void {
    this.updateSettings({ enabled });
    if (!enabled) {
      this.stopAll();
    }
  }

  /**
   * Resume AudioContext after user interaction
   */
  private resumeAudioContext(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch((err) => {
        logger.warn('Failed to resume AudioContext:', err);
      });
    }
  }

  /**
   * Get AudioContext (create if needed)
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended' && this.hasUserInteracted) {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Play ringback tone (outbound call waiting for answer)
   */
  playRingback(): void {
    if (!this.settings.enabled || !this.settings.ringbackEnabled) {
      logger.debug('Ringback disabled in settings');
      return;
    }

    if (this.isRingbackPlaying) {
      logger.debug('Ringback already playing');
      return;
    }

    logger.info('Starting ringback tone');
    this.isRingbackPlaying = true;

    if (this.ringbackAudio?.src) {
      this.ringbackAudio.currentTime = 0;
      this.ringbackAudio.play().catch((err) => {
        logger.warn('Failed to play ringback audio:', err);
        this.isRingbackPlaying = false;
      });
    }
  }

  /**
   * Stop ringback tone
   */
  stopRingback(): void {
    // Always try to stop the audio, regardless of flag state
    if (this.ringbackAudio) {
      this.ringbackAudio.pause();
      this.ringbackAudio.currentTime = 0;
    }

    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }

    if (this.isRingbackPlaying) {
      logger.info('Stopping ringback tone');
      this.isRingbackPlaying = false;
    }
  }

  /**
   * Play incoming call ringtone
   */
  playRingtone(): void {
    if (!this.settings.enabled || !this.settings.ringtoneEnabled) {
      logger.debug('Ringtone disabled in settings');
      return;
    }

    if (this.isRingtonePlaying) {
      logger.debug('Ringtone already playing');
      return;
    }

    logger.info('Starting incoming call ringtone');
    this.isRingtonePlaying = true;

    if (this.ringtoneAudio?.src) {
      this.ringtoneAudio.currentTime = 0;
      this.ringtoneAudio.play().catch((err) => {
        logger.warn('Failed to play ringtone audio:', err);
        this.isRingtonePlaying = false;
      });
    }
  }

  /**
   * Stop incoming call ringtone
   */
  stopRingtone(): void {
    // Always try to stop the audio, regardless of flag state
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
    }

    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }

    if (this.isRingtonePlaying) {
      logger.info('Stopping ringtone');
      this.isRingtonePlaying = false;
    }
  }

  /**
   * Preview a specific ringtone (for settings page)
   */
  previewRingtone(ringtoneId: string): void {
    if (!this.previewAudio) return;

    // Stop any current preview
    this.stopPreview();

    const ringtone = AVAILABLE_RINGTONES.find((r) => r.id === ringtoneId);
    if (!ringtone) {
      logger.warn(`Unknown ringtone ID for preview: ${ringtoneId}`);
      return;
    }

    logger.info(`Previewing ringtone: ${ringtone.name}`);
    this.isPreviewPlaying = true;

    if (ringtone.file) {
      this.previewAudio.src = ringtone.file;
      this.previewAudio.currentTime = 0;
      this.previewAudio.play().catch((err) => {
        logger.warn('Failed to play preview audio:', err);
        this.isPreviewPlaying = false;
      });
    } else {
      // Generated tone preview
      this.generateRingtoneDataUri().then((uri) => {
        if (this.previewAudio) {
          this.previewAudio.src = uri;
          this.previewAudio.currentTime = 0;
          this.previewAudio.play().catch((err) => {
            logger.warn('Failed to play generated preview:', err);
            this.isPreviewPlaying = false;
          });
        }
      });
    }
  }

  /**
   * Stop preview audio
   */
  stopPreview(): void {
    if (!this.isPreviewPlaying) return;

    logger.info('Stopping preview');
    this.isPreviewPlaying = false;

    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    }
  }

  /**
   * Check if preview is playing
   */
  isPreviewActive(): boolean {
    return this.isPreviewPlaying;
  }

  /**
   * Play a DTMF tone
   */
  playDTMF(digit: string, duration: number = 150): void {
    if (!this.settings.enabled) return;

    const frequencies = DTMF_FREQUENCIES[digit];
    if (!frequencies) {
      logger.warn(`Unknown DTMF digit: ${digit}`);
      return;
    }

    try {
      const ctx = this.getAudioContext();
      const gainNode = ctx.createGain();
      gainNode.gain.value = this.settings.volume * 0.3;
      gainNode.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = frequencies[0];
      osc1.connect(gainNode);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = frequencies[1];
      osc2.connect(gainNode);

      osc1.start();
      osc2.start();

      setTimeout(() => {
        osc1.stop();
        osc2.stop();
        osc1.disconnect();
        osc2.disconnect();
        gainNode.disconnect();
      }, duration);
    } catch (error) {
      logger.error('Failed to play DTMF:', error);
    }
  }

  /**
   * Stop all audio
   */
  stopAll(): void {
    this.stopRingback();
    this.stopRingtone();
    this.stopPreview();
  }

  /**
   * Check if ringback is playing
   */
  isRingbackActive(): boolean {
    return this.isRingbackPlaying;
  }

  /**
   * Check if ringtone is playing
   */
  isRingtoneActive(): boolean {
    return this.isRingtonePlaying;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAll();

    if (this.pendingApiSave) {
      clearTimeout(this.pendingApiSave);
      this.pendingApiSave = null;
    }

    if (this.ringbackAudio) {
      this.ringbackAudio.src = '';
      this.ringbackAudio = null;
    }

    if (this.ringtoneAudio) {
      this.ringtoneAudio.src = '';
      this.ringtoneAudio = null;
    }

    if (this.previewAudio) {
      this.previewAudio.src = '';
      this.previewAudio = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((err) => {
        logger.warn('Error closing AudioContext:', err);
      });
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const callAudioService = new CallAudioService();
