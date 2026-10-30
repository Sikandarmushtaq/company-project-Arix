'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input, Button, Select, Toggle } from '@/components/ui';
import {
  useAdminUser,
  useUpdateUser,
  useToggleSms,
  useToggleAutoDialer,
  useUserExtensionSettings,
  useUserPhoneNumbers,
  useAddPhoneNumber,
  useRemovePhoneNumber,
  useSetDefaultPhoneNumber,
  useToggleAutoSms,
  useToggleAiDialer,
  useOrganizations,
  useAssignUserToOrganization,
  useRemoveUserFromOrganization,
} from '@/lib/hooks/useAdmin';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuthStore } from '@/lib/stores';
import { formatPhoneNumber } from '@/lib/utils/formatting';
import { generateSecurePassword } from '@/lib/utils/password';
import { normalizePhone } from '@/lib/utils/phone';
import { isPossibleNumber } from '@/lib/utils/phone-format';
import { useConfirm } from '@/lib/hooks/useConfirm';
import { VoiceProvisioningFields } from './user-form/VoiceProvisioningFields';
import {
  FiUser,
  FiMail,
  FiHash,
  FiPhone,
  FiCalendar,
  FiClock,
  FiLock,
  FiSettings,
  FiPlus,
  FiTrash2,
  FiStar,
  FiLoader,
} from 'react-icons/fi';
import type { AdminUser } from '@/lib/api/services/admin.service';
import { permissionsService } from '@/lib/api/services/permissions.service';

/**
 * Manager "page access" toggles shown in the modal when role = manager.
 * Keys must match the backend MANAGER_PAGE_ACCESS map. Turning one off writes
 * a real view.* permission override, hiding the page from that manager's nav.
 */
const PAGE_ACCESS_ITEMS: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'liveCalls', label: 'Live Calls' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'bans', label: 'Bans' },
  { key: 'recordings', label: 'Recordings' },
  { key: 'voicemailAudit', label: 'Voicemail Audit' },
];
const DEFAULT_PAGE_ACCESS: Record<string, boolean> = {
  dashboard: true,
  liveCalls: true,
  analytics: true,
  sessions: true,
  bans: true,
  recordings: true,
  voicemailAudit: true,
  // Capabilities (non-page abilities, same toggle mechanism)
  deleteRecordings: true,
  dialerAccess: true,
};

/**
 * Manager capability toggles (actions, not nav pages) — same save mechanism as
 * page access. Keys must match the backend MANAGER_CAPABILITIES map.
 */
const CAPABILITY_ITEMS: { key: string; label: string; onText: string; offText: string }[] = [
  {
    key: 'deleteRecordings',
    label: 'Delete Recordings',
    onText: 'Can delete recordings',
    offText: 'Cannot delete recordings',
  },
  {
    key: 'dialerAccess',
    label: 'Dialer Access',
    onText: 'Can access the dialer',
    offText: 'Blocked from the dialer',
  },
];

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | null;
  onSuccess?: () => void;
}

interface FormData {
  fullName: string;
  email: string;
  role: 'admin' | 'user' | 'manager' | 'owner' | 'super_admin';
  extension: string;
  sipPassword: string;
  isActive: boolean;
  limitMax: number;
  callTimeout: number;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  extension?: string;
  /** Per-field error for the Voice provisioning phone input. */
  phone?: string;
  general?: string;
}

