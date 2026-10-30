'use client';

/**
 * WhatsApp Call Floating Panel
 *
 * Compact floating panel that shows on ALL pages during WA calls.
 * Positioned bottom-right, minimizable. Does not push page content.
 *
 * States:
 * - Incoming: ring animation, answer/reject buttons
 * - Connecting: spinner
 * - Active: duration timer, mute/end buttons
 * - Minimized: tiny pill showing duration
 *
 * @module components/phone/WaCallFloatingPanel
 */

import React, { useState } from 'react';
import {
  FiPhone,
  FiPhoneOff,
  FiMic,
  FiMicOff,
  FiMinimize2,
  FiMaximize2,
  FiLoader,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useGlobalWaCall } from '@/lib/providers/WaCallProvider';
import { useContactDisplayName, useContactName } from '@/lib/hooks/useContactName';
import { useAuthStore } from '@/lib/stores';
import { getDisplayPhone } from '@/lib/utils/privacy';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function WaCallFloatingPanel() {
  const {
    state,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    incomingEvent,
    outboundRingingConfirmed,
  } = useGlobalWaCall();
  const [minimized, setMinimized] = useState(false);

  const displayName = useContactDisplayName(
    state.customerNumber || '',
    state.customerName ?? undefined
  );
  // Privacy support — the secondary phone line below uses getDisplayPhone
  // so it shows "••••4069" instead of the raw number when the agent has
  // waPhoneMaskEnabled. hasContactName uses the contact lookup directly
  // (not displayName !== phone) so it works correctly in privacy mode
  // where displayName is a masked stub that's never equal to the raw phone.
  const savedContactName = useContactName(state.customerNumber || '');
  const hasContactName = !!(savedContactName || state.customerName);
  const isMasked = useAuthStore((s) => !!s.user?.waPhoneMaskEnabled);

  // Only show when there's an active WA call state
  if (state.status === 'idle' || state.status === 'ended') return null;

  // Minimized pill — bottom right
  if (minimized && state.status === 'active') {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-colors"
      >
        <FaWhatsapp className="w-4 h-4" />
        <span className="text-sm font-medium">{formatDuration(state.duration)}</span>
        <FiMaximize2 className="w-3 h-3 opacity-70" />
      </button>
    );
  }

  // Incoming call
  if (state.status === 'incoming') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Green header bar */}
        <div className="bg-green-500 px-4 py-2 flex items-center gap-2">
          <FaWhatsapp className="w-4 h-4 text-white" />
          <span className="text-white text-xs font-medium">Incoming WhatsApp Call</span>
          <div className="ml-auto relative">
            <div className="w-2 h-2 bg-white rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping" />
          </div>
        </div>

        {/* Caller info */}
        <div className="p-4 text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-500/10 flex items-center justify-center">
            <FaWhatsapp className="w-6 h-6 text-green-500" />
          </div>
          <p className="font-semibold text-sm">{displayName}</p>
          {hasContactName && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {getDisplayPhone(state.customerNumber || '', isMasked)}
            </p>
          )}
        </div>

        {/* Answer / Reject */}
        <div className="flex justify-center gap-6 pb-4">
          <button
            onClick={() => rejectCall()}
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            title="Reject"
          >
            <FiPhoneOff className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => {
              if (incomingEvent?.sdpOffer) {
                answerCall(incomingEvent.sdpOffer, incomingEvent.callId).catch((err) => {
                  console.error('[WaCallFloatingPanel] Answer failed:', err);
                });
              } else {
                console.warn('[WaCallFloatingPanel] No SDP offer available yet');
              }
            }}
            disabled={!incomingEvent?.sdpOffer}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              incomingEvent?.sdpOffer
                ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                : 'bg-green-500/50 cursor-not-allowed'
            }`}
            title={incomingEvent?.sdpOffer ? 'Answer' : 'Waiting for call signal...'}
          >
            <FiPhone className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Connecting (outbound: "Calling..." → "Ringing..." once Meta confirms
  // the customer's phone is ringing; inbound: "Connecting..."). All three
  // states are reachable: outbound while waiting for Meta and then while
  // the customer's phone rings; inbound after the agent clicks Answer but
  // before WebRTC ICE finishes. The label refinement distinguishes "we
  // sent the request, waiting on Meta" from "the customer's phone is
  // ringing" — same UX a normal softphone gives.
  if (state.status === 'connecting') {
    const isOutbound = state.direction === 'outbound';
    const headerLabel = isOutbound
      ? outboundRingingConfirmed
        ? 'Ringing...'
        : 'Calling...'
      : 'Connecting...';
    const bodyLabel = isOutbound
      ? outboundRingingConfirmed
        ? "Customer's phone is ringing..."
        : 'Reaching customer...'
      : 'Setting up call...';

    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        <div className="bg-green-500 px-4 py-2 flex items-center gap-2">
          <FaWhatsapp className="w-4 h-4 text-white" />
          <span className="text-white text-xs font-medium">{headerLabel}</span>
        </div>
        <div className="p-4 text-center">
          <FiLoader className="w-6 h-6 mx-auto animate-spin text-green-500 mb-2" />
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">{bodyLabel}</p>
          {/* Cancel — gives the user an out so they don't have to stare at
              "Calling..." until the 45s no-answer timeout fires. Calls the
              same endCall() the active-call hangup uses, so backend tells
              Meta to release the ringing call cleanly. */}
          <button
            onClick={() => {
              endCall().catch((err) => {
                console.error('[WaCallFloatingPanel] Cancel failed:', err);
              });
            }}
            className="w-12 h-12 mx-auto rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            title={isOutbound ? 'Cancel call' : 'End call'}
            aria-label={isOutbound ? 'Cancel call' : 'End call'}
          >
            <FiPhoneOff className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // Active call — and the brief 'ending' tail, but ONLY if the call actually
  // connected (answerTime set). Cancelling a still-ringing call also passes
  // through 'ending'; without the answerTime check it would flash the active
  // view (timer + "Outgoing call") for a call that never connected.
  if (state.status === 'active' || (state.status === 'ending' && state.answerTime)) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header with duration */}
        <div className="bg-green-500 px-4 py-2 flex items-center gap-2">
          <FaWhatsapp className="w-4 h-4 text-white" />
          <span className="text-white text-xs font-medium">{formatDuration(state.duration)}</span>
          <button
            onClick={() => setMinimized(true)}
            className="ml-auto text-white/70 hover:text-white transition-colors"
            title="Minimize"
          >
            <FiMinimize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Contact info */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <FaWhatsapp className="w-4 h-4 text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {state.direction === 'outbound' ? 'Outgoing' : 'Incoming'} call
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 pb-3 px-4">
          <button
            onClick={() => toggleMute()}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              state.isMuted
                ? 'bg-red-500/10 text-red-500'
                : 'bg-[var(--muted)]/50 text-[var(--foreground)] hover:bg-[var(--muted)]'
            }`}
            title={state.isMuted ? 'Unmute' : 'Mute'}
          >
            {state.isMuted ? <FiMicOff className="w-4 h-4" /> : <FiMic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => endCall()}
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            title="End call"
            disabled={state.status === 'ending'}
          >
            <FiPhoneOff className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
