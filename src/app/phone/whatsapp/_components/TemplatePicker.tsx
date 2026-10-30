'use client';

import React, { useState, useEffect } from 'react';
import { FiFileText, FiX, FiArrowLeft, FiSend } from 'react-icons/fi';
import { extractVariables, getVariableLabel, getVariableKey, fillVariables } from './utils';
import type { WaTemplate } from '@/lib/api/services/whatsapp-types';

// ============================================================
// TemplatePicker Component
// ============================================================

/** Does this template carry WhatsApp's call-permission-request button? */
function isCallPermissionTemplate(t: WaTemplate): boolean {
  return (t.components ?? []).some(
    (c) => (c as Record<string, unknown>).type === 'CALL_PERMISSION_REQUEST'
  );
}

interface TemplatePickerProps {
  templates: WaTemplate[];
  isLoading: boolean;
  onSend: (template: WaTemplate, components: Record<string, unknown>[]) => void;
  onClose: () => void;
  /**
   * When true, the picker opens directly on the org's approved call-permission
   * template (the one with a CALL_PERMISSION_REQUEST button) so the agent only
   * has to hit Send. Used by the "Request Call" button.
   */
  autoSelectCallPermission?: boolean;
}

export function TemplatePicker({
  templates,
  isLoading,
  onSend,
  onClose,
  autoSelectCallPermission,
}: TemplatePickerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const approved = templates.filter((t) => t.status === 'APPROVED');

  // Auto-jump to the call-permission template when launched from "Request Call".
  // Runs once templates are loaded; if none exists, the agent sees the normal
  // list (and a hint to create one).
  useEffect(() => {
    if (!autoSelectCallPermission || selectedTemplate) return;
    const callTpl = approved.find(isCallPermissionTemplate);
    if (callTpl) setSelectedTemplate(callTpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectCallPermission, templates]);

  const bodyComp = selectedTemplate?.components?.find(
    (c) => (c as Record<string, unknown>).type === 'BODY'
  ) as Record<string, unknown> | undefined;
  const headerComp = selectedTemplate?.components?.find(
    (c) => (c as Record<string, unknown>).type === 'HEADER'
  ) as Record<string, unknown> | undefined;
  const footerComp = selectedTemplate?.components?.find(
    (c) => (c as Record<string, unknown>).type === 'FOOTER'
  ) as Record<string, unknown> | undefined;

  const bodyText = (bodyComp?.text as string) || '';
  const headerText = (headerComp?.text as string) || '';
  const footerText = (footerComp?.text as string) || '';

  const bodyVars = extractVariables(bodyText);
  const headerVars = extractVariables(headerText);
  const allVars = [...new Set([...headerVars, ...bodyVars])];
  const hasVariables = allVars.length > 0;

  const previewBody = fillVariables(bodyText, variableValues);
  const previewHeader = fillVariables(headerText, variableValues);

  const allFilled =
    !hasVariables || allVars.every((v) => variableValues[getVariableKey(v)]?.trim());

  const handleSend = () => {
    if (!selectedTemplate) return;

    const components: Record<string, unknown>[] = [];

    const buildParams = (vars: string[]) =>
      vars.map((v) => {
        const key = getVariableKey(v);
        const isNamed = !/^\d+$/.test(key);
        return {
          type: 'text',
          text: variableValues[key] || '',
          ...(isNamed ? { parameter_name: key } : {}),
        };
      });

    if (headerVars.length > 0) {
      components.push({ type: 'header', parameters: buildParams(headerVars) });
    }
    if (bodyVars.length > 0) {
      components.push({ type: 'body', parameters: buildParams(bodyVars) });
    }

    onSend(selectedTemplate, components);
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setVariableValues({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 max-w-lg w-full mx-4 max-h-[80dvh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FiFileText className="w-4 h-4 text-green-500" />
            {selectedTemplate ? 'Customize Template' : 'Select Template'}
          </h3>
          <button onClick={onClose}>
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {!selectedTemplate ? (
          <>
            <p className="text-[10px] text-[var(--muted-foreground)] mb-3">
              WhatsApp requires a pre-approved template for the first message. Select one below.
            </p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500" />
                </div>
              ) : approved.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)] text-center py-8">
                  No approved templates. Ask your admin to create one.
                </p>
              ) : (
                approved.map((t) => {
                  const tBody = t.components?.find(
                    (c) => (c as Record<string, unknown>).type === 'BODY'
                  ) as Record<string, unknown> | undefined;
                  const tText = (tBody?.text as string) || '';
                  const tVars = extractVariables(tText);
                  return (
                    <button
                      key={`${t.templateId}-${t.language}`}
                      onClick={() => setSelectedTemplate(t)}
                      className="w-full text-left p-3 bg-[var(--background)] border border-[var(--border)] rounded-lg hover:border-green-500/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">{t.name}</span>
                        <div className="flex items-center gap-2">
                          {tVars.length > 0 && (
                            <span className="text-[10px] text-amber-400">
                              {tVars.length} variable{tVars.length > 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {t.language}
                          </span>
                        </div>
                      </div>
                      {tText && (
                        <p className="text-[10px] text-[var(--muted-foreground)] line-clamp-2">
                          {tText}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={handleBack}
              className="text-xs text-green-500 hover:underline mb-3 flex items-center gap-1"
            >
              <FiArrowLeft className="w-3 h-3" /> Back to templates
            </button>

            {hasVariables && (
              <div className="space-y-2 mb-3">
                <p className="text-[10px] font-medium text-[var(--muted-foreground)]">
                  Fill in the variables:
                </p>
                {allVars.map((v) => {
                  const key = getVariableKey(v);
                  const label = getVariableLabel(v);
                  return (
                    <div key={key}>
                      <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={variableValues[key] || ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className="w-full px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mb-3">
              <p className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
                Preview:
              </p>
              <div className="bg-green-600/10 border border-green-500/20 rounded-lg p-3 space-y-1">
                {previewHeader && (
                  <p className="text-xs font-semibold text-[var(--foreground)]">{previewHeader}</p>
                )}
                <p className="text-xs text-[var(--foreground)]">
                  {previewBody || '(No body text)'}
                </p>
                {footerText && (
                  <p className="text-[10px] text-[var(--muted-foreground)] italic">{footerText}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleBack}
                className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleSend}
                disabled={!allFilled}
                className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <FiSend className="w-3 h-3" />
                Send Template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
