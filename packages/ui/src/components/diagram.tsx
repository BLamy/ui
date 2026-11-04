'use client';
import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { cva } from 'class-variance-authority';
import { Canvas, CanvasGuides, CanvasMarquee, CanvasMiniMap, type CanvasMiniMapItem, type CanvasMiniMapProps, type CanvasPointerInfo, type CanvasProps } from '@/components/ui/canvas';
import { centerOf, fitCamera, intersects, rectOf, toBoard, type Camera, type Guide, type Pt, type Rect } from '@/lib/canvas-math';
import { useContainerSize } from '@/lib/container';
import { connectionOf, connectionTargetAt, hitTestDiagram, movableNodes, offerConnection, stepDiagramGesture, type DiagramConnectionEnd, type DiagramGesture, type DiagramGestureEvent, type DiagramHit } from '@/lib/diagram-gesture';
import { cameraToShow, describeEdge, describeNode, edgesByNode, nearestNode, stepFocus, type DiagramFocus, type DiagramFocusStep } from '@/lib/diagram-keyboard';
import {
  DIAGRAM_SIDES, NOTHING_SELECTED, addConnection, anchorNormal, anchorPoint, checkConnection, connectorPath, deleteItems, diagramBounds, diagramTextRuns, edgeGeometries, edgeGeometry, indexDiagram, labelBox, moveEdgeEnd, moveNodes, nearestSide, portPoint, regionDividers, renderWindow, sizeNodesToText,
  type ConnectorEnd, type ConnectorGeometry, type DiagramConnection, type DiagramDivider, type DiagramEdge, type DiagramIndex, type DiagramNode, type DiagramPort, type DiagramSelection, type DiagramSide,
} from '@/lib/diagram-model';
import { DIAGRAM_TEXT_CLASS, estimateText, measureText, type TextMeasurer } from '@/lib/diagram-text';
import { useFontVersion, useShownVersion } from '@/lib/use-font-version';
import { cn } from '@/lib/utils';

/* ══ Diagram — nodes, edges, labels and regions on the Canvas ══
   Hand it nodes and edges as plain data (`@/lib/diagram-model`) and it draws them on a `Canvas`, so the camera, the
   minimap and `useCanvas` are the canvas's own. Everything's in board units, and scales with the camera as an object on a
   board does, borders included. Lines and arrowheads are the exception: they keep their thickness on screen at any zoom.
   Text that would be too small to read hides.

   Give it `editable` and the pointer selects, moves and deletes, as one gesture (`@/lib/diagram-gesture`), with undo. The
   data's controlled with `nodes`, `edges` and `onChange`, or left to it with `defaultNodes` and `defaultEdges`.

   It's one tab stop. From there the keys move between nodes and along edges (`@/lib/diagram-keyboard`), and the view follows.
   Each node and edge says what it is and what it connects to.

   Named ports (`DiagramNode.ports`) draw on their nodes. With `connectable`, which `editable` turns on, a drag from a port
   draws a connection that snaps to the nearest port in reach, and a node without ports gets one on each side once it's
   selected. `isValidConnection` says what's allowed, and a selected edge's ends can be moved. C does all that by keyboard. */

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

/** A diagram can draw thousands of nodes and edges, with only a few looks between them, so each is only worked out once. */
const once = <A extends string>(make: (key: A) => string) => {
  const known = new Map<A, string>();
  return (key: A) => {
    let v = known.get(key);
    if (v === undefined) { v = make(key); known.set(key, v); }
    return v;
  };
};
const edgeClass = once((key: string) => {
  const [look, selected, lit] = key.split(':');
  return cn(diagramEdgeVariants({ kind: look as EdgeLook }), selected && 'stroke-primary', lit && 'stroke-primary [stroke-width:calc(2.5px/var(--diagram-z))]', 'outline-none focus-visible:stroke-ring focus-visible:[stroke-width:calc(3px/var(--diagram-z))]');
});
const nodeBodyClass = once((kind: NonNullable<DiagramNode['kind']>) => diagramNodeVariants({ kind }));

const isContainer = (n: DiagramNode<unknown>) => n.kind === 'compound' || n.kind === 'parallel' || n.kind === 'region' || n.kind === 'root';

/** The zoom below which each kind of text hides: under about 3 px for a node's, and 4.4 px for an edge label's. */
const NODE_TEXT_ZOOM = 0.25;
const EDGE_LABEL_ZOOM = 0.4;

const TITLE_CLASS = cn('absolute top-1.5 left-3 whitespace-nowrap text-foreground/70 group-data-[zoom=far]/diagram:hidden', DIAGRAM_TEXT_CLASS.title);
const LABEL_CLASS = cn('max-w-full text-center [overflow-wrap:anywhere] group-data-[zoom=far]/diagram:hidden', DIAGRAM_TEXT_CLASS.label);
const DETAIL_CLASS = cn('max-w-full text-center text-foreground/70 [overflow-wrap:anywhere] group-data-[zoom=far]/diagram:hidden', DIAGRAM_TEXT_CLASS.detail);
const EDGE_LABEL_CLASS = cn('absolute whitespace-nowrap text-foreground/70 group-data-[zoom=far]/diagram:hidden group-data-[zoom=mid]/diagram:hidden', DIAGRAM_TEXT_CLASS.edge);
const nodeWrapClass = once((radius: string) => cn('absolute outline-none', radius));

/* ── A node ── */

export interface DiagramNodeBodyProps {
  node: DiagramNode<unknown>;
  className?: string;
  style?: CSSProperties;
}

