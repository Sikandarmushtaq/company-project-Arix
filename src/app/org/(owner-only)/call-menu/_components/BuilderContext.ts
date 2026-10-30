/**
 * Shared builder state for the Call-Menu canvas. Custom nodes and edges read it
 * to draw validation badges, hide "+" buttons on already-connected outputs, and
 * open the step picker — without threading callbacks through React Flow props.
 */

import { createContext, useContext } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { IvrValidationIssue } from '@/lib/api/services/ivr.api';

export interface BuilderCtxValue {
  /** Live, client-side validation issues keyed by node id (drives per-step badges). */
  issuesByNode: Record<string, IvrValidationIssue[]>;
  /** Which outputs already have a wire — `nodeId` for a single output, `nodeId:key` for a menu key. */
  connectedHandles: Set<string>;
  /** Open the picker to add a step after this output (undefined handle = the single bottom output). */
  onAddAfter: (sourceId: string, sourceHandle: string | undefined, ev: ReactMouseEvent) => void;
  /** Open the picker to insert a step in the middle of this edge. */
  onSplitEdge: (edgeId: string, ev: ReactMouseEvent) => void;
}

export const BuilderContext = createContext<BuilderCtxValue | null>(null);

export function useBuilder(): BuilderCtxValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used inside a BuilderContext provider');
  return ctx;
}
