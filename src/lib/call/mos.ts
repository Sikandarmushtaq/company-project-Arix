/**
 * Call-quality scoring — SINGLE SOURCE OF TRUTH.
 *
 * The MOS (Mean Opinion Score) and quality-level math used to be private to
 * `SipQualityManager`. It now lives here so BOTH call engines (SIP.js and
 * LiveKit) score a call identically — a MOS of 3.8 means the same thing and
 * lights the same signal bars regardless of which engine placed the call.
 *
 * Pure functions, no state, no engine dependencies.
 *
 * @module lib/call/mos
 */

import type { CallQuality } from '../sip/types';

/**
 * Estimate MOS (1.0–4.5) from jitter/packet-loss/RTT using a simplified
 * ITU-T G.107 E-Model — the exact formula the SIP engine has always used, so
 * scores are directly comparable across engines.
 *
 * @param jitter     one-way jitter in milliseconds
 * @param packetLoss loss as a percentage (0–100)
 * @param rtt        round-trip time in milliseconds
 */
export function calculateMOS(jitter: number, packetLoss: number, rtt: number): number {
  const R0 = 93.2;
  const delay = rtt / 2;
  const Id = delay > 177.3 ? 0.024 * delay + 0.11 * (delay - 177.3) : 0.024 * delay;
  const Ie = 0;
  const Ipl = packetLoss > 0 ? 30 * Math.log(1 + (15 * packetLoss) / 100) : 0;
  const Ij = jitter > 40 ? (jitter - 40) * 0.2 : 0;

  let R = R0 - Id - Ie - Ipl - Ij;
  R = Math.max(0, Math.min(100, R)); // R ∈ [0,100] → the E-model curve applies directly
  const mos = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
  return Math.round(mos * 100) / 100;
}

/** Bucket a MOS score into the four-level quality label the UI renders. */
export function getQualityLevel(mosScore: number): CallQuality {
  if (mosScore >= 4.0) return 'excellent';
  if (mosScore >= 3.5) return 'good';
  if (mosScore >= 3.0) return 'fair';
  return 'poor';
}
