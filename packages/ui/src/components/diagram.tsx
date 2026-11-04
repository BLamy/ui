'use client';
import { memo, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Canvas, CanvasMiniMap, type CanvasMiniMapItem, type CanvasMiniMapProps, type CanvasProps } from '@/components/ui/canvas';
import { fitCamera, type Camera, type Rect } from '@/lib/canvas-math';
import { useContainerSize } from '@/lib/container';
import {
  diagramBounds, edgeGeometries, indexDiagram, labelBox, regionDividers,
  type ConnectorGeometry, type DiagramDivider, type DiagramEdge, type DiagramNode,
} from '@/lib/diagram-model';
import { cn } from '@/lib/utils';

/* ══ Diagram — nodes, edges, labels and regions on the Canvas ══
   Hand it nodes and edges as plain data (`@/lib/diagram-model`) and it draws them on a `Canvas`, so the camera, the
   minimap and `useCanvas` are the canvas's own. Everything's in board units, and scales with the camera as an object on a
   board does, borders included. Lines and arrowheads are the exception: they keep their thickness on screen at any zoom.
   Text that would be too small to read hides. */

/* ── Looks ── */

/** A line's thickness on screen, whatever the zoom: `--diagram-z` is the camera's zoom. */
const LINE = '[stroke-width:calc(1.25px/var(--diagram-z))] [stroke-linejoin:round]';

