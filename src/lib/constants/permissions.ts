/**
 * Permission Constants
 *
 * SSOT mirror of server/src/modules/permissions/permission.constants.ts
 * All permission codes for the permissions system.
 *
 * @module lib/constants/permissions
 */

export const PERMISSIONS = {
  // ========== VIEWING PERMISSIONS ==========
  VIEW_DASHBOARD: 'view.dashboard',
  VIEW_USERS: 'view.users',
  VIEW_USER_DETAILS: 'view.user_details',
  VIEW_AUDIT_LOGS: 'view.audit_logs',
  VIEW_RECORDINGS: 'view.recordings',
  VIEW_VOICEMAIL_AUDIT: 'view.voicemail_audit',
  VIEW_CALL_HISTORY: 'view.call_history',
  VIEW_SMS_HISTORY: 'view.sms_history',
  VIEW_DEVICES: 'view.devices',
  VIEW_SESSIONS: 'view.sessions',
  VIEW_ANALYTICS: 'view.analytics',
  VIEW_LIVE_CALLS: 'view.live_calls',
  VIEW_SYSTEM_HEALTH: 'view.system_health',
  VIEW_FAILOVER: 'view.failover',
  VIEW_BANS: 'view.bans',
  VIEW_SETTINGS: 'view.settings',
  VIEW_DIALER: 'view.dialer',

  // ========== MANAGING PERMISSIONS - Users ==========
  MANAGE_USERS: 'manage.users',
  CREATE_USERS: 'manage.users.create',
  UPDATE_USERS: 'manage.users.update',
  DELETE_USERS: 'manage.users.delete',
  MANAGE_USER_ROLES: 'manage.users.roles',
  MANAGE_USER_PERMISSIONS: 'manage.users.permissions',

  // ========== MANAGING PERMISSIONS - Sessions ==========
  MANAGE_SESSIONS: 'manage.sessions',
  TERMINATE_SESSIONS: 'manage.sessions.terminate',
  TERMINATE_ALL_SESSIONS: 'manage.sessions.terminate_all',

  // ========== MANAGING PERMISSIONS - Devices ==========
  MANAGE_DEVICES: 'manage.devices',
  KICK_DEVICES: 'manage.devices.kick',
  BAN_DEVICES: 'manage.devices.ban',

  // ========== MANAGING PERMISSIONS - Recordings ==========
  MANAGE_RECORDINGS: 'manage.recordings',
  DELETE_RECORDINGS: 'manage.recordings.delete',
  DOWNLOAD_RECORDINGS: 'manage.recordings.download',

  // ========== MANAGING PERMISSIONS - Bans ==========
  MANAGE_BANS: 'manage.bans',
  BAN_USERS: 'manage.bans.users',
  UNBAN_USERS: 'manage.bans.unban',

  // ========== MANAGING PERMISSIONS - Phone Numbers ==========
  MANAGE_PHONE_NUMBERS: 'manage.phone_numbers',
  TRANSFER_PHONE_NUMBERS: 'manage.phone_numbers.transfer',

  // ========== MANAGING PERMISSIONS - SMS ==========
  MANAGE_SMS: 'manage.sms',
  TOGGLE_SMS: 'manage.sms.toggle',
  SET_SMS_LIMIT: 'manage.sms.limit',
  // SMS usage dashboard — hidden by default; a super-admin grants it per user.
  VIEW_SMS_USAGE: 'view.sms_usage',

  // ========== MANAGING PERMISSIONS - AutoDialer ==========
  MANAGE_AUTODIALER: 'manage.autodialer',
  TOGGLE_AUTODIALER: 'manage.autodialer.toggle',

  // ========== MANAGING PERMISSIONS - Call Monitoring ==========
  MONITOR_CALLS: 'manage.calls.monitor',
  WHISPER_CALLS: 'manage.calls.whisper',
  BARGE_CALLS: 'manage.calls.barge',

  // ========== SYSTEM PERMISSIONS ==========
  ACCESS_SETTINGS: 'system.settings',
  UPDATE_SETTINGS: 'system.settings.update',
  ACCESS_FAILOVER: 'system.failover',
  SWITCH_SERVER: 'system.failover.switch',
  ACCESS_MAINTENANCE: 'system.maintenance',
  RUN_MAINTENANCE: 'system.maintenance.run',
  VIEW_SYSTEM_LOGS: 'system.logs.view',

  // ========== SECURITY PERMISSIONS ==========
  RESET_PASSWORDS: 'security.passwords.reset',
  FORCE_LOGOUT: 'security.force_logout',
  VIEW_SECURITY_EVENTS: 'security.events.view',
  MANAGE_IP_BANS: 'security.ip_bans',

  // ========== REPORTING PERMISSIONS ==========
  EXPORT_DATA: 'reporting.export',
  EXPORT_USERS: 'reporting.export.users',
  EXPORT_CALLS: 'reporting.export.calls',
  EXPORT_SMS: 'reporting.export.sms',
  EXPORT_AUDIT: 'reporting.export.audit',
  GENERATE_REPORTS: 'reporting.generate',

  // ========== BULK OPERATIONS ==========
  BULK_OPERATIONS: 'bulk.operations',
  BULK_BAN: 'bulk.ban',
  BULK_DELETE: 'bulk.delete',
  BULK_UPDATE: 'bulk.update',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
