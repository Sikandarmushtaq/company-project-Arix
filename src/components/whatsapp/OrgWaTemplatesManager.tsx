'use client';

/**
 * Per-org WhatsApp Templates panel (owner + manager).
 *
 * Lists the org's message templates and lets the owner/manager re-sync them
 * from their provider. The sync is PROVIDER-AWARE server-side: YCloud orgs
 * pull from YCloud's template API, Meta orgs from the Graph API. This is the
 * manager-facing equivalent of the admin template refresh — and it's what
 * keeps a YCloud org's template list real (a freshly onboarded WABA has no
 * `hello_world`, so sending it 403s until the real templates are synced here).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw, FiAlertCircle, FiInbox, FiPlus, FiX, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, Button, StyledSelect } from '@/components/ui';
import {
  getMyTemplates,
  refreshMyTemplates,
  createMyTemplate,
  deleteMyTemplate,
} from '@/lib/api/services/whatsapp-org.api';
import type { WaTemplate } from '@/lib/api/services/whatsapp-types';

const EMPTY_FORM = { name: '', language: 'en_US', category: 'UTILITY', bodyText: '' };

/** Colour a template status into a badge class. */
function statusBadge(status: string): string {
  const s = status.toUpperCase();
  if (s === 'APPROVED')
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (s === 'PENDING' || s === 'IN_APPEAL')
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (s === 'REJECTED' || s === 'DISABLED' || s === 'PAUSED')
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
}

