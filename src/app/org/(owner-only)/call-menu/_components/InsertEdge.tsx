'use client';

/**
 * Custom edge for the Call Menu: draws the wire, a keypad pill for menu branches
 * ("Press 1"), and a mid-wire "+" to insert a step between two others. One
 * component covers both jobs the research called for (labels + inline insert).
 */

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { FiPlus } from 'react-icons/fi';
import { useBuilder } from './BuilderContext';

export function InsertEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, sourceHandleId } = props;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const { onSplitEdge } = useBuilder();
  const key = sourceHandleId && /^[0-9*#]$/.test(sourceHandleId) ? sourceHandleId : null;

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: 'var(--muted-foreground)', strokeWidth: 1.5 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          {key && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--foreground)] shadow-sm">
              Press {key}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => onSplitEdge(id, e)}
            aria-label="Insert a step here"
            title="Insert a step here"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-sm transition-colors hover:border-[var(--primary-600)] hover:text-[var(--primary-600)]"
          >
            <FiPlus className="h-3 w-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
