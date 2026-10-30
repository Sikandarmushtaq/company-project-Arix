'use client';

/**
 * Contacts Page — RingCentral-style list + detail layout (re-skin).
 * All data/mutations reuse the existing hooks; only the UI changed.
 *
 * @module app/phone/contacts/page
 */

import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiSearch,
  FiPlus,
  FiPhone,
  FiMessageSquare,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiRefreshCw,
  FiX,
  FiAlertTriangle,
  FiStar,
  FiShield,
  FiShieldOff,
  FiCopy,
  FiArrowLeft,
} from 'react-icons/fi';
import { Button, Pagination, ConfirmModal } from '@/components/ui';
import { normalizePhone, isOwnNumber, formatPhoneNumber } from '@/lib/utils/phone';
import { ContactForm } from '@/components/forms';
import {
  useContactsPaginated,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  usePagination,
  useToggleFavorite,
  useFavoriteContacts,
  useBlockedNumberLookup,
  useBlockContact,
  useUnblockContact,
} from '@/lib/hooks';
import { toast } from '@/lib/stores/toast';
import { useAuthStore } from '@/lib/stores/auth';
import { useContactLookupStore } from '@/lib/stores/contactLookup';
import { PageTransition } from '@/components/phone';
import { GenericAvatar } from '@/components/phone/chrome/avatarUtils';
import type { Contact } from '@/lib/api';
import type { CreateContactInput } from '@/lib/validation';

const TABS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Business' },
  { id: 'other', label: 'Other' },
];

