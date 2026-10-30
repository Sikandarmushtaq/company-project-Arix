'use client';

/**
 * Call Menu (IVR) builder — Phase 0. A React-Flow canvas over the org's default
 * call flow. Non-technical owners start from a template, add steps with an
 * inline "+" picker (no handle-dragging required), let the tree auto-arrange,
 * edit in the inspector, undo freely, validate + save, and "Test call" through
 * it entirely in-browser (no telephony). Publish-to-live lands in Phase 1.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  type Node,
  type Edge,
  type Connection,
  type OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  FiSave,
  FiPlay,
  FiAlertTriangle,
  FiInfo,
  FiLoader,
  FiRotateCcw,
  FiRotateCw,
  FiGrid,
  FiLayout,
  FiTrash2,
  FiX,
  FiGlobe,
} from 'react-icons/fi';
import { Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { useDefaultIvrFlow, useUpdateIvrFlow } from '@/lib/hooks/useIvr';
import type {
  IvrFlow,
  IvrNodeData,
  IvrNodeType,
  IvrValidationIssue,
  IvrValidationResult,
} from '@/lib/api/services/ivr.api';
import { nodeTypes, NODE_META, PALETTE } from './_components/ivrNodes';
import { CallMenuInspector } from './_components/CallMenuInspector';
import { TestSimulator } from './_components/TestSimulator';
import { PublishModal } from './_components/PublishModal';
import { InsertEdge } from './_components/InsertEdge';
import { BuilderContext, type BuilderCtxValue } from './_components/BuilderContext';
import { NodePicker } from './_components/NodePicker';
import { FLOW_TEMPLATES } from './_components/flowTemplates';
import { layoutFlow } from './_components/autoLayout';

const newId = () => `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const edgeTypes = { insert: InsertEdge };
const DEFAULT_EDGE_OPTIONS = { type: 'insert' };

/** The viewer's IANA timezone, so a new business-hours step defaults sensibly. */
function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

function defaultData(type: IvrNodeType): IvrNodeData {
  if (type === 'menu') return { label: NODE_META.menu.label, options: [], timeoutSeconds: 5, maxRetries: 2 };
  if (type === 'greeting') return { label: NODE_META.greeting.label, prompt: { text: '' } };
  if (type === 'hours')
    return {
      label: NODE_META.hours.label,
      // Mon–Fri 9–5 (FreeSWITCH wday: 2=Mon … 6=Fri) — the most common default.
      hours: [2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '17:00' })),
      holidays: [],
      timezone: guessTimezone(),
    };
  return { label: NODE_META[type].label };
}

/** Strip React-Flow runtime fields down to our stored IvrFlow shape. */
function toIvrFlow(nodes: Node[], edges: Edge[]): IvrFlow {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as IvrNodeType,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: (n.data ?? {}) as IvrNodeData,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle as IvrFlow['edges'][number]['sourceHandle'] } : {}),
    })),
  };
}

/**
 * Fast, client-side per-step validation for the on-canvas badges. Runs on every
 * edit with no network round-trip. The server's validation remains the
 * authoritative gate at save/publish time.
 */
