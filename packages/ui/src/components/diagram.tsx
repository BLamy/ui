'use client';
import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { cva } from 'class-variance-authority';
import { Canvas, CanvasGuides, CanvasMarquee, CanvasMiniMap, type CanvasMiniMapItem, type CanvasMiniMapProps, type CanvasPointerInfo, type CanvasProps } from '@/components/ui/canvas';
import { fitCamera, type Camera, type Guide, type Pt, type Rect } from '@/lib/canvas-math';
import { useContainerSize } from '@/lib/container';
import { hitTestDiagram, stepDiagramGesture, type DiagramGesture, type DiagramGestureEvent, type DiagramHit } from '@/lib/diagram-gesture';
import {
  NOTHING_SELECTED, deleteItems, diagramBounds, diagramTextRuns, edgeGeometries, indexDiagram, labelBox, moveNodes, regionDividers, sizeNodesToText,
  type ConnectorGeometry, type DiagramDivider, type DiagramEdge, type DiagramIndex, type DiagramNode, type DiagramSelection,
} from '@/lib/diagram-model';
import { DIAGRAM_TEXT_CLASS, estimateText, measureText, type TextMeasurer } from '@/lib/diagram-text';
import { useFontVersion } from '@/lib/use-font-version';
import { cn } from '@/lib/utils';

/* ══ Diagram — nodes, edges, labels and regions on the Canvas ══
   Hand it nodes and edges as plain data (`@/lib/diagram-model`) and it draws them on a `Canvas`, so the camera, the
   minimap and `useCanvas` are the canvas's own. Everything's in board units, and scales with the camera as an object on a
   board does, borders included. Lines and arrowheads are the exception: they keep their thickness on screen at any zoom.
   Text that would be too small to read hides.

   Give it `editable` and the pointer selects, moves and deletes, as one gesture (`@/lib/diagram-gesture`), with undo. The
   data's controlled with `nodes`, `edges` and `onChange`, or left to it with `defaultNodes` and `defaultEdges`. */

/* ── Looks ── */

/** A line's thickness on screen, whatever the zoom: `--diagram-z` is the camera's zoom. */
const LINE = '[stroke-width:calc(1.25px/var(--diagram-z))] [stroke-linejoin:round]';

export const diagramNodeVariants = cva('relative size-full', {
  variants: {
    kind: {
      node: 'flex flex-col items-center justify-center rounded-ctl border border-border bg-card px-3 py-2 text-card-foreground shadow-hairline',
      final: 'flex flex-col items-center justify-center rounded-ctl border-2 border-foreground bg-card px-3 py-2 text-card-foreground outline-1 -outline-offset-4 outline-foreground',
      initial: 'rounded-full bg-foreground',
      compound: 'rounded-card border border-border bg-secondary',
      parallel: 'rounded-card border border-dashed border-border bg-secondary',
      region: 'rounded-card',
      root: 'rounded-card border border-border',
    },
  },
  defaultVariants: { kind: 'node' },
});

export const diagramEdgeVariants = cva(`fill-none ${LINE}`, {
  variants: {
    kind: {
      event: 'stroke-muted-foreground',
      done: 'stroke-muted-foreground',
      invoke: 'stroke-muted-foreground',
      /** Taken as soon as it can be, with no event: dashes. */
      always: 'stroke-muted-foreground [stroke-dasharray:calc(5px/var(--diagram-z))_calc(3px/var(--diagram-z))]',
      /** Taken when time runs out: dots. */
      after: 'stroke-muted-foreground [stroke-dasharray:calc(1.5px/var(--diagram-z))_calc(3px/var(--diagram-z))] [stroke-linecap:round]',
      initial: 'stroke-foreground',
    },
  },
  defaultVariants: { kind: 'event' },
});

type EdgeLook = NonNullable<Parameters<typeof diagramEdgeVariants>[0]>['kind'];
const EDGE_LOOKS: readonly string[] = ['event', 'done', 'invoke', 'always', 'after', 'initial'];
const edgeLook = (kind: string | undefined): EdgeLook => (kind && EDGE_LOOKS.includes(kind) ? (kind as EdgeLook) : 'event');

const isContainer = (n: DiagramNode<unknown>) => n.kind === 'compound' || n.kind === 'parallel' || n.kind === 'region' || n.kind === 'root';