/** How a node looks, by its kind. Use it in `renderNode` to add to what's drawn rather than replacing it. */
export function DiagramNodeBody({ node, className, style }: DiagramNodeBodyProps) {
  const kind = node.kind ?? 'node';
  if (kind === 'initial') return <div data-slot="diagram-node-body" className={className ? cn(nodeBodyClass(kind), className) : nodeBodyClass(kind)} style={style} />;
  if (isContainer(node)) {
    return (
      <div data-slot="diagram-node-body" className={className ? cn(nodeBodyClass(kind), className) : nodeBodyClass(kind)} style={style}>
        {node.label ? (
          <div data-slot="diagram-node-label" className={TITLE_CLASS}>
            {node.label}
            {node.detail ? <span data-slot="diagram-node-detail" className="font-normal"> ({node.detail})</span> : null}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div data-slot="diagram-node-body" className={className ? cn(nodeBodyClass(kind), className) : nodeBodyClass(kind)} style={style}>
      <div data-slot="diagram-node-label" className={LABEL_CLASS}>{node.label}</div>
      {node.detail ? <div data-slot="diagram-node-detail" className={DETAIL_CLASS}>{node.detail}</div> : null}
    </div>
  );
}

interface NodeViewProps {
  node: DiagramNode<unknown>;
  selected?: boolean;
  /** Whether being selected is something it can be, so that a screen reader says if it is. */
  selectable?: boolean;
  lit?: boolean;
  label: string;
  renderNode?: (node: DiagramNode<any>) => ReactNode;
}

/** A ring around what's selected or has focus, the same thickness on screen at any zoom. A box-shadow, as Chrome rounds a
 *  border or an outline under 1 px up to 1 px, before the board's scale makes it thicker. These sit in a layer of their own,
 *  and it's only that layer and the lines that get `--diagram-z`: a custom property that changes restyles everything under it,
 *  and with all the nodes under it, that was 79 ms a frame while zooming, at 2,000 nodes. */
const RING_SELECTED = '[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--background),0_0_0_calc(3.6px/var(--diagram-z))_var(--primary)]';
const RING_FOCUSED = '[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--background),0_0_0_calc(4px/var(--diagram-z))_var(--ring)]';
/** What's lit: a tint over it and a line around it, or only a thinner line for something that holds others. */
const LIT_LEAF = 'bg-primary/15 [box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--primary)]';
const LIT_CONTAINER = '[box-shadow:0_0_0_calc(1.5px/var(--diagram-z))_var(--primary)]';
const nodeRadius = (n: DiagramNode<any>) => (isContainer(n) ? 'rounded-card' : n.kind === 'initial' ? 'rounded-full' : 'rounded-ctl');

const NodeView = memo(function NodeView({ node, selected, selectable, lit, label, renderNode }: NodeViewProps) {
  return (
    <div
      data-slot="diagram-node"
      data-node={node.id}
      data-kind={node.kind ?? 'node'}
      data-selected={selected || undefined}
      // One tab stop, which is the canvas: the keys move focus from there, and a press never lands here.
      role="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={selectable ? !!selected : undefined}
      aria-current={lit || undefined}
      className={nodeWrapClass(nodeRadius(node))}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      {renderNode ? renderNode(node) : <DiagramNodeBody node={node} />}
    </div>
  );
});

/* ── An edge ── */

const EdgeView = memo(function EdgeView({ edge, d, arrow, selected, selectable, lit, label }: { edge: DiagramEdge<unknown>; d: string; arrow: string; selected?: boolean; selectable?: boolean; lit?: boolean; label: string }) {
  const look = edgeLook(edge.kind);
  return (
    <path
      data-slot="diagram-edge"
      data-edge={edge.id}
      data-kind={edge.kind ?? 'event'}
      data-selected={selected || undefined}
      data-lit={lit || undefined}
      role="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={selectable ? !!selected : undefined}
      d={d}
      markerEnd={`url(#${arrow}${selected || lit ? '-selected' : look === 'initial' ? '-strong' : ''})`}
      className={edgeClass(`${look}:${selected ? '1' : ''}:${lit ? '1' : ''}`)}
    />
  );
});

const EdgeLabel = memo(function EdgeLabel({ edge, box }: { edge: DiagramEdge<unknown>; box: Rect }) {
  return (
    <div
      data-slot="diagram-edge-label"
      data-edge={edge.id}
      // The edge's own label says this, along with what it joins.
      aria-hidden="true"
      className={EDGE_LABEL_CLASS}
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

/* ── Ports, and what's drawn while connecting ── */

const DOT = 'pointer-events-none absolute rounded-full [transform:translate(-50%,-50%)]';

/** A place to connect: the same size on screen at any zoom. It sits over every node, so one underneath can still be reached. */
const PortDot = memo(function PortDot({ at, node, port, side, active }: { at: Pt; node: string; port?: string; side?: DiagramSide; active: boolean }) {
  return (
    <span
      data-slot="diagram-port"
      data-port-of={node}
      data-port={port}
      data-side={side}
      aria-hidden="true"
      className={cn(DOT, 'bg-background', active ? 'size-[calc(10px/var(--diagram-z))] [box-shadow:inset_0_0_0_calc(1.6px/var(--diagram-z))_var(--primary)]' : 'size-[calc(6px/var(--diagram-z))] [box-shadow:inset_0_0_0_calc(1.2px/var(--diagram-z))_var(--muted-foreground)]')}
      style={{ left: at.x, top: at.y }}
    />
  );
});

const EDGE_END = cn(DOT, 'size-[calc(12px/var(--diagram-z))] bg-background [box-shadow:inset_0_0_0_calc(2px/var(--diagram-z))_var(--primary)]');

/** The route a connection would take, as it's being drawn. Dashed, and in the destructive color if it isn't allowed. */
function ConnectionPreview({ d, valid }: { d: string; valid: boolean }) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
      <path
        data-slot="diagram-connection"
        data-valid={valid}
        d={d}
        className={cn('fill-none [stroke-dasharray:calc(5px/var(--diagram-z))_calc(4px/var(--diagram-z))] [stroke-width:calc(1.6px/var(--diagram-z))]', valid ? 'stroke-primary' : 'stroke-destructive')}
      />
    </svg>
  );
}

/* ── The board ── */

interface Laid<N, E> {
  index: DiagramIndex<N>;
  geometries: Map<string, ConnectorGeometry>;
  edgesAt: ReturnType<typeof edgesByNode>;
  containers: DiagramNode<N>[];
  leaves: DiagramNode<N>[];
  edges: { edge: DiagramEdge<E>; geometry: ConnectorGeometry; box: Rect }[];
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
    drawn.push({ edge, geometry, box: rectOf(geometry.pts) });
    if (edge.label) labels.push({ edge, box: edge.labelBox ?? labelBox(geometry.pts, text(edge.label, 'edge')) });
  }
  // Outer containers first, so what's inside draws over them, however the nodes were listed.
  const depth = (n: DiagramNode<N>) => index.depth.get(n.id) ?? 0;
  const containers = nodes.filter(isContainer).map((n, i) => ({ n, i })).sort((a, b) => depth(a.n) - depth(b.n) || a.i - b.i).map(({ n }) => n);
  const leaves = nodes.filter((n) => !isContainer(n));
  return {
    index, geometries, edgesAt: edgesByNode(drawn.map((d) => d.edge)), containers, leaves, edges: drawn, labels, dividers: regionDividers(index),
    bounds: diagramBounds(nodes, geometries.values(), labels.map((l) => l.box)),
  };
}

/** How many nodes and edges a diagram can have before what's out of view stops being drawn. A small one's cheap to draw all
 *  of, which leaves everything for a screen reader to find and a browser to print. */
const CULL_ABOVE = 200;

/** Only what touches `win`, and whatever `keep` says has to stay. An edge goes by its route, not its ends, so one crossing
 *  the view with both ends far away still draws. */
function within<N, E>(laid: Laid<N, E>, win: Rect, keep: DiagramFocus | null): Laid<N, E> {
  const keepNode = keep?.kind === 'node' ? keep.id : null, keepEdge = keep?.kind === 'edge' ? keep.id : null;
  const onNode = (n: DiagramNode<N>) => intersects(n, win) || n.id === keepNode;
  return {
    ...laid,
    containers: laid.containers.filter(onNode),
    leaves: laid.leaves.filter(onNode),
    edges: laid.edges.filter((e) => intersects(e.box, win) || e.edge.id === keepEdge),
    labels: laid.labels.filter((l) => intersects(l.box, win)),
    dividers: laid.dividers.filter((d) => intersects({ x: Math.min(d.x1, d.x2), y: Math.min(d.y1, d.y2), w: Math.abs(d.x2 - d.x1), h: Math.abs(d.y2 - d.y1) }, win)),
  };
}

/* ── Diagram ── */

/** What just happened to a diagram's data. Undo and redo come this way too, so an app sees every change the same way. */
export interface DiagramChange<N = unknown, E = unknown> {
  nodes: DiagramNode<N>[];
  edges: DiagramEdge<E>[];
  reason: 'move' | 'delete' | 'connect' | 'reconnect' | 'undo' | 'redo';
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
  /** What to pick out, apart from what's selected: where a machine is, and how it got there. Each lit node says so to a screen
   *  reader, with `aria-current`. */
  lit?: DiagramSelection;
  onSelectionChange?: (selection: DiagramSelection) => void;
  /** Let the pointer and the keys draw connections, and move an edge's ends. On when `editable` is. */
  connectable?: boolean;
  /** Whether a connection's allowed: true, false, or the reason it isn't, in words. The default keeps to `checkConnection`. */
  isValidConnection?: (connection: DiagramConnection) => boolean | string;
  /** Makes the edge for a new connection. The default's an edge with only its ends and an id. */
  createEdge?: (connection: DiagramConnection) => DiagramEdge<E>;
  /** Enter on a focused node or edge, or a double click. */
  onActivate?: (item: DiagramFocus) => void;
  /** What a screen reader calls a node (default `node`): a state, a service. */
  noun?: string;
  /** What a screen reader says for a node. The default says what it is, what it's in and what it connects to. */
  describeNode?: (node: DiagramNode<N>) => string;
  describeEdge?: (edge: DiagramEdge<E>) => string;
  /** Controlled camera. Left out, the diagram fits its content, and goes on fitting until the camera's moved. */
  camera?: Camera;
  defaultCamera?: Camera;
  onCameraChange?: (camera: Camera) => void;
  /** How much air to leave around the content when fitting it, in px (default 24). */
  fitPadding?: number;
  /** Size each node to its words, measured in the real font, around its center. A node that holds others keeps its size. */
  autoSize?: boolean;
  /** Draw only what's near the view. By default that's on above 200 nodes and edges. */
  cull?: boolean;
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
  const shown = useShownVersion(host);
  const [text, setText] = useState<TextMeasurer>(() => estimateText);
  const words = useMemo(() => (needed ? diagramTextRuns(nodes, edges) : []), [needed, nodes, edges]);
  const key = useMemo(() => words.map((r) => `${r.kind}:${r.text}`).join('\0'), [words]);
  useLayoutEffect(() => {
    if (needed) setText(() => measureText(words, host.current));
    // `key` stands for `words`. `fonts` and `shown` are here because what it's measuring hasn't changed, but the answer has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, key, needed, fonts, shown]);
  return text;
}

/** A diagram on a `Canvas`. Sits in its host like any BL UI container: it fills the nearest positioned box. */
export function Diagram<N = unknown, E = unknown>({
  nodes: givenNodes, edges: givenEdges, defaultNodes = EMPTY, defaultEdges = EMPTY, onChange, selectable: selectableProp, editable = false, connectable: connectableProp,
  isValidConnection, createEdge, selection: selectionProp, defaultSelection = NOTHING_SELECTED, lit = NOTHING_SELECTED, onSelectionChange, onActivate, noun, describeNode: nodeLabel, describeEdge: edgeLabel,
  camera: controlled, defaultCamera, onCameraChange, fitPadding = 24, autoSize, cull, minimap, renderNode,
  background, panning, cursor, autoFocus, 'aria-label': ariaLabel = 'Diagram', overlay, children, className, style,
}: DiagramProps<N, E>) {
  const selectable = selectableProp ?? editable;
  const connectable = connectableProp ?? editable;
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
  const [connecting, setConnecting] = useState<Extract<DiagramGesture, { k: 'connect' }> | null>(null);
  const [status, setStatus] = useState('');

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
  const litSets = useMemo(() => ({ nodes: new Set(lit.nodes), edges: new Set(lit.edges) }), [lit]);

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
  const checkOf = (c: DiagramConnection): true | string => {
    if (!isValidConnection) return checkConnection(c, laid.index, shown.edges);
    const verdict = isValidConnection(c);
    return verdict === true ? true : verdict === false ? 'That can’t connect there.' : verdict;
  };
  const connectContext = connectable ? {
    targetAt: (p: Pt) => connectionTargetAt(p, laid.index, camera.z),
    check: checkOf,
    edgeEnds: (id: string) => {
      const e = shown.edges.find((x) => x.id === id);
      return e ? { from: { node: e.from, ...(e.fromPort ? { port: e.fromPort } : null) }, to: { node: e.to, ...(e.toPort ? { port: e.toPort } : null) } } : null;
    },
  } : undefined;
  const gestureContext = () => ({ index: laid.index, selection: selectionRef.current, zoom: camera.z, editable, connect: connectContext });
  const applyConnection = (c: DiagramConnection) => {
    const base = dataRef.current;
    if (c.edge) commit({ nodes: base.nodes, edges: moveEdgeEnd(base.edges, c as DiagramConnection & { edge: string }) }, 'reconnect');
    else commit({ nodes: base.nodes, edges: addConnection(base.edges, c, createEdge) }, 'connect');
  };
  const nameOf = (id: string) => laid.index.byId.get(id)?.label || id;
  const send = (event: DiagramGestureEvent) => {
    // A camera that's still fitting the content stops at the first press, or dragging would move the view under the pointer.
    if (event.type === 'down' && !controlled && !own) setOwn(camera);
    const step = stepDiagramGesture(gesture.current, event, gestureContext());
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
    setConnecting(g.k === 'connect' ? g : null);
    setStatus(g.k === 'connect' && typeof g.valid === 'string' ? `Can’t connect: ${g.valid}` : '');
    if (step.commit) {
      const base = dataRef.current;
      commit(moveNodes(base.nodes, base.edges, step.commit.ids, step.commit.delta.x, step.commit.delta.y), 'move');
    }
    if (step.connect) applyConnection(step.connect);
  };
  const cancel = () => { if (gesture.current.k !== 'idle') send({ type: 'cancel' }); };
  /** The places to start a connection, or to take hold of an edge's end. Named ports are always there, and a node without
   *  any gets one on each side once it's the only thing selected. */
  const handles = useMemo(() => {
    const out: { hit: NonNullable<DiagramHit>; at: Pt }[] = [];
    for (const n of laid.index.nodes) {
      for (const port of n.ports ?? []) out.push({ hit: { kind: 'port', id: n.id, port: port.id }, at: portPoint(n, port).p });
    }
    if (!connectable) return out;
    if (selection.nodes.length === 1 && !selection.edges.length) {
      const n = laid.index.byId.get(selection.nodes[0]);
      if (n && !n.ports?.length && n.kind !== 'root') for (const side of DIAGRAM_SIDES) out.push({ hit: { kind: 'port', id: n.id, side }, at: anchorPoint(n, side) });
    }
    if (selection.edges.length === 1 && !selection.nodes.length) {
      const g = laid.geometries.get(selection.edges[0]);
      if (g) out.push({ hit: { kind: 'end', id: selection.edges[0], end: 'from' }, at: g.start }, { hit: { kind: 'end', id: selection.edges[0], end: 'to' }, at: g.end });
    }
    return out;
  }, [laid, selection, connectable]);
  const labels = useMemo(() => laid.labels.map((l) => ({ id: l.edge.id, box: l.box })), [laid]);
  const hitAt = (p: Pt): DiagramHit => hitTestDiagram(p, { index: laid.index, geometries: laid.geometries, labels, handles: connectable ? handles : undefined }, camera.z);
  const interactive = selectable || editable || connectable;
  const pointerProps = interactive ? {
    onCanvasPointerDown: (e: ReactPointerEvent, { board, screen }: CanvasPointerInfo) => {
      const hit = hitAt(board);
      // A press ends connecting by keyboard, and the keys carry on from what was pressed.
      cancel();
      setRingOn(null);
      if (hit?.kind === 'node' || hit?.kind === 'edge') { focus.current = hit; focusPlace.current = board; }
      send({ type: 'down', hit, board, screen, additive: e.shiftKey || e.metaKey || e.ctrlKey });
    },
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
  /* ── Focus: one tab stop, and the keys go from there ── */
  const focus = useRef<DiagramFocus | null>(null);
  // What the keys have gone to stays drawn wherever it is, and gets its focus once it's there.
  const [kept, setKept] = useState<DiagramFocus | null>(null);
  // The keys draw a ring on what they go to. A press clears it, and so does focus leaving.
  const [ringOn, setRingOn] = useState<DiagramFocus | null>(null);
  const focusNext = useRef<{ item: DiagramFocus | null } | null>(null);
  const focusWithin = useRef(false);
  /** Where what's focused last was, so that if it's deleted focus can stay nearby. */
  const focusPlace = useRef<Pt | null>(null);
  const boxOf = (item: DiagramFocus): Rect | null => {
    if (item.kind === 'node') return laid.index.byId.get(item.id) ?? null;
    const g = laid.geometries.get(item.id);
    if (!g) return null;
    const r = rectOf(g.pts);
    // A long route can't fit, and its middle's what there is to show.
    return r.w * camera.z > size.width || r.h * camera.z > size.height ? { x: g.mid.x - 1, y: g.mid.y - 1, w: 2, h: 2 } : r;
  };
  const focusEl = (item: DiagramFocus | null) => {
    setKept(item);
    focusNext.current = { item };
  };
  useLayoutEffect(() => {
    const next = focusNext.current;
    const root = ref.current;
    if (!next || !root) return;
    focusNext.current = null;
    const { item } = next;
    const el = item ? root.querySelector<HTMLElement | SVGElement>(item.kind === 'node' ? `[data-slot=diagram-node][data-node="${CSS.escape(item.id)}"]` : `[data-slot=diagram-edge][data-edge="${CSS.escape(item.id)}"]`) : null;
    (el ?? root.querySelector<HTMLElement>('[data-slot=canvas]'))?.focus({ preventScroll: true });
  });
  const moveFocus = (item: DiagramFocus) => {
    focus.current = item;
    setRingOn(item);
    const box = boxOf(item);
    if (box) {
      focusPlace.current = centerOf(box);
      const next = cameraToShow(camera, box, size);
      if (next !== camera) change(next);
    }
    focusEl(item);
  };
  /** Focus that's nowhere yet starts on what's selected, or else on what's nearest the middle of the view. */
  const startFocus = (): DiagramFocus | null => {
    const sel = selectionRef.current;
    if (sel.nodes.length) return { kind: 'node', id: sel.nodes[0] };
    if (sel.edges.length) return { kind: 'edge', id: sel.edges[0] };
    const id = nearestNode(laid.index, toBoard(camera, size.width / 2, size.height / 2));
    return id ? { kind: 'node', id } : null;
  };
  const go = (step: DiagramFocusStep) => {
    const from = focus.current;
    const here = from && (from.kind === 'node' ? laid.index.byId.has(from.id) : laid.geometries.has(from.id)) ? from : null;
    const ctx = { index: laid.index, edges: laid.edges.map((d) => d.edge) };
    const next = here ? stepFocus(here, step, ctx) : step === 'first' || step === 'last' ? stepFocus(null, step, ctx) : startFocus();
    if (next) moveFocus(next);
    if (next?.kind === 'node') offerByKeyboard({ node: next.id });
  };
  /** While connecting by keyboard, what's focused is what's offered, and a screen reader's told if it can be. */
  const offerByKeyboard = (over: DiagramConnectionEnd | null) => {
    const g = gesture.current;
    if (g.k !== 'connect' || !g.keyboard) return;
    const box = over ? laid.index.byId.get(over.node) : null;
    const next = offerConnection(g, box ? centerOf(box) : g.at, over, gestureContext());
    gesture.current = next;
    setConnecting(next);
    if (over) {
      const port = over.port ? `, ${over.port}` : '';
      setStatus(next.valid === true ? `To ${nameOf(over.node)}${port}. Enter connects.` : `To ${nameOf(over.node)}${port}. Can’t connect: ${next.valid}`);
    }
  };
  const startKeyboardConnection = (reverse: boolean) => {
    const f = focus.current;
    if (!f || !connectable) return;
    if (f.kind === 'node') {
      const n = laid.index.byId.get(f.id);
      if (!n || n.kind === 'root') return;
      const port = n.ports?.find((p) => p.direction !== 'in')?.id;
      const g: DiagramGesture = { k: 'connect', fixed: { node: n.id, ...(port ? { port } : null) }, end: 'to', at: centerOf(n), over: null, valid: null, keyboard: true };
      gesture.current = g;
      setConnecting(g);
      setStatus(`Connecting from ${nameOf(n.id)}. Arrows choose what to connect to, P changes port, Enter connects, Escape cancels.`);
      return;
    }
    const ends = connectContext?.edgeEnds(f.id);
    const route = laid.geometries.get(f.id);
    if (!ends || !route) return;
    const g: DiagramGesture = { k: 'connect', fixed: reverse ? ends.to : ends.from, edge: f.id, end: reverse ? 'from' : 'to', at: reverse ? route.start : route.end, over: null, valid: null, keyboard: true };
    gesture.current = g;
    setConnecting(g);
    setStatus(`Moving this edge’s ${reverse ? 'start' : 'end'}. Arrows choose where to, P changes port, Enter moves it, Escape cancels.`);
  };
  /** The next port on what's being offered, or on where it's starting from if nothing's been chosen yet. */
  const nextKeyboardPort = () => {
    const g = gesture.current;
    if (g.k !== 'connect' || !g.keyboard) return;
    if (!g.over) {
      const n = laid.index.byId.get(g.fixed.node);
      const list = (n?.ports ?? []).filter((p) => p.direction !== 'in');
      if (!list.length) return;
      const at = list.findIndex((p) => p.id === g.fixed.port);
      const fixed = { node: g.fixed.node, port: list[(at + 1) % list.length].id };
      const next = { ...g, fixed };
      gesture.current = next;
      setConnecting(next);
      setStatus(`From ${fixed.port}.`);
      return;
    }
    const n = laid.index.byId.get(g.over.node);
    const list = n?.ports ?? [];
    if (!list.length) return;
    const at = list.findIndex((p) => p.id === g.over!.port);
    offerByKeyboard({ node: g.over.node, port: list[(at + 1) % list.length].id });
  };
  // What's focused can go away, by a delete or from outside: focus stays nearby rather than falling out of the diagram.
  useLayoutEffect(() => {
    const f = focus.current;
    if (!f || !focusWithin.current) return;
    const there = f.kind === 'node' ? laid.index.byId.has(f.id) : laid.geometries.has(f.id);
    if (there) return;
    const near = focusPlace.current ? nearestNode(laid.index, focusPlace.current) : null;
    const next: DiagramFocus | null = near ? { kind: 'node', id: near } : null;
    focus.current = next;
    setRingOn(next);
    focusEl(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laid]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const g = gesture.current;
    if (g.k === 'connect' && g.keyboard) {
      if (key === 'p') { e.preventDefault(); nextKeyboardPort(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (g.over && g.valid === true) {
          const c = connectionOf(g, g.over);
          gesture.current = { k: 'idle' };
          setConnecting(null);
          setStatus(`Connected ${nameOf(c.from)} to ${nameOf(c.to)}.`);
          applyConnection(c);
        } else setStatus(g.over ? `Can’t connect: ${g.valid}` : 'Choose what to connect to first.');
        return;
      }
    }
    if (key === 'escape') {
      if (gesture.current.k !== 'idle') cancel();
      else if (selection.nodes.length || selection.edges.length) select(NOTHING_SELECTED);
      else focusEl(null);
      return;
    }
    const arrow = e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp';
    if (arrow && mod) {
      // ⌘ and an arrow pans, as scrolling does.
      e.preventDefault();
      const by = 80;
      change({ ...camera, x: camera.x + (e.key === 'ArrowLeft' ? by : e.key === 'ArrowRight' ? -by : 0), y: camera.y + (e.key === 'ArrowUp' ? by : e.key === 'ArrowDown' ? -by : 0) });
      return;
    }
    if (arrow && e.shiftKey && editable) {
      // Shift and an arrow nudges, what's selected or else what's focused: 8 at a time, or 1 with Alt.
      e.preventDefault();
      const sel = selectionRef.current.nodes;
      const f = focus.current;
      const ids = movableNodes(laid.index, sel.length ? sel : f?.kind === 'node' ? [f.id] : []);
      if (!ids.length) return;
      const by = e.altKey ? 1 : 8;
      const dx = e.key === 'ArrowLeft' ? -by : e.key === 'ArrowRight' ? by : 0, dy = e.key === 'ArrowUp' ? -by : e.key === 'ArrowDown' ? by : 0;
      const base = dataRef.current;
      commit(moveNodes(base.nodes, base.edges, ids, dx, dy), 'move');
      return;
    }
    if (arrow && e.altKey) { e.preventDefault(); go(e.key === 'ArrowDown' ? 'in' : e.key === 'ArrowUp' ? 'out' : (e.key as DiagramFocusStep)); return; }
    if (arrow) { e.preventDefault(); go(e.key as DiagramFocusStep); return; }
    if (e.key === '[' || e.key === ']') { e.preventDefault(); go(e.key === ']' ? 'edge+' : 'edge-'); return; }
    if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); go(e.key === 'PageDown' ? 'next' : 'previous'); return; }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); go(e.key === 'Home' ? 'first' : 'last'); return; }
    if (e.key === 'Enter') {
      const f = focus.current;
      if (!f) { go('first'); return; }
      e.preventDefault();
      if (selectable) {
        const sel = selectionRef.current;
        const list = f.kind === 'node' ? sel.nodes : sel.edges;
        if (e.shiftKey) select(f.kind === 'node' ? { ...sel, nodes: list.includes(f.id) ? list.filter((x) => x !== f.id) : [...list, f.id] } : { ...sel, edges: list.includes(f.id) ? list.filter((x) => x !== f.id) : [...list, f.id] });
        else select(f.kind === 'node' ? { nodes: [f.id], edges: [] } : { nodes: [], edges: [f.id] });
      }
      if (!e.shiftKey) onActivate?.(f);
      return;
    }
    if (key === 'c' && !mod && connectable && g.k === 'idle') { e.preventDefault(); startKeyboardConnection(e.shiftKey); return; }
    if (mod && key === 'a' && selectable) { e.preventDefault(); select({ nodes: data.nodes.filter((n) => n.kind !== 'root').map((n) => n.id), edges: data.edges.map((x) => x.id) }); return; }
    if (!editable) return;
    if (mod && key === 'z') { e.preventDefault(); cancel(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); cancel(); redo(); return; }
    if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      const sel = selectionRef.current;
      // With nothing selected, the key means what's focused.
      if (!sel.nodes.length && !sel.edges.length && focus.current) {
        const f = focus.current;
        select(f.kind === 'node' ? { nodes: [f.id], edges: [] } : { nodes: [], edges: [f.id] });
      }
      deleteSelection();
    }
  };

  /* ── Only what's near the view gets drawn. Most frames of a pan don't change that, so they don't touch the board at all. ── */
  const culling = cull ?? laid.index.nodes.length + laid.edges.length > CULL_ABOVE;
  const windowRef = useRef<Rect | null>(null);
  windowRef.current = culling ? renderWindow(windowRef.current, { x: -camera.x / camera.z, y: -camera.y / camera.z, w: size.width / camera.z, h: size.height / camera.z }) : null;
  const drawWindow = windowRef.current;
  const drawn = useMemo(() => (drawWindow ? within(laid, drawWindow, kept) : laid), [laid, drawWindow, kept]);
  // Each kept in a memo, so a camera that only moves changes none of them, and what depends on the zoom is one attribute.
  const nodeView = (n: DiagramNode<any>) => (
    <NodeView key={n.id} node={n} selected={selectedSets.nodes.has(n.id)} selectable={selectable} lit={litSets.nodes.has(n.id)} renderNode={renderNode as NodeViewProps['renderNode']} label={(nodeLabel as DiagramProps<any, any>['describeNode'])?.(n) ?? describeNode(n, laid.index, laid.edgesAt.get(n.id), noun)} />
  );
  const containers = useMemo(() => drawn.containers.map(nodeView),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawn.containers, selectedSets.nodes, litSets.nodes, selectable, renderNode, nodeLabel, noun, laid.edgesAt]);
  const leaves = useMemo(() => drawn.leaves.map(nodeView),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawn.leaves, selectedSets.nodes, litSets.nodes, selectable, renderNode, nodeLabel, noun, laid.edgesAt]);
  const lines = useMemo(() => (
    <>
      <defs>
        <ArrowMarker id={arrow} className="fill-muted-foreground" />
        <ArrowMarker id={`${arrow}-strong`} className="fill-foreground" />
        <ArrowMarker id={`${arrow}-selected`} className="fill-primary" />
      </defs>
      {drawn.dividers.map((d) => (
        <line
          key={d.id}
          data-slot="diagram-divider"
          aria-hidden="true"
          x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
          className="stroke-border [stroke-dasharray:calc(6px/var(--diagram-z))_calc(4px/var(--diagram-z))] [stroke-width:calc(1px/var(--diagram-z))]"
        />
      ))}
      {drawn.edges.map(({ edge, geometry }) => <EdgeView key={edge.id} edge={edge} d={geometry.d} arrow={arrow} selected={selectedSets.edges.has(edge.id)} selectable={selectable} lit={litSets.edges.has(edge.id)} label={(edgeLabel as DiagramProps<any, any>['describeEdge'])?.(edge) ?? describeEdge(edge, laid.index)} />)}
    </>
  ), [drawn.dividers, drawn.edges, arrow, selectedSets.edges, litSets.edges, selectable, edgeLabel, laid.index]);
  const labelViews = useMemo(() => drawn.labels.map(({ edge, box }) => <EdgeLabel key={edge.id} edge={edge} box={box} />), [drawn.labels]);
  const rings = useMemo(() => {
    const all = drawn.containers.concat(drawn.leaves);
    // Lit first, so that a selection's line goes over it.
    const litUp = all.filter((n) => litSets.nodes.has(n.id)).map((n) => (
      <span
        key={`lit:${n.id}`}
        data-slot="diagram-lit"
        data-lit-of={n.id}
        aria-hidden="true"
        className={cn('absolute', nodeRadius(n), isContainer(n) ? LIT_CONTAINER : LIT_LEAF)}
        style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
      />
    ));
    const ringed = all.filter((n) => selectedSets.nodes.has(n.id) || (ringOn?.kind === 'node' && ringOn.id === n.id));
    return litUp.concat(ringed.map((n) => (
      <span
        key={n.id}
        data-slot="diagram-ring"
        data-ring-of={n.id}
        data-focused={ringOn?.kind === 'node' && ringOn.id === n.id ? true : undefined}
        aria-hidden="true"
        className={cn('absolute', nodeRadius(n), ringOn?.kind === 'node' && ringOn.id === n.id ? RING_FOCUSED : RING_SELECTED)}
        style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
      />
    )));
  }, [drawn.containers, drawn.leaves, selectedSets.nodes, litSets.nodes, ringOn]);
  const marks = useMemo<CanvasMiniMapItem[]>(() => (minimap ? nodes.filter((n) => n.kind !== 'root').map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h })) : []), [minimap, nodes]);
  const zoom = camera.z < NODE_TEXT_ZOOM ? 'far' : camera.z < EDGE_LABEL_ZOOM ? 'mid' : 'near';
  // Changing this restyles every line drawn, so it moves in steps of about 9%, a few frames apart, which keeps a line of
  // 1.25 px within 0.06 px of that. At 2,000 nodes, a change every frame cost 25 ms a frame while zooming.
  const lineZoom = 2 ** (Math.round(Math.log2(camera.z) * 8) / 8);
  const portDots = useMemo(() => handles.length ? (
    <div data-slot="diagram-ports" className="pointer-events-none absolute top-0 left-0" style={{ '--diagram-z': camera.z } as CSSProperties}>
      {(drawWindow ? handles.filter((h) => h.at.x >= drawWindow.x && h.at.x <= drawWindow.x + drawWindow.w && h.at.y >= drawWindow.y && h.at.y <= drawWindow.y + drawWindow.h) : handles).map((h) => (h.hit.kind === 'end'
        ? <span key={`end:${h.hit.end}`} data-slot="diagram-edge-end" data-end={h.hit.end} aria-hidden="true" className={EDGE_END} style={{ left: h.at.x, top: h.at.y }} />
        : h.hit.kind === 'port' ? <PortDot key={`${h.hit.id}/${h.hit.port ?? h.hit.side}`} at={h.at} node={h.hit.id} port={h.hit.port} side={h.hit.side} active={connectable} /> : null))}
    </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ) : null, [handles, connectable, camera.z, drawWindow]);
  const connection = useMemo(() => {
    if (!connecting) return null;
    const index = laid.index;
    const a = index.byId.get(connecting.fixed.node);
    if (!a) return null;
    const c = connecting.over ? connectionOf(connecting, connecting.over) : null;
    let route: ConnectorGeometry | null = null;
    if (c) route = edgeGeometry({ id: 'connecting', from: c.from, fromPort: c.fromPort, to: c.to, toPort: c.toPort }, index);
    else {
      // Nothing to land on yet: from the fixed end to the pointer.
      const port = connecting.fixed.port ? a.ports?.find((x) => x.id === connecting.fixed.port) : undefined;
      const side = connecting.side ?? nearestSide(a, connecting.at).side;
      const fixedEnd: ConnectorEnd = port ? portPoint(a, port) : { p: anchorPoint(a, side), n: anchorNormal(a, side) };
      const free: ConnectorEnd = { p: connecting.at, n: null };
      route = connecting.end === 'to' ? connectorPath('elbow', fixedEnd, free) : connectorPath('elbow', free, fixedEnd);
    }
    const target = connecting.over ? index.byId.get(connecting.over.node) : null;
    const portTarget = connecting.over?.port && target ? target.ports?.find((x: DiagramPort) => x.id === connecting.over!.port) : undefined;
    const valid = connecting.valid !== null ? connecting.valid === true : true;
    return (
      <div className="pointer-events-none absolute top-0 left-0" style={{ '--diagram-z': camera.z } as CSSProperties}>
        {route ? <ConnectionPreview d={route.d} valid={valid} /> : null}
        {portTarget && target ? (
          <span data-slot="diagram-connection-target" data-valid={valid} aria-hidden="true" className={cn(DOT, 'size-[calc(16px/var(--diagram-z))]', valid ? 'bg-primary/40' : 'bg-destructive/40')} style={{ left: portPoint(target, portTarget).p.x, top: portPoint(target, portTarget).p.y }} />
        ) : target ? (
          <span data-slot="diagram-connection-target" data-valid={valid} aria-hidden="true" className={cn('absolute rounded-ctl', valid ? '[box-shadow:0_0_0_calc(3px/var(--diagram-z))_var(--primary)]' : '[box-shadow:0_0_0_calc(3px/var(--diagram-z))_var(--destructive)]')} style={{ left: target.x, top: target.y, width: target.w, height: target.h }} />
        ) : null}
      </div>
    );
  }, [connecting, laid, camera.z]);
  return (
    <div
      ref={ref}
      data-slot="diagram"
      className={cn('absolute inset-0', className)}
      style={style}
      // Holding Space to pan drops a drag in progress, the same as a pinch does. It's the canvas's key, so it isn't handed on.
      onKeyDownCapture={(e) => { if (e.key === ' ') cancel(); }}
      onLostPointerCapture={cancel}
      onFocus={() => { focusWithin.current = true; }}
      onBlur={(e) => { if (!e.relatedTarget || !ref.current?.contains(e.relatedTarget as Node)) { focusWithin.current = false; setRingOn(null); } }}
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
        onCanvasKeyDown={onKeyDown}
        onCanvasDoubleClick={onActivate ? (_e, { board: at }) => { const hit = hitAt(at); if (hit?.kind === 'node' || hit?.kind === 'edge') onActivate({ kind: hit.kind, id: hit.id }); } : undefined}
        {...pointerProps}
        overlay={<>{minimap ? <CanvasMiniMap items={marks} {...(minimap === true ? null : minimap)} /> : null}{overlay}</>}
      >
        <div data-slot="diagram-layer" data-zoom={zoom} className="group/diagram pointer-events-none absolute top-0 left-0">
          {containers}
          <svg data-slot="diagram-edges" role="group" aria-label="Edges" className="absolute top-0 left-0 overflow-visible" width={1} height={1} style={{ '--diagram-z': lineZoom } as CSSProperties}>
            {lines}
          </svg>
          {leaves}
          {labelViews}
          {rings.length ? <div data-slot="diagram-rings" className="absolute top-0 left-0" style={{ '--diagram-z': lineZoom } as CSSProperties}>{rings}</div> : null}
        </div>
        {portDots}
        {guides.length ? <CanvasGuides guides={guides} /> : null}
        {marquee ? <CanvasMarquee rect={marquee} /> : null}
        {connection}
        {children}
      </Canvas>
      <div
        data-slot="diagram-status"
        role="status"
        className={cn(status.startsWith('Can’t') && connecting && !connecting.keyboard ? 'pointer-events-none absolute bottom-3 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-ctl bg-popover px-3 py-2 text-footnote text-foreground shadow-hairline' : 'sr-only')}
      >
        {status}
      </div>
    </div>
  );
}
