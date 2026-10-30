'use client';

import React, { useRef, useCallback } from 'react';
import {
  FiSend,
  FiFileText,
  FiPaperclip,
  FiX,
  FiImage,
  FiVideo,
  FiMic,
  FiFile,
} from 'react-icons/fi';
import { useWaTemplates, useWaTypingEmitter, useWaDraftEmitter } from '@/lib/hooks';
import { useToast } from '@/lib/stores/toast';
import { TemplatePicker } from './_components';
import {
  WA_ALLOWED_TYPES,
  getWaTypeFromMime,
  getMaxSizeForMime,
  formatBytes,
  getWaTypeLabel,
} from './_components';
import type { WaTemplate } from '@/lib/api/services/whatsapp-types';
import type { WaSelectedFile } from './_components';

// ============================================================================
// Types
// ============================================================================

export interface WaMessageComposerProps {
  /** Whether the 24h conversation window is active */
  hasActiveWindow: boolean;
  /** Message text */
  newMessage: string;
  /** Set message text */
  setNewMessage: (value: string) => void;
  /** Send text/media message handler */
  handleSend: () => void;
  /** Whether a send is in progress */
  isSending: boolean;
  /** Whether template picker is visible */
  showTemplatePicker: boolean;
  /** Set template picker visibility */
  setShowTemplatePicker: (show: boolean) => void;
  /** Open the picker pre-selected on the call-permission template ("Request Call"). */
  templatePickerAutoSelectCallPermission?: boolean;
  /** Send template handler */
  handleSendTemplate: (template: WaTemplate, components: Record<string, unknown>[]) => void;
  /** Whether template send is in progress */
  isSendingTemplate: boolean;
  /** Selected file for media message */
  selectedFile: WaSelectedFile | null;
  /** Set selected file */
  setSelectedFile: (file: WaSelectedFile | null) => void;
  /** Whether file is uploading */
  isUploading: boolean;
  /**
   * Customer phone of the active conversation. Used to drive the
   * typing-indicator + live-watch emit hooks. Null when no conversation
   * is open; passing null is harmless — the hooks short-circuit.
   */
  customerPhone?: string | null;
}

// ============================================================================
// Sub-Components
// ============================================================================

