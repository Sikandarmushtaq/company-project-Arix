'use client';

/**
 * Reusable saved-SMS-template picker + quick-save.
 *
 * A small popover button that lets the user insert a saved template into the
 * current message, and save the current message as a new template. Shared by the
 * Auto-SMS composer (and, later, drip steps + auto-replies) so the whole SMS
 * automation surface reuses one template library.
 */

import React, { useEffect, useRef, useState } from 'react';
import { FiFileText, FiTrash2, FiX, FiBookmark } from 'react-icons/fi';
import {
  useSmsTemplates,
  useCreateSmsTemplate,
  useDeleteSmsTemplate,
} from '@/lib/hooks/useSmsTemplates';
import { toast } from '@/lib/stores/toast';

interface Props {
  /** Current composer text — enables "save as template". */
  currentBody?: string;
  /** Called with the chosen template body to insert into the composer. */
  onInsert: (body: string) => void;
  /** Only mount/fetch when the feature is available to this user. */
  enabled?: boolean;
}

export function TemplatePicker({ currentBody, onInsert, enabled = true }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape (a11y) while the popover is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSaving(false);
        setNewName('');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const { data: templates = [], isLoading } = useSmsTemplates(enabled && open);
  const createTemplate = useCreateSmsTemplate();
  const deleteTemplate = useDeleteSmsTemplate();

  if (!enabled) return null;

  const close = () => {
    setOpen(false);
    setSaving(false);
    setNewName('');
  };

  const handleSave = async () => {
    const name = newName.trim();
    const body = (currentBody ?? '').trim();
    if (!name) {
      toast.error('Give the template a name');
      return;
    }
    if (!body) {
      toast.error('Write a message first, then save it as a template');
      return;
    }
    try {
      await createTemplate.mutateAsync({ name, body });
      toast.success('Template saved');
      setSaving(false);
      setNewName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save template');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete the template "${name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete template');
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary-600)] hover:text-[var(--foreground)]"
      >
        <FiFileText className="h-3.5 w-3.5" /> Templates
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            ref={panelRef}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                Saved templates
              </span>
              <button type="button" onClick={close} aria-label="Close" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">Loading…</div>
              ) : templates.length === 0 ? (
                <div className="px-3 py-5 text-center text-xs text-[var(--muted-foreground)]">
                  No templates yet. Save your current message to reuse it later.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {templates.map((t) => (
                    <li key={t.id} className="group flex items-start gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          onInsert(t.body);
                          toast.success(`Inserted "${t.name}"`);
                          close();
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-semibold text-[var(--foreground)]">{t.name}</div>
                        <div className="truncate text-xs text-[var(--muted-foreground)]">{t.body}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id, t.name)}
                        aria-label={`Delete ${t.name}`}
                        className="mt-0.5 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Save-as-template footer */}
            <div className="border-t border-[var(--border)] p-2">
              {saving ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="Template name"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary-600)]"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={createTemplate.isPending}
                    className="shrink-0 rounded-lg bg-[var(--primary-600)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSaving(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--primary-600)] hover:bg-[var(--primary-600)]/5"
                >
                  <FiBookmark className="h-3.5 w-3.5" /> Save current message as template
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
