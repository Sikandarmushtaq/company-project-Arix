// Debounce
export { useDebounce } from './useDebounce';

// Pagination
export {
  usePagination,
  PAGINATION_DEFAULTS,
  createPaginationInfo,
  type PaginationState,
  type PaginationInfo,
  type PaginationControls,
  type PaginatedResponse,
} from './usePagination';

// Real-time sync
export { useRealtimeSync } from './useRealtimeSync';

// Contacts
export {
  useContacts,
  useContactsPaginated,
  useBlockedContacts,
  useBlockedNumberLookup,
  useFavoriteContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useBlockContact,
  useUnblockContact,
  useToggleFavorite,
  contactsKeys,
} from './useContacts';

// Contact Name Lookup (SSOT)
export {
  useContactName,
  useContactDisplayName,
  useContactInfo,
  useHasContact,
  useResolvedContact,
  useContactLookupStatus,
} from './useContactName';

// Calls
export {
  useCalls,
  useCallsPaginated,
  useCallStats,
  useUnreadCallCount,
  useUnreadCalls,
  useMarkCallsAsRead,
  useDeleteCalls,
  callsKeys,
} from './useCalls';

// Messages
export {
  useConversations,
  useConversationsPaginated,
  useMessages,
  useMessagesPaginated,
  useSearchMessages,
  useUnreadMessageCount,
  useUnreadConversations,
  useSendMessage,
  useMarkMessagesAsRead,
  useMarkConversationUnread,
  useDeleteConversation,
  useDeleteConversations,
  useDeleteMessages,
  messagesKeys,
} from './useMessages';

// Groups (SMS Group Messaging)
export {
  useUnifiedConversations,
  useGroups,
  useGroup,
  useGroupMessages,
  useGroupUnreadCount,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useDeleteGroupMessages,
  useAddGroupMembers,
  useRemoveGroupMember,
  useSendGroupMessage,
  useMarkGroupAsRead,
  groupsKeys,
} from './useGroups';

// Voicemail
export {
  useVoicemails,
  useVoicemailsPaginated,
  useVoicemailCounts,
  useVoicemailAudio,
  useUnreadVoicemails,
  useMarkVoicemailAsRead,
  useDeleteVoicemail,
  useDeleteVoicemails,
  useMarkAllVoicemailsAsRead,
  voicemailKeys,
} from './useVoicemail';

// Recordings
export {
  useRecordings,
  useRecordingsPaginated,
  useRecordingQuota,
  useOrganizationQuota,
  useOrganizationsWithQuotas,
  useUpdateOrganizationQuota,
  useMyRecordingStats,
  useRecordingAudio,
  useDeleteRecording,
  useBulkDeleteRecordings,
  useBulkDownloadPlan,
  recordingsKeys,
} from './useRecordings';

// Campaigns (Auto-Dialer)
export {
  useCampaigns,
  useCampaignsPaginated,
  useCampaignStats,
  useAllCampaignStats,
  useCreateCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
  useDeleteCampaign,
  campaignsKeys,
} from './useCampaigns';

// Admin
export {
  useAdminStats,
  useAdminUsers,
  useAdminUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useSetBanStatus,
  useToggleSms,
  useToggleAutoDialer,
  useUpdateUserPassword,
  useForceLogout,
  useAdminDevices,
  useKickDevice,
  useAdminConnections,
  useKickConnection,
  useKickUserConnections,
  useAdminSessions,
  useSessionStats,
  useLogoutSession,
  useLogoutAllSessions,
  useBannedUsers,
  useTempBans,
  useDeviceBans,
  useIpBans,
  useBanIpFromConnection,
  useUnbanIp,
  useFailoverStatus,
  useSwitchAllToBackup,
  useSwitchUserServer,
  useRecordingStats,
  useDeleteOldRecordings,
  useUsersWithQuotas,
  useUpdateUserQuota,
  useAuditLogs,
  useAuditStats,
  useAuditActions,
  useExportAuditLogs,
  useCleanupAuditLogs,
  // Analytics
  useAnalyticsOverview,
  useTimeSeriesData,
  useCallAnalytics,
  useSmsAnalytics,
  useUserAnalytics,
  useCampaignAnalytics,
  useWhatsAppCallAnalytics,
  // Bulk Operations
  useBulkBanUsers,
  useBulkUnbanUsers,
  useBulkEnableSms,
  useBulkDisableSms,
  useBulkEnableAutoDialer,
  useBulkDisableAutoDialer,
  useBulkDeleteUsers,
  // Data Export
  useExportUsers,
  useExportSessions,
  useExportDevices,
  useExportCalls,
  useExportSms,
  useExportVoicemails,
  useExportRecordings,
  // System Settings
  useSettings,
  useUpdateSettings,
  // Organizations
  useOrganizations,
  useOrganization,
  useOrganizationStats,
  useOrganizationUsers,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useReactivateOrganization,
  usePurgeOrganization,
  useAssignUserToOrganization,
  useRemoveUserFromOrganization,
  useUnassignedUsers,
  adminKeys,
} from './useAdmin';

