/**
 * Download Utilities
 *
 * Reusable functions for downloading media files (recordings, voicemails, etc.)
 *
 * @module lib/utils/download
 */

export interface DownloadOptions {
  /** The blob or blob URL to download */
  blobOrUrl: Blob | string;
  /** Filename for the downloaded file */
  filename: string;
  /** MIME type (used when providing a blob URL string) */
  mimeType?: string;
}

/**
 * Download a blob or blob URL as a file
 *
 * @param options - Download configuration
 *
 * @example
 * // Download a blob directly
 * const blob = await recordingsService.getAudio(id);
 * downloadFile({ blobOrUrl: blob, filename: 'recording.wav' });
 *
 * @example
 * // Download from a cached blob URL
 * downloadFile({ blobOrUrl: cachedBlobUrl, filename: 'voicemail.wav' });
 */
export function downloadFile(options: DownloadOptions): void {
  const { blobOrUrl, filename } = options;

  // Convert blob to URL if needed
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);

  // Create temporary anchor for download
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  // Append, click, and cleanup
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoke the URL if we created it from a blob
  // Note: Don't revoke if it was passed in as a string (might be cached)
  if (typeof blobOrUrl !== 'string') {
    // Delay revocation to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Create a safe filename from potentially unsafe input
 *
 * @param name - The original filename or identifier
 * @param extension - File extension to append (without dot)
 * @returns Sanitized filename
 *
 * @example
 * createSafeFilename('my recording', 'wav'); // 'my_recording.wav'
 * createSafeFilename('voicemail-123', 'wav'); // 'voicemail-123.wav'
 */
export function createSafeFilename(name: string, extension: string): string {
  // Remove potentially dangerous characters
  const safeName = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid filename chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();

  // Ensure the filename is not empty
  const finalName = safeName || 'download';

  // Add extension if not already present
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  if (finalName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    return finalName;
  }

  return `${finalName}.${ext}`;
}

/**
 * Generate a download filename for a recording
 *
 * @param recording - Recording object with optional filename/id
 * @param fallbackId - Fallback ID if recording has no filename
 * @returns Safe filename for download
 */
export function getRecordingFilename(
  recording: { filename?: string; id?: string },
  fallbackId?: string
): string {
  const name = recording.filename || recording.id || fallbackId || 'recording';
  return createSafeFilename(name, 'mp3');
}

/**
 * Generate a download filename for a voicemail
 *
 * @param voicemail - Voicemail object
 * @returns Safe filename for download
 */
export function getVoicemailFilename(voicemail: {
  id: string | number;
  caller_id_number?: string;
}): string {
  const callerId = voicemail.caller_id_number
    ? `-${voicemail.caller_id_number.replace(/\D/g, '')}`
    : '';
  return createSafeFilename(`voicemail-${voicemail.id}${callerId}`, 'mp3');
}

export interface MediaCacheManager {
  /** Get cached blob URL for a key */
  get: (key: string) => string | undefined;
  /** Set blob URL for a key */
  set: (key: string, url: string) => void;
  /** Remove and revoke a cached URL */
  remove: (key: string) => void;
  /** Clear all cached URLs */
  clear: () => void;
}

/**
 * Create a media cache manager for storing and retrieving blob URLs
 *
 * @returns Cache manager object
 *
 * @example
 * const audioCache = createMediaCache();
 *
 * // Cache a blob URL
 * const blobUrl = URL.createObjectURL(blob);
 * audioCache.set(recording.id, blobUrl);
 *
 * // Retrieve later
 * const cached = audioCache.get(recording.id);
 */
export function createMediaCache(): MediaCacheManager {
  const cache = new Map<string, string>();

  return {
    get: (key: string) => cache.get(key),
    set: (key: string, url: string) => cache.set(key, url),
    remove: (key: string) => {
      const url = cache.get(key);
      if (url) {
        URL.revokeObjectURL(url);
        cache.delete(key);
      }
    },
    clear: () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    },
  };
}

// ============================================================================
// Browser Recording Download Utilities
// ============================================================================

/**
 * MIME type to file extension mapping for browser-recorded audio
 */
const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

/**
 * Get file extension from MIME type
 *
 * @param mimeType - The MIME type string
 * @returns Appropriate file extension (without dot)
 */
export function getExtensionFromMimeType(mimeType: string): string {
  // Normalize and lookup
  const normalized = mimeType.toLowerCase().trim();
  return AUDIO_MIME_EXTENSIONS[normalized] || 'webm';
}

/**
 * Generate timestamped filename for browser recordings
 *
 * @param prefix - Filename prefix (default: 'recording')
 * @param mimeType - MIME type to determine extension
 * @returns Formatted filename with timestamp
 */
export function generateRecordingFilename(mimeType: string, prefix: string = 'recording'): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const ext = getExtensionFromMimeType(mimeType);
  return `${prefix}-${timestamp}.${ext}`;
}

/**
 * Download a browser-recorded audio blob
 *
 * Handles proper MIME type detection and generates appropriate filename.
 *
 * @param blob - The recorded audio blob
 * @param filenamePrefix - Optional prefix for the filename
 *
 * @example
 * const recording = await sipManager.stopRecording(lineId);
 * if (recording) {
 *   downloadRecordingBlob(recording, 'call-recording');
 * }
 */
export function downloadRecordingBlob(blob: Blob, filenamePrefix: string = 'recording'): void {
  const filename = generateRecordingFilename(blob.type, filenamePrefix);
  downloadFile({ blobOrUrl: blob, filename });
}
