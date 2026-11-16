'use client';
import {
  createContext, memo, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref, type RefObject,
} from 'react';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { cva } from 'class-variance-authority';
import { Canvas, CanvasGuides, CanvasMarquee, CanvasMiniMap, createCanvasController, type CanvasController, type CanvasMiniMapItem, type CanvasMiniMapProps, type CanvasPointerInfo, type CanvasProps, type CanvasViewportChangeDetails, type Viewport } from '@/components/ui/canvas';
import { renderEmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Toolbar, ToolbarButton, ToolbarSeparator, type ToolbarProps } from '@/components/ui/toolbar';
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from '@/components/ui/tooltip';
import { centerOf, intersects, rectOf, toBoard, type Guide, type Pt, type Rect } from '@/lib/canvas-math';
import { useContainerSize } from '@/lib/container';
import { connectionOf, connectionTargetAt, hitTestDiagram, movableNodes, offerConnection, stepDiagramGesture, type DiagramConnectionEnd, type DiagramGesture, type DiagramGestureEvent, type DiagramHit } from '@/lib/diagram-gesture';
import { describeEdge, describeNode, edgesByNode, fitViewport, nearestNode, stepFocus, viewportToShow, type DiagramItem, type DiagramStep } from '@/lib/diagram-keyboard';
import {
  DIAGRAM_SIDES, NOTHING_SELECTED, anchorNormal, anchorPoint, connectorPath, diagramBounds, diagramTextRuns, edgeGeometries, edgeGeometry, indexDiagram, labelBox, moveNodes, nearestSide, portPoint, regionDividers, renderWindow, sizeNodesToText,
  type ConnectorEnd, type ConnectorGeometry, type DiagramConnection, type DiagramDivider, type DiagramEdge, type DiagramIndex, type DiagramNode, type DiagramPort, type DiagramSelection, type DiagramSide,
} from '@/lib/diagram-model';
import {
  diagram, type DiagramController, type DiagramData, type DiagramDataChangeDetails, type DiagramDataChangeReason, type DiagramOptions, type DiagramSelectionChangeDetails, type DiagramSelectionChangeReason,
} from '@/lib/diagram-primitive';
import { DIAGRAM_TEXT_CLASS, estimateText, measureText, type TextMeasurer } from '@/lib/diagram-text';
import { Icon } from '@/lib/icon';
import { useFontVersion, useShownVersion } from '@/lib/use-font-version';
import { cn } from '@/lib/utils';

export { createDiagramController } from '@/lib/diagram-primitive';
export type { DiagramController, DiagramData, DiagramDataChangeDetails, DiagramDataChangeReason, DiagramSelectionChangeDetails, DiagramSelectionChangeReason } from '@/lib/diagram-primitive';
export type { DiagramItem } from '@/lib/diagram-keyboard';

/* ══ Diagram — nodes, edges, labels and regions on the Canvas ══
   Hand it nodes and edges as plain data (`@/lib/diagram-model`) and it draws them on a `Canvas`, so the view, the
   minimap and `useCanvas` are the canvas's own. Everything's in board units, and scales with the view as an object on a
   board does, borders included. Lines and arrowheads are the exception: they keep their thickness on screen at any zoom.
   Text that would be too small to read hides.

   What the diagram is (its data, its selection, its history) is one primitive, `lib/diagram-primitive`: every change goes
   through `onDataChange(data, details)` / `onSelectionChange(selection, details)`, where `details.cancel()` refuses it,
   and a controller (`createDiagramController`) or an agent can select, delete, connect, move, undo and redo.

   Give it `editable` and the pointer selects, moves and deletes, as one gesture (`@/lib/diagram-gesture`), with undo.

   It's one tab stop, the board. From there the keys move between nodes and along edges (`@/lib/diagram-keyboard`), the
   view follows, and each node and edge says what it is and what it connects to. The keys are described to a screen
   reader on the board, and every step of connecting by keyboard is announced.

   Named ports (`DiagramNode.ports`) draw on their nodes. With `connectable`, which `editable` turns on, a drag from a port
   draws a connection that snaps to the nearest port in reach, and a node without ports gets one on each side once it's
   selected. `isValidConnection` says what's allowed, and a selected edge's ends can be moved. C does all that by keyboard. */

/* ── Looks ── */

/** A line's thickness on screen, whatever the zoom: `--diagram-z` is the view's zoom, in steps. */
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
      /** Something's wrong with it: dashes as well as the color, as a color isn't enough on its own. */
      problem: 'stroke-destructive [stroke-dasharray:calc(6px/var(--diagram-z))_calc(3px/var(--diagram-z))]',
    },
  },
  defaultVariants: { kind: 'event' },
});

type EdgeLook = NonNullable<Parameters<typeof diagramEdgeVariants>[0]>['kind'];
const EDGE_LOOKS: readonly string[] = ['event', 'done', 'invoke', 'always', 'after', 'initial', 'problem'];
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
  const [look, selected, current] = key.split(':');
  return cn(diagramEdgeVariants({ kind: look as EdgeLook }), selected && 'stroke-primary', current && 'stroke-primary [stroke-width:calc(2.5px/var(--diagram-z))]', 'outline-none focus-visible:stroke-ring focus-visible:[stroke-width:calc(3px/var(--diagram-z))]');
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
  current?: boolean;
  label: string;
  renderNode?: (node: DiagramNode<any>) => ReactNode;
}

/** A ring around what's selected or has focus, the same thickness on screen at any zoom. A box-shadow, as Chrome rounds a
 *  border or an outline under 1 px up to 1 px, before the board's scale makes it thicker. These sit in a layer of their own,
 *  and it's only that layer and the lines that get `--diagram-z`, in steps: a custom property that changes restyles
 *  everything under it. */