/** The zoom below which each kind of text hides: under about 3 px for a node's, and 4.4 px for an edge label's. */
const NODE_TEXT_ZOOM = 0.25;
const EDGE_LABEL_ZOOM = 0.4;

/* ── A node ── */

export interface DiagramNodeBodyProps {
  node: DiagramNode<unknown>;
  className?: string;
  style?: CSSProperties;
}

/** How a node looks, by its kind. Use it in `renderNode` to add to what's drawn rather than replacing it. */
export function DiagramNodeBody({ node, className, style }: DiagramNodeBodyProps) {
  const kind = node.kind ?? 'node';
  if (kind === 'initial') return <div data-slot="diagram-node-body" className={cn(diagramNodeVariants({ kind }), className)} style={style} />;
  if (isContainer(node)) {
    return (
      <div data-slot="diagram-node-body" className={cn(diagramNodeVariants({ kind }), className)} style={style}>
        {node.label ? (
          <div data-slot="diagram-node-label" className={cn('absolute top-1.5 left-3 whitespace-nowrap text-muted-foreground group-data-[zoom=far]/diagram:hidden', DIAGRAM_TEXT_CLASS.title)}>
            {node.label}
            {node.detail ? <span data-slot="diagram-node-detail" className="font-normal"> ({node.detail})</span> : null}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div data-slot="diagram-node-body" className={cn(diagramNodeVariants({ kind }), className)} style={style}>
      <div data-slot="diagram-node-label" className={cn('max-w-full text-center [overflow-wrap:anywhere] group-data-[zoom=far]/diagram:hidden', DIAGRAM_TEXT_CLASS.label)}>{node.label}</div>
      {node.detail ? <div data-slot="diagram-node-detail" className={cn('max-w-full text-center text-muted-foreground [overflow-wrap:anywhere] group-data-[zoom=far]/diagram:hidden', DIAGRAM_TEXT_CLASS.detail)}>{node.detail}</div> : null}
    </div>
  );
}

interface NodeViewProps {
  node: DiagramNode<unknown>;
  selected?: boolean;
  renderNode?: (node: DiagramNode<any>) => ReactNode;
}

/** A ring around what's selected that's the same thickness on screen at any zoom. A box-shadow, as Chrome rounds a border or
 *  an outline under 1 px up to 1 px, before the board's scale makes it thicker. */
const SELECTED = 'data-selected:[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--background),0_0_0_calc(3.6px/var(--diagram-z))_var(--primary)]';

const NodeView = memo(function NodeView({ node, selected, renderNode }: NodeViewProps) {
  return (
    <div
      data-slot="diagram-node"
      data-node={node.id}
      data-kind={node.kind ?? 'node'}
      data-selected={selected || undefined}
      className={cn('absolute', isContainer(node) ? 'rounded-card' : node.kind === 'initial' ? 'rounded-full' : 'rounded-ctl', SELECTED)}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      {renderNode ? renderNode(node) : <DiagramNodeBody node={node} />}
    </div>
  );
});

/* ── An edge ── */

const EdgeView = memo(function EdgeView({ edge, d, arrow, selected }: { edge: DiagramEdge<unknown>; d: string; arrow: string; selected?: boolean }) {
  const look = edgeLook(edge.kind);
  return (
    <path
      data-slot="diagram-edge"
      data-edge={edge.id}
      data-kind={edge.kind ?? 'event'}
      data-selected={selected || undefined}
      d={d}
      markerEnd={`url(#${arrow}${selected ? '-selected' : look === 'initial' ? '-strong' : ''})`}
      className={cn(diagramEdgeVariants({ kind: look }), selected && 'stroke-primary')}
    />
  );
});

const EdgeLabel = memo(function EdgeLabel({ edge, box }: { edge: DiagramEdge<unknown>; box: Rect }) {
  return (
    <div
      data-slot="diagram-edge-label"
      data-edge={edge.id}
      className={cn('absolute whitespace-nowrap text-muted-foreground group-data-[zoom=far]/diagram:hidden group-data-[zoom=mid]/diagram:hidden', DIAGRAM_TEXT_CLASS.edge)}
      style={{ left: box.x, top: box.y }}
    >
      {edge.label}
    </div>
  );
});

/** An arrowhead as a marker: its size goes by the line's thickness, so it's 7 px on screen from 100% up. Below that it
 *  shrinks with the board, down to 40%, so arrows don't outgrow the nodes they point at. */
function ArrowMarker({ id, className }: { id: string; className: string }) {
  return (
    <marker id={id} viewBox="0 0 7 7.7" refX="7" refY="3.85" markerWidth="5.6" markerHeight="6.16" markerUnits="strokeWidth" orient="auto" overflow="visible">
      <path d="M0 0L7 3.85L0 7.7Z" className={cn('origin-[7px_3.85px] [transform:scale(clamp(0.4,var(--diagram-z),1))]', className)} />
    </marker>
  );
}

/* ── The board ── */

interface Laid<N, E> {
  index: DiagramIndex<N>;
  geometries: Map<string, ConnectorGeometry>;
  containers: DiagramNode<N>[];
  leaves: DiagramNode<N>[];
  edges: { edge: DiagramEdge<E>; geometry: ConnectorGeometry }[];
  labels: { edge: DiagramEdge<E>; box: Rect }[];
  dividers: DiagramDivider[];
  bounds: Rect | null;
}

function layOut<N, E>(nodes: readonly DiagramNode<N>[], edges: readonly DiagramEdge<E>[], text: TextMeasurer): Laid<N, E> {
  const index = indexDiagram(nodes);
  const geometries = edgeGeometries(edges, index);
  const drawn: Laid<N, E>['edges'] = [];
  const labels: Laid<N, E>['labels'] = [];
  for (const edge of edges) {
    const geometry = geometries.get(edge.id);
    if (!geometry) continue;
    drawn.push({ edge, geometry });
    if (edge.label) labels.push({ edge, box: edge.labelBox ?? labelBox(geometry.pts, text(edge.label, 'edge')) });
  }
  // Outer containers first, so what's inside draws over them, however the nodes were listed.
  const depth = (n: DiagramNode<N>) => index.depth.get(n.id) ?? 0;
  const containers = nodes.filter(isContainer).map((n, i) => ({ n, i })).sort((a, b) => depth(a.n) - depth(b.n) || a.i - b.i).map(({ n }) => n);
  const leaves = nodes.filter((n) => !isContainer(n));
  return {
    index, geometries, containers, leaves, edges: drawn, labels, dividers: regionDividers(index),
    bounds: diagramBounds(nodes, geometries.values(), labels.map((l) => l.box)),
  };
}

const Board = memo(function Board({ laid, renderNode, arrow, selection }: { laid: Laid<any, any>; renderNode?: NodeViewProps['renderNode']; arrow: string; selection: { nodes: Set<string>; edges: Set<string> } }) {
  return (
    <>
      {laid.containers.map((n) => <NodeView key={n.id} node={n} selected={selection.nodes.has(n.id)} renderNode={renderNode} />)}
      <svg data-slot="diagram-edges" aria-hidden="true" className="absolute top-0 left-0 overflow-visible" width={1} height={1}>
        <defs>
          <ArrowMarker id={arrow} className="fill-muted-foreground" />
          <ArrowMarker id={`${arrow}-strong`} className="fill-foreground" />
          <ArrowMarker id={`${arrow}-selected`} className="fill-primary" />
        </defs>
        {laid.dividers.map((d) => (
          <line
            key={d.id}
            data-slot="diagram-divider"
            x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
            className="stroke-border [stroke-dasharray:calc(6px/var(--diagram-z))_calc(4px/var(--diagram-z))] [stroke-width:calc(1px/var(--diagram-z))]"
          />
        ))}
        {laid.edges.map(({ edge, geometry }) => <EdgeView key={edge.id} edge={edge} d={geometry.d} arrow={arrow} selected={selection.edges.has(edge.id)} />)}
      </svg>
      {laid.leaves.map((n) => <NodeView key={n.id} node={n} selected={selection.nodes.has(n.id)} renderNode={renderNode} />)}
      {laid.labels.map(({ edge, box }) => <EdgeLabel key={edge.id} edge={edge} box={box} />)}
    </>
  );
});

/* ── Diagram ── */

/** What just happened to a diagram's data. Undo and redo come this way too, so an app sees every change the same way. */
export interface DiagramChange<N = unknown, E = unknown> {
  nodes: DiagramNode<N>[];
  edges: DiagramEdge<E>[];
  reason: 'move' | 'delete' | 'undo' | 'redo';
}

export interface DiagramProps<N = unknown, E = unknown> extends Pick<CanvasProps, 'background' | 'panning' | 'cursor' | 'autoFocus' | 'aria-label' | 'overlay'> {
  /** Controlled data, with `onChange`. Refuse a change by not passing it back, and it goes back where it was. */
  nodes?: readonly DiagramNode<N>[];
  edges?: readonly DiagramEdge<E>[];
  /** Data left to the diagram. */
  defaultNodes?: readonly DiagramNode<N>[];
  defaultEdges?: readonly DiagramEdge<E>[];
  onChange?: (change: DiagramChange<N, E>) => void;
  /** Let the pointer select nodes and edges, one at a time, with shift or ⌘, or with a marquee. On when `editable` is. */
  selectable?: boolean;
  /** Let the pointer and the keys move and delete things, with undo. */
  editable?: boolean;
  selection?: DiagramSelection;
  defaultSelection?: DiagramSelection;
  onSelectionChange?: (selection: DiagramSelection) => void;
  /** Controlled camera. Left out, the diagram fits its content, and goes on fitting until the camera's moved. */
  camera?: Camera;
  defaultCamera?: Camera;
  onCameraChange?: (camera: Camera) => void;
  /** How much air to leave around the content when fitting it, in px (default 24). */
  fitPadding?: number;
  /** Size each node to its words, measured in the real font, around its center. A node that holds others keeps its size. */
  autoSize?: boolean;
  /** An overview in a corner, on `CanvasMiniMap`. */
  minimap?: boolean | Omit<CanvasMiniMapProps, 'items'>;
  /** Draws a node's insides, within a box it's placed in. Keep the function stable, as it's what the nodes memoize on. */
  renderNode?: (node: DiagramNode<N>) => ReactNode;
  /** More of the board layer, over the diagram. `useCanvas` works here. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const EMPTY: readonly never[] = [];
const NO_GUIDES: Guide[] = [];
/** How many changes undo reaches back. */
const HISTORY_LIMIT = 100;

interface Snapshot<N, E> {
  nodes: readonly DiagramNode<N>[];
  edges: readonly DiagramEdge<E>[];
}

/** What the text in a diagram measures. The first render, on a server or hydrating, goes by estimates. Straight after, it's
 *  measured in the real font, and again if the words change or a font turns up later. A drag doesn't measure anything. */
function useDiagramText(host: RefObject<HTMLElement | null>, nodes: readonly DiagramNode<any>[], edges: readonly DiagramEdge<any>[], needed: boolean): TextMeasurer {
  const fonts = useFontVersion();
  const [text, setText] = useState<TextMeasurer>(() => estimateText);
  const words = useMemo(() => (needed ? diagramTextRuns(nodes, edges) : []), [needed, nodes, edges]);
  const key = useMemo(() => words.map((r) => `${r.kind}:${r.text}`).join('\0'), [words]);
  useLayoutEffect(() => {
    if (needed) setText(() => measureText(words, host.current));
    // `key` stands for `words`. `fonts` is here because what it's measuring hasn't changed, but the answer has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, key, needed, fonts]);
  return text;
}

/** A diagram on a `Canvas`. Sits in its host like any BL UI container: it fills the nearest positioned box. */
export function Diagram<N = unknown, E = unknown>({
  nodes: givenNodes, edges: givenEdges, defaultNodes = EMPTY, defaultEdges = EMPTY, onChange, selectable: selectableProp, editable = false,
  selection: selectionProp, defaultSelection = NOTHING_SELECTED, onSelectionChange,
  camera: controlled, defaultCamera, onCameraChange, fitPadding = 24, autoSize, minimap, renderNode,
  background, panning, cursor, autoFocus, 'aria-label': ariaLabel = 'Diagram', overlay, children, className, style,
}: DiagramProps<N, E>) {
  const selectable = selectableProp ?? editable;
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1000, height: 700 });
  const [own, setOwn] = useState<Camera | null>(defaultCamera ?? null);
  const arrow = `diagram-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  /* ── The data: given, or held here, and what a drag shows before it's committed ── */
  const isControlled = givenNodes !== undefined;
  const [heldData, setHeldData] = useState<Snapshot<N, E>>(() => ({ nodes: defaultNodes, edges: defaultEdges }));
  const data = useMemo<Snapshot<N, E>>(() => (isControlled ? { nodes: givenNodes, edges: givenEdges ?? EMPTY } : heldData), [isControlled, givenNodes, givenEdges, heldData]);
  const [draft, setDraft] = useState<Snapshot<N, E> | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  const shown = draft ?? data;
  const text = useDiagramText(ref, shown.nodes, shown.edges, !!autoSize || shown.edges.some((e) => e.label && !e.labelBox));
  const nodes = useMemo(() => (autoSize ? sizeNodesToText(shown.nodes, text) : shown.nodes), [autoSize, shown.nodes, text]);
  const laid = useMemo(() => layOut(nodes, shown.edges, text), [nodes, shown.edges, text]);

  const camera = controlled ?? own ?? fitCamera(laid.bounds, size, fitPadding);
  const change = (next: Camera) => {
    setOwn(next);
    onCameraChange?.(next);
  };

  /* ── Selection ── */
  const [heldSelection, setHeldSelection] = useState<DiagramSelection>(defaultSelection);
  const selection = selectionProp ?? heldSelection;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const select = useCallback((next: DiagramSelection) => {
    selectionRef.current = next;
    setHeldSelection(next);
    onSelectionChangeRef.current?.(next);
  }, []);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const selectedSets = useMemo(() => ({ nodes: new Set(selection.nodes), edges: new Set(selection.edges) }), [selection]);

  /* ── Changes, and undoing them. A controlled parent may refuse, so history only moves once the data really has. ── */
  const history = useRef<{ past: Snapshot<N, E>[]; future: Snapshot<N, E>[] }>({ past: [], future: [] });
  const pending = useRef<{ before: Snapshot<N, E>; mode: 'edit' | 'undo' | 'redo' } | null>(null);
  const dataRef = useRef(data);
  const settle = (before: Snapshot<N, E>, mode: 'edit' | 'undo' | 'redo') => {
    const h = history.current;
    if (mode === 'edit') { h.past.push(before); if (h.past.length > HISTORY_LIMIT) h.past.shift(); h.future = []; }
    else if (mode === 'undo') { h.past.pop(); h.future.push(before); }
    else { h.future.pop(); h.past.push(before); }
  };
  useLayoutEffect(() => {
    const before = dataRef.current;
    dataRef.current = data;
    if (before.nodes === data.nodes && before.edges === data.edges) return;
    const p = pending.current;
    pending.current = null;
    if (p) settle(p.before, p.mode);
    // Data that changed for reasons of its own can't be undone to what it was, without losing whatever the change was.
    else history.current = { past: [], future: [] };
  }, [data]);
  const commit = (next: { nodes: readonly DiagramNode<N>[]; edges: readonly DiagramEdge<E>[] }, reason: DiagramChange['reason']) => {
    const before = dataRef.current;
    const mode = reason === 'undo' || reason === 'redo' ? reason : 'edit';
    pending.current = { before, mode };
    if (!isControlled) setHeldData(next);
    onChange?.({ nodes: [...next.nodes], edges: [...next.edges], reason });
  };
  const undo = () => { const to = history.current.past[history.current.past.length - 1]; if (to) commit(to, 'undo'); };
  const redo = () => { const to = history.current.future[history.current.future.length - 1]; if (to) commit(to, 'redo'); };

  /* ── The gesture ── */
  const gesture = useRef<DiagramGesture>({ k: 'idle' });
  const send = (event: DiagramGestureEvent) => {
    // A camera that's still fitting the content stops at the first press, or dragging would move the view under the pointer.
    if (event.type === 'down' && !controlled && !own) setOwn(camera);
    const step = stepDiagramGesture(gesture.current, event, { index: laid.index, selection: selectionRef.current, zoom: camera.z, editable });
    const g = step.gesture;
    gesture.current = g;
    if (step.selection) select(step.selection);
    if (g.k === 'move') {
      const base = dataRef.current;
      const index = indexDiagram(base.nodes);
      setDraft(moveNodes(base.nodes, base.edges, g.ids, g.delta.x, g.delta.y, index));
      setGuides(g.guides);
    } else {
      setDraft(null);
      setGuides(NO_GUIDES);
    }
    setMarquee(g.k === 'marquee' ? g.rect : null);
    if (step.commit) {
      const base = dataRef.current;
      commit(moveNodes(base.nodes, base.edges, step.commit.ids, step.commit.delta.x, step.commit.delta.y), 'move');
    }
  };
  const cancel = () => { if (gesture.current.k !== 'idle') send({ type: 'cancel' }); };
  const hitAt = (p: Pt): DiagramHit => hitTestDiagram(p, { index: laid.index, geometries: laid.geometries, labels: laid.labels.map((l) => ({ id: l.edge.id, box: l.box })) }, camera.z);
  const interactive = selectable || editable;
  const pointerProps = interactive ? {
    onCanvasPointerDown: (e: ReactPointerEvent, { board, screen }: CanvasPointerInfo) => send({ type: 'down', hit: hitAt(board), board, screen, additive: e.shiftKey || e.metaKey || e.ctrlKey }),
    onCanvasPointerMove: (e: ReactPointerEvent, { board, screen }: CanvasPointerInfo) => { if (gesture.current.k !== 'idle') send({ type: 'move', board, screen, noSnap: e.metaKey || e.ctrlKey }); },
    onCanvasPointerUp: (e: ReactPointerEvent) => send(e.type === 'pointercancel' ? { type: 'cancel' } : { type: 'up' }),
    onNavigationStart: cancel,
  } : null;

  const deleteSelection = () => {
    const sel = selectionRef.current;
    if (!sel.nodes.length && !sel.edges.length) return;
    cancel();
    const base = dataRef.current;
    const index = indexDiagram(base.nodes);
    const next = deleteItems(base.nodes, base.edges, { nodes: sel.nodes.filter((id) => index.byId.get(id)?.kind !== 'root'), edges: sel.edges }, index);
    if (next.nodes.length === base.nodes.length && next.edges.length === base.edges.length) return;
    commit(next, 'delete');
    select(NOTHING_SELECTED);
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      if (gesture.current.k !== 'idle') cancel();
      else if (selection.nodes.length || selection.edges.length) select(NOTHING_SELECTED);
      return;
    }
    if (mod && key === 'a' && selectable) { e.preventDefault(); select({ nodes: data.nodes.filter((n) => n.kind !== 'root').map((n) => n.id), edges: data.edges.map((x) => x.id) }); return; }
    if (!editable) return;
    if (mod && key === 'z') { e.preventDefault(); cancel(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); cancel(); redo(); return; }
    if (key === 'delete' || key === 'backspace') { e.preventDefault(); deleteSelection(); }
  };

  const board = useMemo(() => <Board laid={laid} renderNode={renderNode as NodeViewProps['renderNode']} arrow={arrow} selection={selectedSets} />, [laid, renderNode, arrow, selectedSets]);
  const marks = useMemo<CanvasMiniMapItem[]>(() => (minimap ? nodes.filter((n) => n.kind !== 'root').map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h })) : []), [minimap, nodes]);
  const zoom = camera.z < NODE_TEXT_ZOOM ? 'far' : camera.z < EDGE_LABEL_ZOOM ? 'mid' : 'near';
  return (
    <div
      ref={ref}
      data-slot="diagram"
      className={cn('absolute inset-0', className)}
      style={style}
      // Holding Space to pan drops a drag in progress, the same as a pinch does. It's the canvas's key, so it isn't handed on.
      onKeyDownCapture={(e) => { if (e.key === ' ') cancel(); }}
      onLostPointerCapture={cancel}
    >
      <Canvas
        camera={camera}
        onCameraChange={change}
        fit={laid.bounds}
        fitPadding={fitPadding}
        background={background}
        panning={panning}
        cursor={cursor}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        onCanvasKeyDown={interactive ? onKeyDown : undefined}
        {...pointerProps}
        overlay={<>{minimap ? <CanvasMiniMap items={marks} {...(minimap === true ? null : minimap)} /> : null}{overlay}</>}
      >
        <div
          data-slot="diagram-layer"
          data-zoom={zoom}
          className="group/diagram pointer-events-none absolute top-0 left-0"
          style={{ '--diagram-z': camera.z } as CSSProperties}
        >
          {board}
        </div>
        {guides.length ? <CanvasGuides guides={guides} /> : null}
        {marquee ? <CanvasMarquee rect={marquee} /> : null}
        {children}
      </Canvas>
    </div>
  );
}
