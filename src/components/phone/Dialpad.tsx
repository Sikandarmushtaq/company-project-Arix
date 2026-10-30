'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { FiPhone, FiZap, FiDelete, FiClipboard } from 'react-icons/fi';
import { callAudioService } from '@/lib/sip';
import { useSpeedDial } from '@/lib/hooks';
import { toE164, formatPhoneUS } from '@/lib/utils/phone';
import {
  formatInternational,
  isPossibleNumber,
  detectCountry,
  countryFlag,
  type CountryCode,
} from '@/lib/utils/phone-format';
import { PhoneSelector } from './PhoneSelector';
import { CallOutcomeNotice } from './CallOutcomeNotice';

const dialPadKeys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const keySubLabels: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
  '0': '+',
};

interface DialpadProps {
  phoneNumber: string;
  isRegistered: boolean;
  isInCall: boolean;
  collapsed?: boolean;
  isCallBusy?: boolean;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onCall: () => void;
  onNumberChange: (value: string) => void;
  onSpeedDial?: (phoneNumber: string) => void;
  dialCountry: CountryCode;
  /** Last successfully dialed number — enables double-click redial when empty. */
  lastDialedNumber?: string;
  onRecallLast?: () => void;
}

/** Smooth easing for all animations */
const smoothEase = [0.22, 1, 0.36, 1] as const;

/**
 * Extract a dialable phone number from arbitrary clipboard text, or null. Accepts
 * an optional leading "+", 7–15 digits, and common separators; rejects anything
 * with letters (so pasted text/emails don't masquerade as a number).
 */
