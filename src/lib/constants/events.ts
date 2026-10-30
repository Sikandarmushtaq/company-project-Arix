/**
 * Real-time event constants
 *
 * IMPORTANT: Keep in sync with server/src/core/websocket/server.ts
 * These must match the backend REALTIME_EVENTS exactly.
 */
export const REALTIME_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Calls
  CALL_INCOMING: 'call:incoming',
  CALL_STARTED: 'call:started',
  CALL_UPDATED: 'call:updated',
  CALL_ENDED: 'call:ended',
  CALL_MISSED: 'call:missed',
  CALL_HOLD: 'call:hold',
  CALL_MUTE: 'call:mute',
  CALL_ANSWERED_ELSEWHERE: 'call:answered_elsewhere', // Multi-device: call answered on another device

  // LiveKit overlay inbound (Phase 3d) — must match backend server.ts REALTIME_EVENTS
  LIVEKIT_INCOMING: 'livekit:incoming',
  LIVEKIT_CALL_ENDED: 'livekit:call_ended',
  LIVEKIT_ANSWERED_ELSEWHERE: 'livekit:answered_elsewhere', // Multi-device: another of your devices answered

  // SMS
  SMS_RECEIVED: 'sms:received',
  SMS_SENT: 'sms:sent',
  SMS_STATUS: 'sms:status',
  SMS_READ: 'sms:read',
  SMS_TYPING: 'sms:typing',
  SMS_DELETED: 'sms:deleted',
  SMS_CONVERSATION_DELETED: 'sms:conversation_deleted',
  SMS_USAGE_UPDATE: 'sms:usage_update',
  // KYC trial caps — pushed to the org room when daily call/SMS usage changes
  // or the org is verified, so the dialer/SMS limits banner updates live.
  CALL_VERIFICATION_USAGE: 'call_verification:usage',
  // Admin-only: one org's REAL call-usage row (minutes used vs the hidden soft cap),
  // pushed to the admin Usage ledger on a cap change or call-end so it updates live.
  ADMIN_CALL_USAGE: 'admin:call_usage',
  // Admin-only: one org's REAL SMS-usage row (SMS used vs the effective allowance),
  // pushed to the same admin Usage ledger on an SMS send / package grant / cap change.
  ADMIN_SMS_USAGE: 'admin:sms_usage',
  // Calling+SMS bundle changed (bought/switched/canceled/renewed) — Plan & billing
  // refreshes the active bundle + history live.
  BUNDLE_UPDATED: 'bundle:updated',
  SMS_ADMIN_USAGE_UPDATE: 'sms:admin_usage_update', // Real-time admin dashboard updates

  // WhatsApp
  WA_RECEIVED: 'wa:received',
  // Org-wide inbound notification for the manager/admin oversight surface.
  // Server emits this in parallel with the per-user WA_RECEIVED so the
  // oversight UI can refresh without dragging per-user UIs along for the
  // ride. Only listened to from the oversight realtime hook.
  WA_OVERSIGHT_INBOUND: 'wa:oversight_inbound',
  WA_SENT: 'wa:sent',
  WA_STATUS: 'wa:status',
  WA_REACTION: 'wa:reaction',
  WA_READ: 'wa:read',
  WA_DELETED: 'wa:deleted',
  WA_CONVERSATION_DELETED: 'wa:conversation_deleted',
  WA_USAGE_UPDATE: 'wa:usage_update',
  WA_ADMIN_USAGE_UPDATE: 'wa:admin_usage_update',
  WA_CONFIG_UPDATED: 'wa:config_updated',
  WA_GROUP_UPDATED: 'wa:group_updated',
  WA_GROUP_DELETED: 'wa:group_deleted',
  WA_NUMBER_ASSIGNMENT_CHANGED: 'wa:number_assignment_changed',
  /**
   * Fires when admin toggles WA manager-oversight feature flags (typing
   * indicators, live conversation watch, customer-facing Meta typing).
   * Targeted at org members so client-side feature gating refreshes
   * immediately. Payload: { orgId, flags, updatedBy }.
   */
  WA_FEATURE_FLAGS_UPDATED: 'wa:feature_flags_updated',

  /**
   * Agent typing pulse fan-out to org managers.
   * Payload: { customerPhone, userId, userName, isTyping, at }.
   */
  WA_TYPING: 'wa:typing',

  /**
   * Agent's draft text fan-out to managers watching a specific
   * conversation. Empty draft means cleared (agent disconnected or
   * sent the message).
   * Payload: { customerPhone, userId, userName, draft, at }.
   */
  WA_DRAFT: 'wa:draft',

  // Customer assignment (org-level customer pool)
  CUSTOMER_CREATED: 'customer:created',
  CUSTOMER_UPDATED: 'customer:updated',
  CUSTOMER_DELETED: 'customer:deleted',
  CUSTOMER_ASSIGNED: 'customer:assigned',
  CUSTOMER_UNASSIGNED: 'customer:unassigned',
  CUSTOMER_TRIAGE_ARRIVED: 'customer:triage_arrived',

  // SMS Groups
  GROUP_CREATED: 'group:created',
  GROUP_UPDATED: 'group:updated',
  GROUP_DELETED: 'group:deleted',
  GROUP_MEMBER_ADDED: 'group:member_added',
  GROUP_MEMBER_REMOVED: 'group:member_removed',
  GROUP_MESSAGE_SENT: 'group:message_sent',
  GROUP_MESSAGE_RECEIVED: 'group:message_received',

  // Notifications
  NOTIFICATION: 'notification',
  TOAST: 'toast',

  // Voicemail
  VOICEMAIL_NEW: 'voicemail:new',
  VOICEMAIL_DELETED: 'voicemail:deleted',
  VOICEMAIL_READ: 'voicemail:read',
  VOICEMAIL_ALL_READ: 'voicemail:all-read',

  // Recordings
  RECORDING_NEW: 'recording:new',
  RECORDING_DELETED: 'recording:deleted',

  // Org media storage cap reached — new recordings/voicemail are being dropped.
  STORAGE_FULL: 'storage:full',

  // Async recording export (RECORDING-EXPORT-SCOPE.md) — live build progress.
  RECORDING_EXPORT_PROGRESS: 'recording:export:progress',
  RECORDING_EXPORT_READY: 'recording:export:ready',
  RECORDING_EXPORT_FAILED: 'recording:export:failed',

  // Contacts
  CONTACT_CREATED: 'contact:created',
  CONTACT_UPDATED: 'contact:updated',
  CONTACT_DELETED: 'contact:deleted',
  CONTACT_CHANGED: 'contact:changed',

  // Campaigns
  CAMPAIGN_UPDATED: 'campaign:updated',
  CAMPAIGN_STATS: 'campaign:stats',

  // AI Auto-Dialer
  AI_CALL_STARTED: 'ai:call_started',
  AI_CALL_COMPLETED: 'ai:call_completed',
  AI_CALL_FAILED: 'ai:call_failed',
  AI_CAMPAIGN_PROGRESS: 'ai:campaign_progress',

  // Admin events - User management
  ADMIN_USER_CREATED: 'admin:user:created',
  ADMIN_USER_UPDATED: 'admin:user:updated',
  ADMIN_USER_DELETED: 'admin:user:deleted',
  ADMIN_USER_BANNED: 'admin:user:banned',
  ADMIN_USER_UNBANNED: 'admin:user:unbanned',
  ADMIN_USER_PASSWORD_RESET: 'admin:user:password_reset',
  ADMIN_USER_STATUS: 'admin:user:status',

  // Admin events - Device management
  ADMIN_DEVICE_CONNECTED: 'admin:device:connected',
  ADMIN_DEVICE_DISCONNECTED: 'admin:device:disconnected',
  ADMIN_DEVICE_KICKED: 'admin:device:kicked',
  ADMIN_DEVICE_STATUS: 'admin:device:status',

  // Admin events - Session management
  ADMIN_SESSION_CREATED: 'admin:session:created',
  ADMIN_SESSION_TERMINATED: 'admin:session:terminated',
  ADMIN_SESSION_ALL_TERMINATED: 'admin:session:all_terminated',

  // Admin events - Stats and monitoring
  ADMIN_STATS_UPDATE: 'admin:stats:update',
  ADMIN_CALL_ACTIVE: 'admin:call:active',
  ADMIN_CALL_ENDED: 'admin:call:ended',
  ADMIN_CALLS_REFRESHED: 'admin:calls:refreshed',

  // Admin events - Settings
  ADMIN_SETTINGS_CHANGED: 'admin:settings:changed',

  // Admin events - Audit log
  ADMIN_AUDIT_LOG: 'admin:audit:log',

  // Admin events - Permissions
  ADMIN_PERMISSION_GRANTED: 'admin:permission:granted',
  ADMIN_PERMISSION_REVOKED: 'admin:permission:revoked',
  ADMIN_PERMISSION_UPDATED: 'admin:permission:updated',
  PERMISSION_CHANGED: 'permission:changed',

  // Admin events - System health
  ADMIN_HEALTH_UPDATE: 'admin:health:update',
  ADMIN_ALERT: 'admin:alert',

  // Admin events - Card-less (bank-transfer) add-on purchase queue
  ADMIN_PURCHASE_REQUEST: 'admin:purchase:request',
  // Org-facing mirror of a purchase-request status change (pending→approved/rejected)
  ORG_ADDON_REQUEST_UPDATED: 'org:addon_request:updated',

  // Monitoring (pushed to monitored user)
  USER_BEING_MONITORED: 'user:being:monitored',
  USER_MONITORING_STOPPED: 'user:monitoring:stopped',

  // Presence
  USER_ONLINE: 'presence:online',
  USER_OFFLINE: 'presence:offline',

  // User settings (pushed from admin to user)
  USER_SETTINGS_UPDATED: 'user:settings:updated',

  // Organization portal events
  ORG_USER_CREATED: 'org:user:created',
  ORG_USER_UPDATED: 'org:user:updated',
  ORG_USER_DELETED: 'org:user:deleted',
  ORG_NUMBER_PURCHASED: 'org:number:purchased',
  ORG_NUMBER_ASSIGNED: 'org:number:assigned',
  // An admin changed the org's limits (e.g. max phone numbers) — the org portal
  // Numbers page refetches its cap so the change reflects live.
  ORG_LIMITS_UPDATED: 'org:limits_updated',
  // Org call-policy changed (anti-spam end-call lock toggled by the Trunk Usage
  // switch) — every org member's dialer updates the lock live.
  ORG_CALL_POLICY_UPDATED: 'org:call_policy:updated',
  ORG_STATUS_CHANGED: 'org:status:changed',

  // Signup / Onboarding events
  SIGNUP_ORDER_CREATED: 'signup:order:created',
  SIGNUP_ORDER_PAID: 'signup:order:paid',
  SIGNUP_ORDER_PROVISIONED: 'signup:order:provisioned',
  SIGNUP_ORDER_FAILED: 'signup:order:failed',
  // Any org billing-status change (cancel / resume / renewal / suspend) — admins
  // listen so the Organizations list updates in real time.
  ORG_BILLING_CHANGED: 'org:billing:changed',
  // Internal support chat (user ↔ super-admin) real-time events.
  SUPPORT_TICKET_NEW: 'support:ticket_new',
  SUPPORT_MESSAGE: 'support:message',
  SUPPORT_CLAIMED: 'support:claimed',
  SUPPORT_TRANSFERRED: 'support:transferred',
  SUPPORT_CLOSED: 'support:closed',
  SUPPORT_READ: 'support:read',
  // Server→admin: live draft preview so the agent sees the user typing.
  SUPPORT_TYPING: 'support:typing',
  // Client→server: a super-admin's AFK/at-the-desk heartbeat ({ status }).
  SUPPORT_PRESENCE: 'support:presence',
  SIGNUP_SMS_REVIEW_SUBMITTED: 'signup:sms-review:submitted',
  SIGNUP_SMS_REVIEW_UPDATED: 'signup:sms_review:updated',

  // HA Monitoring events
  HA_STATUS_UPDATE: 'ha:status:update',
  HA_SERVER_CHANGED: 'ha:server:changed',
  HA_FAILOVER_STARTED: 'ha:failover:started',
  HA_FAILOVER_COMPLETED: 'ha:failover:completed',
  HA_FAILOVER_FAILED: 'ha:failover:failed',
  HA_ALERT: 'ha:alert',
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
