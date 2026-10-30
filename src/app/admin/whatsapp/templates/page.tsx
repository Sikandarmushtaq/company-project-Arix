'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiRefreshCw, FiFileText, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { whatsappAdminService } from '@/lib/api/services/whatsapp.service';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth';
import { OrgWaTemplatesManager } from '@/components/whatsapp';
import { StyledSelect } from '@/components/ui';

/**
 * /admin/whatsapp/templates — role-aware route, single (admin) shell.
 *
 *  - manager → OrgWaTemplatesManager: their own org's verified templates,
 *    synced provider-aware (YCloud or Meta) without surfacing the vendor.
 *  - admin   → AdminGlobalTemplatesView: legacy platform-wide Meta template
 *    manager with create/delete.
 *
 * Same role-switch pattern as the Settings/Numbers routes — keeps the manager
 * in the admin shell instead of bouncing them to /org/whatsapp/*.
 */
export default function WhatsAppTemplatesPage() {
  const { user } = useAuthStore();

  if (user?.role === 'manager') {
    return <OrgWaTemplatesManager />;
  }

  return <AdminGlobalTemplatesView />;
}

function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return 'text-green-400 bg-green-500/20';
    case 'PENDING':
      return 'text-amber-400 bg-amber-500/20';
    case 'REJECTED':
      return 'text-red-400 bg-red-500/20';
    default:
      return 'text-[var(--muted-foreground)] bg-[var(--background)]';
  }
}

function getCategoryColor(category: string): string {
  switch (category.toUpperCase()) {
    case 'MARKETING':
      return 'text-purple-400 bg-purple-500/20';
    case 'UTILITY':
      return 'text-blue-400 bg-blue-500/20';
    case 'AUTHENTICATION':
      return 'text-amber-400 bg-amber-500/20';
    default:
      return 'text-[var(--muted-foreground)] bg-[var(--background)]';
  }
}

function AdminGlobalTemplatesView() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ name: string } | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    language: 'en_US',
    category: 'UTILITY',
    bodyText: '',
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['wa-templates'],
    queryFn: () => whatsappAdminService.getTemplates(),
    staleTime: 60000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => whatsappAdminService.refreshTemplates(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wa-templates'] });
      toast.success(`Refreshed ${result.count} templates from Meta`);
    },
    onError: (err) => {
      toast.error(`Failed to refresh: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => whatsappAdminService.createTemplate(createForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-templates'] });
      toast.success('Template created — pending Meta approval');
      setShowCreateModal(false);
      setCreateForm({ name: '', language: 'en_US', category: 'UTILITY', bodyText: '' });
    },
    onError: (err) => {
      toast.error(`Failed to create: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (templateName: string) => whatsappAdminService.deleteTemplate(templateName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-templates'] });
      toast.success('Template deleted');
      setDeleteConfirm(null);
    },
    onError: (err) => {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const canCreate =
    createForm.name.trim() &&
    createForm.bodyText.trim() &&
    /^[a-z][a-z0-9_]*$/.test(createForm.name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-green-500/10 shrink-0">
            <FaWhatsapp className="w-6 h-6 text-green-500" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-[var(--foreground)] truncate">WhatsApp Templates</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              Create and manage message templates — requires Meta approval before use
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 h-10 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Create Template
          </button>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title="Refresh from Meta"
            aria-label="Refresh from Meta"
            className="grid place-items-center w-10 h-10 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-[18px] h-[18px] ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center">
          <FiFileText className="w-12 h-12 mx-auto text-[var(--muted-foreground)] opacity-40 mb-3" />
          <h3 className="text-lg font-bold text-[var(--foreground)] mb-1">No templates found</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Create your first template or refresh from Meta.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 h-10 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Create Template
            </button>
            <button
              onClick={() => refreshMutation.mutate()}
              className="px-4 h-10 text-sm font-bold border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              Refresh from Meta
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={`${template.templateId}-${template.language}`}
              className="group bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3 transition-colors hover:border-green-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--foreground)] truncate">{template.name}</h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{template.language}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(template.status)}`}
                  >
                    {template.status}
                  </span>
                  <button
                    onClick={() => setDeleteConfirm({ name: template.name })}
                    className="grid place-items-center w-7 h-7 rounded-full text-[var(--muted-foreground)] hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-[var(--danger)] transition-colors"
                    title="Delete template"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getCategoryColor(template.category)}`}
              >
                {template.category}
              </span>

              {template.components && template.components.length > 0 && (
                <div className="space-y-1">
                  {template.components.map((comp, i) => {
                    const c = comp as Record<string, unknown>;
                    const type = c.type as string;
                    const text = c.text as string | undefined;
                    if (!type || !text) return null;
                    return (
                      <div key={i} className="text-xs leading-relaxed">
                        <span className="uppercase text-[var(--muted-foreground)] font-bold tracking-wide">
                          {type}:{' '}
                        </span>
                        <span className="text-[var(--foreground)]">
                          {text.slice(0, 120)}
                          {text.length > 120 ? '...' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="text-xs text-[var(--muted-foreground)] font-mono">
                ID: {template.templateId}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
              <h3 className="text-lg font-black text-[var(--foreground)]">Create Template</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                title="Close"
                aria-label="Close"
                className="grid place-items-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <FiX className="w-[18px] h-[18px]" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
              <div>
                <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">Template Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    }))
                  }
                  placeholder="e.g., order_confirmation"
                  className="w-full h-10 px-3 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Lowercase, underscores only
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">Language</label>
                  <StyledSelect
                    value={createForm.language}
                    onChange={(v) => setCreateForm((f) => ({ ...f, language: v }))}
                  >
                    <option value="en_US">English (US)</option>
                    <option value="en_GB">English (UK)</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="ar">Arabic</option>
                    <option value="pt_BR">Portuguese (BR)</option>
                    <option value="de">German</option>
                    <option value="ms">Malay</option>
                  </StyledSelect>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">Category</label>
                  <StyledSelect
                    value={createForm.category}
                    onChange={(v) => setCreateForm((f) => ({ ...f, category: v }))}
                  >
                    <option value="UTILITY">Utility</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </StyledSelect>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[var(--foreground)] mb-1.5">Body Text</label>
                <textarea
                  value={createForm.bodyText}
                  onChange={(e) => setCreateForm((f) => ({ ...f, bodyText: e.target.value }))}
                  placeholder="Hello {{1}}, your order {{2}} has been confirmed."
                  rows={4}
                  className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none"
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Use {'{{1}}'}, {'{{2}}'} etc. for variables. Max 1024 characters.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-[var(--border)] shrink-0">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 h-10 text-sm font-bold rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!canCreate || createMutation.isPending}
                className="px-4 h-10 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-black text-[var(--foreground)] mb-2">Delete Template?</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">
              This will permanently delete{' '}
              <span className="text-[var(--foreground)] font-bold">{deleteConfirm.name}</span>{' '}
              from Meta. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 h-10 text-sm font-bold rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.name)}
                disabled={deleteMutation.isPending}
                className="px-4 h-10 text-sm font-bold bg-[var(--danger)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
