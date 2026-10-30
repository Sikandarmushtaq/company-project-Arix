/**
 * Message utility functions
 * Pure functions with no side effects
 */

import {
  GSM7_BASIC_CHARS,
  GSM7_EXTENDED_CHARS,
  SMS_GSM7_SINGLE_LIMIT,
  SMS_GSM7_CONCAT_LIMIT,
  SMS_UNICODE_SINGLE_LIMIT,
  SMS_UNICODE_CONCAT_LIMIT,
} from './types';

/**
 * Format file size in human-readable format
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Strip HTML tags from a string
 */
export const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<img[^>]*>/gi, '[Image]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
};

/**
 * Get preview text for conversation list
 * Handles both SMS (text) and MMS (media) messages
 */
export const getConversationPreview = (
  lastMessage: string | null | undefined,
  mediaUrl?: string | null
): string => {
  const textContent = stripHtml(lastMessage || '');
  if (textContent) return textContent;
  if (mediaUrl) return '📷 Image';
  return '';
};

/**
 * Extract image URLs from HTML body
 */
export const extractImages = (body: string): string[] => {
  if (!body) return [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(body)) !== null) {
    urls.push(match[1]);
  }
  return urls;
};

/**
 * Get text content from message body (strips HTML)
 */
export const getMessageText = (body: string): string => {
  if (!body) return '';
  return body
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
};

/**
 * Download an image from URL
 */
export const downloadImage = async (url: string, filename?: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || url.split('/').pop() || 'image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank');
  }
};

/**
 * Check if URL is a Twilio media URL
 */
export const isTwilioUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('twilio.com');
  } catch {
    return false;
  }
};

/**
 * Get auth token from localStorage
 */
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

/**
 * Get grid class based on image count - professional responsive layout
 */
export const getImageGridClass = (count: number): string => {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-2'; // 2 top, 1 bottom spanning
  if (count === 4) return 'grid-cols-2';
  return 'grid-cols-3'; // 5+ images in 3 columns
};

// ============================================================
// SMS CHARACTER & SEGMENT UTILITIES
// ============================================================

/**
 * Check if a character is in the GSM-7 basic character set
 */
const isGsm7Basic = (char: string): boolean => {
  return GSM7_BASIC_CHARS.includes(char);
};

/**
 * Check if a character is in the GSM-7 extended set (counts as 2 chars)
 */
const isGsm7Extended = (char: string): boolean => {
  return GSM7_EXTENDED_CHARS.includes(char);
};

/**
 * Check if entire message can be encoded as GSM-7
 * Returns false if any character requires Unicode encoding
 */
export const isGsm7Encodable = (text: string): boolean => {
  for (const char of text) {
    if (!isGsm7Basic(char) && !isGsm7Extended(char)) {
      return false;
    }
  }
  return true;
};

/**
 * Count the effective character length for GSM-7 encoding
 * Extended characters count as 2 characters
 */
export const getGsm7Length = (text: string): number => {
  let length = 0;
  for (const char of text) {
    if (isGsm7Extended(char)) {
      length += 2; // Extended chars take 2 character slots
    } else {
      length += 1;
    }
  }
  return length;
};

/**
 * SMS segment calculation result
 */
export interface SmsSegmentInfo {
  /** Number of characters in message */
  characterCount: number;
  /** Effective character count (GSM-7 extended chars count as 2) */
  effectiveLength: number;
  /** Number of SMS segments this message will use */
  segmentCount: number;
  /** Maximum characters allowed per segment */
  charsPerSegment: number;
  /** Characters remaining in current segment */
  remainingInSegment: number;
  /** Whether message uses Unicode encoding */
  isUnicode: boolean;
  /** Whether message is MMS (has media) */
  isMms: boolean;
  /** Message type label for display */
  messageType: 'SMS' | 'MMS';
  /** Encoding type for display */
  encodingType: 'GSM-7' | 'Unicode';
}

/**
 * Calculate SMS segment information for a message
 * Accounts for GSM-7 vs Unicode encoding and concatenation headers
 *
 * @param text - The message text
 * @param hasMedia - Whether message has media attachments (makes it MMS)
 * @returns Segment calculation details
 */
