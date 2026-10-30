import type { Message, Conversation } from '@/lib/api';

// ============================================================
// CONSTANTS - Single Source of Truth
// ============================================================
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILES = 10;
export const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MESSAGES_PER_PAGE = 30;

// SMS Segment Constants
// GSM-7 encoding: 160 chars for single, 153 for concatenated (7 chars for header)
// Unicode (UCS-2): 70 chars for single, 67 for concatenated
export const SMS_GSM7_SINGLE_LIMIT = 160;
export const SMS_GSM7_CONCAT_LIMIT = 153;
export const SMS_UNICODE_SINGLE_LIMIT = 70;
export const SMS_UNICODE_CONCAT_LIMIT = 67;

// GSM-7 basic character set (standard SMS encoding)
// Characters outside this set force Unicode encoding
export const GSM7_BASIC_CHARS =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

// GSM-7 extended characters (count as 2 characters)
export const GSM7_EXTENDED_CHARS = '^{}\\[~]|€';

// ============================================================
// TYPES
// ============================================================
export interface SelectedFile {
  file: File;
  preview: string;
}

export interface GroupedMessageResult {
  phone: string;
  messages: Message[];
}

// Re-export types for convenience
export type { Message, Conversation };
