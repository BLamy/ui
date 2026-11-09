'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { diagramTextRuns, type DiagramNode } from '@/lib/diagram-model';
import { createDiagramLayoutEngine, runLayout, toElkGraph, type DiagramDraft, type DiagramLayoutEngine, type DiagramLayoutError, type DiagramLayoutOptions, type DiagramLayoutResult } from '@/lib/diagram-layout';
import { measureTextGently, nextFrame } from '@/lib/diagram-text';
import { useFontVersion, useShownVersion } from '@/lib/use-font-version';

export interface UseDiagramLayoutOptions<N = unknown, E = unknown> extends Pick<DiagramLayoutOptions, 'direction' | 'elk' | 'worker'> {
  /** Measure text in here, so its fonts apply. Without it, measuring happens in the page's body. */
  host?: RefObject<Element | null>;
  /** A layout done ahead of time, on a server perhaps, to show until this one's ready. */
  initial?: DiagramLayoutResult<N, E>;
}

export interface UseDiagramLayout<N = unknown, E = unknown> extends Partial<Pick<DiagramLayoutResult<N, E>, 'bounds' | 'engine' | 'ms'>> {
  nodes: DiagramNode<N>[];
  edges: DiagramLayoutResult<N, E>['edges'];
  /** `pending` has nothing to show yet. `working` may be showing the last layout. */
  status: 'pending' | 'working' | 'ready' | 'error';
  error: DiagramLayoutError | Error | null;
}

const NOTHING: never[] = [];

/** Lays a draft out, in a worker, measuring its words first. It runs again when the graph or a font changes, and a new run
 *  stops the one before it. Unmounting stops the worker. */
export function useDiagramLayout<N = unknown, E = unknown>(draft: DiagramDraft<N, E>, options: UseDiagramLayoutOptions<N, E> = {}): UseDiagramLayout<N, E> {
  const { direction, elk, worker, host, initial } = options;
  const fonts = useFontVersion();
  const shown = useShownVersion(host);
  const [state, setState] = useState<{ result: DiagramLayoutResult<N, E> | null; status: UseDiagramLayout['status']; error: UseDiagramLayout['error'] }>(
    () => ({ result: initial ?? null, status: initial ? 'working' : 'pending', error: null }),
  );
  const engine = useRef<DiagramLayoutEngine | null>(null);
  const started = useRef<Function | undefined>(undefined);
  const lastGraph = useRef<string | null>(null);
  const elkKey = useMemo(() => JSON.stringify(elk ?? null), [elk]);
  // What a layout depends on: not positions, which it's about to replace, nor anything else in a node's data.
  const key = useMemo(() => JSON.stringify([
    draft.nodes.map((n) => [n.id, n.parent ?? null, n.kind ?? null, n.label ?? null, n.detail ?? null, n.w ?? null, n.h ?? null, n.ports?.map((p) => [p.id, p.side]) ?? null]),
    (draft.edges ?? NOTHING).map((e) => [e.id, e.from, e.to, e.fromPort ?? null, e.toPort ?? null, e.label ?? null]),
    direction ?? null, elkKey,
  ]), [draft.nodes, draft.edges, direction, elkKey]);
  const latest = useRef(draft);
  latest.current = draft;

  useEffect(() => {
    const current = latest.current;
    const stop = new AbortController();
    setState((s) => ({ ...s, status: s.result ? 'working' : 'pending', error: null }));
    (async () => {
      // Measuring first, on this thread, as only it has the fonts.
      const text = await measureTextGently(diagramTextRuns(current.nodes as DiagramNode<N>[], current.edges ?? NOTHING), host?.current);
      if (stop.signal.aborted) return;
      // A large graph takes a while to build, compare and hand over: a frame each, so none of them is one long gap.
      const large = current.nodes.length > 500;
      if (large) await nextFrame();
      if (stop.signal.aborted) return;
      const graph = toElkGraph(current, { direction, elk: elk ?? undefined, text });
      if (large) await nextFrame();
      if (stop.signal.aborted) return;
      const signature = JSON.stringify(graph);
      // A font that loaded and changed no sizes changes nothing.
      if (signature === lastGraph.current) {
        setState((s) => ({ ...s, status: 'ready' }));
        return;
      }
      if (started.current !== worker) {
        engine.current?.dispose();
        engine.current = null;
        started.current = worker;
      }
      engine.current ??= createDiagramLayoutEngine({ worker });
      if (large) await nextFrame();
      if (stop.signal.aborted) return;
      const result = await runLayout(current, { signal: stop.signal }, engine.current, graph);
      if (stop.signal.aborted) return;
      lastGraph.current = signature;
      setState({ result, status: 'ready', error: null });
    })().catch((error: DiagramLayoutError | Error) => {
      if (!stop.signal.aborted) setState((s) => ({ ...s, status: 'error', error }));
    });
    return () => stop.abort();
    // `key` stands for the draft and `elk`. `fonts` and `shown` are here because the words haven't changed, but what they
    // measure has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fonts, shown, worker, host]);

  useEffect(() => () => {
    engine.current?.dispose();
    engine.current = null;
  }, []);

  const result = state.result;
  // Where things are is the layout's, and what they are is the draft's as it is now. A new name the same size, or new data,
  // lays out the same, so no new layout brings it, and without this the last one's nodes were drawn as they were.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => (result ? onLayout(draft, result) : null), [draft.nodes, draft.edges, result]);
  return {
    nodes: now?.nodes ?? NOTHING, edges: now?.edges ?? NOTHING,
    bounds: result?.bounds, engine: result?.engine, ms: result?.ms,
    status: state.status, error: state.error,
  };
}

/** A draft's nodes and edges where a layout put them: each with the layout's place, size, port places and route, and the
 *  draft's everything else. What the layout hasn't placed yet isn't there. */
export function onLayout<N, E>(draft: DiagramDraft<N, E>, laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges'>): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges'> {
  const placedNodes = new Map(laid.nodes.map((n) => [n.id, n]));
  const placedEdges = new Map(laid.edges.map((e) => [e.id, e]));
  const nodes: DiagramNode<N>[] = [];
  for (const n of draft.nodes) {
    const at = placedNodes.get(n.id);
    if (!at) continue;
    const ports = n.ports?.map((p) => {
      const placed = at.ports?.find((q) => q.id === p.id)?.at;
      return p.at !== undefined || placed === undefined ? p : { ...p, at: placed };
    });
    nodes.push({ ...n, x: at.x, y: at.y, w: at.w, h: at.h, ...(ports ? { ports } : null) } as DiagramNode<N>);
  }
  const edges: DiagramLayoutResult<N, E>['edges'] = [];
  for (const e of draft.edges ?? NOTHING) {
    const at = placedEdges.get(e.id);
    if (!at) continue;
    const { labelBox: _stale, ...rest } = e;
    edges.push({ ...rest, points: at.points, ...(at.labelBox ? { labelBox: at.labelBox } : null) });
  }
  return { nodes, edges };
}
