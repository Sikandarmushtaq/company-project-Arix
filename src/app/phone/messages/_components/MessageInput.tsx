'use client';

import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiSend, FiPaperclip, FiPlus, FiX, FiSmile } from 'react-icons/fi';
import { useToast } from '@/lib/stores/toast';
import { formatBytes, calculateSmsSegments, sanitizeSmsText } from './utils';
import { MAX_FILE_SIZE, MAX_FILES, MAX_TOTAL_SIZE, ALLOWED_TYPES, SelectedFile } from './types';
import { EmojiPicker } from './EmojiPicker';


interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  selectedFiles: SelectedFile[];
  onFilesChange: (files: SelectedFile[]) => void;
  isSending: boolean;
  isUploading: boolean;
  placeholder?: string;
}

/**
 * Message input component with file attachment support
 */
export function MessageInput({
  value,
  onChange,
  onSend,
  selectedFiles,
  onFilesChange,
  isSending,
  isUploading,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalFileSize = useMemo(
    () => selectedFiles.reduce((acc, f) => acc + f.file.size, 0),
    [selectedFiles]
  );

  // Calculate SMS segment information
  const segmentInfo = useMemo(
    () => calculateSmsSegments(value, selectedFiles.length > 0),
    [value, selectedFiles.length]
  );

  // Calculate what segment count would be after sanitization
  const canReduce = useMemo(() => {
    if (!segmentInfo.isUnicode || !value.trim()) return false;
    const sanitized = sanitizeSmsText(value);
    const sanitizedInfo = calculateSmsSegments(sanitized, selectedFiles.length > 0);
    return sanitizedInfo.segmentCount < segmentInfo.segmentCount;
  }, [value, segmentInfo.isUnicode, segmentInfo.segmentCount, selectedFiles.length]);

  const reducedSegmentCount = useMemo(() => {
    if (!canReduce) return segmentInfo.segmentCount;
    const sanitized = sanitizeSmsText(value);
    return calculateSmsSegments(sanitized, selectedFiles.length > 0).segmentCount;
  }, [canReduce, value, segmentInfo.segmentCount, selectedFiles.length]);

  // Store original text before sanitization so user can undo
  const [originalText, setOriginalText] = useState<string | null>(null);

  const handleReduce = useCallback(() => {
    setOriginalText(value);
    onChange(sanitizeSmsText(value));
  }, [value, onChange]);

  const handleUndo = useCallback(() => {
    if (originalText !== null) {
      onChange(originalText);
      setOriginalText(null);
    }
  }, [originalText, onChange]);

  // Clear undo state when user manually edits after undo is available
  useEffect(() => {
    if (
      originalText !== null &&
      value !== sanitizeSmsText(originalText) &&
      value !== originalText
    ) {
      setOriginalText(null);
    }
  }, [value, originalText]);

  const processFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const totalFiles = selectedFiles.length + files.length;
      if (totalFiles > MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} images allowed`);
        return;
      }

      const newFilesSize = files.reduce((acc, f) => acc + f.size, 0);
      if (totalFileSize + newFilesSize > MAX_TOTAL_SIZE) {
        toast.error(`Total size exceeds 25MB limit`);
        return;
      }

      const validFiles: SelectedFile[] = [];
      const errors: string[] = [];

      for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          errors.push(`${file.name}: Invalid type`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: Max 5MB`);
          continue;
        }
        validFiles.push({ file, preview: URL.createObjectURL(file) });
      }

      if (errors.length > 0) toast.error(errors.join(', '));
      if (validFiles.length > 0) {
        onFilesChange([...selectedFiles, ...validFiles]);
      }
    },
    [selectedFiles, totalFileSize, toast, onFilesChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(Array.from(e.target.files || []));
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFiles]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const newFiles = [...selectedFiles];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      onFilesChange(newFiles);
    },
    [selectedFiles, onFilesChange]
  );

  const clearSelectedFiles = useCallback(() => {
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    onFilesChange([]);
  }, [selectedFiles, onFilesChange]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 150);
    el.style.height = `${newHeight}px`;
    // Only show scrollbar when content exceeds max height
    el.style.overflowY = el.scrollHeight > 150 ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  // ── Emoji picker ──
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiPos, setEmojiPos] = useState<{ left: number; bottom: number } | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);

  const toggleEmoji = useCallback(() => {
    if (emojiOpen) {
      setEmojiOpen(false);
      return;
    }
    const r = emojiBtnRef.current?.getBoundingClientRect();
    if (r) setEmojiPos({ left: r.left, bottom: window.innerHeight - r.top + 8 });
    setEmojiOpen(true);
  }, [emojiOpen]);

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = textareaRef.current;
      if (!el) {
        onChange(value + emoji);
      } else {
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        onChange(value.slice(0, start) + emoji + value.slice(end));
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + emoji.length;
          el.setSelectionRange(pos, pos);
        });
      }
      if (!keepOpen) setEmojiOpen(false);
    },
    [value, onChange, keepOpen]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  return (
    <div className="border-t border-[var(--border)]">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={ALLOWED_TYPES.join(',')}
        multiple
        className="hidden"
      />

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="p-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">
              {selectedFiles.length}/{MAX_FILES} images • {formatBytes(totalFileSize)}
            </span>
            <button
              type="button"
              onClick={clearSelectedFiles}
              className="text-xs text-[var(--danger)] hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedFiles.map((file, index) => (
              <div key={`${file.file.name}-${index}`} className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL previews require native img */}
                <img
                  src={file.preview}
                  alt={`Selected ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-[var(--danger)] text-white"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </div>
            ))}
            {selectedFiles.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]"
              >
                <FiPlus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Segment counter + reduce/undo controls */}
      {value.trim().length > 0 && !selectedFiles.length && (
        <div className="flex items-center justify-end gap-2 px-4 pt-1.5">
          <span
            className={`text-[11px] ${segmentInfo.segmentCount > 1 ? 'text-amber-500 font-medium' : 'text-[var(--muted-foreground)]'}`}
          >
            {segmentInfo.segmentCount} segment{segmentInfo.segmentCount !== 1 ? 's' : ''} ·{' '}
            {segmentInfo.effectiveLength} chars
          </span>
          {canReduce && originalText === null && (
            <button
              type="button"
              onClick={handleReduce}
              className="text-[11px] font-medium text-[var(--foreground)] hover:text-[var(--foreground)] hover:underline"
            >
              Reduce to {reducedSegmentCount} segment{reducedSegmentCount !== 1 ? 's' : ''}
            </button>
          )}
          {originalText !== null && (
            <button
              type="button"
              onClick={handleUndo}
              className="text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Toolbar — attach + emoji (RingCentral) */}
      <div className="flex items-center gap-0.5 px-3 pt-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isUploading || selectedFiles.length >= MAX_FILES}
            title="Attach image"
            aria-label="Attach image"
            className="w-9 h-9 grid place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
          >
            <FiPaperclip className="w-[18px] h-[18px]" />
          </button>
          {selectedFiles.length > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-[var(--primary-600)] text-white rounded-full">
              {selectedFiles.length}
            </span>
          )}
        </div>
        <button
          ref={emojiBtnRef}
          type="button"
          onClick={toggleEmoji}
          title="Emoji"
          aria-label="Emoji"
          aria-haspopup="dialog"
          aria-expanded={emojiOpen}
          className={`w-9 h-9 grid place-items-center rounded-full transition-colors ${emojiOpen ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'}`}
        >
          <FiSmile className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Input row */}
      <div className="px-3 pb-1 flex gap-2 items-end">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            placeholder={selectedFiles.length > 0 ? 'Caption (optional)...' : placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || isUploading}
            rows={1}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm leading-5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] disabled:opacity-50"
            style={{ minHeight: '40px', overflowY: 'hidden' }}
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={(!value.trim() && selectedFiles.length === 0) || isSending || isUploading}
          aria-label="Send"
          className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)] transition-colors disabled:opacity-40 disabled:hover:bg-[var(--primary-600)]"
        >
          {isUploading || isSending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FiSend className="w-4 h-4 translate-x-[1px]" />
          )}
        </button>
      </div>

      {/* Emoji picker (portal, opens upward from the emoji button) */}
      {emojiOpen &&
        emojiPos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setEmojiOpen(false)} />
            <div style={{ position: 'fixed', left: emojiPos.left, bottom: emojiPos.bottom }} className="z-[61]">
              <EmojiPicker onPick={insertEmoji} keepOpen={keepOpen} onKeepOpenChange={setKeepOpen} />
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export default MessageInput;
