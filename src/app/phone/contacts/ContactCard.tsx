'use client';

import React, { memo, useCallback } from 'react';
import {
  FiPhone,
  FiMessageSquare,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiStar,
  FiFileText,
  FiShield,
  FiShieldOff,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import type { Contact } from '@/lib/api';

// ============================================================
// Avatar utilities
// ============================================================

export const AVATAR_COLORS = [
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#059669',
  '#0891b2',
  '#2563eb',
  '#6366f1',
];

export function getInitials(name: string): string {
  if (!name.trim()) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().substring(0, 2).toUpperCase();
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ============================================================
// ContactCard component
// ============================================================

export interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onCall: (contact: Contact) => void;
  onSms: (contact: Contact) => void;
  onToggleFavorite: (contact: Contact) => void;
  onBlockToggle: (contact: Contact) => void;
  isBlocked: boolean;
}

export const ContactCard = memo(function ContactCard({
  contact,
  onEdit,
  onDelete,
  onCall,
  onSms,
  onToggleFavorite,
  onBlockToggle,
  isBlocked,
}: ContactCardProps) {
  const handleEdit = useCallback(() => onEdit(contact), [onEdit, contact]);
  const handleDelete = useCallback(() => onDelete(contact), [onDelete, contact]);
  const handleCall = useCallback(() => onCall(contact), [onCall, contact]);
  const handleSms = useCallback(() => onSms(contact), [onSms, contact]);
  const handleToggleFavorite = useCallback(
    () => onToggleFavorite(contact),
    [onToggleFavorite, contact]
  );
  const handleBlockToggle = useCallback(() => onBlockToggle(contact), [onBlockToggle, contact]);

  const initials = getInitials(contact.name);
  const avatarColor = getAvatarColor(contact.name);

  return (
    <div className="p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary-300)] hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={initials ? { backgroundColor: avatarColor } : undefined}
            aria-hidden="true"
          >
            {initials ? (
              <span className="text-white font-semibold text-sm">{initials}</span>
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--primary-100)] dark:bg-[var(--primary-900)] flex items-center justify-center">
                <FiUser className="w-6 h-6 text-[var(--foreground)]" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-[var(--foreground)]">{contact.name}</h3>
              <button
                onClick={handleToggleFavorite}
                className="p-1 rounded-full hover:bg-[var(--muted)] transition-colors"
                aria-label={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <FiStar
                  className={`w-4 h-4 ${
                    contact.isFavorite
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'text-[var(--muted-foreground)]'
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
              {contact.type || 'personal'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-sm text-[var(--muted-foreground)] mb-4">
        <p>{contact.contact}</p>
        {contact.notes && (
          <div className="flex items-start gap-1 mt-2 p-2 rounded-lg bg-[var(--muted)]">
            <FiFileText className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs line-clamp-2">{contact.notes}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleCall}
          aria-label={`Call ${contact.name}`}
        >
          <FiPhone className="w-3 h-3" aria-hidden="true" />
          Call
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleSms}
          aria-label={`Send SMS to ${contact.name}`}
        >
          <FiMessageSquare className="w-3 h-3" aria-hidden="true" />
          SMS
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleEdit}
          aria-label={`Edit ${contact.name}`}
        >
          <FiEdit2 className="w-3 h-3" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDelete}
          aria-label={`Delete ${contact.name}`}
        >
          <FiTrash2 className="w-3 h-3 text-[var(--danger)]" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleBlockToggle}
          aria-label={isBlocked ? `Unblock ${contact.name}` : `Block ${contact.name}`}
          title={isBlocked ? 'Unblock' : 'Block number'}
        >
          {isBlocked ? (
            <FiShield className="w-3 h-3 text-red-500" aria-hidden="true" />
          ) : (
            <FiShieldOff className="w-3 h-3" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
});
