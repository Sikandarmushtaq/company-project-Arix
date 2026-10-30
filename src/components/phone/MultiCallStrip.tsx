'use client';

import React, { useState } from 'react';
import { FiPhone, FiPause, FiRepeat, FiUsers, FiArrowRight, FiList } from 'react-icons/fi';
import { formatPhoneUS } from '@/lib/utils/phone';
import type { CallLine } from '@/lib/sip/types';

interface MultiCallStripProps {
  lines: CallLine[];
  activeLineId: number | null;
  isInConference: boolean;
  /** Remote parties in the conference — computed by the parent so it's correct for
   *  BOTH engines (SIP = one line per party; LiveKit = one line whose
   *  `conferenceParties` holds the extra callers). Only used while in conference. */
  conferenceParticipants: { name?: string; number: string }[];
  canMerge: boolean;
  canSplit: boolean;
  onSwitchToLine: (lineId: number) => void;
  onMerge: () => void;
  onSplit: () => void;
}

const isLineHeld = (l: CallLine) => l.isHeld || l.state === 'held' || l.state === 'holding';

/** Small round action button used in the strip's action cluster. */
function StripBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`w-9 h-9 grid place-items-center rounded-full transition-colors ${
        active ? 'bg-white text-[#1b2438]' : 'bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * RingCentral-style multi-call / conference strip.
 *
 * A compact dark bar pinned at the top of the in-call panel that summarises the
 * call state ("N calls" / "Conference") with per-state colour chips and the
 * switch / merge-or-split / list actions — so the control grid and End Call below
 * stay in place (no growing panel that pushes hang-up off-screen). Renders nothing
 * for a single, non-conference call.
 */
export function MultiCallStrip({
  lines,
  activeLineId,
  isInConference,
  conferenceParticipants,
  canMerge,
  canSplit,
  onSwitchToLine,
  onMerge,
  onSplit,
}: MultiCallStripProps) {
  const [listOpen, setListOpen] = useState(false);

  if (lines.length < 2 && !isInConference) return null;

  const heldCount = lines.filter(isLineHeld).length;
  const activeCount = lines.length - heldCount;
  // Quick-swap target for the switch button: the first held line.
  const swapTarget = lines.find(isLineHeld);
  // In a conference everyone is connected — show the true party count (engine-aware,
  // via the parent) as a single active chip rather than the raw line count.
  const chips = isInConference
    ? ([{ tone: 'active' as const, count: conferenceParticipants.length }] as const)
    : ([
        { tone: 'held' as const, count: heldCount },
        { tone: 'active' as const, count: activeCount },
      ] as const);

  return (
    <div className="relative shrink-0 rounded-2xl bg-[#1b2438] text-white px-3.5 py-2.5 mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-black leading-tight">
            {isInConference ? 'Conference' : `${lines.length} calls`}
          </div>
          <div className="flex items-center gap-3.5 mt-1">
            {chips.map((c, i) =>
              c.count > 0 ? (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-[13px]"
                  title={c.tone === 'held' ? 'On hold' : 'Connected'}
                >
                  <FiPhone
                    className={`w-3.5 h-3.5 ${c.tone === 'held' ? 'text-amber-400' : 'text-emerald-400'}`}
                  />
                  <span className="tabular-nums font-semibold">{c.count}</span>
                </span>
              ) : null
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isInConference && swapTarget && (
            <StripBtn title="Switch call" onClick={() => onSwitchToLine(swapTarget.id)}>
              <FiRepeat className="w-[18px] h-[18px]" />
            </StripBtn>
          )}
          {isInConference
            ? canSplit && (
                <StripBtn title="Split conference" onClick={onSplit}>
                  <FiArrowRight className="w-[18px] h-[18px]" />
                </StripBtn>
              )
            : canMerge && (
                <StripBtn title="Merge into conference" onClick={onMerge}>
                  <FiUsers className="w-[18px] h-[18px]" />
                </StripBtn>
              )}
          <StripBtn
            title={isInConference ? 'Show participants' : 'Show calls'}
            onClick={() => setListOpen((v) => !v)}
            active={listOpen}
          >
            <FiList className="w-[18px] h-[18px]" />
          </StripBtn>
        </div>
      </div>

      {/* Expandable list floats as an overlay (absolute) so it never adds height to
          the panel / creates a scroll. In a conference it's the read-only participant
          roster; otherwise the separate calls, each tappable to switch to it. */}
      {listOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setListOpen(false)} />
          <div className="absolute left-2 right-2 top-full mt-1 z-30 max-h-52 overflow-y-auto rounded-xl bg-[#1b2438] ring-1 ring-white/10 shadow-2xl p-1.5 space-y-0.5">
            {isInConference
              ? conferenceParticipants.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[13px]"
                  >
                    <FiPhone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="flex-1 truncate font-medium">
                      {p.name || formatPhoneUS(p.number)}
                    </span>
                  </div>
                ))
              : lines.map((line) => {
                  const isActive = line.id === activeLineId;
                  const held = isLineHeld(line);
                  return (
                    <button
                      key={line.id}
                      type="button"
                      disabled={isActive}
                      onClick={() => {
                        if (!isActive) onSwitchToLine(line.id);
                        setListOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                        isActive ? 'bg-white/15 cursor-default' : 'hover:bg-white/10'
                      }`}
                    >
                      {held ? (
                        <FiPause className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <FiPhone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="flex-1 truncate font-medium">
                        {line.remoteName || formatPhoneUS(line.remoteNumber)}
                      </span>
                      {isActive ? (
                        <span className="text-[11px] text-emerald-300 shrink-0">Active</span>
                      ) : held ? (
                        <span className="text-[11px] text-white/60 shrink-0">On hold</span>
                      ) : null}
                    </button>
                  );
                })}
          </div>
        </>
      )}
    </div>
  );
}
