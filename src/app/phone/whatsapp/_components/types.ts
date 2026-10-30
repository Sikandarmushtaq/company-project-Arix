import type {
  WaMessage,
  WaConversation,
  WaTemplate,
  WaMessageType,
} from '@/lib/api/services/whatsapp-types';

// ============================================================
// CONSTANTS - Single Source of Truth
// ============================================================

export const WA_MESSAGES_PER_PAGE = 100;

// WhatsApp media constraints — sized per Meta Cloud API v21.0 limits.
// https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#supported-media-types
// WhatsApp Cloud API sends one media per message (unlike SMS which batches).
export const WA_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB — absolute ceiling (documents)
export const WA_MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB — JPEG / PNG
export const WA_MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16MB — MP4 / 3GPP
export const WA_MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB — AAC / AMR / MP3 / M4A / OGG-OPUS
export const WA_MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB — PDF / Office / TXT
// WebP stickers: 100KB static, 500KB animated. We can't reliably distinguish
// the two client-side without parsing the RIFF container, so enforce the
// permissive limit and let Meta reject animated files >500KB or static >100KB.
export const WA_MAX_STICKER_SIZE = 500 * 1024; // 500KB — animated WebP ceiling

// Allowed MIME types for WhatsApp media (per Meta Cloud API v21.0)
export const WA_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
export const WA_ALLOWED_STICKER_TYPES = ['image/webp'];
export const WA_ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/3gpp'];
export const WA_ALLOWED_AUDIO_TYPES = [
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/amr',
  'audio/ogg',
];
export const WA_ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
export const WA_ALLOWED_TYPES = [
  ...WA_ALLOWED_IMAGE_TYPES,
  ...WA_ALLOWED_STICKER_TYPES,
  ...WA_ALLOWED_VIDEO_TYPES,
  ...WA_ALLOWED_AUDIO_TYPES,
  ...WA_ALLOWED_DOCUMENT_TYPES,
];

// ============================================================
// TYPES
// ============================================================

export interface WaSelectedFile {
  file: File;
  preview: string; // Object URL for image/sticker preview, empty for other types
  waType: WaMessageType; // 'image' | 'sticker' | 'video' | 'audio' | 'document'
}

// Re-export types for convenience
export type { WaMessage, WaConversation, WaTemplate, WaMessageType };
