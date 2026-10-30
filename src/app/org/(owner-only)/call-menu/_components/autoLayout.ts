/**
 * Auto-layout for the Call-Menu canvas. A top-down tree (dagre) so non-technical
 * owners never position steps by hand — the flow tidies itself after every add,
 * and the "Tidy up" button re-runs it on demand.
 */

import Dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { IvrNodeData } from '@/lib/api/services/ivr.api';

const NODE_WIDTH = 210;

/** Estimate a step's footprint so dagre spaces around it (menus grow per option). */
export function nodeSize(n: Node): { width: number; height: number } {
  const data = n.data as IvrNodeData;
  if (n.type === 'menu') {
    const opts = data?.options?.length ?? 0;
    return { width: NODE_WIDTH, height: 74 + opts * 22 };
  }
  return { width: NODE_WIDTH, height: 66 };
}

/** Arrange the graph as a top-down tree and return repositioned nodes. */
export function layoutFlow(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB'): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 56, ranksep: 68, marginx: 24, marginy: 24 });

  nodes.forEach((n) => {
    const s = nodeSize(n);
    g.setNode(n.id, { width: s.width, height: s.height });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  Dagre.layout(g);

  return nodes.map((n) => {
    const s = nodeSize(n);
    const p = g.node(n.id);
    return { ...n, position: { x: Math.round(p.x - s.width / 2), y: Math.round(p.y - s.height / 2) } };
  });
}