export default function ContactsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isMasked = useAuthStore((state) => !!state.user?.waPhoneMaskEnabled);

  const pagination = usePagination({ initialPageSize: 20 });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [contactToBlock, setContactToBlock] = useState<Contact | null>(null);

  // A11y live region
  const [announcement, setAnnouncement] = useState('');
  const announcementTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
    announcementTimer.current = setTimeout(() => setAnnouncement(''), 3000);
  }, []);
  useEffect(() => () => {
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
  }, []);

  const contactLookupContacts = useContactLookupStore((s) => s.contacts);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      pagination.goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    pagination.goToPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const {
    data: contactsData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useContactsPaginated({
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
    type: typeFilter || undefined,
  });

  useEffect(() => {
    if (contactsData?.total !== undefined) pagination.setTotalItems(contactsData.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactsData?.total]);

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const toggleFavorite = useToggleFavorite();
  const { data: favoriteContacts } = useFavoriteContacts();
  const { blockedNumberSet, blockedNumberMap } = useBlockedNumberLookup();
  const blockContact = useBlockContact();
  const unblockContact = useUnblockContact();

  const contacts = contactsData?.contacts || [];
  const favorites = favoriteContacts || [];

  const handleToggleFavorite = useCallback(
    (contact: Contact) => {
      toggleFavorite.mutate(
        { id: contact.id, isFavorite: !contact.isFavorite },
        { onError: () => toast.error('Failed to update favorite') }
      );
      // keep the open detail pane in sync
      setSelectedContact((prev) =>
        prev && prev.id === contact.id ? { ...prev, isFavorite: !contact.isFavorite } : prev
      );
    },
    [toggleFavorite]
  );

  const handleCreateContact = useCallback(() => {
    setEditingContact(null);
    setApiError(null);
    setIsModalOpen(true);
  }, []);

  const handleEditContact = useCallback((contact: Contact) => {
    setEditingContact(contact);
    setApiError(null);
    setIsModalOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: CreateContactInput) => {
      try {
        setApiError(null);
        if (editingContact) {
          updateContact.mutate(
            {
              id: editingContact.id,
              data: {
                name: data.name,
                contact: data.contact,
                type: data.type,
                notes: data.notes || undefined,
              },
            },
            {
              onSuccess: () => {
                toast.success('Contact updated');
                announce('Contact updated');
              },
              onError: (err) =>
                toast.error(err instanceof Error ? err.message : 'Failed to update contact'),
            }
          );
          setSelectedContact((prev) =>
            prev && prev.id === editingContact.id
              ? { ...prev, name: data.name, contact: data.contact, type: data.type, notes: data.notes || null }
              : prev
          );
          setIsModalOpen(false);
        } else {
          await createContact.mutateAsync({
            name: data.name,
            contact: data.contact,
            type: data.type,
            notes: data.notes || undefined,
          });
          toast.success('Contact created');
          announce('Contact created');
          setIsModalOpen(false);
        }
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Failed to save contact. Please try again.');
      }
    },
    [editingContact, updateContact, createContact, announce]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!contactToDelete) return;
    const id = contactToDelete.id;
    setContactToDelete(null);
    setSelectedContact((prev) => (prev && prev.id === id ? null : prev));
    deleteContact.mutate(id, {
      onSuccess: () => {
        toast.success('Contact deleted');
        announce('Contact deleted');
      },
      onError: () => toast.error('Failed to delete contact'),
    });
  }, [contactToDelete, deleteContact, announce]);

  const handleCall = useCallback(
    (contact: Contact) => {
      const normalized = normalizePhone(contact.contact);
      if (isOwnNumber(normalized, user?.senderPhone, user?.phoneNumbers)) {
        toast.error('You cannot call your own number');
        return;
      }
      router.push(`/phone?dial=${encodeURIComponent(normalized)}`);
    },
    [router, user?.senderPhone, user?.phoneNumbers]
  );

  const handleSms = useCallback(
    (contact: Contact) => {
      router.push(`/phone/messages?phone=${encodeURIComponent(normalizePhone(contact.contact))}`);
    },
    [router]
  );

  const handleBlockToggle = useCallback(
    (contact: Contact) => {
      const normalized = normalizePhone(contact.contact);
      if (blockedNumberSet.has(normalized)) {
        const blockedId = blockedNumberMap.get(normalized);
        if (blockedId) {
          unblockContact.mutate(blockedId, {
            onSuccess: () => {
              toast.success('Number unblocked');
              announce('Number unblocked');
            },
            onError: () => toast.error('Failed to unblock number'),
          });
        }
      } else {
        setContactToBlock(contact);
      }
    },
    [blockedNumberSet, blockedNumberMap, unblockContact, announce]
  );

  const handleConfirmBlock = useCallback(() => {
    if (!contactToBlock) return;
    blockContact.mutate(normalizePhone(contactToBlock.contact), {
      onSuccess: () => {
        toast.success('Number blocked');
        announce('Number blocked');
        setContactToBlock(null);
      },
      onError: () => toast.error('Failed to block number'),
    });
  }, [contactToBlock, blockContact, announce]);

  const showLoading = isLoading && contacts.length === 0;
  const showEmpty = !showLoading && !error && contacts.length === 0;
  const isSaving = createContact.isPending;

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex h-full min-h-0 bg-[var(--card)] overflow-hidden">
        <div aria-live="polite" className="sr-only">{announcement}</div>

        {/* ===== LIST PANEL ===== */}
        {/* On mobile, hide the list once a contact is open (the detail takes over,
            with a Back button); on md+ both panels always show side by side. */}
        <section className={`w-full md:w-[320px] md:shrink-0 flex-col min-h-0 bg-[var(--card)] md:border-r border-[var(--border)] ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
          {/* header */}
          <div className="flex items-center justify-between px-5 pt-3.5 pb-1.5">
            <h1 className="text-[21px] font-black text-[var(--foreground)] flex items-center gap-2">
              Contacts
              {contactsData?.total !== undefined && (
                <span className="text-[13px] font-bold text-[var(--muted-foreground)]">
                  {contactsData.total.toLocaleString()}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                title="Refresh"
                aria-label="Refresh"
                className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
              >
                <FiRefreshCw className={`w-[18px] h-[18px] ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              {!isMasked && (
                <button
                  onClick={handleCreateContact}
                  title="Add contact"
                  aria-label="Add contact"
                  className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <FiPlus className="w-[20px] h-[20px]" />
                </button>
              )}
            </div>
          </div>

          {/* sub-tabs */}
          <div className="flex items-center gap-5 px-5 border-b border-[var(--border)]">
            {TABS.map((t) => {
              const on = typeFilter === t.id;
              return (
                <button
                  key={t.id || 'all'}
                  onClick={() => setTypeFilter(t.id)}
                  className={`relative py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${
                    on ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {t.label}
                  {on && <span className="absolute left-0 right-0 -bottom-px h-[2.5px] rounded bg-[var(--primary-600)]" />}
                </button>
              );
            })}
          </div>

          {/* search */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] text-[var(--muted-foreground)]">
            <FiSearch className="w-4 h-4 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all contacts"
              aria-label="Search contacts"
              className="nx-search-input w-full bg-transparent outline-none text-[13.5px] text-[var(--foreground)]"
            />
            {searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
                className="grid place-items-center w-5 h-5 rounded-full shrink-0 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* body */}
          <div className="flex-1 overflow-auto min-h-0">
            {showLoading && (
              <div className="grid place-items-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border)] border-t-transparent" />
              </div>
            )}
            {error && contacts.length === 0 && (
              <div className="text-center py-10 text-sm text-[var(--danger)]">{error.message}</div>
            )}

            {/* Favorites — only on the All tab, with no active search */}
            {!typeFilter && !debouncedSearch && (
              <div>
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <span className="text-[12px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">Favorites</span>
                  {!isMasked && (
                    <button onClick={handleCreateContact} title="Add favorite" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <FiPlus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {favorites.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-[var(--muted-foreground)]">No favorite contacts added yet</p>
                ) : (
                  favorites.map((c) => (
                    <ContactRow key={`fav-${c.id}`} contact={c} selected={selectedContact?.id === c.id} onSelect={setSelectedContact} />
                  ))
                )}
              </div>
            )}

            {/* All contacts */}
            <div>
              <div className="px-4 pt-3 pb-1">
                <span className="text-[12px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
                  {typeFilter ? TABS.find((t) => t.id === typeFilter)?.label : 'All contacts'}
                </span>
              </div>
              {showEmpty ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
                  {searchQuery || typeFilter ? 'No contacts match your search' : 'No contacts found'}
                </p>
              ) : (
                contacts.map((c) => (
                  <ContactRow key={c.id} contact={c} selected={selectedContact?.id === c.id} onSelect={setSelectedContact} />
                ))
              )}
            </div>

            {/* Pagination */}
            {contacts.length > 0 && pagination.totalPages > 1 && (
              <div className="px-3 py-3 border-t border-[var(--border)]">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  pageRange={pagination.pageRange}
                  onPageChange={(p) => pagination.goToPage(p)}
                  onPageSizeChange={(s) => pagination.setPageSize(s)}
                  disabled={isFetching}
                  showPageSizeSelector={false}
                  showTotalItems={false}
                />
              </div>
            )}
          </div>
        </section>

        {/* ===== DETAIL PANE ===== */}
        {/* Shown on mobile only when a contact is selected; always shown on md+. */}
        <div className={`flex-1 min-h-0 bg-[var(--background)] ${selectedContact ? 'flex' : 'hidden md:flex'}`}>
          {selectedContact ? (
            <ContactDetailPane
              contact={selectedContact}
              isMasked={isMasked}
              isBlocked={blockedNumberSet.has(normalizePhone(selectedContact.contact))}
              onClose={() => setSelectedContact(null)}
              onEdit={handleEditContact}
              onDelete={setContactToDelete}
              onCall={handleCall}
              onSms={handleSms}
              onToggleFavorite={handleToggleFavorite}
              onBlockToggle={handleBlockToggle}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-center text-[var(--muted-foreground)] px-6">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] grid place-items-center mx-auto mb-3">
                  <FiUser className="w-7 h-7 opacity-60" />
                </div>
                <p className="text-sm">Select a contact to see their details.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact add/edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
          <div className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 id="contact-modal-title" className="text-xl font-black text-[var(--foreground)]">
                {editingContact ? 'Edit contact' : 'Add contact'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setApiError(null); }} aria-label="Close" className="w-8 h-8 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <ContactForm
              defaultValues={
                editingContact
                  ? {
                      name: editingContact.name,
                      contact: editingContact.contact,
                      type: (editingContact.type as 'personal' | 'business' | 'other') || 'personal',
                      notes: editingContact.notes || '',
                    }
                  : undefined
              }
              onSubmit={handleFormSubmit}
              onCancel={() => { setIsModalOpen(false); setApiError(null); }}
              isSubmitting={isSaving}
              apiError={apiError}
              submitLabel={editingContact ? 'Update' : 'Create'}
              existingContacts={contactLookupContacts}
              editingContactId={editingContact?.id}
            />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {contactToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 grid place-items-center">
                <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-black text-[var(--foreground)]">Delete contact</h2>
            </div>
            <p className="text-[var(--muted-foreground)] mb-6">
              Delete <span className="font-bold text-[var(--foreground)]">{contactToDelete.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setContactToDelete(null)} disabled={deleteContact.isPending}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleConfirmDelete} disabled={deleteContact.isPending}>
                {deleteContact.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Block confirmation */}
      <ConfirmModal
        isOpen={!!contactToBlock}
        title="Block number"
        message={`Block ${contactToBlock?.name || contactToBlock?.contact || ''}? Calls from this number will be rejected.`}
        confirmText="Block"
        variant="danger"
        loading={blockContact.isPending}
        onConfirm={handleConfirmBlock}
        onClose={() => setContactToBlock(null)}
      />
    </PageTransition>
  );
}

// ============================================================
// Row
// ============================================================

const ContactRow = memo(function ContactRow({
  contact,
  selected,
  onSelect,
}: {
  contact: Contact;
  selected: boolean;
  onSelect: (c: Contact) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact)}
      role="option"
      aria-selected={selected}
      className={`group w-full flex items-center gap-3 px-4 py-[5px] text-left border-b border-[var(--border)]/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-500)] ${
        selected ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20' : 'hover:bg-[var(--muted)]/60'
      }`}
    >
      <GenericAvatar name={contact.name} number={contact.contact} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14.5px] font-bold truncate text-[var(--foreground)]">{contact.name}</span>
          {!!contact.isFavorite && <FiStar className="w-3.5 h-3.5 shrink-0 text-yellow-500 fill-yellow-500" />}
        </div>
        <div className="text-[12.5px] text-[var(--muted-foreground)] truncate mt-0.5">{formatPhoneNumber(contact.contact)}</div>
      </div>
      {contact.type && (
        <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] capitalize">
          {contact.type}
        </span>
      )}
    </button>
  );
});

// ============================================================
// Detail pane
// ============================================================

interface DetailProps {
  contact: Contact;
  isMasked: boolean;
  isBlocked: boolean;
  onClose: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  onCall: (c: Contact) => void;
  onSms: (c: Contact) => void;
  onToggleFavorite: (c: Contact) => void;
  onBlockToggle: (c: Contact) => void;
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[680px] rounded-2xl border border-[var(--border)] p-4 md:p-5">
      <div className="text-[13px] font-black text-[var(--foreground)] mb-1.5">{label}</div>
      {children}
    </div>
  );
}

const ContactDetailPane = memo(function ContactDetailPane({
  contact,
  isMasked,
  isBlocked,
  onClose,
  onEdit,
  onDelete,
  onCall,
  onSms,
  onToggleFavorite,
  onBlockToggle,
}: DetailProps) {
  const phone = isMasked
    ? `••••${contact.contact.replace(/\D/g, '').slice(-4) || ''}`
    : formatPhoneNumber(contact.contact);

  return (
    <div className="flex flex-col h-full w-full">
      {/* top actions */}
      <div className="flex items-center justify-end gap-1 px-6 pt-4">
        {/* Mobile back — returns to the list (detail is full-screen on phones). */}
        <button onClick={onClose} aria-label="Back to contacts" className="md:hidden mr-auto flex items-center gap-1 -ml-1 text-sm font-bold text-[var(--foreground)]">
          <FiArrowLeft className="w-4 h-4" />
          Contacts
        </button>
        <button onClick={() => onToggleFavorite(contact)} title={contact.isFavorite ? 'Remove favorite' : 'Add favorite'} className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
          <FiStar className={`w-5 h-5 ${contact.isFavorite ? 'text-yellow-500 fill-yellow-500' : ''}`} />
        </button>
        {!isMasked && (
          <button onClick={() => onEdit(contact)} title="Edit" className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
            <FiEdit2 className="w-5 h-5" />
          </button>
        )}
        <button onClick={() => onDelete(contact)} title="Delete" className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
          <FiTrash2 className="w-5 h-5" />
        </button>
        <button onClick={onClose} title="Close" className="w-9 h-9 hidden md:grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
          <FiX className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 md:px-10 pb-10 flex flex-col items-center">
        <GenericAvatar name={contact.name} number={contact.contact} size={96} />
        <div className="mt-3.5 text-[26px] font-black text-[var(--foreground)]">{contact.name}</div>

        {/* action row */}
        {!isMasked && (
          <div className="flex gap-6 mt-6 mb-8">
            {[
              { icon: <FiPhone className="w-[22px] h-[22px]" />, label: 'Call', fn: () => onCall(contact) },
              { icon: <FiMessageSquare className="w-[22px] h-[22px]" />, label: 'Message', fn: () => onSms(contact) },
              {
                icon: isBlocked ? <FiShield className="w-[22px] h-[22px]" /> : <FiShieldOff className="w-[22px] h-[22px]" />,
                label: isBlocked ? 'Unblock' : 'Block',
                fn: () => onBlockToggle(contact),
              },
            ].map((a) => (
              <button key={a.label} onClick={a.fn} className="flex flex-col items-center gap-2 text-[var(--muted-foreground)] group">
                <span className="w-[52px] h-[52px] rounded-full bg-[var(--muted)] grid place-items-center group-hover:bg-[var(--primary-50)] dark:group-hover:bg-[var(--primary-900)]/30 group-hover:text-[var(--foreground)] transition-colors">
                  {a.icon}
                </span>
                <span className="text-[11.5px] font-bold">{a.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="w-full flex flex-col items-center gap-3.5">
          <InfoCard label="Phone number">
            <div className="flex items-center gap-2 text-[15px] text-[var(--foreground)]">
              {phone}
              {!isMasked && (
                <button title="Copy number" onClick={() => { navigator.clipboard?.writeText(contact.contact); toast.success('Number copied'); }}>
                  <FiCopy className="w-4 h-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" />
                </button>
              )}
            </div>
          </InfoCard>

          <InfoCard label="Type">
            <div className="text-sm text-[var(--muted-foreground)] capitalize">{contact.type || 'personal'}</div>
          </InfoCard>
        </div>
      </div>
    </div>
  );
});