export const calculateSmsSegments = (text: string, hasMedia: boolean = false): SmsSegmentInfo => {
  // MMS is always 1 segment regardless of text length
  if (hasMedia) {
    return {
      characterCount: text.length,
      effectiveLength: text.length,
      segmentCount: 1,
      charsPerSegment: 1600, // MMS can have much longer text
      remainingInSegment: 1600 - text.length,
      isUnicode: false,
      isMms: true,
      messageType: 'MMS',
      encodingType: 'GSM-7',
    };
  }

  // Empty message
  if (!text || text.length === 0) {
    return {
      characterCount: 0,
      effectiveLength: 0,
      segmentCount: 0,
      charsPerSegment: SMS_GSM7_SINGLE_LIMIT,
      remainingInSegment: SMS_GSM7_SINGLE_LIMIT,
      isUnicode: false,
      isMms: false,
      messageType: 'SMS',
      encodingType: 'GSM-7',
    };
  }

  const isUnicode = !isGsm7Encodable(text);
  const characterCount = text.length;

  let effectiveLength: number;
  let singleLimit: number;
  let concatLimit: number;

  if (isUnicode) {
    // Unicode: each character counts as 1, limits are 70/67
    effectiveLength = characterCount;
    singleLimit = SMS_UNICODE_SINGLE_LIMIT;
    concatLimit = SMS_UNICODE_CONCAT_LIMIT;
  } else {
    // GSM-7: extended chars count as 2, limits are 160/153
    effectiveLength = getGsm7Length(text);
    singleLimit = SMS_GSM7_SINGLE_LIMIT;
    concatLimit = SMS_GSM7_CONCAT_LIMIT;
  }

  // Calculate segments
  let segmentCount: number;
  let charsPerSegment: number;
  let remainingInSegment: number;

  if (effectiveLength <= singleLimit) {
    // Fits in single SMS
    segmentCount = effectiveLength > 0 ? 1 : 0;
    charsPerSegment = singleLimit;
    remainingInSegment = singleLimit - effectiveLength;
  } else {
    // Requires concatenated SMS (uses header bytes, reducing usable chars)
    segmentCount = Math.ceil(effectiveLength / concatLimit);
    charsPerSegment = concatLimit;
    remainingInSegment = segmentCount * concatLimit - effectiveLength;
  }

  return {
    characterCount,
    effectiveLength,
    segmentCount,
    charsPerSegment,
    remainingInSegment,
    isUnicode,
    isMms: false,
    messageType: 'SMS',
    encodingType: isUnicode ? 'Unicode' : 'GSM-7',
  };
};

/**
 * Common smart-quote and special character replacements
 * Maps Unicode characters that trigger UCS-2 to their GSM-7 equivalents
 */
const SMART_CHAR_REPLACEMENTS: [RegExp, string][] = [
  [/[\u2018\u2019\u201A\u2039\u203A]/g, "'"], // Smart single quotes → straight apostrophe
  [/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"'], // Smart double quotes → straight quote
  [/[\u2013\u2014]/g, '-'], // En dash, em dash → hyphen
  [/[\u2026]/g, '...'], // Ellipsis → three dots
  [/[\u00A0]/g, ' '], // Non-breaking space → regular space
  [/[\u2002\u2003\u2009\u200A\u200B]/g, ' '], // Various Unicode spaces → regular space
  [/[\u2022]/g, '*'], // Bullet → asterisk
];

/**
 * Auto-replace smart quotes, em/en dashes, and other common Unicode characters
 * with their GSM-7 equivalents to reduce segment count.
 * Returns the sanitized text.
 */
export const sanitizeSmsText = (text: string): string => {
  let result = text;
  for (const [pattern, replacement] of SMART_CHAR_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
};

/**
 * Find Unicode characters in text that would force UCS-2 encoding.
 * Returns array of { char, position, name } for display in warnings.
 */
export const findUnicodeCharacters = (
  text: string
): { char: string; position: number; name: string }[] => {
  const found: { char: string; position: number; name: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!isGsm7Basic(char) && !isGsm7Extended(char) && !seen.has(char)) {
      seen.add(char);
      found.push({
        char,
        position: i,
        name: getUnicodeCharName(char),
      });
    }
  }
  return found;
};

/**
 * Get a human-readable name for common Unicode characters that trigger UCS-2
 */
function getUnicodeCharName(char: string): string {
  const code = char.codePointAt(0) || 0;
  const names: Record<number, string> = {
    0x2018: 'left single quote',
    0x2019: 'right single quote',
    0x201c: 'left double quote',
    0x201d: 'right double quote',
    0x201e: 'double low quote',
    0x2013: 'en dash',
    0x2014: 'em dash',
    0x2026: 'ellipsis',
    0x00a0: 'non-breaking space',
    0x2002: 'en space',
    0x2003: 'em space',
    0x2022: 'bullet',
    0x00ab: 'left guillemet',
    0x00bb: 'right guillemet',
  };
  if (names[code]) return names[code];
  if (code >= 0x1f600 && code <= 0x1f64f) return 'emoji';
  if (code >= 0x1f300 && code <= 0x1f5ff) return 'emoji';
  if (code >= 0x1f680 && code <= 0x1f6ff) return 'emoji';
  if (code >= 0x2600 && code <= 0x27bf) return 'symbol';
  if (code >= 0x0600 && code <= 0x06ff) return 'Arabic';
  if (code >= 0x0900 && code <= 0x097f) return 'Hindi';
  if (code >= 0x4e00 && code <= 0x9fff) return 'Chinese';
  return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Get a human-readable segment summary
 * e.g., "45/160" or "180/153 (2 SMS)"
 */
export const getSegmentSummary = (info: SmsSegmentInfo): string => {
  if (info.isMms) {
    return 'MMS';
  }

  if (info.segmentCount <= 1) {
    return `${info.effectiveLength}/${info.charsPerSegment}`;
  }

  return `${info.effectiveLength} chars (${info.segmentCount} SMS)`;
};
