'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiPhoneIncoming, FiPhoneOff, FiPhone, FiLoader, FiUser } from 'react-icons/fi';
import { useContactDisplayName, useContactName } from '@/lib/hooks';
import { useAuthStore } from '@/lib/stores';
import { getDisplayPhone } from '@/lib/utils/privacy';

interface IncomingCallInfo {
  lineId: number;
  callerNumber: string;
  callerName?: string;
}

interface IncomingCallModalProps {
  incomingCall: IncomingCallInfo;
  onAnswer: () => void;
  onReject: () => void;
  isAnswering?: boolean;
}

/** Get initials from a display name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Incoming Call Modal — Premium full-screen iOS/Android-inspired design
 */
export function IncomingCallModal({
  incomingCall,
  onAnswer,
  onReject,
  isAnswering = false,
}: IncomingCallModalProps) {
  const displayName = useContactDisplayName(incomingCall.callerNumber, incomingCall.callerName);
  // Real-contact detection. The old check `displayName !== callerNumber`
  // was broken in privacy mode: when waPhoneMaskEnabled is on with no
  // saved contact, displayName is the "Customer ••••1997" stub which is
  // never equal to the raw callerNumber, so the check falsely returned
  // true and the secondary line below leaked the raw phone. Check the
  // contact lookup + SIP callerName directly instead.
  const savedContactName = useContactName(incomingCall.callerNumber);
  const hasContactName = !!(savedContactName || incomingCall.callerName);
  const isMasked = useAuthStore((s) => !!s.user?.waPhoneMaskEnabled);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-green-600/20 via-transparent to-emerald-600/20"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Subtle radial glow behind avatar */}
        <motion.div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-green-500/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center pt-16 sm:pt-24">
        {/* "Incoming Call" label */}
        <motion.div
          className="flex items-center gap-2 mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            animate={{ rotate: [0, 12, -12, 8, -8, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
          >
            <FiPhoneIncoming className="w-5 h-5 text-green-400" />
          </motion.div>
          <span
            id="incoming-call-title"
            className="text-sm font-medium tracking-widest uppercase text-green-400"
          >
            Incoming Call
          </span>
        </motion.div>

        {/* Avatar with pulse rings */}
        <div className="relative w-32 h-32 mb-8">
          {/* Expanding rings */}
          {[0, 0.7, 1.4].map((delay) => (
            <motion.div
              key={delay}
              className="absolute inset-0 rounded-full border border-green-400/20"
              animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay }}
            />
          ))}

          {/* Avatar circle */}
          <motion.div
            className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/30 ring-2 ring-green-400/30"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {hasContactName ? (
              <span className="text-4xl font-bold text-white select-none">{initials}</span>
            ) : (
              <FiUser className="w-14 h-14 text-white/90" />
            )}
          </motion.div>
        </div>

        {/* Caller info */}
        <motion.h2
          className="text-3xl font-bold text-white mb-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {displayName}
        </motion.h2>

        {hasContactName && (
          <motion.p
            className="text-base text-white/60 font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {getDisplayPhone(incomingCall.callerNumber, isMasked)}
          </motion.p>
        )}
      </div>

      {/* Action buttons at bottom */}
      <motion.div
        className="relative z-10 flex items-center justify-center gap-16 pb-16 sm:pb-24"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 25 }}
      >
        {/* Reject */}
        <div className="flex flex-col items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onReject}
            disabled={isAnswering}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 hover:bg-red-600 transition-colors disabled:opacity-50"
            aria-label="Reject call"
          >
            <FiPhoneOff className="w-7 h-7 text-white" />
          </motion.button>
          <span className="text-xs text-white/50 font-medium">Decline</span>
        </div>

        {/* Answer */}
        <div className="flex flex-col items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={
              !isAnswering
                ? {
                    y: [0, -6, 0],
                    boxShadow: [
                      '0 10px 25px -5px rgba(34, 197, 94, 0.3)',
                      '0 15px 35px -5px rgba(34, 197, 94, 0.5)',
                      '0 10px 25px -5px rgba(34, 197, 94, 0.3)',
                    ],
                  }
                : {}
            }
            transition={!isAnswering ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
            onClick={onAnswer}
            disabled={isAnswering}
            className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/40 hover:bg-green-600 transition-colors disabled:opacity-50"
            aria-label={isAnswering ? 'Connecting...' : 'Answer call'}
          >
            {isAnswering ? (
              <FiLoader className="w-7 h-7 text-white animate-spin" />
            ) : (
              <FiPhone className="w-7 h-7 text-white" />
            )}
          </motion.button>
          <span className="text-xs text-white/50 font-medium">
            {isAnswering ? 'Connecting...' : 'Accept'}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
