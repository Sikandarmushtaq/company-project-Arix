/**
 * Auth Types - MIRRORS BACKEND SSOT
 * @see server/src/shared/types/user.types.ts
 */

import type {
  ISODateString,
  E164PhoneNumber,
  BaseEntity,
  ApiResponse as BaseApiResponse,
} from './common';

// Re-export ApiResponse for backward compatibility
export type { ApiResponse } from './common';

/**
 * User roles - MATCHES BACKEND ENUM
 */
export type UserRole = 'super_admin' | 'superadmin' | 'admin' | 'manager' | 'user' | 'owner';

/**
 * User status - MATCHES BACKEND ENUM
 */
export type UserStatus = 'active' | 'inactive' | 'banned' | 'pending';

/**
 * Phone number assigned to a user (multi-number support)
 */
export interface PhoneNumber {
  id: number;
  phoneNumber: E164PhoneNumber;
  label: string | null;
  isPrimary: boolean;
  smsEnabled: boolean;
  autoSmsEnabled: boolean;
  aiDialerEnabled?: boolean;
  elevenlabsPhoneId?: string | null;
  createdAt?: ISODateString;
}

/**
 * User entity - MATCHES BACKEND SafeUser (without password/sipPassword)
 * @see server/src/shared/types/user.types.ts - SafeUser
 */
export interface User extends BaseEntity {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;

  // Multi-tenant organization (org = the company the user belongs to)
  organizationId?: number | null;
  /** The organization/company display name, when the user belongs to one. */
  organizationName?: string | null;
  /**
   * Business-KYC gate (reskin only). 'not_required'/'approved' = uncapped;
   * 'pending'/'rejected' = outbound calling + SMS are capped per day until a
   * super-admin approves Call Verification.
   */
  callVerificationStatus?: 'not_required' | 'pending' | 'approved' | 'rejected' | null;

  /**
   * Org-level anti-spam end-call lock policy. 1/true (or absent) = the ~6s lock
   * applies to outbound answered calls; 0/false = no lock. Set org-wide by the
   * super-admin Trunk Usage switch (telnyx → on, tozcall → off) and pushed live
   * via ORG_CALL_POLICY_UPDATED. Absent → treated as ON (fail-safe). MySQL sends 0/1.
   */
  endCallLockEnabled?: boolean | number | null;

  // Phone/SIP configuration
  senderPhone: E164PhoneNumber;
  sipUsername: string;
  sipDomain: string;

  // Multi-number support
  phoneNumbers?: PhoneNumber[];

  // Feature flags
  smsEnabled: boolean;
  autoDialerEnabled: boolean;
  recordingEnabled: boolean;
  /**
   * WhatsApp/contacts privacy mode. When true, the agent's UI hides
   * customer phone numbers across the WhatsApp pages and the contacts
   * page. Display-only — server still ships phones as routing keys.
   * Server-side guards prevent this being set on owner/manager/admin.
   */
  waPhoneMaskEnabled?: boolean;

  // SMS provider assignment
  smsType: 'standard' | 'auto' | 'both' | null;

  // SMS limits
  smsLimit: number | null;
  smsCount: number;

  // Bulk SMS settings
  bulkSmsInterval: number;
  bulkSmsIntervalControl: boolean;
  userBulkSmsInterval: number | null;

  // Preferences
  timezone: string;
  language: string;

  // Metadata
  lastLoginAt: ISODateString | null;
  lastActivityAt: ISODateString | null;
  mustChangePassword: boolean;
  passwordChangedAt: ISODateString | null;

  // Failover
  preferredServer: 'primary' | 'backup' | null;
}

/**
 * Login credentials - MATCHES BACKEND LoginRequest
 * @see server/src/shared/types/user.types.ts - LoginRequest
 */
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login response data - MATCHES BACKEND LoginResponse
 * @see server/src/shared/types/user.types.ts - LoginResponse
 */
export interface LoginData {
  user: User;
  token?: string;
  expiresAt: ISODateString;
  mustChangePassword: boolean;
}

/**
 * Auth state for Zustand store
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  expiresAt: ISODateString | null;
  token: string | null;
}

/**
 * Change password request - MATCHES BACKEND
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * OTP check response - MATCHES BACKEND
 * @see server/src/modules/otp/otp.types.ts
 */
export interface OtpCheckResponse {
  requiresOtp: boolean;
  message?: string;
}

/**
 * OTP send request
 */
export interface OtpSendRequest {
  email: string;
}

/**
 * OTP send response - MATCHES BACKEND
 */
export interface OtpSendResponse {
  success: boolean;
  message: string;
  remainingAttempts?: number;
  expiresIn?: number;
  cooldownRemaining?: number;
}

/**
 * OTP verify request
 */
export interface OtpVerifyRequest {
  email: string;
  otp: string;
  password: string;
  /** Stable per-browser device id (see lib/device-id) — OTP completes the login
   *  and creates the session, so it carries the same device fingerprint. */
  deviceId?: string;
}

/**
 * OTP verify response - MATCHES BACKEND LoginResponse
 */
export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  token?: string;
  expiresAt?: string;
  user?: User;
  mustChangePassword?: boolean;
}

/**
 * User session - MATCHES BACKEND UserSession
 */
export interface UserSession {
  id: string;
  sessionId: string;
  userId: number;
  userPhone: E164PhoneNumber;
  userRole: UserRole;
  ip: string;
  userAgent: string;
  loginAt: ISODateString;
  lastActiveAt: ISODateString;
  expiresAt: ISODateString;
  isActive: boolean;
}