const RING_SELECTED = '[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--background),0_0_0_calc(3.6px/var(--diagram-z))_var(--primary)]';
const RING_FOCUSED = '[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--background),0_0_0_calc(4px/var(--diagram-z))_var(--ring)]';
/** What's current: a tint over it and a line around it, or only a thinner line for something that holds others. */
const CURRENT_LEAF = 'bg-primary/15 [box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--primary)]';
const CURRENT_CONTAINER = '[box-shadow:0_0_0_calc(1.5px/var(--diagram-z))_var(--primary)]';
const nodeRadius = (n: DiagramNode<any>) => (isContainer(n) ? 'rounded-card' : n.kind === 'initial' ? 'rounded-full' : 'rounded-ctl');

/** The same node drawn the same, though it's a new object: new data from a layout or an owner's state is mostly what was
 *  there, and redrawing thousands of nodes for it would take a frame of its own. */
const sameNode = (a: DiagramNode<unknown>, b: DiagramNode<unknown>) => a === b || (
  a.id === b.id && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.kind === b.kind && a.label === b.label
  && a.detail === b.detail && a.parent === b.parent && a.data === b.data && a.ports === b.ports
);
const sameNodeView = (a: NodeViewProps, b: NodeViewProps) =>
  a.selected === b.selected && a.selectable === b.selectable && a.current === b.current && a.label === b.label && a.renderNode === b.renderNode && sameNode(a.node, b.node);

const NodeView = memo(function NodeView({ node, selected, selectable, current, label, renderNode }: NodeViewProps) {
  return (
    <div
      data-slot="diagram-node"
      data-node={node.id}
      data-kind={node.kind ?? 'node'}
      data-selected={selected ? '' : undefined}
      data-current={current ? '' : undefined}
      // One tab stop, which is the board: the keys move focus from there, and a press never lands here.
      role="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={selectable ? !!selected : undefined}
      aria-current={current || undefined}
      className={nodeWrapClass(nodeRadius(node))}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      {renderNode ? renderNode(node) : <DiagramNodeBody node={node} />}
    </div>
  );
}, sameNodeView);

/* ── An edge ── */

interface EdgeViewProps { edge: DiagramEdge<unknown>; d: string; arrow: string; selected?: boolean; selectable?: boolean; current?: boolean; label: string }

/** An edge is drawn from its route, its kind and its name, which are all that's compared. */
const sameEdgeView = (a: EdgeViewProps, b: EdgeViewProps) =>
  a.d === b.d && a.arrow === b.arrow && a.selected === b.selected && a.selectable === b.selectable && a.current === b.current && a.label === b.label
  && a.edge.id === b.edge.id && a.edge.kind === b.edge.kind;

const EdgeView = memo(function EdgeView({ edge, d, arrow, selected, selectable, current, label }: EdgeViewProps) {
  const look = edgeLook(edge.kind);
  return (
    <path
      data-slot="diagram-edge"
      data-edge={edge.id}
      data-kind={edge.kind ?? 'event'}
      data-selected={selected ? '' : undefined}
      data-current={current ? '' : undefined}
      role="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={selectable ? !!selected : undefined}
      aria-current={current || undefined}
      d={d}
      markerEnd={`url(#${arrow}${selected || current ? '-selected' : look === 'initial' ? '-strong' : look === 'problem' ? '-problem' : ''})`}
      className={edgeClass(`${look}:${selected ? '1' : ''}:${current ? '1' : ''}`)}
    />
  );
}, sameEdgeView);

const sameEdgeLabel = (a: { edge: DiagramEdge<unknown>; box: Rect }, b: { edge: DiagramEdge<unknown>; box: Rect }) =>
  a.edge.id === b.edge.id && a.edge.label === b.edge.label && a.box.x === b.box.x && a.box.y === b.box.y;