function computeIssues(nodes: Node[], edges: Edge[]): Record<string, IvrValidationIssue[]> {
  const out: Record<string, IvrValidationIssue[]> = {};
  const push = (id: string, level: 'error' | 'warning', message: string) => {
    (out[id] ??= []).push({ level, nodeId: id, message });
  };
  // Which source handles are wired, per node ('__' = the single bottom output).
  const wired = new Map<string, Set<string>>();
  edges.forEach((e) => {
    const s = wired.get(e.source) ?? new Set<string>();
    s.add(e.sourceHandle ?? '__');
    wired.set(e.source, s);
  });

  for (const n of nodes) {
    const handles = wired.get(n.id) ?? new Set<string>();
    const data = n.data as IvrNodeData;
    switch (n.type) {
      case 'entry':
        if (!handles.size) push(n.id, 'error', 'Connect the start to your first step.');
        break;
      case 'greeting':
        if (!data?.prompt?.text) push(n.id, 'warning', 'Add a message to play.');
        if (!handles.has('__')) push(n.id, 'error', 'Add what happens after the greeting.');
        break;
      case 'menu': {
        const opts = data?.options ?? [];
        if (!opts.length) push(n.id, 'error', 'Add at least one keypad option.');
        const seen = new Set<string>();
        opts.forEach((o) => {
          if (seen.has(o.key)) push(n.id, 'error', `Key ${o.key} is used more than once.`);
          seen.add(o.key);
          if (!handles.has(o.key)) push(n.id, 'error', `Key ${o.key} isn’t routed anywhere.`);
        });
        break;
      }
      case 'ring_user':
        if (!data?.extension) push(n.id, 'warning', 'Choose who to ring.');
        if (!handles.has('__')) push(n.id, 'warning', 'Add a no-answer step (e.g. voicemail).');
        break;
      case 'ring_group':
        if (data?.groupId == null) push(n.id, 'warning', 'Choose which team to ring.');
        if (!handles.has('__')) push(n.id, 'warning', 'Add a no-answer step (e.g. voicemail).');
        break;
      case 'hours': {
        if (!data?.hours?.length)
          push(n.id, 'warning', 'Set your open hours, or every call is treated as closed.');
        if ((data?.hours ?? []).some((iv) => iv.start >= iv.end))
          push(n.id, 'error', 'An open period ends before it starts (overnight hours aren’t supported yet).');
        if (!handles.has('open'))
          push(n.id, 'error', 'Connect where calls go during OPEN hours.');
        if (!handles.has('closed'))
          push(n.id, 'warning', 'Add a “closed” step, or closed-hours calls will hang up.');
        if ((data?.holidays?.length ?? 0) > 0 && !handles.has('holiday'))
          push(n.id, 'warning', 'Holidays are set but the Holiday branch isn’t connected — they’ll use Closed.');
        break;
      }
      case 'voicemail':
        if (!data?.extension) push(n.id, 'warning', 'Choose whose mailbox.');
        break;
      case 'transfer':
        if (!data?.externalNumber && !data?.extension)
          push(n.id, 'warning', 'Choose who or what to forward to.');
        break;
      default:
        break;
    }
  }
  return out;
}

