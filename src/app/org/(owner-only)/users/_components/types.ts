/**
 * PROTOTYPE LOCAL STATE DEFINITIONS
 * 
 * Speculative backend contracts are deliberately avoided pending a full backend audit.
 * Manager permissions, communication capabilities, and status values below are
 * frontend prototype models for local UI state.
 */

export type UserRole = 'owner' | 'manager' | 'user';

/**
 * Confirmed Owner-facing org-user statuses:
 * - active: Active app access
 * - inactive: Deactivated (app access disabled, data/phone preserved)
 * 
 * 'banned' is platform-controlled (read-only display state; not editable by Owner).
 */
export type UserStatus = 'active' | 'inactive' | 'banned';

export interface ManagerPermissions {
  // Monitoring
  dashboard: boolean;
  liveCalls: boolean;
  analytics: boolean;
  // Team Operations
  sessions: boolean;
  callGroups: boolean;
  // Recording & QA
  recordings: boolean;
  voicemailAudit: boolean;
  deleteRecordings: boolean;
  // Workspace
  dialerAccess: boolean;
}

/**
 * The default permission set applied when a member is promoted to manager (the
 * "standard" access preset). A real configuration default — not mock data — so it
 * lives with its type rather than in a fixtures file.
 */
export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  // Monitoring
  dashboard: true,
  liveCalls: true,
  analytics: true,
  // Team Operations
  sessions: true,
  callGroups: false,
  // Recording & QA
  recordings: true,
  voicemailAudit: false,
  deleteRecordings: false,
  // Workspace
  dialerAccess: true,
};

export interface CommunicationCapabilities {
  calling: boolean;
  sms: boolean;
  recordings: boolean;
  autodialer: boolean;
}

export interface TeamMember {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  senderPhone: string | null;
  sipUsername: string | null; // Internal extension (e.g. '20375')
  communication: CommunicationCapabilities;
  managerAccess?: {
    mode: 'standard' | 'custom';
    permissions: ManagerPermissions;
  };
  createdAt?: string;
}

export type CreateTeamMemberInput = Omit<TeamMember, 'id'> & {
  password?: string;
  importHistory?: boolean;
};

export interface AvailableNumber {
  id: number;
  number: string;
  hasHistory: boolean;
}

export interface OrganizationConfig {
  id: number;
  name: string;
  maxUsers: number;
  enabledModules: {
    calling: boolean;
    sms: boolean;
    recordings: boolean;
    whatsapp: boolean;
    autodialer: boolean;
  };
  availableNumbers: AvailableNumber[];
}

export interface TeamFilters {
  search: string;
  role: 'all' | 'manager' | 'user';
  status: 'all' | 'active' | 'inactive';
  phone: 'all' | 'assigned' | 'unassigned';
}

