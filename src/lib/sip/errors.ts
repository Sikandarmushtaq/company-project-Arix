/**
 * SIP Error Classes
 *
 * Custom error types for SIP operations with proper error codes
 * and contextual information.
 *
 * @module lib/sip/errors
 */

/**
 * SIP Error codes
 */
export enum SipErrorCode {
  // Connection errors (1xx)
  CONNECTION_FAILED = 'SIP_CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'SIP_CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'SIP_CONNECTION_LOST',
  INVALID_URI = 'SIP_INVALID_URI',

  // Registration errors (2xx)
  REGISTRATION_FAILED = 'SIP_REGISTRATION_FAILED',
  REGISTRATION_TIMEOUT = 'SIP_REGISTRATION_TIMEOUT',
  REGISTRATION_REJECTED = 'SIP_REGISTRATION_REJECTED',
  NOT_REGISTERED = 'SIP_NOT_REGISTERED',

  // Call errors (3xx)
  CALL_FAILED = 'SIP_CALL_FAILED',
  CALL_REJECTED = 'SIP_CALL_REJECTED',
  CALL_BUSY = 'SIP_CALL_BUSY',
  CALL_NOT_FOUND = 'SIP_CALL_NOT_FOUND',
  CALL_TIMEOUT = 'SIP_CALL_TIMEOUT',
  NO_AVAILABLE_LINES = 'SIP_NO_AVAILABLE_LINES',
  INVALID_CALL_STATE = 'SIP_INVALID_CALL_STATE',
  HOLD_FAILED = 'SIP_HOLD_FAILED',
  UNHOLD_FAILED = 'SIP_UNHOLD_FAILED',

  // Media errors (4xx)
  MEDIA_PERMISSION_DENIED = 'SIP_MEDIA_PERMISSION_DENIED',
  MEDIA_DEVICE_ERROR = 'SIP_MEDIA_DEVICE_ERROR',
  MEDIA_NEGOTIATION_FAILED = 'SIP_MEDIA_NEGOTIATION_FAILED',

  // General errors (9xx)
  UNKNOWN = 'SIP_UNKNOWN_ERROR',
}

/**
 * Base SIP error class
 */
export class SipError extends Error {
  readonly code: SipErrorCode;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: SipErrorCode = SipErrorCode.UNKNOWN,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message);
    this.name = 'SipError';
    this.code = code;
    this.cause = options?.cause;
    this.context = options?.context;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SipError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Connection-related errors
 */
export class ConnectionError extends SipError {
  constructor(
    message: string,
    code: SipErrorCode = SipErrorCode.CONNECTION_FAILED,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, code, options);
    this.name = 'ConnectionError';
  }
}

/**
 * Registration-related errors
 */
export class RegistrationError extends SipError {
  readonly statusCode?: number;
  readonly reasonPhrase?: string;

  constructor(
    message: string,
    code: SipErrorCode = SipErrorCode.REGISTRATION_FAILED,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      statusCode?: number;
      reasonPhrase?: string;
    }
  ) {
    super(message, code, options);
    this.name = 'RegistrationError';
    this.statusCode = options?.statusCode;
    this.reasonPhrase = options?.reasonPhrase;
  }
}

/**
 * Call-related errors
 */
export class CallError extends SipError {
  readonly lineId?: number;
  readonly statusCode?: number;
  readonly reasonPhrase?: string;

  constructor(
    message: string,
    code: SipErrorCode = SipErrorCode.CALL_FAILED,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      lineId?: number;
      statusCode?: number;
      reasonPhrase?: string;
    }
  ) {
    super(message, code, options);
    this.name = 'CallError';
    this.lineId = options?.lineId;
    this.statusCode = options?.statusCode;
    this.reasonPhrase = options?.reasonPhrase;
  }
}

/**
 * Media-related errors
 */
export class MediaError extends SipError {
  constructor(
    message: string,
    code: SipErrorCode = SipErrorCode.MEDIA_DEVICE_ERROR,
    options?: { cause?: Error; context?: Record<string, unknown> }
  ) {
    super(message, code, options);
    this.name = 'MediaError';
  }
}
