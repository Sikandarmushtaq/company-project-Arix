'use client';

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { normalizePhone } from '@/lib/utils/phone';
import type { Contact } from '@/lib/api';
import { ContactCard } from './ContactCard';

export interface ContactSectionProps {
  title: string;
  icon?: React.ReactNode;
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onCall: (contact: Contact) => void;
  onSms: (contact: Contact) => void;
  onToggleFavorite: (contact: Contact) => void;
  onBlockToggle: (contact: Contact) => void;
  blockedNumberSet: Set<string>;
}

export const ContactSection = memo(function ContactSection({
  title,
  icon,
  contacts,
  onEdit,
  onDelete,
  onCall,
  onSms,
  onToggleFavorite,
  onBlockToggle,
  blockedNumberSet,
}: ContactSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title} ({contacts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={onEdit}
              onDelete={onDelete}
              onCall={onCall}
              onSms={onSms}
              onToggleFavorite={onToggleFavorite}
              onBlockToggle={onBlockToggle}
              isBlocked={blockedNumberSet.has(normalizePhone(contact.contact))}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