const EdgeLabel = memo(function EdgeLabel({ edge, box }: { edge: DiagramEdge<unknown>; box: Rect }) {
  return (
    <div
      data-slot="diagram-edge-label"
      data-edge={edge.id}
      // The edge's own name says this, along with what it joins.
      aria-hidden="true"
      className={EDGE_LABEL_CLASS}
      style={{ left: box.x, top: box.y }}
    >
      {edge.label}
    </div>
  );
}, sameEdgeLabel);

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
        data-invalid={valid ? undefined : ''}
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
  // Two edges between the same two ports are one line, so their labels would be one on top of the other.
  const onRoute = new Map<string, number>();
  const placeLabel = (edge: DiagramEdge<E>, geometry: ConnectorGeometry) => {
    if (edge.labelBox) return edge.labelBox;
    const box = labelBox(geometry.pts, text(edge.label!, 'edge'));
    const before = onRoute.get(geometry.d) ?? 0;
    onRoute.set(geometry.d, before + 1);
    return before ? { ...box, y: box.y - before * box.h } : box;
  };
  for (const edge of edges) {
    const geometry = geometries.get(edge.id);
    if (!geometry) continue;
    drawn.push({ edge, geometry, box: rectOf(geometry.pts) });
    if (edge.label) labels.push({ edge, box: placeLabel(edge, geometry) });
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
function within<N, E>(laid: Laid<N, E>, win: Rect, keep: DiagramItem | null): Laid<N, E> {
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

/* ── Context, for parts in a diagram's `overlay` ── */

export interface DiagramContextValue {
  /** The diagram's own methods: select, delete, connect, undo… (the controller's). */
  diagram: DiagramController<any, any>;
  /** The board's view: zoom, fit, pan. */
  canvas: CanvasController;
  canUndo: boolean;
  canRedo: boolean;
  undoable: boolean;
  zoom: number;
}

const DiagramContext = createContext<DiagramContextValue | null>(null);

/** The nearest Diagram's methods and its board's view, for a part in its `overlay` (or anywhere under it). */
export function useDiagram(): DiagramContextValue {
  const value = useContext(DiagramContext);
  if (!value) throw new Error('useDiagram must be used within <Diagram>.');
  return value;
}

/* ── Diagram ── */

export interface DiagramProps<N = unknown, E = unknown> extends Pick<CanvasProps, 'background' | 'panning' | 'autoFocus'> {
  /** Controlled data, with `onDataChange`. */
  nodes?: readonly DiagramNode<N>[];
  edges?: readonly DiagramEdge<E>[];
  /** Data left to the diagram. */
  defaultNodes?: readonly DiagramNode<N>[];
  defaultEdges?: readonly DiagramEdge<E>[];
  /** Every change to the data, undo and redo included, with why (`details.reason`). `details.cancel()` refuses it: the
   *  node goes back where it was, and history stays where it was. */
  onDataChange?: (data: DiagramData<N, E>, details: DiagramDataChangeDetails) => void;
  /** Let the pointer select nodes and edges, one at a time, with shift or ⌘, or with a marquee. On when `editable` is. */
  selectable?: boolean;
  /** Let the pointer and the keys move and delete things, with undo. */
  editable?: boolean;
  /** Whether dragging and ⇧ with an arrow move things, for when where they are isn't up to you. On when `editable` is. */
  movable?: boolean;
  /** Whether ⌘Z and ⇧⌘Z undo and redo here. On when `editable` is; off for a diagram drawn from data that keeps its own
   *  history (a StateDiagram's config). */
  undoable?: boolean;
  selection?: DiagramSelection;
  defaultSelection?: DiagramSelection;
  onSelectionChange?: (selection: DiagramSelection, details: DiagramSelectionChangeDetails) => void;
  /** Where things are now, apart from what's selected: where a machine is, and how it got there. Each current node and edge
   *  says so to a screen reader, with `aria-current`. */
  current?: DiagramSelection;
  /** Let the pointer and the keys draw connections, and move an edge's ends. On when `editable` is. */
  connectable?: boolean;
  /** Connect only from named ports: no places to connect on a node without any, and no moving an edge's ends, so that a press on
   *  a port that has a selected edge at it starts a new one. */
  portsOnly?: boolean;
  /** Whether a connection's allowed: true, false, or the reason it isn't, in words. The default keeps to `checkConnection`. */
  isValidConnection?: (connection: DiagramConnection) => boolean | string;
  /** Makes the edge for a new connection. The default's an edge with only its ends and an id. */
  createEdge?: (connection: DiagramConnection) => DiagramEdge<E>;
  /** Enter on a focused node or edge, or a double click. */
  onAction?: (item: DiagramItem, details: { reason: 'enter-key' | 'double-click'; event: Event }) => void;
  /** What a screen reader calls a node (default `node`): a state, a service. */
  noun?: string;
  /** What a screen reader says for a node. The default says what it is, what it's in and what it connects to. */
  describeNode?: (node: DiagramNode<N>) => string;
  describeEdge?: (edge: DiagramEdge<E>) => string;
  /** Controlled view. Left out, the diagram fits its content, and goes on fitting until the view's moved. */
  viewport?: Viewport;
  defaultViewport?: Viewport;
  onViewportChange?: (viewport: Viewport, details: CanvasViewportChangeDetails) => void;
  /** How much air to leave around the content when fitting it, in px (default 24). */
  fitPadding?: number;
  /** Size each node to its words, measured in the real font, around its center. A node that holds others keeps its size. */
  autoSize?: boolean;
  /** Draw only what's near the view. By default that's on above 200 nodes and edges. */
  cull?: boolean;
  /** An overview in a corner, on `CanvasMiniMap` (`side`, `align`). */
  minimap?: boolean | Omit<CanvasMiniMapProps, 'items'>;
  /** Draws a node's insides, within a box it's placed in. Keep the function stable, as it's what the nodes memoize on. */
  renderNode?: (node: DiagramNode<N>) => ReactNode;
  /** What shows with no nodes (and not `loading`). Default an `EmptyState`; `null` for nothing. */
  emptyState?: ReactNode;
  /** The data isn't here yet (a layout is running): a spinner, and no empty state. */
  loading?: boolean;
  /** Drives it from outside: `createDiagramController()`. */
  controller?: DiagramController<N, E>;
  /** Its name, for people and agents (default `Diagram`). The board inside is named `<name> board`. */
  'aria-label'?: string;
  /** Drawn over the diagram in screen space: a `DiagramToolbar`, a status, an error. `useDiagram` works here. */
  overlay?: ReactNode;
  /** More of the board layer, over the diagram. `useCanvas` works here. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

const EMPTY: readonly never[] = [];
const NO_GUIDES: Guide[] = [];

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
  }, [host, key, needed, fonts, shown]);
  return text;
}

/** A diagram on a `Canvas`. Sits in its host like any BL UI container: it fills the nearest positioned box. */
export function Diagram<N = unknown, E = unknown>({
  nodes: givenNodes, edges: givenEdges, defaultNodes = EMPTY, defaultEdges = EMPTY, onDataChange, selectable: selectableProp, editable = false, movable: movableProp, undoable: undoableProp, portsOnly = false, connectable: connectableProp,
  isValidConnection, createEdge, selection: selectionProp, defaultSelection = NOTHING_SELECTED, current = NOTHING_SELECTED, onSelectionChange, onAction, noun, describeNode: nodeLabel, describeEdge: edgeLabel,
  viewport: controlled, defaultViewport, onViewportChange, fitPadding = 24, autoSize, cull, minimap, renderNode, emptyState, loading = false, controller,
  background, panning, autoFocus, 'aria-label': ariaLabel = 'Diagram', overlay, children, className, style, ref: refProp,
}: DiagramProps<N, E>) {
  const selectable = selectableProp ?? editable;
  const connectable = connectableProp ?? editable;
  const movable = movableProp ?? editable;
  const undoable = undoableProp ?? editable;
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1000, height: 700 });
  const rootRef = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (typeof refProp === 'function') refProp(el);
    else if (refProp) refProp.current = el;
  }, [ref, refProp]);
  const [own, setOwn] = useState<Viewport | null>(defaultViewport ?? null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arrow = `diagram-arrow-${uid}`;
  const keysId = `diagram-keys-${uid}`;
  const [canvas] = useState(createCanvasController);

  /* ── The data and the selection: the primitive's. Controlled values are read from props, so a render never lags them. ── */
  const isControlled = givenNodes !== undefined;
  const givenData = useMemo<DiagramData<N, E> | undefined>(() => (isControlled ? { nodes: givenNodes, edges: givenEdges ?? EMPTY } : undefined), [isControlled, givenNodes, givenEdges]);
  const [defaultData] = useState<DiagramData<N, E>>(() => ({ nodes: defaultNodes, edges: defaultEdges }));
  const handle = usePrimitive(diagram, {
    data: givenData, defaultData: givenData ? undefined : defaultData, onDataChange, selection: selectionProp, defaultSelection: selectionProp ? undefined : defaultSelection, onSelectionChange,
    selectable, editable: editable || movable || connectable, undoable, isValidConnection, createEdge, controller,
  } as DiagramOptions<any, any>);
  const { instance, api } = handle;
  const subscribe = useCallback((listener: () => void) => instance.subscribe(listener), [instance]);
  const read = useCallback(() => instance.get(), [instance]);
  const state = useSyncExternalStore(subscribe, read, read);
  const data = (givenData ?? state.data) as DiagramData<N, E>;
  const selection = selectionProp ?? state.selection;
  const canUndo = undoable && state.past > 0;
  const canRedo = undoable && state.future > 0;

  /* ── What a drag shows before it's committed ── */
  const [draft, setDraft] = useState<DiagramData<N, E> | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [connecting, setConnecting] = useState<Extract<DiagramGesture, { k: 'connect' }> | null>(null);
  const [status, setStatus] = useState('');

  const shown = draft ?? data;
  const text = useDiagramText(ref, shown.nodes, shown.edges, !!autoSize || shown.edges.some((e) => e.label && !e.labelBox));
  const nodes = useMemo(() => (autoSize ? sizeNodesToText(shown.nodes, text) : shown.nodes), [autoSize, shown.nodes, text]);
  const laid = useMemo(() => layOut(nodes, shown.edges, text), [nodes, shown.edges, text]);

  const viewport = controlled ?? own ?? fitViewport(laid.bounds, size, fitPadding);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  /** Every move of the view comes through the canvas, ours included (the keys following focus go through its
   *  controller), so `onViewportChange` always hears why. */
  const change = (next: Viewport, details: CanvasViewportChangeDetails) => {
    onViewportChange?.(next, details);
    if (!details.canceled) setOwn(next);
  };

  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const select = (next: DiagramSelection, reason: DiagramSelectionChangeReason, event?: Event) => {
    if (api.select(next, { reason, event })) selectionRef.current = next;
  };
  const selectedSets = useMemo(() => ({ nodes: new Set(selection.nodes), edges: new Set(selection.edges) }), [selection]);
  const currentSets = useMemo(() => ({ nodes: new Set(current.nodes), edges: new Set(current.edges) }), [current]);
  const commit = (next: DiagramData<N, E>, reason: DiagramDataChangeReason, event?: Event) => api.internal.commit(next, reason, event);

  /* ── The gesture ── */
  const gesture = useRef<DiagramGesture>({ k: 'idle' });
  const connectContext = connectable ? {
    targetAt: (p: Pt) => connectionTargetAt(p, laid.index, viewport.zoom),
    check: api.internal.check,
    edgeEnds: (id: string) => {
      const e = shown.edges.find((x) => x.id === id);
      return e ? { from: { node: e.from, ...(e.fromPort ? { port: e.fromPort } : null) }, to: { node: e.to, ...(e.toPort ? { port: e.toPort } : null) } } : null;
    },
  } : undefined;
  const gestureContext = () => ({ index: laid.index, selection: selectionRef.current, zoom: viewport.zoom, editable: movable, connect: connectContext });
  const nameOf = (id: string) => laid.index.byId.get(id)?.label || id;
  const send = (event: DiagramGestureEvent, cause?: Event) => {
    // A view that's still fitting the content stops at the first press, or dragging would move the view under the pointer.
    if (event.type === 'down' && !controlled && !own) setOwn(viewport);
    const was = gesture.current.k;
    const step = stepDiagramGesture(gesture.current, event, gestureContext());
    const g = step.gesture;
    gesture.current = g;
    if (step.selection) select(step.selection, was === 'marquee' ? 'marquee' : 'press', cause);
    if (g.k === 'move') {
      const base = data;
      setDraft(moveNodes(base.nodes, base.edges, g.ids, g.delta.x, g.delta.y, indexDiagram(base.nodes)));
      setGuides(g.guides);
    } else {
      setDraft(null);
      setGuides(NO_GUIDES);
    }
    setMarquee(g.k === 'marquee' ? g.rect : null);
    setConnecting(g.k === 'connect' ? g : null);
    setStatus(g.k === 'connect' && typeof g.valid === 'string' ? `Can’t connect: ${g.valid}` : '');
    if (step.commit) commit(moveNodes(data.nodes, data.edges, step.commit.ids, step.commit.delta.x, step.commit.delta.y), 'move', cause);
    if (step.connect) api.connect(step.connect, cause);
  };
  const cancel = () => { if (gesture.current.k !== 'idle') send({ type: 'cancel' }); };
  /** The places to start a connection, or to take hold of an edge's end. Named ports are always there, and a node without
   *  any gets one on each side once it's the only thing selected. */
  const handles = useMemo(() => {
    const out: { hit: NonNullable<DiagramHit>; at: Pt }[] = [];
    for (const n of laid.index.nodes) {
      for (const port of n.ports ?? []) out.push({ hit: { kind: 'port', id: n.id, port: port.id }, at: portPoint(n, port).p });
    }
    if (!connectable || portsOnly) return out;
    if (selection.nodes.length === 1 && !selection.edges.length) {
      const n = laid.index.byId.get(selection.nodes[0]);
      if (n && !n.ports?.length && n.kind !== 'root') for (const side of DIAGRAM_SIDES) out.push({ hit: { kind: 'port', id: n.id, side }, at: anchorPoint(n, side) });
    }
    if (selection.edges.length === 1 && !selection.nodes.length) {
      const g = laid.geometries.get(selection.edges[0]);
      if (g) out.push({ hit: { kind: 'end', id: selection.edges[0], end: 'from' }, at: g.start }, { hit: { kind: 'end', id: selection.edges[0], end: 'to' }, at: g.end });
    }
    return out;
  }, [laid, selection, connectable, portsOnly]);
  const labels = useMemo(() => laid.labels.map((l) => ({ id: l.edge.id, box: l.box })), [laid]);
  // A press goes on to the next of the edges on one line, and a double press opens the one it's left selected.
  const hitAt = (p: Pt, cycle = false): DiagramHit => hitTestDiagram(p, { index: laid.index, geometries: laid.geometries, labels, handles: connectable ? handles : undefined, selectedEdges: selection.edges, cycle }, viewport.zoom);
  const interactive = selectable || editable || connectable;
  const pointerProps: Pick<CanvasProps, 'onCanvasPointerDown' | 'onCanvasPointerMove' | 'onCanvasPointerUp' | 'onNavigationStart'> = interactive ? {
    onCanvasPointerDown: (e: PointerEvent, { board, screen }: CanvasPointerInfo) => {
      const hit = hitAt(board, true);
      // A press ends connecting by keyboard, and the keys carry on from what was pressed.
      cancel();
      setRingOn(null);
      if (hit?.kind === 'node' || hit?.kind === 'edge') { focus.current = { kind: hit.kind, id: hit.id }; focusPlace.current = board; }
      send({ type: 'down', hit, board, screen, additive: e.shiftKey || e.metaKey || e.ctrlKey }, e);
    },
    onCanvasPointerMove: (e: PointerEvent, { board, screen }: CanvasPointerInfo) => { if (gesture.current.k !== 'idle') send({ type: 'move', board, screen, noSnap: e.metaKey || e.ctrlKey }, e); },
    onCanvasPointerUp: (e: PointerEvent) => send(e.type === 'pointercancel' ? { type: 'cancel' } : { type: 'up' }, e),
    onNavigationStart: cancel,
  } : {};

  /* ── Focus: one tab stop, and the keys go from there ── */
  const focus = useRef<DiagramItem | null>(null);
  // What the keys have gone to stays drawn wherever it is, and gets its focus once it's there.
  const [kept, setKept] = useState<DiagramItem | null>(null);
  // The keys draw a ring on what they go to. A press clears it, and so does focus leaving.
  const [ringOn, setRingOn] = useState<DiagramItem | null>(null);
  const focusNext = useRef<{ item: DiagramItem | null } | null>(null);
  const focusWithin = useRef(false);
  /** Where what's focused last was, so that if it's deleted focus can stay nearby. */
  const focusPlace = useRef<Pt | null>(null);
  const boxOf = (item: DiagramItem): Rect | null => {
    if (item.kind === 'node') return laid.index.byId.get(item.id) ?? null;
    const g = laid.geometries.get(item.id);
    if (!g) return null;
    const r = rectOf(g.pts);
    // A long route can't fit, and its middle's what there is to show.
    return r.w * viewport.zoom > size.width || r.h * viewport.zoom > size.height ? { x: g.mid.x - 1, y: g.mid.y - 1, w: 2, h: 2 } : r;
  };
  const focusEl = (item: DiagramItem | null) => {
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
  const moveFocus = (item: DiagramItem, event?: Event) => {
    focus.current = item;
    setRingOn(item);
    const box = boxOf(item);
    if (box) {
      focusPlace.current = centerOf(box);
      const next = viewportToShow(viewport, box, size);
      if (next !== viewport) canvas.setViewport(next, { reason: 'move-key', event });
    }
    focusEl(item);
  };
  /** Focus that's nowhere yet starts on what's selected, or else on what's nearest the middle of the view. */
  const startFocus = (): DiagramItem | null => {
    const sel = selectionRef.current;
    if (sel.nodes.length) return { kind: 'node', id: sel.nodes[0] };
    if (sel.edges.length) return { kind: 'edge', id: sel.edges[0] };
    const id = nearestNode(laid.index, toBoard(viewport, size.width / 2, size.height / 2));
    return id ? { kind: 'node', id } : null;
  };
  const go = (step: DiagramStep, event?: Event) => {
    const from = focus.current;
    const here = from && (from.kind === 'node' ? laid.index.byId.has(from.id) : laid.geometries.has(from.id)) ? from : null;
    const ctx = { index: laid.index, edges: laid.edges.map((d) => d.edge) };
    const next = here ? stepFocus(here, step, ctx) : step === 'first' || step === 'last' ? stepFocus(null, step, ctx) : startFocus();
    if (next) moveFocus(next, event);
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
      if (portsOnly && !port) return;
      const g: DiagramGesture = { k: 'connect', fixed: { node: n.id, ...(port ? { port } : null) }, end: 'to', at: centerOf(n), over: null, valid: null, keyboard: true };
      gesture.current = g;
      setConnecting(g);
      setStatus(`Connecting from ${nameOf(n.id)}. Arrows choose what to connect to, P changes port, Enter connects, Escape cancels.`);
      return;
    }
    if (portsOnly) return;
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
    const next: DiagramItem | null = near ? { kind: 'node', id: near } : null;
    focus.current = next;
    setRingOn(next);
    focusEl(next);
  }, [laid]);

  const onKeyDown = (e: KeyboardEvent) => {
    // Typing in something a node draws keeps its keys.
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
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
          api.connect(c, e);
        } else setStatus(g.over ? `Can’t connect: ${g.valid}` : 'Choose what to connect to first.');
        return;
      }
    }
    if (key === 'escape') {
      if (gesture.current.k !== 'idle') { cancel(); setStatus('Cancelled.'); }
      else if (selection.nodes.length || selection.edges.length) select(NOTHING_SELECTED, 'escape-key', e);
      else focusEl(null);
      return;
    }
    const arrowKey = e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp';
    if (arrowKey && mod) {
      // ⌘ and an arrow pans, as scrolling does.
      e.preventDefault();
      const by = 80;
      canvas.panBy(e.key === 'ArrowLeft' ? by : e.key === 'ArrowRight' ? -by : 0, e.key === 'ArrowUp' ? by : e.key === 'ArrowDown' ? -by : 0, { reason: 'move-key', event: e });
      return;
    }
    if (arrowKey && e.shiftKey && movable) {
      // Shift and an arrow nudges, what's selected or else what's focused: 8 at a time, or 1 with Alt.
      e.preventDefault();
      const sel = selectionRef.current.nodes;
      const f = focus.current;
      const ids = movableNodes(laid.index, sel.length ? sel : f?.kind === 'node' ? [f.id] : []);
      const by = e.altKey ? 1 : 8;
      api.moveNodes(ids, e.key === 'ArrowLeft' ? -by : e.key === 'ArrowRight' ? by : 0, e.key === 'ArrowUp' ? -by : e.key === 'ArrowDown' ? by : 0, e);
      return;
    }
    if (arrowKey && e.altKey) { e.preventDefault(); go(e.key === 'ArrowDown' ? 'in' : e.key === 'ArrowUp' ? 'out' : (e.key as DiagramStep), e); return; }
    if (arrowKey) { e.preventDefault(); go(e.key as DiagramStep, e); return; }
    if (e.key === '[' || e.key === ']') { e.preventDefault(); go(e.key === ']' ? 'edge+' : 'edge-', e); return; }
    if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); go(e.key === 'PageDown' ? 'next' : 'previous', e); return; }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); go(e.key === 'Home' ? 'first' : 'last', e); return; }
    if (e.key === 'Enter') {
      const f = focus.current;
      if (!f) { go('first', e); return; }
      e.preventDefault();
      if (selectable) {
        const sel = selectionRef.current;
        const list = f.kind === 'node' ? sel.nodes : sel.edges;
        if (e.shiftKey) select(f.kind === 'node' ? { ...sel, nodes: list.includes(f.id) ? list.filter((x) => x !== f.id) : [...list, f.id] } : { ...sel, edges: list.includes(f.id) ? list.filter((x) => x !== f.id) : [...list, f.id] }, 'keyboard', e);
        else select(f.kind === 'node' ? { nodes: [f.id], edges: [] } : { nodes: [], edges: [f.id] }, 'keyboard', e);
      }
      if (!e.shiftKey) onAction?.(f, { reason: 'enter-key', event: e });
      return;
    }
    if (key === 'c' && !mod && connectable && g.k === 'idle') { e.preventDefault(); startKeyboardConnection(e.shiftKey); return; }
    if (mod && key === 'a' && selectable) { e.preventDefault(); api.selectAll(); return; }
    if (undoable && mod && key === 'z') { e.preventDefault(); cancel(); if (e.shiftKey) api.redo(e); else api.undo(e); return; }
    if (undoable && mod && key === 'y') { e.preventDefault(); cancel(); api.redo(e); return; }
    if (!editable) return;
    if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      cancel();
      let sel = selectionRef.current;
      // With nothing selected, the key means what's focused.
      if (!sel.nodes.length && !sel.edges.length && focus.current) {
        const f = focus.current;
        sel = f.kind === 'node' ? { nodes: [f.id], edges: [] } : { nodes: [], edges: [f.id] };
      }
      if (api.internal.remove(sel, e)) setStatus('Deleted.');
    }
  };

  /* ── Only what's near the view gets drawn. Most frames of a pan don't change that, so they don't touch the board at all. ── */
  const culling = cull ?? laid.index.nodes.length + laid.edges.length > CULL_ABOVE;
  const windowRef = useRef<Rect | null>(null);
  windowRef.current = culling ? renderWindow(windowRef.current, { x: -viewport.x / viewport.zoom, y: -viewport.y / viewport.zoom, w: size.width / viewport.zoom, h: size.height / viewport.zoom }) : null;
  const drawWindow = windowRef.current;
  const drawn = useMemo(() => (drawWindow ? within(laid, drawWindow, kept) : laid), [laid, drawWindow, kept]);
  // Each kept in a memo, so a view that only moves changes none of them, and what depends on the zoom is one attribute.
  const nodeView = (n: DiagramNode<any>) => (
    <NodeView key={n.id} node={n} selected={selectedSets.nodes.has(n.id)} selectable={selectable} current={currentSets.nodes.has(n.id)} renderNode={renderNode as NodeViewProps['renderNode']} label={(nodeLabel as DiagramProps<any, any>['describeNode'])?.(n) ?? describeNode(n, laid.index, laid.edgesAt.get(n.id), noun)} />
  );
  const containers = useMemo(() => drawn.containers.map(nodeView),
    [drawn.containers, selectedSets.nodes, currentSets.nodes, selectable, renderNode, nodeLabel, noun, laid.edgesAt]);
  const leaves = useMemo(() => drawn.leaves.map(nodeView),
    [drawn.leaves, selectedSets.nodes, currentSets.nodes, selectable, renderNode, nodeLabel, noun, laid.edgesAt]);
  const lines = useMemo(() => (
    <>
      <defs>
        <ArrowMarker id={arrow} className="fill-muted-foreground" />
        <ArrowMarker id={`${arrow}-strong`} className="fill-foreground" />
        <ArrowMarker id={`${arrow}-selected`} className="fill-primary" />
        <ArrowMarker id={`${arrow}-problem`} className="fill-destructive" />
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
      {drawn.edges.map(({ edge, geometry }) => <EdgeView key={edge.id} edge={edge} d={geometry.d} arrow={arrow} selected={selectedSets.edges.has(edge.id)} selectable={selectable} current={currentSets.edges.has(edge.id)} label={(edgeLabel as DiagramProps<any, any>['describeEdge'])?.(edge) ?? describeEdge(edge, laid.index)} />)}
    </>
  ), [drawn.dividers, drawn.edges, arrow, selectedSets.edges, currentSets.edges, selectable, edgeLabel, laid.index]);
  const labelViews = useMemo(() => drawn.labels.map(({ edge, box }) => <EdgeLabel key={edge.id} edge={edge} box={box} />), [drawn.labels]);
  const rings = useMemo(() => {
    const all = drawn.containers.concat(drawn.leaves);
    // Current first, so that a selection's line goes over it.
    const currentUp = all.filter((n) => currentSets.nodes.has(n.id)).map((n) => (
      <span
        key={`current:${n.id}`}
        data-slot="diagram-current"
        data-current-of={n.id}
        aria-hidden="true"
        className={cn('absolute', nodeRadius(n), isContainer(n) ? CURRENT_CONTAINER : CURRENT_LEAF)}
        style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
      />
    ));
    const ringed = all.filter((n) => selectedSets.nodes.has(n.id) || (ringOn?.kind === 'node' && ringOn.id === n.id));
    return currentUp.concat(ringed.map((n) => (
      <span
        key={n.id}
        data-slot="diagram-ring"
        data-ring-of={n.id}
        data-focused={ringOn?.kind === 'node' && ringOn.id === n.id ? '' : undefined}
        aria-hidden="true"
        className={cn('absolute', nodeRadius(n), ringOn?.kind === 'node' && ringOn.id === n.id ? RING_FOCUSED : RING_SELECTED)}
        style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
      />
    )));
  }, [drawn.containers, drawn.leaves, selectedSets.nodes, currentSets.nodes, ringOn]);
  const marks = useMemo<CanvasMiniMapItem[]>(() => (minimap ? nodes.filter((n) => n.kind !== 'root').map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h })) : []), [minimap, nodes]);
  const zoom = viewport.zoom < NODE_TEXT_ZOOM ? 'far' : viewport.zoom < EDGE_LABEL_ZOOM ? 'mid' : 'near';
  // Changing this restyles every line drawn, so it moves in steps of about 9%, a few frames apart, which keeps a line of
  // 1.25 px within 0.06 px of that. At 2,000 nodes, a change every frame cost 25 ms a frame while zooming.
  const lineZoom = 2 ** (Math.round(Math.log2(viewport.zoom) * 8) / 8);
  const portDots = useMemo(() => handles.length ? (
    <div data-slot="diagram-ports" className="pointer-events-none absolute top-0 left-0" style={{ '--diagram-z': viewport.zoom } as CSSProperties}>
      {(drawWindow ? handles.filter((h) => h.at.x >= drawWindow.x && h.at.x <= drawWindow.x + drawWindow.w && h.at.y >= drawWindow.y && h.at.y <= drawWindow.y + drawWindow.h) : handles).map((h) => (h.hit.kind === 'end'
        ? <span key={`end:${h.hit.end}`} data-slot="diagram-edge-end" data-end={h.hit.end} aria-hidden="true" className={EDGE_END} style={{ left: h.at.x, top: h.at.y }} />
        : h.hit.kind === 'port' ? <PortDot key={`${h.hit.id}/${h.hit.port ?? h.hit.side}`} at={h.at} node={h.hit.id} port={h.hit.port} side={h.hit.side} active={connectable} /> : null))}
    </div>
  ) : null, [handles, connectable, viewport.zoom, drawWindow]);
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
      <div className="pointer-events-none absolute top-0 left-0" style={{ '--diagram-z': viewport.zoom } as CSSProperties}>
        {route ? <ConnectionPreview d={route.d} valid={valid} /> : null}
        {portTarget && target ? (
          <span data-slot="diagram-connection-target" data-valid={valid} aria-hidden="true" className={cn(DOT, 'size-[calc(16px/var(--diagram-z))]', valid ? 'bg-primary/40' : 'bg-destructive/40')} style={{ left: portPoint(target, portTarget).p.x, top: portPoint(target, portTarget).p.y }} />
        ) : target ? (
          <span data-slot="diagram-connection-target" data-valid={valid} aria-hidden="true" className={cn('absolute rounded-ctl', valid ? '[box-shadow:0_0_0_calc(3px/var(--diagram-z))_var(--primary)]' : '[box-shadow:0_0_0_calc(3px/var(--diagram-z))_var(--destructive)]')} style={{ left: target.x, top: target.y, width: target.w, height: target.h }} />
        ) : null}
      </div>
    );
  }, [connecting, laid, viewport.zoom]);

  const context = useMemo<DiagramContextValue>(() => ({ diagram: api as unknown as DiagramController, canvas, canUndo, canRedo, undoable, zoom: viewport.zoom }), [api, canvas, canUndo, canRedo, undoable, viewport.zoom]);
  const empty = !loading && !laid.index.nodes.length;
  const keys = [
    'Arrows move between nodes and along edges; [ and ] step through a node’s edges; Page Up and Page Down go through everything; Enter selects and opens',
    connectable ? '; C connects from what has focus, Shift+C moves an edge’s start' : '',
    movable ? '; Shift and an arrow moves it' : '',
    editable ? '; Delete deletes' : '',
    undoable ? '; Command+Z undoes' : '',
    '. Plus and minus zoom, Command+0 fits.',
  ].join('');

  const onBoard = (el: EventTarget | null) => {
    const board = ref.current?.querySelector('[data-slot=canvas]');
    return !!board && el instanceof Node && board.contains(el);
  };
  const root = usePart(handle, 'root', {}, {
    ref: rootRef,
    'aria-label': ariaLabel,
    className: cn('absolute inset-0', className),
    style,
    // Holding Space to pan drops a drag in progress, the same as a pinch does. It's the canvas's key, so it isn't handed on.
    onKeyDownCapture: (e: ReactKeyboardEvent) => { if (e.key === ' ') cancel(); },
    onLostPointerCapture: cancel,
    // What the keys go to is the board's: focus on the toolbar or a field in the overlay has left it, ring and all.
    onFocus: (e: ReactFocusEvent) => { focusWithin.current = onBoard(e.target); },
    onBlur: (e: ReactFocusEvent) => { if (!onBoard(e.relatedTarget)) { focusWithin.current = false; setRingOn(null); } },
    children: (
      <DiagramContext.Provider value={context}>
        <Canvas
          viewport={viewport}
          onViewportChange={(next, details) => {
            // The keys follow focus themselves, moving as little as they can, and a long edge by its middle.
            if (details.reason === 'focus-in') { details.cancel(); return; }
            change(next, details);
          }}
          controller={canvas}
          fit={laid.bounds}
          fitPadding={fitPadding}
          // A zoom that changes every frame would restyle every node under it: the parts that use it get it in steps.
          zoomVariable={false}
          background={background}
          panning={panning}
          autoFocus={autoFocus}
          aria-label={`${ariaLabel} board`}
          aria-describedby={keysId}
          onCanvasKeyDown={onKeyDown}
          onCanvasDoubleClick={onAction ? (e, { board: at }) => { const hit = hitAt(at); if (hit?.kind === 'node' || hit?.kind === 'edge') onAction({ kind: hit.kind, id: hit.id }, { reason: 'double-click', event: e }); } : undefined}
          {...pointerProps}
          overlay={minimap ? <CanvasMiniMap items={marks} {...(minimap === true ? null : minimap)} /> : null}
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
          {connection}
          <div data-part="board-parts" className="absolute top-0 left-0" style={{ '--canvas-zoom': lineZoom } as CSSProperties}>
            {guides.length ? <CanvasGuides guides={guides} /> : null}
            {marquee ? <CanvasMarquee rect={marquee} /> : null}
            {children}
          </div>
        </Canvas>
        {/* Over the board, and outside it: its keys (Space, the zoom keys) aren't a button's or a field's. */}
        <div data-slot="diagram-overlay" className="pointer-events-none absolute inset-0 z-10 *:pointer-events-auto">
          {loading ? (
            <div data-slot="diagram-loading" role="status" className="absolute start-3 top-3 flex items-center gap-2 rounded-ctl bg-popover px-3 py-2 text-footnote text-popover-foreground shadow-hairline">
              <Spinner size={14} />
              Laying out…
            </div>
          ) : null}
          {empty ? <div data-slot="diagram-empty" className="absolute inset-0 grid place-items-center p-6 *:pointer-events-auto">{renderEmptyState(emptyState, { icon: <Icon name="grid-fill" size={28} />, title: 'Nothing here yet', description: editable ? 'Add a node to start.' : undefined })}</div> : null}
          {overlay}
        </div>
        <p id={keysId} data-slot="diagram-keys" hidden>{keys}</p>
        <div
          data-slot="diagram-status"
          role="status"
          className={cn(status.startsWith('Can’t') && connecting && !connecting.keyboard ? 'pointer-events-none absolute bottom-3 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-ctl bg-popover px-3 py-2 text-footnote text-popover-foreground shadow-hairline' : 'sr-only')}
        >
          {status}
        </div>
      </DiagramContext.Provider>
    ),
  }, 'div');
  return root;
}

