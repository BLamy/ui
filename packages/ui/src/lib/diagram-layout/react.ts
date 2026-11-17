'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { diagramTextRuns, type DiagramNode } from '@/lib/diagram-model';
import { createDiagramLayoutEngine, routeForks, routePortEdges, runLayout, toElkGraph, wrapDiagram, type DiagramBoardSize, type DiagramDraft, type DiagramLayoutEngine, type DiagramLayoutError, type DiagramLayoutOptions, type DiagramLayoutResult } from '@/lib/diagram-layout';
import { estimateText, measureTextGently, nextFrame, type TextMeasurer } from '@/lib/diagram-text';
import { useFontVersion, useShownVersion } from '@/lib/use-font-version';

export interface UseDiagramLayoutOptions<N = unknown, E = unknown> extends Pick<DiagramLayoutOptions, 'direction' | 'density' | 'elk' | 'worker'> {
  /** Measure text in here, so its fonts apply. Without it, measuring happens in the page's body. It's also the board the
   *  diagram fills: a long run wraps into columns where they fit (`board`), and back as the host narrows to a phone's. */
  host?: RefObject<Element | null>;
  /** The board to fill, in px, instead of the host's size; `null` never wraps. */
  board?: DiagramBoardSize | null;
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
  const { direction, density, elk, worker, host, initial, board: boardProp } = options;
  const hostSize = useHostSize(host, boardProp === undefined);
  const board = boardProp === undefined ? hostSize : boardProp;
  const fonts = useFontVersion();
  const shown = useShownVersion(host);
  const [state, setState] = useState<{
    result: DiagramLayoutResult<N, E> | null; status: UseDiagramLayout['status']; error: UseDiagramLayout['error'];
    /** The graph the result is a layout of (`key`), and whether nothing's run since (`null`: the `initial` one). */
    of: string | null;
    /** What its words measured, for routing its ports again once it's wrapped. */
    text: TextMeasurer;
  }>(
    () => ({ result: initial ?? null, status: initial ? 'working' : 'pending', error: null, of: null, text: estimateText }),
  );
  const engine = useRef<DiagramLayoutEngine | null>(null);
  const started = useRef<DiagramLayoutOptions['worker'] | undefined>(undefined);
  const lastGraph = useRef<string | null>(null);
  const elkKey = useMemo(() => JSON.stringify(elk ?? null), [elk]);
  // What a layout depends on: not positions, which it's about to replace, nor anything else in a node's data.
  const key = useMemo(() => JSON.stringify([
    draft.nodes.map((n) => [n.id, n.parent ?? null, n.kind ?? null, n.variant ?? null, n.title ?? null, n.icon ?? null, n.trailing ?? null, n.description ?? null, n.sections ?? null, n.w ?? null, n.h ?? null, n.ports?.map((p) => [p.id, p.side, p.at ?? null, p.offset ?? null]) ?? null]),
    (draft.edges ?? NOTHING).map((e) => [e.id, e.from, e.to, e.fromPort ?? null, e.toPort ?? null, e.title ?? null, e.icon ?? null, e.sections ?? null, e.forkOf ?? null]),
    direction ?? null, density ?? null, elkKey,
  ]), [draft.nodes, draft.edges, direction, density, elkKey]);
  const latest = useRef(draft);
  latest.current = draft;

  useEffect(() => {
    const current = latest.current;
    // Nothing to lay out (a diagram whose nodes all have places hands over an empty draft): no engine, so no ELK and no worker.
    if (!current.nodes.length) {
      setState({ result: { nodes: [], edges: [], bounds: { x: 0, y: 0, w: 0, h: 0 }, engine: 'main-thread', ms: 0 }, status: 'ready', error: null, of: key, text: estimateText });
      lastGraph.current = null;
      return;
    }
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
      const graph = toElkGraph(current, { direction, density, elk: elk ?? undefined, text });
      if (large) await nextFrame();
      if (stop.signal.aborted) return;
      const signature = JSON.stringify(graph);
      // A font that loaded and changed no sizes changes nothing.
      if (signature === lastGraph.current) {
        setState((s) => ({ ...s, status: 'ready', of: key }));
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
      // Its ports are routed here, once it's wrapped to the board.
      const result = await runLayout(current, { signal: stop.signal, text }, engine.current, graph, false);
      if (stop.signal.aborted) return;
      lastGraph.current = signature;
      setState({ result, status: 'ready', error: null, of: key, text });
    })().catch((error: DiagramLayoutError | Error) => {
      if (!stop.signal.aborted) setState((s) => ({ ...s, status: 'error', error }));
    });
    return () => stop.abort();
    // `key` stands for the draft and `elk`. `fonts` and `shown` are here because the words haven't changed, but what they
    // measure has.
  }, [key, fonts, shown, worker, host]);

  useEffect(() => () => {
    engine.current?.dispose();
    engine.current = null;
  }, []);

  const result = state.result;
  // Where things are is the layout's, and what they are is the draft's: the draft as it is now, while the graph is the one
  // laid out (a new name the same size, or new data, lays out the same, so no new layout brings it). A graph that has to be
  // laid out again leaves the last picture as it was until its own layout lands: a new draft's names on the old places
  // would be wrong anyway, and drawing them is a frame's worth of work (2,000 new nodes over 100) for nothing.
  const shownDraft = useRef<{ draft: DiagramDraft<N, E>; result: DiagramLayoutResult<N, E> } | null>(null);
  const fresh = state.of === null || state.of === key;
  if (result && (fresh || shownDraft.current?.result !== result)) shownDraft.current = { draft, result };
  const showing = shownDraft.current?.draft;
  // Wrapped to fill the board, which is quick: only a new size brings it, not a new layout. Then the routes between ports,
  // in lanes of their own, from where things ended up, and those that fork from another's label.
  const text = state.text;
  const shaped = useMemo(() => (result ? { ...result, ...routeForks(routePortEdges(board ? wrapDiagram(result, board, direction) : result, text), text) } : result), [result, board, direction, text]);
  const now = useMemo(() => (shaped && showing ? onLayout(showing, shaped) : null), [showing?.nodes, showing?.edges, shaped]);
  return {
    nodes: now?.nodes ?? NOTHING, edges: now?.edges ?? NOTHING,
    bounds: shaped?.bounds, engine: result?.engine, ms: result?.ms,
    status: state.status, error: state.error,
  };
}

/** How big the host is, in steps of 40 px, so a resize only wraps again when it's grown or shrunk by a good deal. */
function useHostSize(host: RefObject<Element | null> | undefined, on: boolean): DiagramBoardSize | null {
  const [size, setSize] = useState<DiagramBoardSize | null>(null);
  useEffect(() => {
    const el = host?.current;
    if (!on || !el || typeof ResizeObserver === 'undefined') return undefined;
    const step = (v: number) => Math.round(v / 40) * 40;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const next = { width: step(r.width), height: step(r.height) };
      setSize((was) => (was && was.width === next.width && was.height === next.height ? was : next));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [host, on]);
  return size;
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
      return p.at !== undefined || p.offset !== undefined || placed === undefined ? p : { ...p, at: placed };
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