export function EditUserModal({ isOpen, onClose, userId, onSuccess }: EditUserModalProps) {
  const { data: user, isLoading, error: fetchError, refetch } = useAdminUser(userId ?? 0);
  const { data: extensionSettingsResult, refetch: refetchExtension } = useUserExtensionSettings(
    userId ?? 0
  );
  const updateUser = useUpdateUser();
  const toggleSms = useToggleSms();
  const toggleAutoDialer = useToggleAutoDialer();
  const { data: phoneNumbers, refetch: refetchPhoneNumbers } = useUserPhoneNumbers(userId ?? 0);
  const addPhoneNumber = useAddPhoneNumber();
  const removePhoneNumber = useRemovePhoneNumber();
  const setDefaultPhoneNumber = useSetDefaultPhoneNumber();
  const toggleAutoSms = useToggleAutoSms();
  const toggleAiDialer = useToggleAiDialer();
  const { isAdmin, isManager, isSuperAdmin } = usePermissions();
  const currentUser = useAuthStore((state) => state.user);

  // Organization assignment — admin-only feature. Limit list to a generous
  // page size; small platforms (current scale) won't exceed this. Cache
  // freshness is guaranteed at the mutation site via refetchType:'all' (see
  // useCreateOrganization etc.) — no per-mount refetch needed here.
  // Org reassignment is a super-admin-only action (and the org-list API is
  // super-admin-only). Tenant admins/managers skip this fetch entirely.
  const { data: orgsResult } = useOrganizations({ page: 1, limit: 200 }, { enabled: isSuperAdmin });
  const assignUserToOrg = useAssignUserToOrganization();
  const removeUserFromOrg = useRemoveUserFromOrganization();
  const orgs = (orgsResult?.organizations ?? []).filter((o) => o.isActive);

  // Themed confirm dialog — replaces window.confirm() for destructive
  // actions like Voice deprovision so the warning matches the rest of the
  // admin UI instead of using the browser's native popup.
  const { confirm } = useConfirm();

  // Check if manager is editing their own account
  const isEditingOwnAccount = !isAdmin && currentUser?.id === userId;

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    role: 'user',
    extension: '',
    sipPassword: '',
    isActive: true,
    limitMax: 5,
    callTimeout: 30,
  });
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [autoDialerEnabled, setAutoDialerEnabled] = useState(false);
  // LiveKit call-engine pilot membership (Stage 1 per-user rollout). Loaded from
  // the allowlist when a super-admin opens the modal; `initial` tracks the loaded
  // value so we only PUT on an actual change.
  const [livekitPilotEnabled, setLivekitPilotEnabled] = useState(false);
  const [livekitPilotInitial, setLivekitPilotInitial] = useState(false);
  // Telnyx call-engine pilot membership — same per-user opt-in model as LiveKit.
  // Mutually exclusive with LiveKit in the UI (a user belongs to at most one
  // pilot). This build has no Telnyx WebRTC engine, but the pilot flag still
  // drives the SIP-transport sub-option below.
  const [telnyxPilotEnabled, setTelnyxPilotEnabled] = useState(false);
  const [telnyxPilotInitial, setTelnyxPilotInitial] = useState(false);
  // Telnyx transport for a pilot user: false = Programmable Voice (WebRTC,
  // default), true = SIP (Telnyx SIP). Only shown/sent while Telnyx is enabled.
  const [telnyxSip, setTelnyxSip] = useState(false);
  const [telnyxSipInitial, setTelnyxSipInitial] = useState(false);
  const [waEnabled, setWaEnabled] = useState(false);
  const [waPhoneMaskEnabled, setWaPhoneMaskEnabled] = useState(false);
  // Manager page-access toggles (Dashboard, Live Calls, Analytics, Sessions,
  // Bans, Recordings). Loaded from the backend when the modal opens; defaults
  // to all-on so a fetch failure never hides pages by accident.
  const [pageAccess, setPageAccess] = useState<Record<string, boolean>>(DEFAULT_PAGE_ACCESS);
  // Voice Calling capability — drives whether the SIP/FusionPBX section
  // is shown and required. Initialized from user.extension presence in
  // the populate effect below.
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  // Auto-generated SIP password for the "enable Voice on existing user
  // who didn't have it" flow. Generated once when the user toggles Voice
  // ON; admin can refresh.
  const [generatedSipPassword, setGeneratedSipPassword] = useState('');
  // Phone number input for enabling Voice on a user who had no
  // senderPhone (e.g. a WhatsApp-only user being upgraded to Voice).
  const [voicePhoneInput, setVoicePhoneInput] = useState('');
  // Organization picker state. `null` means "no organization" (which is a
  // valid choice — just blocks WA from being enabled).
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [smsType, setSmsType] = useState<'standard' | 'auto' | 'both' | null>(null);
  const [smsProvider, setSmsProvider] = useState<'twilio' | 'telnyx'>('twilio');
  const [bulkSmsInterval, setBulkSmsInterval] = useState(5);
  const [bulkSmsIntervalControl, setBulkSmsIntervalControl] = useState(false);
  // Per-user concurrent-login (device) limit. Stored as a string so the field
  // can be empty = "inherit the global default". '0' = unlimited; 'N' = cap.
  const [maxLogins, setMaxLogins] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [extensionSettingsLoaded, setExtensionSettingsLoaded] = useState(false);
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneLabel, setNewPhoneLabel] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Refetch fresh data when modal opens
  useEffect(() => {
    if (isOpen && userId && userId > 0) {
      refetch();
      refetchExtension();
      refetchPhoneNumbers();
      setExtensionSettingsLoaded(false);
      setShowAddPhone(false);
      setNewPhone('');
      setNewPhoneLabel('');
      setPhoneError('');
    }
  }, [isOpen, userId, refetch, refetchExtension, refetchPhoneNumbers]);

  // Populate form when user data loads/changes
  useEffect(() => {
    if (user && isOpen) {
      setFormData((prev) => ({
        ...prev,
        fullName: user.fullName || '',
        email: user.email || '',
        role: user.role,
        extension: user.extension || '',
        sipPassword: user.sipPassword || '',
        isActive: user.isActive,
      }));
      setSmsEnabled(user.smsEnabled);
      setAutoDialerEnabled(user.autoDialerEnabled);
      setWaEnabled(user.waEnabled ?? false);
      setWaPhoneMaskEnabled(user.waPhoneMaskEnabled ?? false);
      // Voice is "on" when the user has a SIP extension provisioned.
      setVoiceEnabled(!!user.extension);
      setVoicePhoneInput('');
      // Pre-generate a SIP password for the "enable Voice for an existing
      // user" flow. Cheap to generate; harmless if admin doesn't use it.
      setGeneratedSipPassword(generateSecurePassword(16));
      setOrganizationId(user.organizationId ?? null);
      setSmsType(user.smsType ?? null);
      setSmsProvider(user.smsProvider ?? 'twilio');
      setBulkSmsInterval(user.bulkSmsInterval ?? 5);
      setBulkSmsIntervalControl(user.bulkSmsIntervalControl ?? false);
      setMaxLogins(user.maxLoginSessions == null ? '' : String(user.maxLoginSessions));
      setErrors({});
    }
  }, [user, isOpen]);

  // Load the manager page-access toggles when the modal opens for a user.
  // Defaults stay all-on if the request fails, so a fetch error never hides
  // pages by accident.
  useEffect(() => {
    // Only existing managers have page-access overrides to load. For a
    // user being switched TO manager, the all-on defaults are correct, and
    // this avoids a needless 403 against the managers-only endpoint.
    if (!isOpen || !userId || user?.role !== 'manager') return;
    let cancelled = false;
    permissionsService
      .getPageAccess(userId)
      .then((res) => {
        if (!cancelled && res?.data?.pages) {
          setPageAccess({ ...DEFAULT_PAGE_ACCESS, ...res.data.pages });
        }
      })
      .catch(() => {
        /* keep defaults — never block editing on this */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId, user?.role]);

  // Load LiveKit pilot membership for this user (super-admin only — the pilot
  // allowlist is a platform-level control, same gate as the kill switch). Keeps
  // defaults off on any failure so it never blocks editing.
  useEffect(() => {
    if (!isOpen || !userId || !isSuperAdmin) return;
    let cancelled = false;
    // Reset first so a previous user's membership never bleeds into this one
    // (the modal reuses state across opens; a failed fetch would otherwise
    // leave the prior user's value showing).
    setLivekitPilotEnabled(false);
    setLivekitPilotInitial(false);
    setTelnyxPilotEnabled(false);
    setTelnyxPilotInitial(false);
    setTelnyxSip(false);
    setTelnyxSipInitial(false);
    (async () => {
      try {
        const { apiClient } = await import('@/lib/api/client');
        // Both pilots load in parallel; a failure on either keeps that one off
        // (never blocks editing).
        const [lkRes, txRes] = await Promise.all([
          apiClient
            .get<{ data?: { users?: Array<string | number> } }>('/livekit/pilot')
            .catch(() => null),
          apiClient
            .get<{
              data?: { users?: Array<string | number>; sipUsers?: Array<string | number> };
            }>('/telnyx/pilot')
            .catch(() => null),
        ]);
        if (cancelled) return;
        const inLk = (lkRes?.data?.users ?? []).map(String).includes(String(userId));
        setLivekitPilotEnabled(inLk);
        setLivekitPilotInitial(inLk);
        const inTx = (txRes?.data?.users ?? []).map(String).includes(String(userId));
        setTelnyxPilotEnabled(inTx);
        setTelnyxPilotInitial(inTx);
        // SIP transport only meaningful while on the Telnyx pilot.
        const isSip = inTx && (txRes?.data?.sipUsers ?? []).map(String).includes(String(userId));
        setTelnyxSip(isSip);
        setTelnyxSipInitial(isSip);
      } catch {
        /* keep defaults off — never block editing on this */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId, isSuperAdmin]);

  // Populate extension settings from FusionPBX (source of truth)
  useEffect(() => {
    if (
      extensionSettingsResult?.success &&
      extensionSettingsResult.data &&
      isOpen &&
      !extensionSettingsLoaded
    ) {
      setFormData((prev) => ({
        ...prev,
        limitMax: extensionSettingsResult.data?.limitMax ?? 5,
        callTimeout: extensionSettingsResult.data?.callTimeout ?? 30,
      }));
      setExtensionSettingsLoaded(true);
    }
  }, [extensionSettingsResult, isOpen, extensionSettingsLoaded]);

  const handleClose = useCallback(() => {
    setErrors({});
    onClose();
  }, [onClose]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Extension validation only when Voice capability is on. WhatsApp- /
    // SMS-only users can be edited without an extension.
    if (isAdmin && voiceEnabled) {
      if (!formData.extension.trim()) {
        newErrors.extension = 'Extension is required for Voice Calling';
      } else if (!/^\d{3,6}$/.test(formData.extension)) {
        newErrors.extension = 'Extension must be 3-6 digits';
      }

      // Enabling Voice on a user who didn't have a phone number yet —
      // require one so caller ID and inbound routing have a number to
      // bind to. If user already has a senderPhone, no input needed.
      // Errors are field-scoped (newErrors.phone) so the input itself
      // shows the validation message — no banner-level general errors.
      const isProvisioning = !user?.extension;
      if (isProvisioning && !user?.senderPhone) {
        if (!voicePhoneInput.trim()) {
          newErrors.phone = 'Phone number is required for Voice Calling';
        } else {
          const normalized = normalizePhone(voicePhoneInput);
          if (!isPossibleNumber('+' + normalized)) {
            newErrors.phone =
              'Enter a valid phone number with country code (e.g. 12164281997 or 443300013011)';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isAdmin, voiceEnabled, user, voicePhoneInput]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm() || !userId) return;

      // Voice capability transitions. Determined here (vs in validateForm)
      // because the destructive deprovision path needs an explicit confirm
      // BEFORE we call the mutation.
      const hadVoice = !!user?.extension;
      const isVoiceProvision = voiceEnabled && !hadVoice;
      const isVoiceDeprovision = !voiceEnabled && hadVoice;

      if (isVoiceDeprovision) {
        // Themed destructive-confirm — uses the platform's ConfirmModal so
        // the warning visually matches the rest of admin UI (the previous
        // window.confirm() looked like a browser popup, jarring in context).
        const confirmed = await confirm({
          title: 'Disable Voice Calling?',
          message:
            `This will delete SIP extension ${user?.extension} from FusionPBX, ` +
            `disconnect ${formData.fullName || 'this user'}'s softphone immediately, ` +
            `and remove their ability to make or receive calls. ` +
            `SMS and WhatsApp access are not affected. ` +
            `You can re-enable Voice later, but they'll need a new extension number.`,
          confirmText: 'Disable Voice',
          cancelText: 'Keep Voice Enabled',
          variant: 'danger',
        });
        if (!confirmed) return;
      }

      try {
        // Build update data based on user role
        const updateData: Record<string, unknown> = {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          isActive: formData.isActive,
        };

        // Only admins can update these fields
        if (isAdmin) {
          // Only send role when it actually changed — avoids re-sending a
          // privileged role like 'owner'/'super_admin' (and prevents an
          // accidental demotion if the dropdown didn't surface it).
          if (formData.role !== user?.role) {
            updateData.role = formData.role;
          }

          // Voice capability — three transitions:
          //  1. provision (was off, now on): send extension + sipPassword
          //     + senderPhone. Backend creates the FusionPBX extension.
          //  2. deprovision (was on, now off): send extension=null,
          //     sipPassword=null. Backend deletes the FusionPBX extension.
          //  3. no transition (still on or still off): existing behaviour.
          if (isVoiceProvision) {
            updateData.extension = formData.extension.trim();
            updateData.sipPassword = generatedSipPassword;
            updateData.limitMax = formData.limitMax;
            updateData.callTimeout = formData.callTimeout;
            // Phone number — only set when admin provided one because the
            // user didn't have a senderPhone yet (e.g. WhatsApp-only user
            // being upgraded). If user already had one, we don't touch it.
            if (!user?.senderPhone && voicePhoneInput.trim()) {
              updateData.senderPhone = normalizePhone(voicePhoneInput.trim());
            }
          } else if (isVoiceDeprovision) {
            updateData.extension = null;
            updateData.sipPassword = null;
          } else if (voiceEnabled) {
            // Voice still on — existing in-place edit path.
            updateData.extension = formData.extension.trim();
            updateData.limitMax = formData.limitMax;
            updateData.callTimeout = formData.callTimeout;
            // Only include sipPassword if admin entered a new one.
            if (formData.sipPassword.trim()) {
              updateData.sipPassword = formData.sipPassword.trim();
            }
          }

          // SMS type (only if changed)
          const currentSmsType = user?.smsType ?? null;
          if (smsType !== currentSmsType) {
            updateData.smsType = smsType;
          }

          // SMS send gateway (Twilio | Telnyx) — only if changed
          const currentSmsProvider = user?.smsProvider ?? 'twilio';
          if (smsProvider !== currentSmsProvider) {
            updateData.smsProvider = smsProvider;
          }

          // Bulk SMS settings (only when Auto SMS is assigned)
          const hasAutoSms = smsType === 'auto' || smsType === 'both';
          if (hasAutoSms) {
            updateData.bulkSmsInterval = bulkSmsInterval;
            updateData.bulkSmsIntervalControl = bulkSmsIntervalControl;
          }
        }

        await updateUser.mutateAsync({
          id: userId,
          data: updateData,
        });

        // Only admins can update SMS and Auto-Dialer toggles
        if (isAdmin) {
          // Update SMS toggle if changed
          if (user && smsEnabled !== user.smsEnabled) {
            await toggleSms.mutateAsync({ id: userId, enabled: smsEnabled });
          }

          // Update Auto-Dialer toggle if changed
          if (user && autoDialerEnabled !== user.autoDialerEnabled) {
            await toggleAutoDialer.mutateAsync({ id: userId, enabled: autoDialerEnabled });
          }

          // Update organization assignment BEFORE the WhatsApp toggle, so
          // that "assign org + enable WA in one submit" works in the
          // correct order — the backend rejects wa_enabled=true for users
          // with no organization.
          if (user && organizationId !== (user.organizationId ?? null)) {
            if (organizationId == null) {
              await removeUserFromOrg.mutateAsync(userId);
            } else {
              await assignUserToOrg.mutateAsync({ userId, organizationId });
            }
          }

          // Update WhatsApp toggle if changed
          if (user && waEnabled !== (user.waEnabled ?? false)) {
            const { apiClient } = await import('@/lib/api/client');
            await apiClient.put(`/whatsapp/admin/users/${userId}/wa-enabled`, {
              enabled: waEnabled,
            });
          }

          // Per-user concurrent-login (device) limit — only when changed.
          // '' = inherit global default (null); '0' = unlimited; 'N' = cap.
          const desiredMaxLogins = maxLogins.trim() === '' ? null : parseInt(maxLogins, 10);
          const currentMaxLogins = user?.maxLoginSessions ?? null;
          if (
            user &&
            (desiredMaxLogins === null || Number.isFinite(desiredMaxLogins)) &&
            desiredMaxLogins !== currentMaxLogins
          ) {
            const { apiClient } = await import('@/lib/api/client');
            await apiClient.put(`/admin/users/${userId}/login-limit`, {
              limit: desiredMaxLogins,
            });
          }

          // LiveKit call-engine pilot — super-admin only, and only when changed.
          // Adds/removes this user from the allowlist (Stage 1 per-user rollout).
          if (isSuperAdmin && livekitPilotEnabled !== livekitPilotInitial) {
            const { apiClient } = await import('@/lib/api/client');
            await apiClient.put('/livekit/pilot', {
              userId,
              enabled: livekitPilotEnabled,
            });
          }

          // Telnyx call-engine pilot — super-admin only, and only when changed.
          // Mutually exclusive with LiveKit in the UI, but each is PUT
          // independently so switching a user from one engine to the other
          // persists both the add and the remove.
          if (
            isSuperAdmin &&
            (telnyxPilotEnabled !== telnyxPilotInitial || telnyxSip !== telnyxSipInitial)
          ) {
            const { apiClient } = await import('@/lib/api/client');
            await apiClient.put('/telnyx/pilot', {
              userId,
              enabled: telnyxPilotEnabled,
              mode: telnyxSip ? 'sip' : 'programmable',
            });
          }

          // Persist the manager page-access toggles. Only meaningful for a
          // manager; the section is hidden for other roles. Org-scoped +
          // page-set-limited on the backend.
          if (formData.role === 'manager') {
            await permissionsService.setPageAccess(userId, pageAccess);
          }
        }

        // Privacy Mode update — runs for both admin AND manager. Sits OUTSIDE
        // the admin-only block because managers also need to flip this for
        // their org's agents (per product requirement). Dispatched by role:
        //   admin → /whatsapp/admin/users/:id/wa-phone-mask (requireAdmin)
        //   manager → /whatsapp/org/users/:id/wa-phone-mask (org-scoped)
        // Backend enforces target must be role=user.
        if (
          (isAdmin || isManager) &&
          user?.role === 'user' &&
          waPhoneMaskEnabled !== (user.waPhoneMaskEnabled ?? false)
        ) {
          const { apiClient } = await import('@/lib/api/client');
          const path = isAdmin
            ? `/whatsapp/admin/users/${userId}/wa-phone-mask`
            : `/whatsapp/org/users/${userId}/wa-phone-mask`;
          await apiClient.put(path, { enabled: waPhoneMaskEnabled });
        }

        handleClose();
        onSuccess?.();
      } catch (error) {
        setErrors({
          general: error instanceof Error ? error.message : 'Failed to update user',
        });
      }
    },
    [
      formData,
      userId,
      user,
      smsEnabled,
      autoDialerEnabled,
      waEnabled,
      waPhoneMaskEnabled,
      voiceEnabled,
      generatedSipPassword,
      voicePhoneInput,
      smsType,
      smsProvider,
      bulkSmsInterval,
      bulkSmsIntervalControl,
      maxLogins,
      organizationId,
      pageAccess,
      isAdmin,
      isManager,
      isSuperAdmin,
      livekitPilotEnabled,
      livekitPilotInitial,
      telnyxPilotEnabled,
      telnyxPilotInitial,
      telnyxSip,
      telnyxSipInitial,
      validateForm,
      updateUser,
      toggleSms,
      toggleAutoDialer,
      assignUserToOrg,
      removeUserFromOrg,
      confirm,
      handleClose,
      onSuccess,
    ]
  );

  const handleAddPhone = useCallback(async () => {
    if (!userId) return;
    const phone = newPhone.trim();
    if (!phone) {
      setPhoneError('Phone number is required');
      return;
    }
    if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s()-]/g, ''))) {
      setPhoneError('Invalid phone number format');
      return;
    }
    // Check for duplicates locally
    const cleanedPhone = phone.replace(/[\s()+\-]/g, '');
    if (
      phoneNumbers?.some(
        (pn) =>
          pn.phoneNumber.replace(/\D/g, '').endsWith(cleanedPhone) ||
          cleanedPhone.endsWith(pn.phoneNumber.replace(/\D/g, ''))
      )
    ) {
      setPhoneError('This phone number is already assigned');
      return;
    }
    setPhoneError('');
    try {
      await addPhoneNumber.mutateAsync({
        userId,
        phoneNumber: phone,
        label: newPhoneLabel.trim() || undefined,
      });
      setNewPhone('');
      setNewPhoneLabel('');
      setShowAddPhone(false);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : 'Failed to add phone number');
    }
  }, [userId, newPhone, newPhoneLabel, addPhoneNumber]);

  const handleRemovePhone = useCallback(
    async (numberId: number, phoneDisplay: string) => {
      if (!userId) return;
      if (
        !window.confirm(`Remove ${phoneDisplay}? This will also delete the inbound DID dialplan.`)
      )
        return;
      try {
        await removePhoneNumber.mutateAsync({ numberId, userId });
      } catch (err) {
        setErrors({
          general: err instanceof Error ? err.message : 'Failed to remove phone number',
        });
      }
    },
    [userId, removePhoneNumber]
  );

  const handleSetDefaultPhone = useCallback(
    async (numberId: number) => {
      if (!userId) return;
      try {
        await setDefaultPhoneNumber.mutateAsync({ userId, numberId });
      } catch (err) {
        setErrors({
          general: err instanceof Error ? err.message : 'Failed to set default phone number',
        });
      }
    },
    [userId, setDefaultPhoneNumber]
  );

  const handleInputChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
    },
    []
  );

  const isPending =
    updateUser.isPending ||
    toggleSms.isPending ||
    toggleAutoDialer.isPending ||
    addPhoneNumber.isPending ||
    removePhoneNumber.isPending ||
    setDefaultPhoneNumber.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={user ? `Edit User: ${user.fullName}` : 'Edit User'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" onClick={handleSubmit} loading={isPending}>
            Save Changes
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[var(--border)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : fetchError ? (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          Failed to load user data. Please try again.
        </div>
      ) : user ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.general && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          {/* User Info (Read-only) */}
          <div className="p-4 rounded-lg bg-[var(--muted)]/50">
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">User Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">User ID:</span>
                <span className="ml-2 text-[var(--foreground)]">#{user.id}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Status:</span>
                <span
                  className={`ml-2 ${user.banned ? 'text-red-500' : user.isActive ? 'text-green-500' : 'text-yellow-500'}`}
                >
                  {user.banned ? 'Banned' : user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {user.createdAt && (
                <div className="flex items-center gap-1">
                  <FiCalendar className="w-3 h-3 text-[var(--muted-foreground)]" />
                  <span className="text-[var(--muted-foreground)]">Created:</span>
                  <span className="text-[var(--foreground)]">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {user.lastLogin && (
                <div className="flex items-center gap-1">
                  <FiClock className="w-3 h-3 text-[var(--muted-foreground)]" />
                  <span className="text-[var(--muted-foreground)]">Last Login:</span>
                  <span className="text-[var(--foreground)]">
                    {new Date(user.lastLogin).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Basic Information</h3>
            <div className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Enter full name"
                value={formData.fullName}
                onChange={handleInputChange('fullName')}
                error={errors.fullName}
                leftIcon={<FiUser className="w-4 h-4" />}
              />
              <Input
                label="Email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={handleInputChange('email')}
                error={errors.email}
                leftIcon={<FiMail className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Phone Numbers - Admin only */}
          {isAdmin && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--foreground)]">Phone Numbers</h3>
                <button
                  type="button"
                  onClick={() => setShowAddPhone(!showAddPhone)}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  Add Number
                </button>
              </div>

              {/* Add Phone Form */}
              {showAddPhone && (
                <div className="mb-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Phone number (e.g. +12025551234)"
                      value={newPhone}
                      onChange={(e) => {
                        setNewPhone(e.target.value);
                        setPhoneError('');
                      }}
                      leftIcon={<FiPhone className="w-4 h-4" />}
                      error={phoneError}
                    />
                    <Input
                      placeholder="Label (optional)"
                      value={newPhoneLabel}
                      onChange={(e) => setNewPhoneLabel(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowAddPhone(false);
                        setNewPhone('');
                        setNewPhoneLabel('');
                        setPhoneError('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleAddPhone}
                      loading={addPhoneNumber.isPending}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Phone Numbers List */}
              <div className="space-y-1.5">
                {phoneNumbers && phoneNumbers.length > 0 ? (
                  phoneNumbers.map((pn) => (
                    <div
                      key={pn.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                        pn.isPrimary
                          ? 'border-[var(--primary-200)] dark:border-[var(--primary-800)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20'
                          : 'border-[var(--border)] bg-[var(--background)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FiPhone
                          className={`w-3.5 h-3.5 flex-shrink-0 ${pn.isPrimary ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}
                        />
                        <div className="min-w-0">
                          <span
                            className={`text-sm font-medium ${pn.isPrimary ? 'text-[var(--foreground)]' : 'text-[var(--foreground)]'}`}
                          >
                            {formatPhoneNumber(pn.phoneNumber)}
                          </span>
                          {pn.label && (
                            <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                              {pn.label}
                            </span>
                          )}
                        </div>
                        {pn.isPrimary && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-800)] text-[var(--foreground)] dark:text-[var(--primary-300)]">
                            <FiStar className="w-2.5 h-2.5" />
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() =>
                            toggleAutoSms.mutate({
                              userId: userId!,
                              numberId: pn.id,
                              enabled: !pn.autoSmsEnabled,
                            })
                          }
                          disabled={
                            toggleAutoSms.isPending && toggleAutoSms.variables?.numberId === pn.id
                          }
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                            pn.autoSmsEnabled
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          title={pn.autoSmsEnabled ? 'Disable Auto SMS' : 'Enable Auto SMS'}
                        >
                          {toggleAutoSms.isPending &&
                          toggleAutoSms.variables?.numberId === pn.id ? (
                            <FiLoader className="w-3 h-3 animate-spin inline" />
                          ) : (
                            `Auto SMS ${pn.autoSmsEnabled ? 'ON' : 'OFF'}`
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!pn.aiDialerEnabled && !pn.elevenlabsPhoneId) {
                              const elId = prompt(
                                'Enter the ElevenLabs Phone ID (e.g., phnum_xxx).\nGet this from ElevenLabs → Phone Numbers after importing the number.'
                              );
                              if (!elId) return;
                              toggleAiDialer.mutate({
                                userId: userId!,
                                numberId: pn.id,
                                enabled: true,
                                elevenlabsPhoneId: elId.trim(),
                              });
                            } else {
                              toggleAiDialer.mutate({
                                userId: userId!,
                                numberId: pn.id,
                                enabled: !pn.aiDialerEnabled,
                              });
                            }
                          }}
                          disabled={
                            toggleAiDialer.isPending && toggleAiDialer.variables?.numberId === pn.id
                          }
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                            pn.aiDialerEnabled
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          title={
                            pn.aiDialerEnabled
                              ? `Disable AI Dialer (${pn.elevenlabsPhoneId || 'no ID'})`
                              : 'Enable AI Dialer'
                          }
                        >
                          {toggleAiDialer.isPending &&
                          toggleAiDialer.variables?.numberId === pn.id ? (
                            <FiLoader className="w-3 h-3 animate-spin inline" />
                          ) : (
                            `AI Dialer ${pn.aiDialerEnabled ? 'ON' : 'OFF'}`
                          )}
                        </button>
                        {!pn.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultPhone(pn.id)}
                            disabled={setDefaultPhoneNumber.isPending}
                            className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                            title="Set as primary"
                          >
                            {setDefaultPhoneNumber.isPending ? (
                              <FiLoader className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FiStar className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {phoneNumbers.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleRemovePhone(pn.id, formatPhoneNumber(pn.phoneNumber))
                            }
                            disabled={removePhoneNumber.isPending}
                            className="p-1 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                            title="Remove number"
                          >
                            {removePhoneNumber.isPending ? (
                              <FiLoader className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FiTrash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[var(--muted-foreground)] italic py-2">
                    No phone numbers assigned. Current sender phone:{' '}
                    {user?.senderPhone ? formatPhoneNumber(user.senderPhone) : 'None'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Role & Status */}
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Role & Status</h3>
            <div className="grid grid-cols-2 gap-4">
              {isAdmin ? (
                <>
                  <Select
                    label="Role"
                    value={formData.role}
                    onChange={handleInputChange('role')}
                    options={[
                      { value: 'user', label: 'User' },
                      { value: 'manager', label: 'Manager' },
                      ...(isSuperAdmin ? [{ value: 'admin', label: 'Administrator' }] : []),
                      // Surface the user's current privileged role so an owner /
                      // super-admin shows correctly (and isn't silently shown as
                      // "User"). Editing away from it is a deliberate choice.
                      ...(formData.role === 'owner'
                        ? [{ value: 'owner', label: 'Owner' }]
                        : formData.role === 'super_admin'
                          ? [{ value: 'super_admin', label: 'Super Admin' }]
                          : []),
                    ]}
                  />
                  {isSuperAdmin && (
                    <Select
                      label="Organization"
                      value={organizationId == null ? '' : String(organizationId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = v === '' ? null : Number(v);
                        setOrganizationId(next);
                        // Removing the org also turns WA off — the backend
                        // would reject wa_enabled=1 with no org anyway, and
                        // this keeps the UI honest.
                        if (next == null) setWaEnabled(false);
                      }}
                      options={[
                        { value: '', label: '— No organization —' },
                        ...orgs.map((o) => ({ value: String(o.id), label: o.name })),
                      ]}
                      hint={organizationId == null ? 'Required to enable WhatsApp.' : undefined}
                    />
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Role
                  </label>
                  <div className="flex items-center h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        formData.role === 'admin'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                          : formData.role === 'manager'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
                      }`}
                    >
                      {formData.role === 'admin'
                        ? 'Administrator'
                        : formData.role === 'manager'
                          ? 'Manager'
                          : 'User'}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-end">
                <Toggle
                  checked={formData.isActive}
                  onChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
                  label="Account Active"
                  description={
                    isEditingOwnAccount
                      ? 'You cannot disable your own account'
                      : 'Enable user login'
                  }
                  disabled={isEditingOwnAccount}
                />
              </div>
            </div>
          </div>

          {/* Permissions - Admin only */}
          {isAdmin && (
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Permissions</h3>
              <div className="grid grid-cols-2 gap-4">
                <Toggle
                  checked={voiceEnabled}
                  onChange={setVoiceEnabled}
                  label="Voice Calling"
                  description={
                    voiceEnabled
                      ? user?.extension
                        ? 'SIP softphone enabled'
                        : 'Will provision a new SIP extension'
                      : user?.extension
                        ? 'Click save to disable Voice (destructive)'
                        : 'No SIP extension'
                  }
                />
                <Toggle
                  checked={smsEnabled}
                  onChange={setSmsEnabled}
                  label="SMS Enabled"
                  description="Allow sending SMS messages"
                />
                <Toggle
                  checked={autoDialerEnabled}
                  onChange={setAutoDialerEnabled}
                  label="Auto-Dialer"
                  description="Allow using auto-dialer"
                />
                <Toggle
                  checked={waEnabled}
                  onChange={setWaEnabled}
                  label="WhatsApp"
                  description={
                    organizationId == null
                      ? 'Assign an organization first'
                      : 'Allow WhatsApp messaging'
                  }
                  disabled={organizationId == null}
                />
              </div>

              {/*
                Per-user concurrent-login (device) limit. Empty = inherit the
                global default (Settings → Security). 0 = unlimited. N = at most
                N devices; a new login past the cap evicts the oldest device.
              */}
              <div className="mt-4 max-w-xs">
                <Input
                  label="Max concurrent logins (devices)"
                  type="number"
                  min={0}
                  placeholder="Inherit global default"
                  value={maxLogins}
                  onChange={(e) => setMaxLogins(e.target.value)}
                />
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Blank = use the global default. 0 = unlimited. A new login past
                  the limit signs out the user&apos;s oldest device.
                </p>
              </div>

              {/*
                Call Engine (Pilot) — super-admin only. Adds/removes this user
                from the LiveKit overlay allowlist. Only meaningful for Voice
                users (it's a calling engine). The engine falls back to SIP.js
                automatically, so this is safe to flip per user.
              */}
              {isSuperAdmin && voiceEnabled && (
                <div className="mt-4 p-3 rounded-lg border border-[var(--primary-300)] dark:border-[var(--primary-700)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 space-y-3">
                  <Toggle
                    checked={livekitPilotEnabled}
                    onChange={(v) => {
                      setLivekitPilotEnabled(v);
                      // At most one pilot per user — enabling LiveKit clears Telnyx.
                      if (v) {
                        setTelnyxPilotEnabled(false);
                        setTelnyxSip(false);
                      }
                    }}
                    label="LiveKit Call Engine (Pilot)"
                    description={
                      livekitPilotEnabled
                        ? 'On the new resilient LiveKit engine (auto-falls back to SIP.js)'
                        : 'On the standard SIP.js engine'
                    }
                  />
                  <Toggle
                    checked={telnyxPilotEnabled}
                    onChange={(v) => {
                      setTelnyxPilotEnabled(v);
                      // At most one pilot per user — enabling Telnyx clears LiveKit.
                      if (v) setLivekitPilotEnabled(false);
                      // Reset transport to the default when Telnyx is turned off.
                      else setTelnyxSip(false);
                    }}
                    label="Telnyx Call Engine (Pilot)"
                    description={
                      telnyxPilotEnabled
                        ? 'On the Telnyx global media-edge engine (auto-falls back to SIP.js)'
                        : 'On the standard SIP.js engine'
                    }
                  />

                  {/*
                    Telnyx transport sub-option — visible only while the Telnyx
                    pilot is on. Programmable Voice = the current WebRTC engine;
                    SIP = Telnyx SIP (routing wired separately).
                  */}
                  {telnyxPilotEnabled && (
                    <div className="ml-1 pl-3 border-l-2 border-[var(--primary-300)] dark:border-[var(--primary-700)] space-y-1.5">
                      <label className="block text-xs font-semibold text-[var(--muted-foreground)]">
                        Telnyx transport
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="telnyx-transport"
                            checked={!telnyxSip}
                            onChange={() => setTelnyxSip(false)}
                            className="border-gray-300"
                          />
                          Programmable Voice
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="telnyx-transport"
                            checked={telnyxSip}
                            onChange={() => setTelnyxSip(true)}
                            className="border-gray-300"
                          />
                          SIP (Telnyx SIP)
                        </label>
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Programmable Voice = current Telnyx WebRTC engine. SIP = Telnyx SIP.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/*
                Provisioning sub-form: shown only when admin is enabling
                Voice on a user who didn't have it. Asks for the new
                extension number; SIP password is auto-generated and
                shown read-only (admin can refresh). Phone number input
                appears only when the user has no senderPhone yet.
              */}
              {voiceEnabled && !user?.extension && (
                <div className="mt-3 p-4 rounded-lg border border-[var(--primary-300)] dark:border-[var(--primary-700)] bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20">
                  <VoiceProvisioningFields
                    heading="Enabling Voice Calling — provision a new SIP extension"
                    extension={formData.extension}
                    onExtensionChange={(v) => setFormData((prev) => ({ ...prev, extension: v }))}
                    extensionError={errors.extension}
                    phone={voicePhoneInput}
                    onPhoneChange={setVoicePhoneInput}
                    phoneError={errors.phone}
                    requirePhone={!user?.senderPhone}
                    sipPassword={generatedSipPassword}
                    onRegenerateSipPassword={() =>
                      setGeneratedSipPassword(generateSecurePassword(16))
                    }
                  />
                </div>
              )}
              {smsEnabled && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">
                    SMS Provider
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsType === 'standard' || smsType === 'both'}
                        onChange={(e) => {
                          const hasAuto = smsType === 'auto' || smsType === 'both';
                          if (e.target.checked) {
                            setSmsType(hasAuto ? 'both' : 'standard');
                          } else {
                            setSmsType(hasAuto ? 'auto' : null);
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      Standard SMS
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsType === 'auto' || smsType === 'both'}
                        onChange={(e) => {
                          const hasStandard = smsType === 'standard' || smsType === 'both';
                          if (e.target.checked) {
                            setSmsType(hasStandard ? 'both' : 'auto');
                          } else {
                            setSmsType(hasStandard ? 'standard' : null);
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      Auto SMS
                    </label>
                  </div>
                </div>
              )}
              {smsEnabled && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-2">
                    SMS Gateway
                  </label>
                  <div className="flex w-fit overflow-hidden rounded-lg border border-[var(--border)]">
                    {(['twilio', 'telnyx'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSmsProvider(p)}
                        className={`px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                          smsProvider === p
                            ? 'bg-[var(--primary-600)] text-white'
                            : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted-foreground)]">
                    Which gateway sends this user&apos;s SMS. Twilio is the default; Telnyx routes
                    through the Arix messaging profile.
                  </p>
                </div>
              )}
              {smsEnabled && (smsType === 'auto' || smsType === 'both') && (
                <div className="mt-3 p-3 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                  <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                    Bulk SMS Settings
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                        Send Interval
                      </label>
                      <div className="flex rounded-lg border border-[var(--border)] overflow-hidden w-fit">
                        {[3, 5, 10, 15].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setBulkSmsInterval(val)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                              bulkSmsInterval === val
                                ? 'bg-[var(--primary-600)] text-white'
                                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                            }`}
                          >
                            {val}s
                          </button>
                        ))}
                      </div>
                    </div>
                    <Toggle
                      checked={bulkSmsIntervalControl}
                      onChange={setBulkSmsIntervalControl}
                      label="User Can Change Interval"
                      description="Allow user to adjust their own send speed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/*
            Page Access — admin/super_admin controls which pages this MANAGER
            can see. Each toggle writes a real view.* permission override (not a
            CSS hide), so turning one off removes the page from the manager's
            nav and blocks the route. Shown only when the role is manager.
          */}
          {isAdmin && formData.role === 'manager' && (
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">Page Access</h3>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Choose which pages this manager can see.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {PAGE_ACCESS_ITEMS.map((item) => (
                  <Toggle
                    key={item.key}
                    checked={pageAccess[item.key] ?? true}
                    onChange={(v) => setPageAccess((prev) => ({ ...prev, [item.key]: v }))}
                    label={item.label}
                    description={
                      (pageAccess[item.key] ?? true) ? 'Visible to this manager' : 'Hidden'
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Manager capabilities — action toggles (e.g. delete recordings),
              same per-user override mechanism + save as Page Access. Shown only
              for managers. */}
          {isAdmin && formData.role === 'manager' && (
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">Capabilities</h3>
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Control what this manager can access and do.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {CAPABILITY_ITEMS.map((item) => (
                  <Toggle
                    key={item.key}
                    checked={pageAccess[item.key] ?? true}
                    onChange={(v) => setPageAccess((prev) => ({ ...prev, [item.key]: v }))}
                    label={item.label}
                    description={(pageAccess[item.key] ?? true) ? item.onText : item.offText}
                  />
                ))}
              </div>
            </div>
          )}

          {/*
            Privacy section — separate from the admin-only Permissions block
            because managers also need to flip this for their org's agents.
            Backend gates the PUT to `requireOwnerOrManager`. The toggle is
            only meaningful for role=user; owner/manager/admin always see
            numbers because they need them to triage and assign.
          */}
          {(isAdmin || isManager) && formData.role === 'user' && (
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Privacy</h3>
              <Toggle
                checked={waPhoneMaskEnabled}
                onChange={setWaPhoneMaskEnabled}
                label="Privacy Mode"
                description="Hide customer phone numbers in WhatsApp + Contacts (display-only)"
              />
            </div>
          )}

          {/*
            SIP Configuration — Admin only, and only meaningful when the
            user has Voice Calling enabled. Hidden for WhatsApp-only /
            SMS-only users to avoid showing empty extension fields.
            The provisioning sub-form above the FusionPBX section handles
            the "enable Voice for the first time" case.
          */}
          {isAdmin && voiceEnabled && user?.extension && (
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                SIP Configuration
              </h3>
              <div className="space-y-4">
                <Input
                  label="Extension"
                  placeholder="e.g. 1001"
                  value={formData.extension}
                  onChange={handleInputChange('extension')}
                  error={errors.extension}
                  leftIcon={<FiHash className="w-4 h-4" />}
                  hint="3-6 digit SIP extension"
                />
                <Input
                  label="SIP Password"
                  type="text"
                  placeholder="Enter SIP password"
                  value={formData.sipPassword}
                  onChange={handleInputChange('sipPassword')}
                  leftIcon={<FiLock className="w-4 h-4" />}
                  hint="Password for SIP authentication (visible for admin verification)"
                />
              </div>
            </div>
          )}

          {/* FusionPBX Extension Settings — only when Voice is on AND user has an extension */}
          {isAdmin && voiceEnabled && user?.extension && (
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
                <FiSettings className="w-4 h-4" />
                FusionPBX Extension Settings
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                Settings fetched from FusionPBX (source of truth). Changes will be synced back.
              </p>
              <div className="space-y-4">
                {/* Extension Limits */}
                <div className="p-4 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                  <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                    Extension Limits
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Max Concurrent Calls"
                      type="number"
                      min={1}
                      max={20}
                      value={formData.limitMax.toString()}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          limitMax: parseInt(e.target.value) || 5,
                        }))
                      }
                      leftIcon={<FiPhone className="w-4 h-4" />}
                      hint="Maximum simultaneous calls (1-20)"
                    />
                    <Input
                      label="Ring Timeout (seconds)"
                      type="number"
                      min={10}
                      max={120}
                      value={formData.callTimeout.toString()}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          callTimeout: parseInt(e.target.value) || 30,
                        }))
                      }
                      leftIcon={<FiClock className="w-4 h-4" />}
                      hint="Time before unanswered call times out"
                    />
                  </div>
                </div>

                {/* Caller ID Info (Read-only from FusionPBX) */}
                {extensionSettingsResult?.success && extensionSettingsResult.data && (
                  <div className="p-4 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)]">
                    <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                      Caller ID (from FusionPBX)
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[var(--muted-foreground)]">Caller ID Name:</span>
                        <span className="ml-2 text-[var(--foreground)]">
                          {extensionSettingsResult.data.effectiveCallerIdName || 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--muted-foreground)]">Caller ID Number:</span>
                        <span className="ml-2 text-[var(--foreground)]">
                          {extensionSettingsResult.data.effectiveCallerIdNumber || 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--muted-foreground)]">Outbound Name:</span>
                        <span className="ml-2 text-[var(--foreground)]">
                          {extensionSettingsResult.data.outboundCallerIdName || 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--muted-foreground)]">Outbound Number:</span>
                        <span className="ml-2 text-[var(--foreground)]">
                          {extensionSettingsResult.data.outboundCallerIdNumber || 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status indicator if FusionPBX settings couldn't be loaded */}
                {extensionSettingsResult && !extensionSettingsResult.success && (
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 text-sm">
                    FusionPBX settings unavailable:{' '}
                    {extensionSettingsResult.error?.message || 'Unknown error'}
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      ) : null}
    </Modal>
  );
}