/* ── DiagramToolbar: zoom, fit, undo, redo ── */

export type DiagramToolbarProps = Omit<ToolbarProps, 'children'> & {
  /** Where it floats over the board (default `bottom`, `start`). */
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  /** More tools after the diagram's own: ToolbarButtons, ToolbarSeparators. */
  children?: ReactNode;
};

function Tool({ label, shortcut, icon, disabled, onClick }: { label: string; shortcut: string; icon: Parameters<typeof Icon>[0]['name']; disabled?: boolean; onClick: () => void }) {
  return (
    <Tooltip type="label" shortcut={shortcut}>
      <TooltipTrigger render={<ToolbarButton data-action={label.toLowerCase().replace(/ /g, '-')} aria-label={label} size="icon-sm" disabled={disabled} onClick={onClick} />}>
        <Icon name={icon} size={16} />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <TooltipShortcut />
      </TooltipContent>
    </Tooltip>
  );
}

/** A floating Toolbar for a Diagram's `overlay`: zoom out, zoom in and fit, and undo and redo when the diagram keeps its
 *  history. One tab stop, arrows between the tools; each names its shortcut in its tooltip. */
export function DiagramToolbar({ side = 'bottom', align = 'start', variant = 'floating', size = 'sm', className, children, 'aria-label': label = 'Diagram tools', ...props }: DiagramToolbarProps) {
  const { diagram: d, canvas, canUndo, canRedo, undoable } = useDiagram();
  return (
    <Toolbar
      aria-label={label}
      variant={variant}
      size={size}
      data-side={side}
      data-align={align}
      className={cn('absolute', side === 'top' ? 'top-3' : 'bottom-3', align === 'start' ? 'start-3' : 'end-3', className)}
      {...props}
    >
      <Tool label="Zoom out" shortcut="mod+-" icon="minus" onClick={() => canvas.zoomBy(0.8)} />
      <Tool label="Zoom in" shortcut="mod+=" icon="plus" onClick={() => canvas.zoomBy(1.25)} />
      <Tool label="Fit" shortcut="mod+0" icon="arrows-expand" onClick={() => canvas.fit()} />
      {undoable ? (
        <>
          <ToolbarSeparator />
          <Tool label="Undo" shortcut="mod+z" icon="arrow-uturn-backward" disabled={!canUndo} onClick={() => d.undo()} />
          <Tool label="Redo" shortcut="mod+shift+z" icon="arrow-uturn-forward" disabled={!canRedo} onClick={() => d.redo()} />
        </>
      ) : null}
      {children}
    </Toolbar>
  );
}

