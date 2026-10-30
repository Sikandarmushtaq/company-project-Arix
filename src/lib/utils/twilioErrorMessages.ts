/**
 * Twilio Error Code Translator
 *
 * Converts Twilio's raw error codes into human-friendly messages.
 * Reference: https://www.twilio.com/docs/api/errors
 */

interface TwilioErrorInfo {
  message: string;
  /** What the user can do about it */
  action?: string;
  /** Whether this is likely a transient issue that might resolve on retry */
  retryable: boolean;
}

/**
 * Maps Twilio SMS error codes to human-readable messages.
 * Most common codes encountered in production.
 */
const TWILIO_SMS_ERROR_MAP: Record<string, TwilioErrorInfo> = {
  // Delivery / Carrier Filtering
  '30003': {
    message: 'Phone was unreachable — the device may be off, out of range, or disconnected.',
    action: 'Try again later.',
    retryable: true,
  },
  '30004': {
    message: 'Message was blocked by the recipient.',
    action: 'The recipient may have blocked your number or messaging.',
    retryable: false,
  },
  '30005': {
    message: "This phone number doesn't exist or is invalid.",
    action: 'Double-check the number and try a different one.',
    retryable: false,
  },
  '30006': {
    message: 'Landline or unreachable carrier — SMS only works on mobile phones.',
    action: 'Try a mobile number instead.',
    retryable: false,
  },
  '30007': {
    message: 'Carrier blocked this message as spam.',
    action: 'Try different wording — avoid excessive caps, special characters, or urgent language.',
    retryable: false,
  },
  '30008': {
    message: 'Message delivery is unknown.',
    action: "The carrier didn't confirm delivery status.",
    retryable: true,
  },

  // A2P 10DLC / Compliance
  '30034': {
    message: 'Your number is not registered for business messaging (A2P 10DLC).',
    action: 'Contact support to complete A2P registration for US carriers.',
    retryable: false,
  },
  '30035': {
    message: 'Your A2P campaign has been paused or flagged.',
    action: 'Contact support to review your messaging campaign.',
    retryable: false,
  },
  '30036': {
    message: 'Message failed carrier filtering for A2P traffic.',
    action: 'Review your message content for spam triggers.',
    retryable: false,
  },

  // Rate limiting
  '30022': {
    message: 'Rate limit exceeded — too many messages sent too quickly.',
    action: 'Wait a moment and try again.',
    retryable: true,
  },

  // Content issues
  '21610': {
    message: 'The recipient has opted out of messages (replied STOP).',
    action: 'This number is on your opt-out list — we cannot message them until they opt back in.',
    retryable: false,
  },
  '21611': {
    message: 'Your number has exceeded the daily sending limit.',
    action: 'Wait until tomorrow or contact support to increase your limit.',
    retryable: true,
  },
  '21614': {
    message: 'Invalid mobile number — SMS only works on mobile phones.',
    action: 'Try a different number.',
    retryable: false,
  },

  // Number format / validation
  '21211': {
    message: 'Invalid phone number format.',
    action: 'Make sure the number has country code (e.g., +1 for US).',
    retryable: false,
  },
  '21217': {
    message: 'This phone number is not a valid mobile number.',
    retryable: false,
  },

  // Balance / Account
  '20003': {
    message: 'Insufficient account balance.',
    action: 'Contact your administrator.',
    retryable: false,
  },
};

/**
 * Extract a Twilio error code from any string.
 * Handles formats like: "Error code: 30007", "30007", "(30007)", "Twilio error 30007: ..."
 */
function extractErrorCode(rawError: string): string | null {
  const match = rawError.match(/\b(2\d{4}|3\d{4})\b/);
  return match ? match[1] : null;
}

/**
 * Translate a raw Twilio error message into a human-friendly version.
 *
 * @param rawError - The raw error string from Twilio (e.g., "Error code: 30007")
 * @returns A user-friendly error message, or the original if no translation found
 */
export function translateTwilioError(rawError: string | null | undefined): string {
  if (!rawError) return 'Message failed to send.';

  const code = extractErrorCode(rawError);
  if (!code) {
    // No recognizable code — return the raw error (it may already be human-readable)
    return rawError;
  }

  const info = TWILIO_SMS_ERROR_MAP[code];
  if (!info) {
    // Known format but unknown code — show something useful
    return `Message failed (error ${code}). Try again or contact support.`;
  }

  // Combine message + action if available
  return info.action ? `${info.message} ${info.action}` : info.message;
}

/**
 * Get structured error info for a Twilio error (for UI that wants to show retry buttons, etc.)
 */
export function getTwilioErrorInfo(rawError: string | null | undefined): TwilioErrorInfo {
  if (!rawError) {
    return {
      message: 'Message failed to send.',
      retryable: true,
    };
  }

  const code = extractErrorCode(rawError);
  if (!code) {
    return {
      message: rawError,
      retryable: false,
    };
  }

  return (
    TWILIO_SMS_ERROR_MAP[code] ?? {
      message: `Message failed (error ${code}).`,
      action: 'Try again or contact support.',
      retryable: true,
    }
  );
}