function Builder() {
  const { data: record, isLoading, isError } = useDefaultIvrFlow();
  const save = useUpdateIvrFlow();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  // Preview mode: the backend /ivr module isn't reachable (e.g. not deployed to
  // the API this frontend points at). The builder still runs fully client-side
  // so the UX is testable — only saving is unavailable.
  const previewMode = isError && !record;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validation, setValidation] = useState<IvrValidationResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [blankChosen, setBlankChosen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [picker, setPicker] = useState<{ x: number; y: number; onPick: (t: IvrNodeType) => void } | null>(
    null
  );
  const seeded = useRef(false);

  // Always-current mirrors so imperative inserts can read state without stale closures.
  const nodesRef = useRef<Node[]>(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef<Edge[]>(edges);
  edgesRef.current = edges;

  // ---- Undo / redo (snapshot stack) --------------------------------------
  const past = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const future = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  // Coalesce a run of edits to ONE node into a single undo step; reset by take().
  const lastPatchNode = useRef<string | null>(null);
  // Bumped after each history change so the undo/redo buttons re-evaluate enabled state.
  const [, bumpHistory] = useState(0);
  const take = useCallback(() => {
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    if (past.current.length > 60) past.current.shift();
    future.current = [];
    lastPatchNode.current = null; // any structural snapshot ends the current edit run
    bumpHistory((t) => t + 1);
  }, []);
  // Key-deleting a node fires node-remove AND edge-remove in the same frame;
  // collapse both into one undo step by snapshotting at most once per tick.
  const removeTakeGuard = useRef(false);
  const takeOnceForRemove = useCallback(() => {
    if (removeTakeGuard.current) return;
    removeTakeGuard.current = true;
    take();
    queueMicrotask(() => {
      removeTakeGuard.current = false;
    });
  }, [take]);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    lastPatchNode.current = null; // stepping through history ends any patch run
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setDirty(true);
    bumpHistory((t) => t + 1);
  }, [setNodes, setEdges]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    lastPatchNode.current = null;
    setNodes(next.nodes);
    setEdges(next.edges);
    setDirty(true);
    bumpHistory((t) => t + 1);
  }, [setNodes, setEdges]);
  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  // Seed the canvas from the loaded flow once (or start empty in preview mode).
  useEffect(() => {
    if (seeded.current) return;
    if (record) {
      seeded.current = true;
      setNodes(
        record.flow.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })) as Node[]
      );
      setEdges(
        record.flow.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          type: 'insert',
        }))
      );
      setReady(true);
    } else if (previewMode) {
      seeded.current = true;
      setNodes([{ id: 'n_entry', type: 'entry', position: { x: 0, y: 0 }, data: { label: 'Incoming call' } } as Node]);
      setEdges([]);
      setReady(true);
    }
  }, [record, previewMode, setNodes, setEdges]);

  const markDirty = useCallback(() => setDirty(true), []);

  // Refit the viewport to the whole flow after a reshape (template / tidy). We
  // wait for the new nodes to be measured, or fitView zooms to an unsized point.
  const [fitNonce, setFitNonce] = useState(0);
  const lastFit = useRef(0);
  const requestFit = useCallback(() => setFitNonce((n) => n + 1), []);
  useEffect(() => {
    if (fitNonce > 0 && fitNonce !== lastFit.current && nodesInitialized) {
      lastFit.current = fitNonce;
      fitView({ padding: 0.2, duration: 300 });
    }
  }, [fitNonce, nodesInitialized, fitView]);

  // ---- Imperative graph edits (used by the picker) ------------------------
  const applyGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], selectId?: string) => {
      const laid = layoutFlow(nextNodes, nextEdges);
      setNodes(laid);
      setEdges(nextEdges);
      if (selectId) setSelectedId(selectId);
      setDirty(true);
    },
    [setNodes, setEdges]
  );

  const insertAfter = useCallback(
    (sourceId: string, sourceHandle: string | undefined, type: IvrNodeType) => {
      take();
      const id = newId();
      const node = { id, type, position: { x: 0, y: 0 }, data: defaultData(type) } as Node;
      const edge = {
        id: `e_${newId()}`,
        source: sourceId,
        ...(sourceHandle ? { sourceHandle } : {}),
        target: id,
        type: 'insert',
      } as Edge;
      applyGraph([...nodesRef.current, node], [...edgesRef.current, edge], id);
    },
    [take, applyGraph]
  );

  const splitEdgeWith = useCallback(
    (edgeId: string, type: IvrNodeType) => {
      const edge = edgesRef.current.find((e) => e.id === edgeId);
      if (!edge) return;
      take();
      const id = newId();
      const node = { id, type, position: { x: 0, y: 0 }, data: defaultData(type) } as Node;
      const e1 = {
        id: `e_${newId()}`,
        source: edge.source,
        ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
        target: id,
        type: 'insert',
      } as Edge;
      const e2 = { id: `e_${newId()}`, source: id, target: edge.target, type: 'insert' } as Edge;
      applyGraph(
        [...nodesRef.current, node],
        [...edgesRef.current.filter((e) => e.id !== edgeId), e1, e2],
        id
      );
    },
    [take, applyGraph]
  );

  const onAddAfter = useCallback(
    (sourceId: string, sourceHandle: string | undefined, ev: React.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      setPicker({
        x: ev.clientX,
        y: ev.clientY,
        onPick: (type) => {
          insertAfter(sourceId, sourceHandle, type);
          setPicker(null);
        },
      });
    },
    [insertAfter]
  );

  const onSplitEdge = useCallback(
    (edgeId: string, ev: React.MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      setPicker({
        x: ev.clientX,
        y: ev.clientY,
        onPick: (type) => {
          splitEdgeWith(edgeId, type);
          setPicker(null);
        },
      });
    },
    [splitEdgeWith]
  );

  // Handle-to-handle drag still works (power path).
  const onConnect = useCallback(
    (c: Connection) => {
      take();
      setEdges((eds) => addEdge({ ...c, id: `e_${newId()}`, type: 'insert' }, eds));
      markDirty();
    },
    [setEdges, take, markDirty]
  );

  // Drag a wire onto empty canvas → open the picker there and create the step.
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (connectionState.isValid) return; // dropped on a real handle; onConnect handled it
      const from = connectionState.fromNode;
      if (!from) return;
      const handle = connectionState.fromHandle?.id ?? undefined;
      const isTouch = 'changedTouches' in event;
      const cx = isTouch ? event.changedTouches[0].clientX : (event as MouseEvent).clientX;
      const cy = isTouch ? event.changedTouches[0].clientY : (event as MouseEvent).clientY;
      setPicker({
        x: cx,
        y: cy,
        onPick: (type) => {
          insertAfter(from.id, handle, type);
          setPicker(null);
        },
      });
    },
    [insertAfter]
  );

  const patchNode = useCallback(
    (id: string, patch: Partial<IvrNodeData>) => {
      // Snapshot once when a new node's edit-run begins, so a burst of field
      // edits to the same step collapses into a single undo step (not one per
      // keystroke). Switching to a different node starts a fresh run.
      if (lastPatchNode.current !== id) {
        past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
        if (past.current.length > 60) past.current.shift();
        future.current = [];
        lastPatchNode.current = id;
        bumpHistory((t) => t + 1);
      }
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...(n.data as IvrNodeData), ...patch } } : n))
      );
      markDirty();
    },
    [setNodes, markDirty]
  );

  const deleteNode = useCallback(
    (id: string) => {
      take();
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      if (selectedId === id) setSelectedId(null);
      markDirty();
    },
    [setNodes, setEdges, selectedId, take, markDirty]
  );

  const tidyUp = useCallback(() => {
    take();
    setNodes(layoutFlow(nodesRef.current, edgesRef.current));
    markDirty();
    requestFit();
  }, [take, setNodes, markDirty, requestFit]);

  // Reset to a single fresh entry step on a blank canvas. Stays blank (no
  // template chooser) — the Templates button is there if the user wants one.
  const clearCanvas = useCallback(() => {
    take();
    setNodes([
      { id: 'n_entry', type: 'entry', position: { x: 0, y: 0 }, data: { label: 'Incoming call' } } as Node,
    ]);
    setEdges([]);
    setSelectedId(null);
    setValidation(null);
    setTemplatesOpen(false);
    setBlankChosen(true); // keep the canvas blank instead of re-opening the chooser
    setDirty(true);
  }, [take, setNodes, setEdges]);

  const applyTemplate = useCallback(
    (build: () => { nodes: Node[]; edges: Edge[] }) => {
      take();
      const { nodes: tn, edges: te } = build();
      setNodes(layoutFlow(tn, te));
      setEdges(te);
      setSelectedId(null);
      setDirty(true);
      setBlankChosen(true);
      setTemplatesOpen(false);
      requestFit();
    },
    [take, setNodes, setEdges, requestFit]
  );

  // Keyboard: undo / redo (ignore while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const currentFlow = useMemo(() => toIvrFlow(nodes, edges), [nodes, edges]);
  const issuesByNode = useMemo(() => computeIssues(nodes, edges), [nodes, edges]);
  const connectedHandles = useMemo(() => {
    const s = new Set<string>();
    edges.forEach((e) => s.add(e.sourceHandle ? `${e.source}:${e.sourceHandle}` : e.source));
    return s;
  }, [edges]);

  const builderCtx = useMemo<BuilderCtxValue>(
    () => ({ issuesByNode, connectedHandles, onAddAfter, onSplitEdge }),
    [issuesByNode, connectedHandles, onAddAfter, onSplitEdge]
  );

  const nonEntryCount = useMemo(() => nodes.filter((n) => n.type !== 'entry').length, [nodes]);
  const showTemplates = ready && !blankChosen && nonEntryCount === 0;
  // Count distinct steps that have a blocking error (not the number of issues).
  const problemCount = useMemo(
    () => Object.values(issuesByNode).filter((list) => list.some((i) => i.level === 'error')).length,
    [issuesByNode]
  );

  const handleSave = () => {
    if (!record) return;
    save.mutate(
      { id: record.id, flow: currentFlow },
      {
        onSuccess: (res) => {
          setValidation(res.validation);
          setDirty(false);
          if (res.validation.valid) toast.success('Call menu saved.');
          else toast.success('Saved as draft — see the notes below.');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save'),
      }
    );
  };

  const errors = validation?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = validation?.issues.filter((i) => i.level === 'warning') ?? [];

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-[var(--muted-foreground)]">
        <FiLoader className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <BuilderContext.Provider value={builderCtx}>
      <div className="flex h-[calc(100dvh-4rem)] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-[var(--foreground)]">Call Menu</h1>
              {record?.status === 'published' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              ) : record?.attachedNumber ? (
                // Live on a number but edited since publish → still answering calls;
                // the owner must be able to open Manage and take it offline.
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Live · edits not published
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                  Draft
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Build how incoming calls are answered and routed (IVR / auto-attendant).
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                className="rounded-md p-1.5 text-[var(--muted-foreground)] enabled:hover:bg-[var(--muted)]/60 enabled:hover:text-[var(--foreground)] disabled:opacity-40"
              >
                <FiRotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                className="rounded-md p-1.5 text-[var(--muted-foreground)] enabled:hover:bg-[var(--muted)]/60 enabled:hover:text-[var(--foreground)] disabled:opacity-40"
              >
                <FiRotateCw className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="outline"
              onClick={() => setTemplatesOpen(true)}
              title="Start from a ready-made call menu"
            >
              <FiLayout className="mr-1.5 h-4 w-4" /> Templates
            </Button>
            <Button variant="outline" onClick={tidyUp} title="Auto-arrange the steps">
              <FiGrid className="mr-1.5 h-4 w-4" /> Tidy up
            </Button>
            <Button
              variant="outline"
              onClick={clearCanvas}
              title="Clear the canvas and start over"
            >
              <FiTrash2 className="mr-1.5 h-4 w-4" /> Clear
            </Button>
            <Button variant="outline" onClick={() => setTesting(true)}>
              <FiPlay className="mr-1.5 h-4 w-4" /> Test call
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              loading={save.isPending}
              disabled={previewMode || !dirty || save.isPending}
              title={previewMode ? 'Saving is unavailable in preview mode' : undefined}
            >
              <FiSave className="mr-1.5 h-4 w-4" /> {dirty ? 'Save' : 'Saved'}
            </Button>
            <Button
              onClick={() => setPublishing(true)}
              disabled={previewMode || !record}
              title={previewMode ? 'Publishing is unavailable in preview mode' : undefined}
            >
              <FiGlobe className="mr-1.5 h-4 w-4" />
              {record?.status === 'published' || record?.attachedNumber ? 'Manage' : 'Publish'}
            </Button>
          </div>
        </div>

        {previewMode && (
          <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-700 dark:text-amber-300">
            <FiInfo className="h-3.5 w-3.5 shrink-0" />
            Preview mode — the Call Menu service isn’t connected here, so changes can’t be saved yet. Everything
            else (templates, editing, Test call) works for evaluating the experience.
          </div>
        )}

        {/* Validation banner (server, at save time) */}
        {validation && (errors.length > 0 || warnings.length > 0) && (
          <div className="max-h-28 overflow-y-auto border-b border-[var(--border)] bg-[var(--muted)]/30 px-5 py-2 text-xs">
            {errors.map((i, k) => (
              <div key={`e${k}`} className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" /> {i.message}
              </div>
            ))}
            {warnings.map((i, k) => (
              <div key={`w${k}`} className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <FiInfo className="h-3.5 w-3.5 shrink-0" /> {i.message}
              </div>
            ))}
          </div>
        )}

        {/* 3-pane body */}
        <div className="relative flex min-h-0 flex-1">
          {/* Palette */}
          <div className="w-44 shrink-0 space-y-2 overflow-y-auto border-r border-[var(--border)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Steps
            </div>
            {PALETTE.map((type) => {
              const m = NODE_META[type];
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/ivr-node', type)}
                  className="flex cursor-grab items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--primary-600)] active:cursor-grabbing"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{ background: `${m.accent}1a`, color: m.accent }}
                  >
                    <m.Icon className="h-3.5 w-3.5" />
                  </span>
                  {m.label}
                </div>
              );
            })}
            <p className="pt-1 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
              Tip: click the <b>+</b> under any step to add the next one — no dragging needed.
            </p>
          </div>

          {/* Canvas */}
          <div className="min-w-0 flex-1" onDrop={onDrop} onDragOver={onDragOver}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={(c) => {
                // The entry step is permanent — drop any change that would remove it.
                const entryIds = new Set(
                  nodesRef.current.filter((n) => n.type === 'entry').map((n) => n.id)
                );
                const changes = c.filter((ch) => !(ch.type === 'remove' && entryIds.has(ch.id)));
                // Key-deleting a step (Delete/Backspace) is an undoable structural
                // edit; snapshot before it applies. Drags are snapshotted at drag start.
                if (changes.some((x) => x.type === 'remove')) takeOnceForRemove();
                onNodesChange(changes);
                if (changes.some((x) => x.type === 'position' || x.type === 'remove')) markDirty();
              }}
              onEdgesChange={(c) => {
                if (c.some((x) => x.type === 'remove')) takeOnceForRemove();
                onEdgesChange(c);
                if (c.some((x) => x.type === 'remove')) markDirty();
              }}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onNodeDragStart={() => take()}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              deleteKeyCode={['Delete', 'Backspace']}
              colorMode="system"
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>

            {/* Template chooser — shown on an empty canvas and re-openable anytime */}
            {(showTemplates || templatesOpen) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/70 backdrop-blur-sm">
                <div className="relative w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
                  {templatesOpen && (
                    <button
                      type="button"
                      onClick={() => setTemplatesOpen(false)}
                      aria-label="Close templates"
                      title="Close"
                      className="absolute right-3 top-3 rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  )}
                  <h2 className="text-base font-black text-[var(--foreground)]">
                    {nonEntryCount > 0 ? 'Replace with a template' : 'Start your call menu'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Pick a starting point — you can change everything after.
                  </p>
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                    {FLOW_TEMPLATES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => applyTemplate(t.build)}
                        className="group flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--primary-600)] hover:shadow-md"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-600)]/10 text-[var(--primary-600)]">
                          <t.Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-semibold text-[var(--foreground)]">{t.name}</span>
                        <span className="text-[11px] leading-snug text-[var(--muted-foreground)]">
                          {t.blurb}
                        </span>
                      </button>
                    ))}
                  </div>
                  {nonEntryCount > 0 ? (
                    <p className="mt-4 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                      <FiAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      This replaces your current call menu — you can undo it (Ctrl+Z).
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBlankChosen(true)}
                      className="mt-4 text-xs font-medium text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
                    >
                      Start from a blank canvas instead
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Inspector */}
          <div className="w-72 shrink-0 border-l border-[var(--border)]">
            <CallMenuInspector node={selectedNode} onPatch={patchNode} onDelete={deleteNode} />
          </div>
        </div>

        {/* Status strip */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-1.5 text-[11px] text-[var(--muted-foreground)]">
          <span>
            {nodes.length} step{nodes.length === 1 ? '' : 's'}
          </span>
          <span className={problemCount > 0 ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
            {problemCount > 0
              ? `${problemCount} step${problemCount === 1 ? '' : 's'} need attention`
              : 'Looks good'}
          </span>
        </div>

        {picker && (
          <NodePicker x={picker.x} y={picker.y} onPick={picker.onPick} onClose={() => setPicker(null)} />
        )}
        {testing && <TestSimulator flow={currentFlow} onClose={() => setTesting(false)} />}
        {publishing && record && (
          <PublishModal record={record} dirty={dirty} onClose={() => setPublishing(false)} />
        )}
      </div>
    </BuilderContext.Provider>
  );

  // ---- Palette drag-drop (secondary path) --------------------------------
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/ivr-node') as IvrNodeType;
    if (!type) return;
    take();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = newId();
    setNodes((nds) => [...nds, { id, type, position, data: defaultData(type) } as Node]);
    setSelectedId(id);
    markDirty();
  }
}

export default function CallMenuPage() {
  return (
    <ReactFlowProvider>
      <Builder />
    </ReactFlowProvider>
  );
}
