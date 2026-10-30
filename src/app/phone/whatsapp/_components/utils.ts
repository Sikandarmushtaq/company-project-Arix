/**
 * WhatsApp utility functions
 * Pure functions with no side effects
 */

import type { WaMessageType } from '@/lib/api/services/whatsapp-types';
import {
  WA_ALLOWED_IMAGE_TYPES,
  WA_ALLOWED_STICKER_TYPES,
  WA_ALLOWED_VIDEO_TYPES,
  WA_ALLOWED_AUDIO_TYPES,
  WA_ALLOWED_DOCUMENT_TYPES,
  WA_MAX_IMAGE_SIZE,
  WA_MAX_STICKER_SIZE,
  WA_MAX_VIDEO_SIZE,
  WA_MAX_AUDIO_SIZE,
  WA_MAX_DOCUMENT_SIZE,
  WA_MAX_FILE_SIZE,
} from './types';

// ============================================================
// Media Helpers
// ============================================================

/**
 * Determine the WhatsApp message type from a file's MIME type.
 *
 * Order matters: image/webp must map to 'sticker' (Meta's classification),
 * not 'image' — so sticker is checked before image.
 */
export function getWaTypeFromMime(mimeType: string): WaMessageType {
  if (WA_ALLOWED_STICKER_TYPES.includes(mimeType)) return 'sticker';
  if (WA_ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (WA_ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
  if (WA_ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio';
  return 'document';
}

/**
 * Get the max file size for a given MIME type, matching Meta's per-category
 * Cloud API limits (5MB image, 500KB sticker, 16MB video/audio, 100MB docs).
 */
export function getMaxSizeForMime(mimeType: string): number {
  if (WA_ALLOWED_STICKER_TYPES.includes(mimeType)) return WA_MAX_STICKER_SIZE;
  if (WA_ALLOWED_IMAGE_TYPES.includes(mimeType)) return WA_MAX_IMAGE_SIZE;
  if (WA_ALLOWED_VIDEO_TYPES.includes(mimeType)) return WA_MAX_VIDEO_SIZE;
  if (WA_ALLOWED_AUDIO_TYPES.includes(mimeType)) return WA_MAX_AUDIO_SIZE;
  if (WA_ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return WA_MAX_DOCUMENT_SIZE;
  return WA_MAX_FILE_SIZE;
}

/**
 * Format file size in human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get a friendly label for the WhatsApp message type
 */
export function getWaTypeLabel(waType: WaMessageType): string {
  switch (waType) {
    case 'image':
      return 'Image';
    case 'sticker':
      return 'Sticker';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Document';
    default:
      return 'File';
  }
}

// ============================================================
// Template Variable Helpers
// ============================================================

/**
 * Extract template variables (e.g. {{1}}, {{name}}) from text
 */
export function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{[^}]+\}\}/g) || [];
  return [...new Set(matches)];
}

/**
 * Get human-readable label for a template variable
 * Numeric variables: "Variable 1", named: "Customer name"
 */
export function getVariableLabel(variable: string): string {
  const inner = variable.replace(/^\{\{|\}\}$/g, '').trim();
  return /^\d+$/.test(inner) ? `Variable ${inner}` : inner;
}

/**
 * Get the raw key from a template variable placeholder
 * {{1}} -> "1", {{Customer name}} -> "Customer name"
 */
export function getVariableKey(variable: string): string {
  return variable.replace(/^\{\{|\}\}$/g, '').trim();
}

/**
 * Replace template variable placeholders with actual values
 */
export function fillVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
    const key = inner.trim();
    return values[key] || match;
  });
}