export const diagramNodeVariants = cva('relative size-full', {
  variants: {
    kind: {
      node: 'flex flex-col items-center justify-center rounded-ctl border border-border bg-card text-card-foreground shadow-hairline',
      final: 'flex flex-col items-center justify-center rounded-ctl border-2 border-foreground bg-card text-card-foreground outline-1 -outline-offset-4 outline-foreground',
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
          <div data-slot="diagram-node-label" className="absolute top-1.5 left-3 whitespace-nowrap text-caption font-semibold text-muted-foreground group-data-[zoom=far]/diagram:hidden">
            {node.label}
            {node.detail ? <span data-slot="diagram-node-detail" className="font-normal"> ({node.detail})</span> : null}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div data-slot="diagram-node-body" className={cn(diagramNodeVariants({ kind }), className)} style={style}>
      <div data-slot="diagram-node-label" className="whitespace-nowrap text-caption font-medium leading-tight group-data-[zoom=far]/diagram:hidden">{node.label}</div>
      {node.detail ? <div data-slot="diagram-node-detail" className="whitespace-nowrap text-caption2 leading-tight text-muted-foreground group-data-[zoom=far]/diagram:hidden">{node.detail}</div> : null}
    </div>
  );
}

interface NodeViewProps {
  node: DiagramNode<unknown>;
  renderNode?: (node: DiagramNode<any>) => ReactNode;
}

const NodeView = memo(function NodeView({ node, renderNode }: NodeViewProps) {
  return (
    <div
      data-slot="diagram-node"
      data-node={node.id}
      data-kind={node.kind ?? 'node'}
      className="absolute"
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      {renderNode ? renderNode(node) : <DiagramNodeBody node={node} />}
    </div>
  );
});

/* ── An edge ── */

const EdgeView = memo(function EdgeView({ edge, geometry, arrow }: { edge: DiagramEdge<unknown>; geometry: ConnectorGeometry; arrow: string }) {
  const look = edgeLook(edge.kind);
  return (
    <path
      data-slot="diagram-edge"
      data-edge={edge.id}
      data-kind={edge.kind ?? 'event'}
      d={geometry.d}
      markerEnd={`url(#${arrow}${look === 'initial' ? '-strong' : ''})`}
      className={diagramEdgeVariants({ kind: look })}
    />
  );
});

const EdgeLabel = memo(function EdgeLabel({ edge, box }: { edge: DiagramEdge<unknown>; box: Rect }) {
  return (
    <div
      data-slot="diagram-edge-label"
      data-edge={edge.id}
      className="absolute whitespace-nowrap text-caption2 leading-none text-muted-foreground group-data-[zoom=far]/diagram:hidden group-data-[zoom=mid]/diagram:hidden"
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
  containers: DiagramNode<N>[];
  leaves: DiagramNode<N>[];
  edges: { edge: DiagramEdge<E>; geometry: ConnectorGeometry }[];
  labels: { edge: DiagramEdge<E>; box: Rect }[];
  dividers: DiagramDivider[];
  bounds: Rect | null;
}

/** A label's size, before anything's measured it. */
const estimateLabel = (text: string) => ({ w: text.length * 5.6 + 2, h: 11 });

function layOut<N, E>(nodes: readonly DiagramNode<N>[], edges: readonly DiagramEdge<E>[]): Laid<N, E> {
  const index = indexDiagram(nodes);
  const geometries = edgeGeometries(edges, index);
  const drawn: Laid<N, E>['edges'] = [];
  const labels: Laid<N, E>['labels'] = [];
  for (const edge of edges) {
    const geometry = geometries.get(edge.id);
    if (!geometry) continue;
    drawn.push({ edge, geometry });
    if (edge.label) labels.push({ edge, box: edge.labelBox ?? labelBox(geometry.pts, estimateLabel(edge.label)) });
  }
  // Outer containers first, so what's inside draws over them, however the nodes were listed.
  const depth = (n: DiagramNode<N>) => index.depth.get(n.id) ?? 0;
  const containers = nodes.filter(isContainer).map((n, i) => ({ n, i })).sort((a, b) => depth(a.n) - depth(b.n) || a.i - b.i).map(({ n }) => n);
  const leaves = nodes.filter((n) => !isContainer(n));
  return {
    containers, leaves, edges: drawn, labels, dividers: regionDividers(index),
    bounds: diagramBounds(nodes, geometries.values(), labels.map((l) => l.box)),
  };
}

const Board = memo(function Board({ laid, renderNode, arrow }: { laid: Laid<any, any>; renderNode?: NodeViewProps['renderNode']; arrow: string }) {
  return (
    <>
      {laid.containers.map((n) => <NodeView key={n.id} node={n} renderNode={renderNode} />)}
      <svg data-slot="diagram-edges" aria-hidden="true" className="absolute top-0 left-0 overflow-visible" width={1} height={1}>
        <defs>
          <ArrowMarker id={arrow} className="fill-muted-foreground" />
          <ArrowMarker id={`${arrow}-strong`} className="fill-foreground" />
        </defs>
        {laid.dividers.map((d) => (
          <line
            key={d.id}
            data-slot="diagram-divider"
            x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
            className="stroke-border [stroke-dasharray:calc(6px/var(--diagram-z))_calc(4px/var(--diagram-z))] [stroke-width:calc(1px/var(--diagram-z))]"
          />
        ))}
        {laid.edges.map(({ edge, geometry }) => <EdgeView key={edge.id} edge={edge} geometry={geometry} arrow={arrow} />)}
      </svg>
      {laid.leaves.map((n) => <NodeView key={n.id} node={n} renderNode={renderNode} />)}
      {laid.labels.map(({ edge, box }) => <EdgeLabel key={edge.id} edge={edge} box={box} />)}
    </>
  );
});

/* ── Diagram ── */

export interface DiagramProps<N = unknown, E = unknown> extends Pick<CanvasProps, 'background' | 'panning' | 'cursor' | 'autoFocus' | 'aria-label' | 'overlay'> {
  nodes: readonly DiagramNode<N>[];
  edges?: readonly DiagramEdge<E>[];
  /** Controlled camera. Left out, the diagram fits its content, and goes on fitting until the camera's moved. */
  camera?: Camera;
  defaultCamera?: Camera;
  onCameraChange?: (camera: Camera) => void;
  /** How much air to leave around the content when fitting it, in px (default 24). */
  fitPadding?: number;
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

/** A diagram on a `Canvas`. Sits in its host like any BL UI container: it fills the nearest positioned box. */
export function Diagram<N = unknown, E = unknown>({
  nodes, edges = EMPTY, camera: controlled, defaultCamera, onCameraChange, fitPadding = 24, minimap, renderNode,
  background, panning, cursor, autoFocus, 'aria-label': ariaLabel = 'Diagram', overlay, children, className, style,
}: DiagramProps<N, E>) {
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1000, height: 700 });
  const [own, setOwn] = useState<Camera | null>(defaultCamera ?? null);
  const arrow = `diagram-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const laid = useMemo(() => layOut(nodes, edges), [nodes, edges]);
  const camera = controlled ?? own ?? fitCamera(laid.bounds, size, fitPadding);
  const change = (next: Camera) => {
    setOwn(next);
    onCameraChange?.(next);
  };
  const board = useMemo(() => <Board laid={laid} renderNode={renderNode as NodeViewProps['renderNode']} arrow={arrow} />, [laid, renderNode, arrow]);
  const marks = useMemo<CanvasMiniMapItem[]>(() => (minimap ? nodes.filter((n) => n.kind !== 'root').map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h })) : []), [minimap, nodes]);
  const zoom = camera.z < NODE_TEXT_ZOOM ? 'far' : camera.z < EDGE_LABEL_ZOOM ? 'mid' : 'near';
  return (
    <div ref={ref} data-slot="diagram" className={cn('absolute inset-0 font-sans', className)} style={style}>
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
        {children}
      </Canvas>
    </div>
  );
}
