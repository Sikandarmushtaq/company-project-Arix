'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FiSmile } from 'react-icons/fi';

// ============================================================================
// Constants
// ============================================================================

/** WhatsApp quick reaction emojis (matches WhatsApp's default set) */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ============================================================================
// Types
// ============================================================================

interface ReactionPickerProps {
  /** Currently applied reaction (null if none) */
  currentReaction: string | null;
  /** Whether this is an outbound message (affects alignment) */
  isOutbound: boolean;
  /** Callback when user selects a reaction */
  onReact: (emoji: string) => void;
  /** Callback when user removes their reaction */
  onRemoveReaction: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * WhatsApp-style reaction picker.
 * Shows a smiley button that opens a quick-pick bar of 6 emojis.
 * Clicking an already-applied reaction removes it.
 */
export const ReactionPicker = React.memo(function ReactionPicker({
  currentReaction,
  isOutbound,
  onReact,
  onRemoveReaction,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = useCallback(
    (emoji: string) => {
      if (emoji === currentReaction) {
        onRemoveReaction();
      } else {
        onReact(emoji);
      }
      setIsOpen(false);
    },
    [currentReaction, onReact, onRemoveReaction]
  );

  return (
    <div ref={pickerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-[var(--muted)] text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
        title="React"
        aria-label="Add reaction"
      >
        <FiSmile className="w-3.5 h-3.5" />
      </button>

      {/* Emoji picker popup */}
      {isOpen && (
        <div
          className={`absolute bottom-full mb-1 z-30 flex items-center gap-0.5 px-2 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-full shadow-lg ${
            isOutbound ? 'right-0' : 'left-0'
          }`}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className={`w-8 h-8 flex items-center justify-center rounded-full text-lg hover:bg-[var(--muted)] transition-colors ${
                emoji === currentReaction ? 'bg-green-500/20 ring-1 ring-green-500' : ''
              }`}
              title={emoji === currentReaction ? 'Remove reaction' : emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