// WhatsApp Messages
export {
  waMessagesKeys,
  useWaStatus,
  useWaConversationsPaginated,
  useWaConversationsInfinite,
  useWaUnreadCount,
  useWaConversationWindows,
  useWaConversationWindow,
  useWaTemplates,
  useWaMessagesInfinite,
  useWaSearchMessages,
  useWaSendMessage,
  useWaSendTemplate,
  useWaDeleteMessages,
  useWaDeleteConversation,
  useWaMarkAsRead,
} from './useWaMessages';

// Admin WhatsApp User Hooks
export { useBulkEnableWhatsApp, useBulkDisableWhatsApp } from './useAdminUsers';

// Admin Real-time Sync
export { useAdminRealtimeSync, type AuditLogEntry, type AdminAlert } from './useAdminRealtimeSync';

// System Monitoring
export {
  useSystemMetrics,
  useMetricsHistory,
  useHealthSummary,
  useRealtimeMetrics,
  useSystemMonitoring,
  useCpuMetrics,
  useMemoryMetrics,
  useDatabaseMetrics,
  useRedisMetricsData,
  useWebSocketMetrics,
  useApiPerformanceMetrics,
  monitoringKeys,
} from './useMonitoring';

// HA Monitoring (Event-driven - no polling)
export {
  useHAStatus,
  useHAConfig,
  useHAEvents,
  useHAMonitoring,
  useGenerateFailoverCode,
  useKamailioFailover,
  usePostgresFailover,
  useTestConnectivity,
  useServerHealth,
  useServerAction,
  useServiceLogs,
  haKeys,
} from './useHA';

// Accessibility
export { useAnnounce, usePageAnnounce, useFormAnnounce } from './useAnnounce';

// Keyboard Shortcuts
export {
  useKeyboardShortcuts,
  useShortcutsModal,
  formatShortcut,
  COMMON_SHORTCUTS,
  CALL_SHORTCUTS,
} from './useKeyboardShortcuts';

// Infinite Scroll
export { useInfiniteScroll, useInfiniteQueryWithScroll, useLoadMore } from './useInfiniteScroll';

// Confirmation Dialog
export { useConfirm, ConfirmProvider, type ConfirmOptions } from './useConfirm';

// Alert Dialog
export { useAlert, AlertProvider, type AlertOptions } from './useAlert';

// User Settings (DND, Speed Dial)
export {
  useDndStatus,
  useToggleDnd,
  useSpeedDial,
  useSpeedDialByPosition,
  useSetSpeedDial,
  useRemoveSpeedDial,
  useClearSpeedDial,
  userSettingsKeys,
  type DndStatus,
  type SpeedDialEntry,
  type SetSpeedDialInput,
} from './useUserSettings';

// Customer pool (org-level customer assignment)
export {
  useCustomersList,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useAssignCustomer,
  useAssignmentHistory,
  useCustomerLockouts,
  useRemoveCustomerLockout,
  useMyCustomers,
  useStartChatWithCustomer,
  useBulkAssignCustomers,
  useBulkDeleteCustomers,
  useBulkImportCustomers,
  customersKeys,
} from './useCustomers';

// WhatsApp manager-oversight feature flags
export { useWaFeatureFlags } from './useWaFeatureFlags';

// WhatsApp typing indicators + live conversation watch
export { useWaTypingEmitter } from './useWaTypingEmitter';
export { useWaDraftEmitter } from './useWaDraftEmitter';
export { useWaTypingIndicators, type WaTypingState } from './useWaTypingIndicators';
export { useWaLiveWatch, type WaWatchState } from './useWaLiveWatch';

// WhatsApp manager oversight (cross-agent read-only views)
export { useWaOversightConversations, waOversightKeys } from './useWaOversightConversations';
export { useWaOversightMessages } from './useWaOversightMessages';
export { useWaOversightAgents } from './useWaOversightAgents';