function FileTypeIcon({ waType }: { waType: string }) {
  switch (waType) {
    case 'image':
      return <FiImage className="w-5 h-5 text-blue-400" />;
    case 'video':
      return <FiVideo className="w-5 h-5 text-purple-400" />;
    case 'audio':
      return <FiMic className="w-5 h-5 text-green-400" />;
    default:
      return <FiFile className="w-5 h-5 text-amber-400" />;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * WhatsApp message composer.
 * Three modes:
 * - Active window with text: Text input + optional file attachment + send button
 * - Active window with file: File preview + caption input + send button
 * - No window: "Send Template" button that opens TemplatePicker
 */
export function WaMessageComposer({
  hasActiveWindow,
  newMessage,
  setNewMessage,
  handleSend,
  isSending,
  showTemplatePicker,
  setShowTemplatePicker,
  templatePickerAutoSelectCallPermission,
  handleSendTemplate,
  isSendingTemplate,
  selectedFile,
  setSelectedFile,
  isUploading,
  customerPhone,
}: WaMessageComposerProps) {
  const { data: templates, isLoading: templatesLoading } = useWaTemplates();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Manager-oversight emit hooks. Both internally gate on the org's
  // feature flags + the customerPhone being non-null, so it's safe to
  // wire unconditionally — they no-op when the feature is off or no
  // conversation is open.
  const { onActivity: onTypingActivity, onSent: onTypingSent } = useWaTypingEmitter({
    customerPhone: customerPhone ?? null,
    isActive: !!customerPhone && hasActiveWindow,
    draft: newMessage,
  });
  useWaDraftEmitter({
    customerPhone: customerPhone ?? null,
    draft: newMessage,
    isActive: !!customerPhone && hasActiveWindow,
  });

  // Wrap send so the typing pulse clears the instant the message goes
  // out — without this the manager sees "typing…" linger for up to the
  // composer's 2.5 s silence-stop window after a send.
  const handleSendWithIndicators = useCallback(() => {
    onTypingSent();
    handleSend();
  }, [onTypingSent, handleSend]);

  // Same for templates — sending a template clears the typing pulse.
  const handleSendTemplateWithIndicators = useCallback(
    (template: WaTemplate, components: Record<string, unknown>[]) => {
      onTypingSent();
      handleSendTemplate(template, components);
    },
    [onTypingSent, handleSendTemplate]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so same file can be re-selected
      e.target.value = '';

      if (!WA_ALLOWED_TYPES.includes(file.type)) {
        toast.error('Unsupported file type. Supported: images, video, audio, documents.');
        return;
      }

      const maxSize = getMaxSizeForMime(file.type);
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds ${formatBytes(maxSize)} limit`);
        return;
      }

      const waType = getWaTypeFromMime(file.type);
      const preview = waType === 'image' || waType === 'sticker' ? URL.createObjectURL(file) : '';

      // Revoke old preview if replacing
      if (selectedFile?.preview) URL.revokeObjectURL(selectedFile.preview);

      setSelectedFile({ file, preview, waType });
    },
    [selectedFile, setSelectedFile, toast]
  );

  const handleRemoveFile = useCallback(() => {
    if (selectedFile?.preview) URL.revokeObjectURL(selectedFile.preview);
    setSelectedFile(null);
  }, [selectedFile, setSelectedFile]);

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={WA_ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="p-4 border-t border-[var(--border)]">
        {hasActiveWindow ? (
          <div className="flex flex-col gap-2">
            {/* File preview */}
            {selectedFile && (
              <div className="flex items-center gap-3 p-2 bg-[var(--muted)] rounded-lg">
                {selectedFile.preview ? (
                  // Image preview thumbnail
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedFile.preview}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  // Non-image file icon
                  <div className="w-12 h-12 rounded-lg bg-[var(--background)] flex items-center justify-center flex-shrink-0">
                    <FileTypeIcon waType={selectedFile.waType} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.file.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {getWaTypeLabel(selectedFile.waType)} &middot;{' '}
                    {formatBytes(selectedFile.file.size)}
                  </p>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="p-1.5 rounded-full hover:bg-[var(--background)] text-[var(--muted-foreground)] transition-colors flex-shrink-0"
                  title="Remove file"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Toolbar — attach + template */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!!selectedFile}
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={selectedFile ? 'Remove current file to attach another' : 'Attach file'}
                aria-label="Attach file"
              >
                <FiPaperclip className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => setShowTemplatePicker(true)}
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Send template"
                aria-label="Send template"
              >
                <FiFileText className="w-[18px] h-[18px]" />
              </button>
            </div>

            {/* Input row */}
            <div className="flex items-end gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  // Drive the typing-pulse + draft emit hooks on every
                  // keystroke. Both hooks short-circuit internally when
                  // the org's feature flag is off, so this stays free
                  // when nobody's watching.
                  onTypingActivity();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendWithIndicators();
                  }
                }}
                placeholder={selectedFile ? 'Add a caption…' : 'Type a message…'}
                rows={1}
                style={{ minHeight: '40px', maxHeight: '150px', overflowY: 'hidden' }}
                className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm leading-5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-green-500 focus:outline-none"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                  target.style.overflowY = target.scrollHeight > 150 ? 'auto' : 'hidden';
                }}
              />
              {/* Send — WhatsApp green (brand cue) */}
              <button
                onClick={handleSendWithIndicators}
                disabled={(!newMessage.trim() && !selectedFile) || isSending || isUploading}
                aria-label="Send"
                className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:hover:bg-green-600 transition-colors"
              >
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiSend className="w-4 h-4 translate-x-[1px]" />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* No active window: template-only */
          <div className="text-center py-2">
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              No active conversation window. Send a template to start.
            </p>
            <button
              onClick={() => setShowTemplatePicker(true)}
              disabled={isSendingTemplate}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
            >
              {isSendingTemplate ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiFileText className="w-4 h-4" />
              )}
              Send Template
            </button>
          </div>
        )}
      </div>

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <TemplatePicker
          templates={templates || []}
          isLoading={templatesLoading}
          onSend={handleSendTemplateWithIndicators}
          onClose={() => setShowTemplatePicker(false)}
          autoSelectCallPermission={templatePickerAutoSelectCallPermission}
        />
      )}
    </>
  );
}