function phoneFromClipboard(text: string): string | null {
  const trimmed = (text || '').trim();
  if (!trimmed || /[a-zA-Z]/.test(trimmed)) return null;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Dialpad — new UI (RingCentral-style: round keys, digit + letters, single
 * round Call button). All behavior is unchanged: DTMF, long-press speed dial,
 * keyboard dialing, ripple, E.164 preview/validity, redial-on-double-click.
 */
export function Dialpad({
  phoneNumber,
  isRegistered,
  isInCall,
  collapsed = false,
  isCallBusy = false,
  onKeyPress,
  onBackspace,
  onCall,
  onNumberChange,
  onSpeedDial,
  dialCountry,
  lastDialedNumber,
  onRecallLast,
}: DialpadProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const longPressKeyRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Touch devices fire BOTH the touch events AND emulated mouse events (mousedown/
  // mouseup/click) for a single tap. Without de-duping, a tap enters the digit
  // twice ("2" -> "22"). lastTouchRef gates the mouse handlers after a touch;
  // lastPointerEndRef gates the trailing emulated/real click after a pointer tap
  // (so click only inputs for genuine keyboard/screen-reader activation).
  const lastTouchRef = useRef(0);
  const lastPointerEndRef = useRef(0);
  const POINTER_GUARD_MS = 700;
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; key: string }>>(
    []
  );
  const rippleIdRef = useRef(0);

  // Hover-to-paste: when the field is empty and the clipboard holds a phone
  // number, hovering the dialpad surfaces a "click to paste" chip. We only READ
  // the clipboard when the permission is already granted, so hovering never
  // triggers a permission prompt; where it's blocked, the chip simply won't show.
  const [pasteNum, setPasteNum] = useState<string | null>(null);
  const hoveringRef = useRef(false);
  const detectClipboard = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
    try {
      // On hover there's no user gesture, so a browser that hasn't been granted
      // clipboard-read rejects this silently (no prompt) — we just show no chip.
      // Once the permission is granted it resolves and the chip appears.
      const num = phoneFromClipboard(await navigator.clipboard.readText());
      // The async read can resolve AFTER the mouse has left; only surface the
      // chip if we're still hovering, so it never appears when not hovered.
      if (hoveringRef.current) setPasteNum(num);
    } catch {
      /* clipboard blocked / not granted — no chip, no prompt */
    }
  }, []);

  const { data: speedDialEntries } = useSpeedDial();

  const getSpeedDialEntry = useCallback(
    (position: number) => speedDialEntries?.find((e) => e.position === position),
    [speedDialEntries]
  );

  // Ripple effect on button press
  const addRipple = useCallback((key: string, e: React.MouseEvent | React.TouchEvent) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const id = rippleIdRef.current++;
    setRipples((prev) => [...prev, { id, x: clientX - rect.left, y: clientY - rect.top, key }]);
  }, []);

  const removeRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleKeyPress = useCallback(
    (key: string) => {
      callAudioService.playDTMF(key);
      onKeyPress(key);
    },
    [onKeyPress]
  );

  const handleLongPressStart = useCallback(
    (key: string) => {
      isLongPressRef.current = false;
      longPressKeyRef.current = key;

      if (key === '0') {
        longPressTimerRef.current = setTimeout(() => {
          isLongPressRef.current = true;
          callAudioService.playDTMF('0');
          onKeyPress('+');
        }, 500);
      } else if (/^[1-9]$/.test(key) && !isInCall) {
        const position = parseInt(key);
        const entry = getSpeedDialEntry(position);
        if (entry && onSpeedDial) {
          longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            callAudioService.playDTMF(key);
            onSpeedDial(entry.phoneNumber);
          }, 500);
        }
      }
    },
    [onKeyPress, isInCall, getSpeedDialEntry, onSpeedDial]
  );

  const handleLongPressEnd = useCallback(
    (key: string) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // A short press (not a long-press) inputs the key. Handles every key —
      // digits, 0, * and # — so a single tap-end is the ONE input path per press.
      if (!isLongPressRef.current && longPressKeyRef.current === key) {
        handleKeyPress(key);
      }
      isLongPressRef.current = false;
      longPressKeyRef.current = null;
    },
    [handleKeyPress]
  );

  // Keyboard support
  useEffect(() => {
    const isEnabled = isRegistered || isInCall;
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inPhoneInput =
        target.tagName === 'INPUT' && target.classList.contains('phone-number-input');
      const inOtherField =
        (target.tagName === 'INPUT' && !inPhoneInput) || target.tagName === 'TEXTAREA';

      // Enter dials — from the number field, or when focus isn't in any text field.
      if (
        e.key === 'Enter' &&
        !isInCall &&
        !isCallBusy &&
        phoneNumber.length > 0 &&
        isRegistered &&
        (inPhoneInput || !inOtherField)
      ) {
        e.preventDefault();
        onCall();
        return;
      }

      // Editing directly in the number field → let the browser handle typing,
      // caret placement, text selection, copy/paste, and backspace-at-cursor.
      if (inPhoneInput || inOtherField) return;

      // Focus elsewhere → keep the "type anywhere to dial" convenience (with DTMF).
      if (/^[0-9*#]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === '+') {
        e.preventDefault();
        callAudioService.playDTMF('0');
        onKeyPress('+');
      } else if (e.key === 'Backspace' && !isInCall) {
        e.preventDefault();
        onBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isRegistered,
    isInCall,
    phoneNumber,
    handleKeyPress,
    onBackspace,
    onCall,
    onKeyPress,
    isCallBusy,
  ]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Preview (flag + E.164) is WYSIWYG — the ACTUAL dial target (same as
  // handleCall), so a number carrying a country code (leading 1 / +) shows
  // where it truly routes. Validity (✓ / ⚠), however, checks the RAW input
  // against the SELECTED country, so picking a country and typing a number
  // that isn't valid there warns — a useful "does this match?" signal.
  // Feature/short codes (*67 …) are passed through and never flagged.
  const hasNumber = phoneNumber.length > 0;
  const isSpecial = /[*#]/.test(phoneNumber);
  const dialE164 = hasNumber && !isSpecial ? toE164(phoneNumber, dialCountry) : '';
  const e164Preview = dialE164 ? formatInternational(dialE164) : '';
  const previewFlag = dialE164 ? countryFlag(detectCountry(dialE164, dialCountry)) : '';
  const isDialable =
    hasNumber && !isSpecial ? isPossibleNumber(phoneNumber, dialCountry) : hasNumber;
  const isReady = hasNumber && isRegistered && !isCallBusy;
  // When the field is empty, the call button becomes Redial: double-click it to
  // bring back the last dialed number (then click Call to dial it).
  const canRecall =
    !hasNumber && !!lastDialedNumber && isRegistered && !isCallBusy && !isInCall;

  if (collapsed) return null;

  return (
    <div
      className="nx-dialpad relative flex flex-col h-full mx-auto w-full max-w-[320px]"
      onMouseEnter={() => {
        hoveringRef.current = true;
        if (!phoneNumber) detectClipboard();
      }}
      onMouseLeave={() => {
        hoveringRef.current = false;
        setPasteNum(null);
      }}
    >
      {/* My caller ID — number the call goes out from (RingCentral-style). Shows
          the number (or "No number assigned"), a dropdown when there are several.
          Moved here off the top bar. */}
      <div className="mb-2 flex justify-center">
        <PhoneSelector variant="inline" />
      </div>

      {/* Hover-to-paste: shown while the field is empty and the clipboard holds a
          phone number (permission permitting). Click to drop it into the field. */}
      {pasteNum && !phoneNumber && (
        <div className="mb-1.5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              onNumberChange(pasteNum);
              setPasteNum(null);
            }}
            title="Paste the number from your clipboard"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-600)]/10 px-3 py-1 text-xs font-medium text-[var(--primary-700)] transition-colors hover:bg-[var(--primary-600)]/20 dark:text-[var(--primary-300)]"
          >
            <FiClipboard className="h-3.5 w-3.5" />
            Click to paste {formatPhoneUS(pasteNum)}
          </button>
        </div>
      )}
      {/* Phone number — real input: selectable, copyable, click to place caret */}
      <div className="text-center mb-1.5 min-h-[52px] flex flex-col justify-center">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            inputMode="tel"
            autoComplete="off"
            value={phoneNumber}
            onChange={(e) => onNumberChange(e.target.value.replace(/[^\d*#+]/g, ''))}
            disabled={!isRegistered && !isInCall}
            placeholder={isRegistered ? 'Enter a name or number' : 'Not connected'}
            className="phone-number-input w-full bg-transparent text-center text-[26px] font-normal tracking-wide text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] placeholder:text-[20px] outline-none border-0 border-b border-[var(--border)] focus:border-[var(--border)] transition-colors pb-2 disabled:cursor-not-allowed selection:bg-[var(--primary-500)]/25"
            aria-label="Phone number"
          />
        </div>
      </div>

      {/* E.164 preview + validity — exactly what will be dialed */}
      <div className="text-center mb-3 min-h-[18px]">
        {e164Preview && (
          <span className="text-[13px] tracking-wide inline-flex items-center gap-2">
            <span className="text-[var(--muted-foreground)]">
              {previewFlag} {e164Preview}
            </span>
            <span
              title={
                isDialable
                  ? 'Valid number for the selected country'
                  : "Doesn't match the selected country — check the number or switch the flag"
              }
              className={
                isDialable
                  ? 'text-green-600 dark:text-green-500'
                  : 'text-amber-600 dark:text-amber-500'
              }
            >
              {isDialable ? '✓' : '⚠'}
            </span>
          </span>
        )}
      </div>

      {/* Dialpad grid — round keys, large digit + letters */}
      <div
        className="grid grid-cols-3 justify-items-center gap-x-6 gap-y-1.5 mb-3"
        role="group"
        aria-label="Dialpad"
      >
        {dialPadKeys.flat().map((key, index) => {
          const isSpeedDialKey = /^[1-9]$/.test(key);
          const speedDialEntry = isSpeedDialKey ? getSpeedDialEntry(parseInt(key)) : null;
          const hasSpeedDial = !isInCall && speedDialEntry !== null && speedDialEntry !== undefined;

          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.02, ease: smoothEase }}
              whileTap={{ scale: 0.9, transition: { duration: 0.08 } }}
              onClick={() => {
                // Keyboard / screen-reader activation only. Pointer taps already
                // input on mouseup/touchend; skip the trailing click they emit.
                if (Date.now() - lastPointerEndRef.current < POINTER_GUARD_MS) return;
                handleKeyPress(key);
              }}
              onMouseDown={(e) => {
                // Ignore the emulated mousedown a touch device fires after a tap.
                if (Date.now() - lastTouchRef.current < POINTER_GUARD_MS) return;
                addRipple(key, e);
                handleLongPressStart(key);
              }}
              onMouseUp={() => {
                if (Date.now() - lastTouchRef.current < POINTER_GUARD_MS) return;
                lastPointerEndRef.current = Date.now();
                handleLongPressEnd(key);
              }}
              onMouseLeave={() => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              }}
              onTouchStart={(e) => {
                lastTouchRef.current = Date.now();
                addRipple(key, e);
                handleLongPressStart(key);
              }}
              onTouchEnd={() => {
                lastTouchRef.current = Date.now();
                lastPointerEndRef.current = Date.now();
                handleLongPressEnd(key);
              }}
              disabled={!isRegistered && !isInCall}
              className="relative h-[62px] w-[62px] rounded-full flex flex-col items-center justify-center overflow-hidden text-[var(--foreground)] bg-transparent hover:bg-[var(--muted)] active:bg-[var(--border)] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={`Dial ${key}${
                hasSpeedDial
                  ? `, hold to speed dial ${speedDialEntry?.name || speedDialEntry?.phoneNumber}`
                  : keySubLabels[key]
                    ? `, ${key === '0' ? 'hold for plus' : keySubLabels[key]}`
                    : ''
              }`}
            >
              {/* Ripple from touch point */}
              {ripples
                .filter((r) => r.key === key)
                .map((ripple) => (
                  <motion.span
                    key={ripple.id}
                    className="absolute rounded-full bg-[var(--primary-500)]/15 pointer-events-none"
                    style={{ left: ripple.x - 5, top: ripple.y - 5, width: 10, height: 10 }}
                    initial={{ scale: 0, opacity: 0.5 }}
                    animate={{ scale: 9, opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    onAnimationComplete={() => removeRipple(ripple.id)}
                  />
                ))}

              {hasSpeedDial && (
                <FiZap className="absolute top-2 right-2.5 w-2.5 h-2.5 text-[var(--primary-500)]" />
              )}

              <span className="text-[27px] leading-none font-normal relative z-10">{key}</span>
              {hasSpeedDial ? (
                <span className="text-[9px] text-[var(--foreground)] font-semibold truncate max-w-full px-1 mt-0.5 relative z-10">
                  {speedDialEntry?.name?.slice(0, 8) || speedDialEntry?.phoneNumber?.slice(-4)}
                </span>
              ) : keySubLabels[key] ? (
                <span className="text-[9px] text-[var(--muted-foreground)] font-medium tracking-[0.14em] mt-0.5 relative z-10 h-[11px]">
                  {keySubLabels[key]}
                </span>
              ) : (
                <span className="h-[11px] mt-0.5" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Call row · backspace — sits a comfortable gap below the dialpad (grouped
          with it) rather than pinned to the very bottom of the tall panel. */}
      {!isInCall && (
        <div className="relative mt-7">
          {/* Call outcome (e.g. "Not in Service") floats in the free space just
              ABOVE the call button — out of the flow, so it never grows the
              layout or forces a scroll, and it lands right where the agent looks. */}
          <CallOutcomeNotice />
          <motion.div
          className="flex items-center justify-between gap-4 pb-1"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.32, ease: smoothEase }}
        >
          {/* left: spacer to keep Call centered */}
          <div className="w-16 flex justify-start">
            <span className="w-11 h-11" aria-hidden />
          </div>

          {/* Call — greyed when empty; when empty, a single click brings back the
              last dialed number (then click again to call it). */}
          <motion.button
            whileHover={isReady ? { scale: 1.04, y: -1 } : {}}
            whileTap={isReady ? { scale: 0.95 } : {}}
            onClick={() => {
              if (isReady) onCall();
              else if (canRecall) onRecallLast?.();
            }}
            disabled={!isReady && !canRecall}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
              isReady
                ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/40 text-white'
                : `bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ${canRecall ? 'cursor-pointer' : 'cursor-not-allowed'}`
            }`}
            aria-label={canRecall ? 'Enter the last dialed number' : `Call ${phoneNumber}`}
            title={canRecall ? 'Enter the last dialed number' : undefined}
          >
            <FiPhone className="w-6 h-6" />
          </motion.button>

          {/* right: Backspace — hidden (but space kept) when empty */}
          <div className="w-16 flex justify-end">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBackspace}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors ${
                phoneNumber.length === 0 ? 'invisible pointer-events-none' : ''
              }`}
              aria-label="Delete last digit"
            >
              <FiDelete className="w-5 h-5" />
            </motion.button>
          </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
