'use client';

import { useState, useCallback, useRef } from 'react';
import { useSendMessage } from '@/lib/hooks';
import { mediaService } from '@/lib/api';
import { useToast } from '@/lib/stores/toast';
import { ALLOWED_TYPES, MAX_FILE_SIZE, MAX_TOTAL_SIZE, SelectedFile } from '../types';

interface UseSendMessageStateOptions {
  effectivePhone: string | null;
  /** Override the "from" phone for sending (isolated selector). Falls back to global active phone if not set. */
  sendFromPhone?: string;
  onMessageSent?: () => void;
}

export interface UseSendMessageStateReturn {
  // Message input
  newMessage: string;
  setNewMessage: (value: string) => void;

  // File handling
  selectedFiles: SelectedFile[];
  setSelectedFiles: (files: SelectedFile[]) => void;
  isUploading: boolean;

  // Drag and drop
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;

  // Send
  handleSend: () => Promise<void>;
  isSending: boolean;
}

/**
 * Hook for managing message sending state
 * Handles text input, file uploads, and drag-drop
 */
export function useSendMessageState({
  effectivePhone,
  sendFromPhone,
  onMessageSent,
}: UseSendMessageStateOptions): UseSendMessageStateReturn {
  const toast = useToast();
  const sendMessage = useSendMessage();

  // State
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Send handler
  const handleSend = useCallback(async () => {
    const hasText = newMessage.trim().length > 0;
    const hasFiles = selectedFiles.length > 0;

    if ((!hasText && !hasFiles) || !effectivePhone || sendMessage.isPending || isUploading) {
      return;
    }

    try {
      let mediaUrls: string[] = [];

      // Upload files if any
      if (hasFiles) {
        setIsUploading(true);
        try {
          const files = selectedFiles.map((f) => f.file);
          const uploadResult = await mediaService.upload(files);
          mediaUrls = uploadResult.urls;
        } catch (uploadErr) {
          toast.error(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload images');
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }

      // Clear input immediately for responsive feel
      const messageText = newMessage.trim();
      const filesToClean = [...selectedFiles];
      setNewMessage('');
      setSelectedFiles([]);

      // Send message — fire-and-forget, scroll on success
      sendMessage.mutate(
        {
          to: effectivePhone,
          body: messageText,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          from: sendFromPhone || undefined,
        },
        {
          onError: (err) => {
            setNewMessage(messageText);
            setSelectedFiles(filesToClean);
            toast.error(err instanceof Error ? err.message : 'Failed to send message');
          },
          onSuccess: () => {
            filesToClean.forEach((f) => URL.revokeObjectURL(f.preview));
            // Scroll to bottom after real message is added to cache
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
    effectivePhone,
    sendFromPhone,
    sendMessage,
    toast,
    selectedFiles,
    isUploading,
    onMessageSent,
  ]);

  // Drag handlers
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

      const files = Array.from(e.dataTransfer.files).filter((f) => ALLOWED_TYPES.includes(f.type));

      if (files.length === 0) {
        toast.error('No valid images found');
        return;
      }

      // Validate individual file sizes and total size
      const errors: string[] = [];
      const validFiles: SelectedFile[] = [];
      const currentTotalSize = selectedFiles.reduce((acc, f) => acc + f.file.size, 0);
      let addedSize = 0;

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: exceeds 5MB limit`);
          continue;
        }
        if (currentTotalSize + addedSize + file.size > MAX_TOTAL_SIZE) {
          errors.push(`${file.name}: would exceed 25MB total limit`);
          continue;
        }
        addedSize += file.size;
        validFiles.push({ file, preview: URL.createObjectURL(file) });
      }

      if (errors.length > 0) toast.error(errors.join(', '));
      if (validFiles.length === 0) return;

      setSelectedFiles((prev) => [...prev, ...validFiles].slice(0, 10));
    },
    [toast]
  );

  return {
    // Message input
    newMessage,
    setNewMessage,

    // File handling
    selectedFiles,
    setSelectedFiles,
    isUploading,

    // Drag and drop
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,

    // Send
    handleSend,
    isSending: sendMessage.isPending,
  };
}
