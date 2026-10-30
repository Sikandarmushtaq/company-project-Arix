/**
 * Starter templates for the Call Menu. Non-technical owners start from a working
 * flow they edit, not a blank canvas — the single biggest onboarding win. Each
 * template is pure data (nodes + edges); applying one replaces the canvas.
 */

import type { Node, Edge } from '@xyflow/react';
import type { IconType } from 'react-icons';
import { FiUsers, FiGrid, FiVoicemail, FiClock } from 'react-icons/fi';
import type { IvrNodeData, IvrNodeType } from '@/lib/api/services/ivr.api';

function guessTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

export interface FlowTemplate {
  key: string;
  name: string;
  blurb: string;
  Icon: IconType;
  build: () => { nodes: Node[]; edges: Edge[] };
}

function node(id: string, type: IvrNodeType, data: IvrNodeData): Node {
  return { id, type, position: { x: 0, y: 0 }, data: data as unknown as Record<string, unknown> } as Node;
}

function edge(source: string, target: string, sourceHandle?: string): Edge {
  return {
    id: `e_${source}_${target}_${sourceHandle ?? ''}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
    type: 'insert',
  } as Edge;
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    key: 'receptionist',
    name: 'Ring my team',
    blurb: 'Greet the caller, ring everyone, fall back to voicemail.',
    Icon: FiUsers,
    build() {
      const e = 'n_entry', g = 'n_greeting', r = 'n_ring', v = 'n_vm';
      return {
        nodes: [
          node(e, 'entry', { label: 'Incoming call' }),
          node(g, 'greeting', {
            label: 'Greeting',
            prompt: { text: 'Thanks for calling. Please hold while we connect you.' },
          }),
          node(r, 'ring_group', { label: 'Ring the team' }),
          node(v, 'voicemail', { label: 'Voicemail' }),
        ],
        edges: [edge(e, g), edge(g, r), edge(r, v)],
      };
    },
  },
  {
    key: 'menu',
    name: 'Sales & Support menu',
    blurb: '“Press 1 for Sales, 2 for Support, 0 for the operator.”',
    Icon: FiGrid,
    build() {
      const e = 'n_entry', g = 'n_greeting', m = 'n_menu';
      const s = 'n_sales', p = 'n_support', o = 'n_operator', v = 'n_vm';
      return {
        nodes: [
          node(e, 'entry', { label: 'Incoming call' }),
          node(g, 'greeting', { label: 'Greeting', prompt: { text: 'Thanks for calling.' } }),
          node(m, 'menu', {
            label: 'Main menu',
            prompt: { text: 'Press 1 for Sales, 2 for Support, or 0 for the operator.' },
            options: [
              { key: '1', label: 'Sales' },
              { key: '2', label: 'Support' },
              { key: '0', label: 'Operator' },
            ],
            timeoutSeconds: 5,
            maxRetries: 2,
          }),
          node(s, 'ring_group', { label: 'Sales team' }),
          node(p, 'ring_group', { label: 'Support team' }),
          node(o, 'ring_user', { label: 'Operator' }),
          node(v, 'voicemail', { label: 'Voicemail' }),
        ],
        edges: [
          edge(e, g),
          edge(g, m),
          edge(m, s, '1'),
          edge(m, p, '2'),
          edge(m, o, '0'),
          edge(s, v),
          edge(p, v),
          edge(o, v),
        ],
      };
    },
  },
  {
    key: 'hours',
    name: 'Open hours → team, after hours → voicemail',
    blurb: 'Ring the team during business hours; send everything else to voicemail.',
    Icon: FiClock,
    build() {
      const e = 'n_entry', h = 'n_hours', r = 'n_ring', v = 'n_vm';
      return {
        nodes: [
          node(e, 'entry', { label: 'Incoming call' }),
          node(h, 'hours', {
            label: 'Business hours',
            hours: [2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '17:00' })), // Mon–Fri 9–5
            holidays: [{ name: 'Christmas Day', date: '12-25' }],
            timezone: guessTz(),
          }),
          node(r, 'ring_group', { label: 'Ring the team' }),
          node(v, 'voicemail', { label: 'Voicemail' }),
        ],
        edges: [
          edge(e, h),
          edge(h, r, 'open'),
          edge(h, v, 'closed'),
          edge(h, v, 'holiday'),
        ],
      };
    },
  },
  {
    key: 'voicemail',
    name: 'Straight to voicemail',
    blurb: 'A quick greeting, then take a message.',
    Icon: FiVoicemail,
    build() {
      const e = 'n_entry', g = 'n_greeting', v = 'n_vm';
      return {
        nodes: [
          node(e, 'entry', { label: 'Incoming call' }),
          node(g, 'greeting', {
            label: 'Greeting',
            prompt: { text: 'Sorry we missed you. Please leave a message after the tone.' },
          }),
          node(v, 'voicemail', { label: 'Voicemail' }),
        ],
        edges: [edge(e, g), edge(g, v)],
      };
    },
  },
];