export function OrgWaTemplatesManager() {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // Sample value per {{n}} variable, keyed by the variable number (as string).
  const [samples, setSamples] = useState<Record<string, string>>({});

  // Template pending delete-confirmation (null = no dialog open).
  const [toDelete, setToDelete] = useState<WaTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Show the cached list instantly for a fast first paint…
    getMyTemplates()
      .then((cached) => {
        if (!cancelled) setTemplates(cached);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load templates.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // …then reconcile with the provider in the background, so a status change
    // since the last sync (e.g. PENDING → APPROVED) is reflected on open
    // without a manual refresh.
    refreshMyTemplates()
      .then((fresh) => {
        if (!cancelled) {
          setTemplates(fresh);
          setLastSynced(new Date().toLocaleTimeString());
        }
      })
      .catch(() => {
        /* keep the cached view; the manual Refresh button is still available */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const fresh = await refreshMyTemplates();
      setTemplates(fresh);
      setLastSynced(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh templates.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Name must start with a letter; lowercase letters, digits, underscores only.
  const nameValid = /^[a-z][a-z0-9_]*$/.test(form.name);

  // Variables in the body, e.g. {{1}} {{2}}. WhatsApp needs them sequential
  // from {{1}} and a sample for each — we surface both so the manager doesn't
  // hit an INVALID_FORMAT rejection. `vars` is the ordered list [1..maxVar].
  const usedVars = [...form.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const maxVar = usedVars.length ? Math.max(...usedVars) : 0;
  const vars = Array.from({ length: maxVar }, (_, i) => i + 1);
  const varsSequential = vars.every((n) => usedVars.includes(n));
  const allSamplesFilled = vars.every((n) => (samples[String(n)] ?? '').trim().length > 0);

  const canCreate =
    nameValid &&
    form.bodyText.trim().length > 0 &&
    form.bodyText.length <= 1024 &&
    varsSequential &&
    allSamplesFilled;

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setSamples({});
  }, []);

  const submitCreate = useCallback(async () => {
    if (!canCreate) return;

    const payload = {
      name: form.name.trim(),
      language: form.language,
      category: form.category,
      bodyText: form.bodyText.trim(),
      examples: vars.map((n) => (samples[String(n)] ?? '').trim()),
    };

    // OPTIMISTIC: drop a PENDING row in immediately and close the modal, so the
    // UI feels instant. The actual provider call + a server refresh run in the
    // background to reconcile (real status, officialTemplateId, etc.). On
    // failure we roll the row back and re-sync from the server.
    const optimistic: WaTemplate = {
      templateId: `optimistic-${payload.name}-${payload.language}`,
      name: payload.name,
      language: payload.language,
      category: payload.category,
      status: 'PENDING',
      components: null,
      cachedAt: new Date().toISOString(),
    };
    setCreating(true);
    setTemplates((list) => [optimistic, ...list]);
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setSamples({});

    try {
      await createMyTemplate(payload);
      toast.success('Template submitted for review. It becomes sendable once approved.');
      // Reconcile with the server (replaces the optimistic row with the real one).
      try {
        setTemplates(await refreshMyTemplates());
        setLastSynced(new Date().toLocaleTimeString());
      } catch {
        /* non-fatal — the optimistic row stands until the next manual refresh */
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create template.');
      // Roll back the optimistic row, then re-sync so the list reflects truth.
      setTemplates((list) => list.filter((t) => t.templateId !== optimistic.templateId));
      try {
        setTemplates(await refreshMyTemplates());
      } catch {
        /* leave the rolled-back list as-is */
      }
    } finally {
      setCreating(false);
    }
  }, [canCreate, form, vars, samples]);

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMyTemplate(toDelete.name, toDelete.language);
      toast.success(`Deleted "${toDelete.name}".`);
      setToDelete(null);
      try {
        setTemplates(await refreshMyTemplates());
        setLastSynced(new Date().toLocaleTimeString());
      } catch {
        // Refresh failed — drop it from the local list so the UI is consistent.
        setTemplates((list) =>
          list.filter((t) => !(t.name === toDelete.name && t.language === toDelete.language))
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete template.');
    } finally {
      setDeleting(false);
    }
  }, [toDelete]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Message templates</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Pre-approved templates you can send as the first message to a customer. Sync to pull
              the latest approved templates from your WhatsApp account.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <FiPlus className="w-4 h-4" />
              Create template
            </Button>
            <Button onClick={refresh} disabled={refreshing} variant="outline">
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Syncing…' : 'Refresh templates'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2 mb-4">
            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {lastSynced && !error && (
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Last synced at {lastSynced}.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading templates…</p>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 text-[var(--muted-foreground)]">
            <FiInbox className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm font-bold text-[var(--foreground)]">No templates yet</p>
            <p className="text-xs mt-1 max-w-sm">
              Click <strong>Create template</strong> to author one — it&apos;s submitted for review
              and appears here as <strong>Pending</strong> until approved. You can&apos;t send a
              first message to a customer until at least one template is approved.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                  <th className="py-2 pr-4 text-xs font-bold uppercase tracking-wide">Name</th>
                  <th className="py-2 pr-4 text-xs font-bold uppercase tracking-wide">Language</th>
                  <th className="py-2 pr-4 text-xs font-bold uppercase tracking-wide">Category</th>
                  <th className="py-2 pr-4 text-xs font-bold uppercase tracking-wide">Status</th>
                  <th className="py-2 text-xs font-bold uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={`${t.name}-${t.language}`}
                    className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--muted)]/40 transition-colors"
                  >
                    <td className="py-2.5 pr-4 font-bold text-[var(--foreground)]">{t.name}</td>
                    <td className="py-2.5 pr-4 text-[var(--muted-foreground)]">{t.language}</td>
                    <td className="py-2.5 pr-4 text-[var(--muted-foreground)]">{t.category}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge(t.status)}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setToDelete(t)}
                        className="grid place-items-center w-8 h-8 ml-auto rounded-full text-[var(--muted-foreground)] hover:text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete template"
                        aria-label={`Delete ${t.name}`}
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
              <h3 className="text-lg font-black text-[var(--foreground)]">Create template</h3>
              <button
                onClick={closeCreate}
                title="Close"
                aria-label="Close"
                className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <FiX className="w-[18px] h-[18px]" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
              <p className="text-xs text-[var(--muted-foreground)]">
                Submitted to WhatsApp for review. Approval usually takes a few minutes to a few hours;
                it becomes sendable once approved.
              </p>
              <div>
                <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">
                  Template name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    }))
                  }
                  placeholder="e.g. order_confirmation"
                  className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)]"
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Lowercase letters, numbers and underscores; must start with a letter.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">
                    Language
                  </label>
                  <StyledSelect
                    value={form.language}
                    onChange={(v) => setForm((f) => ({ ...f, language: v }))}
                  >
                    <option value="en_US">English (US)</option>
                    <option value="en_GB">English (UK)</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="ar">Arabic</option>
                    <option value="ur">Urdu</option>
                    <option value="pt_BR">Portuguese (BR)</option>
                    <option value="de">German</option>
                  </StyledSelect>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">
                    Category
                  </label>
                  <StyledSelect
                    value={form.category}
                    onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  >
                    <option value="UTILITY">Utility</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </StyledSelect>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">
                  Body text
                </label>
                <textarea
                  value={form.bodyText}
                  onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
                  placeholder="Hello {{1}}, your order {{2}} is confirmed."
                  rows={4}
                  className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] resize-none"
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Use {'{{1}}'}, {'{{2}}'} for variables. Max 1024 characters.
                </p>
              </div>

              {maxVar > 0 && !varsSequential && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2.5">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Variables must be numbered in order starting at {'{{1}}'} with no gaps.
                  </p>
                </div>
              )}

              {maxVar > 0 && varsSequential && (
                <div>
                  <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">
                    Sample values
                  </label>
                  <p className="text-xs text-[var(--muted-foreground)] mb-2">
                    WhatsApp reviews the template with example text in place of each variable.
                    Provide a realistic sample for each.
                  </p>
                  <div className="space-y-2">
                    {vars.map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--muted-foreground)] w-10 shrink-0">
                          {`{{${n}}}`}
                        </span>
                        <input
                          type="text"
                          value={samples[String(n)] ?? ''}
                          onChange={(e) =>
                            setSamples((s) => ({ ...s, [String(n)]: e.target.value }))
                          }
                          placeholder={n === 1 ? 'e.g. John' : 'e.g. Acme'}
                          className="flex-1 px-3 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-[var(--border)] shrink-0">
              <Button variant="outline" onClick={closeCreate} disabled={creating}>
                Cancel
              </Button>
              <Button
                onClick={submitCreate}
                disabled={!canCreate || creating}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {creating ? 'Submitting…' : 'Create template'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-black text-[var(--foreground)] mb-2">
              Delete template?
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">
              This permanently deletes{' '}
              <span className="font-bold text-[var(--foreground)]">{toDelete.name}</span> (
              {toDelete.language}) from your WhatsApp account. The name becomes available to reuse.
              This can&apos;t be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default OrgWaTemplatesManager;
