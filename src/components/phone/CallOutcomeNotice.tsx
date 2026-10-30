'use client';

/**
 * CallOutcomeNotice
 *
 * Inline notice for the professional outcome of an outbound call that failed
 * before it was answered — e.g. dialing a dead number surfaces "Not in Service"
 * floating in the free space just ABOVE the call button (absolute overlay, so it
 * never grows the dialpad's layout or forces a scroll).
 *
 * Deliberately NOT a corner toast: the global ToastContainer lives at the
 * screen's bottom-right and serves the whole app; a call outcome belongs beside
 * the dial button where the agent is already looking.
 *
 * This component is a PURE reflection of `lastCallOutcome` in the SIP store. The
 * store owns the whole lifecycle — it sets the outcome on the engine's
 * `callOutcome` event, auto-expires it after a few seconds, and clears it the
 * moment a new call starts or a call is answered. Keeping zero local "shown/
 * dismissed" state is deliberate: this component unmounts while a call is active
 * (the dialpad is replaced by the in-call UI) and remounts afterwards, so any
 * local dismissal would reset and resurface a stale label on a call that
 * actually connected. Reflecting the store means remounting always shows the
 * correct current truth.
 *
 * @module components/phone/CallOutcomeNotice
 */

import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiX } from 'react-icons/fi';
import { useSipStore } from '@/lib/stores/sip';

export function CallOutcomeNotice() {
  const outcome = useSipStore((s) => s.lastCallOutcome);
  const clearCallOutcome = useSipStore((s) => s.clearCallOutcome);

  return (
    <AnimatePresence>
      {outcome && (
        <motion.div
          key={outcome.nonce}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-x-0 bottom-full mb-2 z-20 flex justify-center px-2"
          role="status"
          aria-live="polite"
        >
          <div
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium shadow-md backdrop-blur-sm
              border-amber-200 bg-amber-50/95 text-amber-800
              dark:border-amber-800/60 dark:bg-amber-900/40 dark:text-amber-200"
          >
            <FiAlertCircle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
            <span>{outcome.message}</span>
            <button
              type="button"
              onClick={clearCallOutcome}
              className="ml-0.5 shrink-0 rounded-full p-0.5 text-amber-500 transition-colors hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
              aria-label="Dismiss"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
