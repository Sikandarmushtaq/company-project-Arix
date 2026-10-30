import { FiMessageSquare, FiMic, FiPhoneCall } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

// Single source of truth for the five marketing channels. Every landing
// component that needs channel metadata (icon, label, brand colour, gradient
// class fragments, glow rgba, etc.) should import from here rather than
// re-defining the data per-section.
//
// Per-section copy (headlines, body text, layout-specific delays) stays in
// the section component. Only the *identity* of each channel lives here.

export type ChannelId = 'sip' | 'sms' | 'ai' | 'recording';

export interface ChannelMeta {
  id: ChannelId;
  /** Full display name, e.g. "Bulk SMS" */
  name: string;
  /** Short token used in chips/badges, e.g. "WA" */
  short: string;
  /** Section anchor id on the landing page (where applicable) */
  anchor: string | null;
  /** React-icons component for this channel */
  icon: React.ComponentType<{ size?: number }>;
  /** Hex color (full saturation) used for gradients, glows, etc. */
  hex: string;
  /** Hex color (deeper variant) used as gradient stop */
  hexDeep: string;
  /** RGBA glow string used for box-shadow / radial-gradients */
  glow: string;
  /** Tailwind class fragment for primary text colour (paired light + dark) */
  text: string;
  /** Tailwind class fragment for soft background fill */
  bgSoft: string;
  /** Tailwind class fragment for chip border */
  border: string;
  /** Tailwind class fragment for full-saturation gradient (e.g. icon tile) */
  gradient: string;
  /** Tailwind class fragment for shadow tinted to channel */
  shadow: string;
}

export const channelOrder: ChannelId[] = ['sip', 'sms', 'ai', 'recording'];

export const channels: Record<ChannelId, ChannelMeta> = {
  sip: {
    id: 'sip',
    name: 'Voice',
    short: 'SIP',
    anchor: 'channels',
    icon: FiPhoneCall,
    hex: '#ff6542',
    hexDeep: '#e5481f',
    glow: 'rgba(255,101,66,0.45)',
    text: 'text-[var(--foreground)]',
    bgSoft: 'bg-[var(--primary-600)]/10',
    border: 'border-[var(--border)]/40',
    gradient: 'from-[var(--primary-600)] to-[var(--primary-700)]',
    shadow: 'shadow-black/40',
  },
  sms: {
    id: 'sms',
    name: 'Bulk SMS',
    short: 'SMS',
    anchor: null,
    icon: FiMessageSquare,
    hex: '#f59e0b',
    hexDeep: '#d97706',
    glow: 'rgba(245,158,11,0.45)',
    text: 'text-amber-600 dark:text-amber-400',
    bgSoft: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    gradient: 'from-amber-500 to-amber-600',
    shadow: 'shadow-amber-500/40',
  },
  ai: {
    id: 'ai',
    name: 'AI Agent',
    short: 'AI',
    anchor: 'ai',
    icon: HiSparkles,
    hex: '#8b5cf6',
    hexDeep: '#6d28d9',
    glow: 'rgba(139,92,246,0.45)',
    text: 'text-[#7c3aed] dark:text-[#a78bfa]',
    bgSoft: 'bg-[#8b5cf6]/10',
    border: 'border-[#8b5cf6]/40',
    gradient: 'from-[#8b5cf6] to-[#6d28d9]',
    shadow: 'shadow-[#8b5cf6]/40',
  },
  recording: {
    id: 'recording',
    name: 'Recording',
    short: 'REC',
    anchor: null,
    icon: FiMic,
    hex: '#14b8a6',
    hexDeep: '#0f766e',
    glow: 'rgba(20,184,166,0.45)',
    text: 'text-[var(--accent-600)]',
    bgSoft: 'bg-[var(--accent-500)]/10',
    border: 'border-[var(--accent-500)]/40',
    gradient: 'from-[var(--accent-500)] to-[var(--accent-600)]',
    shadow: 'shadow-emerald-500/40',
  },
};

/** Convenience: ordered array of channel metadata. */
export const channelList = channelOrder.map((id) => channels[id]);
