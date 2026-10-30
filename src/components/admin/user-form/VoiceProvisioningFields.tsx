'use client';

/**
 * VoiceProvisioningFields — lightweight Voice provisioning input cluster.
 *
 * Used by EditUserModal's "enable Voice on an existing user" flow
 * (extension + optional phone + auto-generated SIP password).
 *
 * Why this is NOT used by CreateUserModal:
 * CreateUserModal has a richer admin power-user setup — server
 * preference, custom-vs-autogen SIP password toggle, extension limits
 * (max concurrent / ring timeout), caller-ID preview, voicemail/
 * directory/status display. Forcing the two flows to share UI would
 * turn this component into an opt-in Christmas tree of properties.
 * The two callers serve different scopes and are intentionally
 * separate. If a third caller appears with a similar lightweight need,
 * this component is the one to reach for.
 *
 * The auto-generated SIP password is owned by the parent (not generated
 * here) so the same value displayed to the admin is the value sent to
 * the backend on submit.
 */

import React from 'react';
import { FiHash, FiPhone, FiRefreshCw } from 'react-icons/fi';
import { Input, Button } from '@/components/ui';

interface Props {
  /** Extension number value. Parent owns state. */
  extension: string;
  onExtensionChange: (value: string) => void;
  extensionError?: string;
  /** Hint shown under the extension field. Defaults to standard wording. */
  extensionHint?: string;

  /** Phone number value. Required when `requirePhone` is true. */
  phone: string;
  onPhoneChange: (value: string) => void;
  phoneError?: string;

  /** When false, the phone input is hidden — caller already has a number. */
  requirePhone: boolean;

  /** Auto-generated SIP password to display (read-only). */
  sipPassword: string;
  /** Called when admin clicks the refresh button to regenerate. */
  onRegenerateSipPassword: () => void;

  /** Optional heading shown above the fields. */
  heading?: string;
  /** Optional explainer text shown under the heading. */
  description?: string;
}

export function VoiceProvisioningFields({
  extension,
  onExtensionChange,
  extensionError,
  extensionHint = '3-6 digit SIP extension (must be unique)',
  phone,
  onPhoneChange,
  phoneError,
  requirePhone,
  sipPassword,
  onRegenerateSipPassword,
  heading,
  description,
}: Props) {
  return (
    <div className="space-y-3">
      {(heading || description) && (
        <div>
          {heading && <p className="text-sm font-medium text-[var(--foreground)]">{heading}</p>}
          {description && (
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{description}</p>
          )}
        </div>
      )}

      <Input
        label="Extension Number"
        placeholder="e.g. 1001"
        value={extension}
        onChange={(e) => onExtensionChange(e.target.value)}
        error={extensionError}
        leftIcon={<FiHash className="w-4 h-4" />}
        hint={extensionHint}
      />

      {requirePhone && (
        <Input
          label="Phone Number"
          placeholder="e.g. 12164281997"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          error={phoneError}
          leftIcon={<FiPhone className="w-4 h-4" />}
          hint="Caller ID and inbound number for this extension"
        />
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Auto-generated SIP Password
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] font-mono text-sm break-all">
            {sipPassword}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRegenerateSipPassword}
            title="Regenerate"
          >
            <FiRefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Saved securely with the user. Admin can change it later from the SIP Configuration
          section.
        </p>
      </div>
    </div>
  );
}
