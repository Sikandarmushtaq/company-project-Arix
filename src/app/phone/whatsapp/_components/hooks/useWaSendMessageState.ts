'use client';

import { useState, useCallback, useRef } from 'react';
import { useWaSendMessage, useWaSendTemplate, useWaConversationWindow } from '@/lib/hooks';
import { whatsappService as whatsappApi } from '@/lib/api';
import { useToast } from '@/lib/stores/toast';
import { WA_ALLOWED_TYPES } from '../types';
import { getWaTypeFromMime, getMaxSizeForMime, formatBytes } from '../utils';
import type { WaTemplate } from '@/lib/api/services/whatsapp-types';
import type { WaSelectedFile } from '../types';

// ============================================================================
// Types
// ============================================================================

interface UseWaSendMessageStateOptions {
  /** Phone number of the selected conversation */
  selectedPhone: string | null;
  /** Callback after successful send */
  onMessageSent?: () => void;
}

export interface UseWaSendMessageStateReturn {
  /** Message text input */
  newMessage: string;
  /** Set message text */
  setNewMessage: (value: string) => void;
  /** Send text/media message handler */
  handleSend: () => Promise<void>;
  /** Whether a send is in progress */
  isSending: boolean;
  /** Whether the 24h conversation window is active */
  hasActiveWindow: boolean;
  /** Whether the window check is loading */
  isWindowLoading: boolean;
  /** Whether template picker is visible */
  showTemplatePicker: boolean;
  /** Set template picker visibility */
  setShowTemplatePicker: (show: boolean) => void;
  /** Send template handler */
  handleSendTemplate: (template: WaTemplate, components: Record<string, unknown>[]) => void;
  /** Whether template send is in progress */
  isSendingTemplate: boolean;
  /** Selected file for media message (one per WA message) */
  selectedFile: WaSelectedFile | null;
  /** Set selected file */
  setSelectedFile: (file: WaSelectedFile | null) => void;
  /** Whether file is uploading */
  isUploading: boolean;
  /** Whether drag-drop overlay is active */
  isDragging: boolean;
  /** Drag enter handler */
  handleDragEnter: (e: React.DragEvent) => void;
  /** Drag leave handler */
  handleDragLeave: (e: React.DragEvent) => void;
  /** Drag over handler */
  handleDragOver: (e: React.DragEvent) => void;
  /** Drop handler */
  handleDrop: (e: React.DragEvent) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing WhatsApp message sending state.
 * Handles text, media (drag-drop + file picker), and template messages.
 *
 * CRITICAL: If no active 24h window, the user MUST send a template first.
 * The template opens a new window, enabling free-form text/media messages.
 *
 * WhatsApp Cloud API sends one media per message. Multiple files require
 * multiple messages — this hook handles one file at a time.
 */
export function useWaSendMessageState({
  selectedPhone,
  onMessageSent,
}: UseWaSendMessageStateOptions): UseWaSendMessageStateReturn {
  const toast = useToast();
  const sendMessage = useWaSendMessage();
  const sendTemplate = useWaSendTemplate();

  // State
  const [newMessage, setNewMessage] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<WaSelectedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Check 24h conversation window
  const { data: currentWindow, isLoading: isWindowLoading } =
    useWaConversationWindow(selectedPhone);
  const hasActiveWindow = !!currentWindow;

  // Send text or media message handler (only works with active window)
  const handleSend = useCallback(async () => {
    const hasText = newMessage.trim().length > 0;
    const hasFile = !!selectedFile;

    if ((!hasText && !hasFile) || !selectedPhone || !hasActiveWindow) return;
    if (sendMessage.isPending || isUploading) return;

    try {
      let mediaId: string | undefined;
      let mediaUrl: string | undefined;
      let mediaFilename: string | undefined;

      // Upload file if attached. The backend runs the file through Meta's
      // resumable upload endpoint and returns both a media_id (canonical
      // send reference per Meta's docs) and a local URL we use for the
      // outbound bubble preview.
      if (hasFile) {
        setIsUploading(true);
        try {
          const uploaded = await whatsappApi.uploadMedia(selectedFile.file);
          mediaId = uploaded.mediaId;
          mediaUrl = uploaded.mediaUrl;
          mediaFilename = selectedFile.file.name;
        } catch (uploadErr) {
          toast.error(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload file');
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }

      // Clear input immediately for responsive feel
      const messageText = newMessage.trim();
      const fileToClean = selectedFile;
      setNewMessage('');
      setSelectedFile(null);

      sendMessage.mutate(
        {
          to: selectedPhone,
          type: hasFile ? selectedFile!.waType : 'text',
          body: hasFile ? messageText || undefined : messageText, // caption for media
          mediaId,
          mediaUrl,
          mediaFilename,
        },
        {
          onError: (err) => {
            // Restore on error
            setNewMessage(messageText);
            setSelectedFile(fileToClean);
            toast.error(err instanceof Error ? err.message : 'Failed to send message');
          },
          onSuccess: () => {
            // Revoke preview URL
            if (fileToClean?.preview) URL.revokeObjectURL(fileToClean.preview);
            requestAnimationFrame(() => {
              onMessageSent?.();
            });
          },
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [
    newMessage,
    selectedPhone,
    hasActiveWindow,
    sendMessage,
    toast,
    selectedFile,
    isUploading,
    onMessageSent,
  ]);

  // Send template handler (works without active window)
  const handleSendTemplate = useCallback(
    (template: WaTemplate, components: Record<string, unknown>[]) => {
      if (!selectedPhone) return;

      // Persist the rendered template text as the message body so the chat
      // bubble shows real content (not a blank/"Template: name" placeholder).
      // Take the template's BODY text and fill {{n}} from the body params.
      const bodyComp = template.components?.find(
        (c) => (c as Record<string, unknown>).type === 'BODY'
      ) as Record<string, unknown> | undefined;
      let renderedBody = (bodyComp?.text as string) || '';
      const bodyParams = (
        components.find((c) => (c as Record<string, unknown>).type === 'body') as
          | { parameters?: Array<{ text?: string }> }
          | undefined
      )?.parameters;
      if (bodyParams?.length) {
        renderedBody = renderedBody.replace(
          /\{\{(\d+)\}\}/g,
          (_m, n) => bodyParams[Number(n) - 1]?.text ?? `{{${n}}}`
        );
      }

      sendTemplate.mutate(
        {
          to: selectedPhone,
          type: 'template',
          templateName: template.name,
          templateLanguage: template.language,
          templateComponents: components.length > 0 ? components : undefined,
          body: renderedBody || undefined,
        },
        {
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to send template');
          },
          onSuccess: () => {
            setShowTemplatePicker(false);
            requestAnimationFrame(() => {
              onMessageSent?.();
            });
          },
        }
      );
    },
    [selectedPhone, sendTemplate, toast, onMessageSent]
  );

  // ========================================================================
  // Drag-drop handlers (counter pattern prevents false leaves on nested elems)
  // ========================================================================

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (!hasActiveWindow) {
        toast.error('Send a template first to open a conversation window');
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      const file = files[0]; // WhatsApp: one media per message
      if (!file) return;

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

      if (files.length > 1) {
        toast.info('WhatsApp sends one file per message. Only the first file was attached.');
      }
    },
    [hasActiveWindow, selectedFile, toast]
  );

  return {
    newMessage,
    setNewMessage,
    handleSend,
    isSending: sendMessage.isPending,
    hasActiveWindow,
    isWindowLoading,
    showTemplatePicker,
    setShowTemplatePicker,
    handleSendTemplate,
    isSendingTemplate: sendTemplate.isPending,
    selectedFile,
    setSelectedFile,
    isUploading,
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
