'use client';
import {
  createContext, memo, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
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
import { DiagramChromeProvider, useDiagramChrome, useDiagramChromeInset, useDiagramChromeScope, type DiagramInsets } from '@/lib/diagram-chrome';
import type { DiagramHistory } from '@/lib/diagram-history';
import { describeEdge, describeItem, describeNode, edgesByNode, fitViewport, nearestNode, stepFocus, viewportToKeep, viewportToShow, type DiagramItem, type DiagramStep } from '@/lib/diagram-keyboard';
import {
  DIAGRAM_CARD, DIAGRAM_LEGIBLE_ZOOM, DIAGRAM_SIDES, NOTHING_SELECTED, anchorNormal, codeKey, anchorPoint, connectorPath, diagramBounds, diagramTextRuns, edgeGeometries, edgeGeometry, edgeLabelSize, facePorts, hasEdgeLabel, holdsNodes, indexDiagram, isInside, itemKey, labelBoxAvoiding, moveNodes, nearestSide, nodeAnatomy, portPoint, rectIndex, regionDividers, renderWindow, roundedPolylineD, sectionKey, sizeNodesToText, growNodesToText, loopsBeside,
  type ConnectorEnd, type ConnectorGeometry, type DiagramConnection, type DiagramDivider, type DiagramEdge, type DiagramEdgeTone, type DiagramEdgeVariant, type DiagramGlyph, type DiagramIndex, type DiagramNode, type DiagramNodeKind, type DiagramNodeVariant, type DiagramPort, type DiagramSection, type DiagramSelection, type DiagramSide, type DiagramTone,
} from '@/lib/diagram-model';
import {
  diagram, type DiagramController, type DiagramData, type DiagramDataChangeDetails, type DiagramDataChangeReason, type DiagramOptions, type DiagramSelectionChangeDetails, type DiagramSelectionChangeReason,
} from '@/lib/diagram-primitive';
import { DIAGRAM_TEXT_CLASS, estimateText, measureText, type TextMeasurer } from '@/lib/diagram-text';
import { Icon } from '@/lib/icon';
import { formatShortcutText } from '@/lib/shortcut-text';
import { useFontVersion, useShownVersion } from '@/lib/use-font-version';
import { cn } from '@/lib/utils';

export { createDiagramController } from '@/lib/diagram-primitive';
export { useDiagramHistory } from '@/lib/diagram-history';
export type { DiagramHistory, DiagramHistoryChangeDetails, DiagramHistoryOptions, UseDiagramHistory } from '@/lib/diagram-history';
export type { DiagramController, DiagramData, DiagramDataChangeDetails, DiagramDataChangeReason, DiagramSelectionChangeDetails, DiagramSelectionChangeReason } from '@/lib/diagram-primitive';
export type { DiagramItem } from '@/lib/diagram-keyboard';

/** Why `onAction` was called, and for a press, on what: an edge's whole `label`, or an `item` (a chip). */
export interface DiagramActionDetails {
  reason: 'enter-key' | 'double-click' | 'press';
  event: Event;
  part?: 'label' | 'item';
}

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

/** A node's look: its `kind` (what it is: a node, a group, a region, the root, a marker) and its `variant` (its border).
 *  Nothing here knows what the diagram's about: a statechart's final state is a node with a `double` border, and its
 *  parallel state a group with a `dashed` one, which StateDiagram sets. */
export const diagramNodeVariants = cva('relative size-full', {
  variants: {
    kind: {
      node: 'flex flex-col overflow-hidden rounded-ctl border border-border bg-card text-card-foreground shadow-hairline',
      group: 'flex flex-col overflow-hidden rounded-card border border-border bg-secondary/35 text-card-foreground',
      region: 'flex flex-col rounded-card text-card-foreground',
      root: 'flex flex-col overflow-hidden rounded-card border border-border bg-background/60 text-card-foreground',
      marker: 'rounded-full bg-foreground',
    },
    variant: {
      default: '',
      dashed: 'border-dashed',
      // A hairline inside the border, in the border's color: quiet, so it's never read as selected or focused.
      double: 'outline-1 -outline-offset-4 outline-border',
    },
  },
  defaultVariants: { kind: 'node', variant: 'default' },
});

/** An edge's look: its line (`variant`) and its color (`tone`). A `destructive` edge is dashed as well, as a color isn't
 *  enough on its own. */
export const diagramEdgeVariants = cva(`fill-none ${LINE}`, {
  variants: {
    variant: {
      default: 'stroke-muted-foreground',
      dashed: 'stroke-muted-foreground [stroke-dasharray:calc(5px/var(--diagram-z))_calc(3px/var(--diagram-z))]',
      dotted: 'stroke-muted-foreground [stroke-dasharray:calc(1.5px/var(--diagram-z))_calc(3px/var(--diagram-z))] [stroke-linecap:round]',
      strong: 'stroke-foreground',
    },
    tone: {
      default: '',
      destructive: 'stroke-destructive',
    },
  },
  compoundVariants: [
    { variant: ['default', 'strong'], tone: 'destructive', className: '[stroke-dasharray:calc(6px/var(--diagram-z))_calc(3px/var(--diagram-z))]' },
  ],
  defaultVariants: { variant: 'default', tone: 'default' },
});

const EDGE_VARIANTS: readonly string[] = ['default', 'dashed', 'dotted', 'strong'];
const edgeVariant = (v: string | undefined): DiagramEdgeVariant => (v && EDGE_VARIANTS.includes(v) ? (v as DiagramEdgeVariant) : 'default');
const edgeTone = (t: string | undefined): DiagramEdgeTone => (t === 'destructive' ? 'destructive' : 'default');

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
  const [variant, tone, selected, current] = key.split(':');
  return cn(
    diagramEdgeVariants({ variant: variant as DiagramEdgeVariant, tone: tone as DiagramEdgeTone }),
    selected && 'stroke-primary [stroke-width:calc(2px/var(--diagram-z))]',
    current && 'stroke-primary [stroke-width:calc(2.5px/var(--diagram-z))]',
    'outline-none',
  );
});
const nodeBodyClass = once((key: string) => {
  const [kind, variant] = key.split(':');
  return diagramNodeVariants({ kind: kind as DiagramNodeKind, variant: variant as DiagramNodeVariant });
});

const isContainer = holdsNodes;
const nodeWrapClass = once((radius: string) => cn('absolute outline-none', radius));

/** The zoom below which each kind of text hides: under about 3 px for a node's, and 4.4 px for an edge label's. */
const NODE_TEXT_ZOOM = 0.25;
const EDGE_LABEL_ZOOM = 0.4;
/** The strip along a group's top that its title takes, which an edge label keeps off, when it has nothing measured. */
const GROUP_TITLE_ROOM = 30;
/** How far a route's corners are rounded, in board units. */
const ROUTE_RADIUS = 8;

const FAR_HIDDEN = 'group-data-[zoom=far]/diagram:invisible';

/** An item's look: a chip (the default), or a row of text in a `list` or `code` section; its `tone`; and whether it can be
 *  pressed (then it has hover and press looks). */
export const diagramItemVariants = cva('flex max-w-full min-w-0 items-center gap-1.5', {
  variants: {
    variant: {
      default: 'rounded-md border border-border bg-background px-2 py-0.5 text-foreground shadow-hairline',
      list: 'text-foreground',
      code: 'text-foreground',
    },
    tone: {
      default: '[&_[data-part=glyph]]:text-muted-foreground',
      success: 'border-success/40 [&_[data-part=glyph]]:text-success',
      warning: 'border-warning/50 [&_[data-part=glyph]]:text-warning',
      destructive: 'border-destructive/40 text-destructive [&_[data-part=glyph]]:text-destructive',
      muted: 'text-muted-foreground [&_[data-part=glyph]]:text-muted-foreground',
    },
    pressable: {
      true: 'pointer-events-auto cursor-pointer motion-safe:transition-colors hover:bg-accent active:bg-secondary-strong',
      false: '',
    },
  },
  compoundVariants: [
    { variant: ['list', 'code'], pressable: true, className: 'rounded-xs hover:bg-accent' },
  ],
  defaultVariants: { variant: 'default', tone: 'default', pressable: false },
});

/** An edge's label: a fully rounded `pill` for a title alone, or a small `card` with its items under the title. */
export const diagramEdgeLabelVariants = cva('absolute border border-border bg-card text-card-foreground shadow-hairline', {
  variants: {
    variant: {
      pill: 'flex items-center justify-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap',
      card: 'flex flex-col items-start gap-1.5 rounded-ctl px-2.5 pt-1.5 pb-2',
    },
  },
  defaultVariants: { variant: 'pill' },
});

const TONE_ACCENT: Record<DiagramTone, string> = {
  default: '',
  success: '[box-shadow:inset_0_2px_0_var(--success)] [&>[data-slot=diagram-node-icon]]:text-success',
  warning: '[box-shadow:inset_0_2px_0_var(--warning)] [&>[data-slot=diagram-node-icon]]:text-warning',
  destructive: '[box-shadow:inset_0_2px_0_var(--destructive)] [&>[data-slot=diagram-node-icon]]:text-destructive',
  muted: 'text-muted-foreground',
};

/* ── A node ── */

/** A glyph: one of the kit's icons, or a few characters. */
function Glyph({ glyph, size }: { glyph: DiagramGlyph; size: number }) {
  if (typeof glyph === 'string') return <Icon name={glyph} size={size} />;
  return <span className={cn('px-0.5 text-center', DIAGRAM_TEXT_CLASS.trailing)}>{glyph.text}</span>;
}

export interface DiagramNodeHeaderProps {
  /** The node whose header strip it draws: its `icon`, `title`, `trailing` and `tone`. */
  node: Pick<DiagramNode<unknown>, 'title' | 'icon' | 'trailing' | 'tone' | 'kind'>;
  /** More at the end of the strip, after `trailing`. */
  children?: ReactNode;
  className?: string;
}

/** A card's header strip: a glyph, the title, and a quiet badge at the end. `DiagramNodeBody` draws it; use it in a
 *  `renderNode` that lays a card out its own way. */
export function DiagramNodeHeader({ node, children, className }: DiagramNodeHeaderProps) {
  return (
    <div
      data-slot="diagram-node-header"
      data-tone={node.tone && node.tone !== 'default' ? node.tone : undefined}
      className={cn('flex min-w-0 items-center gap-1.5 px-2.5 py-1.5', TONE_ACCENT[node.tone ?? 'default'], className)}
    >
      {node.icon ? (
        <span data-slot="diagram-node-icon" className={cn('flex min-w-3.5 shrink-0 items-center justify-center text-muted-foreground', FAR_HIDDEN)}>
          <Glyph glyph={node.icon} size={14} />
        </span>
      ) : null}
      {node.title ? (
        <span data-slot="diagram-node-title" className={cn('min-w-0 flex-1 [overflow-wrap:anywhere]', DIAGRAM_TEXT_CLASS.title, FAR_HIDDEN)}>{node.title}</span>
      ) : <span className="flex-1" />}
      {node.trailing ? (
        <span data-slot="diagram-node-trailing" className={cn('ms-0.5 shrink-0 rounded-full bg-foreground/8 px-1.5 py-px whitespace-nowrap text-muted-foreground', DIAGRAM_TEXT_CLASS.trailing, FAR_HIDDEN)}>{node.trailing}</span>
      ) : null}
      {children}
    </div>
  );
}

export interface DiagramSectionsProps {
  sections: readonly DiagramSection[];
  /** Whose they are, for `data-` addresses and presses. */
  owner: { kind: 'node' | 'edge'; id: string };
  /** Whether the items can be pressed: an editable diagram with `onAction`. */
  pressable?: boolean;
  /** The item the keys are on, as `section\0item`. */
  focused?: string;
  className?: string;
}

/** Labelled sections of items: a quiet caption over a column of chips or rows. */
export function DiagramSections({ sections, owner, pressable = false, focused, className }: DiagramSectionsProps) {
  return (
    <div data-slot="diagram-sections" className={cn('flex min-w-0 flex-col items-stretch gap-2.5', className)}>
      {sections.map((s, si) => {
        if (!s.items.length && !s.title) return null;
        const key = sectionKey(s, si);
        const variant = s.variant ?? 'default';
        const inline = variant === 'inline';
        // An inline section's chips are the default chips, in a row.
        const look = inline ? 'default' : variant;
        return (
          <div key={key} data-slot="diagram-section" data-section={key} data-variant={variant} className="flex min-w-0 flex-col items-start">
            {s.title ? <div data-slot="diagram-section-title" className={cn('text-muted-foreground', s.items.length && 'mb-1', DIAGRAM_TEXT_CLASS.caption, FAR_HIDDEN)}>{s.title}</div> : null}
            <div
              className={cn('flex min-w-0', inline ? 'flex-row flex-wrap items-center gap-1' : 'flex-col items-start', variant === 'default' ? 'gap-1' : !inline && 'gap-0.5')}
              // Where it wraps is where it's measured to (a little over, so a pixel of rounding never wraps it sooner).
              style={inline ? { maxWidth: DIAGRAM_CARD.inlineMax + 8 } : undefined}
            >
              {s.items.map((it) => {
                const k = itemKey(it);
                const tone = it.tone ?? 'default';
                return (
                  <div
                    key={k}
                    data-slot="diagram-item"
                    data-owner={owner.id}
                    data-section={key}
                    data-item={k}
                    data-tone={tone === 'default' ? undefined : tone}
                    data-pressable={pressable ? '' : undefined}
                    data-focused={focused === `${key}\0${k}` ? '' : undefined}
                    aria-hidden="true"
                    className={cn(diagramItemVariants({ variant: look, tone, pressable }), ITEM_FOCUS, FAR_HIDDEN)}
                  >
                    {it.icon ? <span data-part="glyph" className="flex min-w-3 shrink-0 items-center justify-center"><Glyph glyph={it.icon} size={12} /></span> : null}
                    <span className={cn('min-w-0 [overflow-wrap:anywhere]', variant === 'code' ? DIAGRAM_TEXT_CLASS.code : DIAGRAM_TEXT_CLASS.item)}>{codeKey(it, variant === 'code')}</span>
                    {it.description ? <span className={cn('min-w-0 text-muted-foreground [overflow-wrap:anywhere]', variant === 'code' ? DIAGRAM_TEXT_CLASS.code : DIAGRAM_TEXT_CLASS.description)}>{it.description}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The keys' ring on an item: the same ring as a node's, past a gap. */
const ITEM_FOCUS = 'data-[focused]:[box-shadow:0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]';

/** The entry marker: a dot, and a curved arrow from it into the node's header, from above its start corner. */
export function DiagramEntryMarker({ className }: { className?: string }) {
  return (
    <svg data-slot="diagram-entry" aria-hidden="true" width={1} height={1} className={cn('pointer-events-none absolute top-0 left-0 overflow-visible', className)}>
      <circle cx={-16} cy={-10} r={4} className="fill-foreground" />
      <path d="M-16 -6C-16 6 -12 14 -4 14" className="fill-none stroke-foreground [stroke-width:1.5]" />
      <path d="M-1 14L-6 11L-6 17Z" className="fill-foreground" />
    </svg>
  );
}

export interface DiagramNodeBodyProps {
  /** The node it draws: its kind, variant, header (`icon`, `title`, `trailing`), `description` and `sections`. */
  node: DiagramNode<unknown>;
  /** Whether its items can be pressed (an editable diagram with `onAction`). */
  pressable?: boolean;
  /** The item the keys are on, as `section\0item`. */
  focusedItem?: string;
  /** More inside the card, after its sections: a badge, a port's name. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** How a node looks, by its kind and variant: a header strip, then its description and its sections. Use it in
 *  `renderNode` to add to what's drawn rather than replacing it. */
export function DiagramNodeBody({ node, pressable: pressableProp, focusedItem: focusedProp, children, className, style }: DiagramNodeBodyProps) {
  const items = useContext(ItemState);
  const pressable = pressableProp ?? items.pressable;
  const focusedItem = focusedProp ?? items.focused;
  const kind = node.kind ?? 'node';
  const look = nodeBodyClass(`${kind}:${node.variant ?? 'default'}`);
  const classes = className ? cn(look, className) : look;
  if (kind === 'marker') return <div data-slot="diagram-node-body" className={classes} style={style}>{children}</div>;
  const sections = node.sections?.some((s) => s.items.length || s.title) ? node.sections : undefined;
  const body = node.description || sections;
  const hasHeader = !!(node.title || node.icon || node.trailing);
  const container = isContainer(node);
  return (
    <div data-slot="diagram-node-body" className={classes} style={style}>
      {hasHeader || !container ? (
        <DiagramNodeHeader
          node={node}
          className={cn(
            body && kind !== 'region' && 'border-b border-border',
            // A strip on a card with sections, as on a box; a card that's only its header is all strip.
            kind === 'region' ? 'text-muted-foreground' : 'bg-secondary-strong',
            // A card that's only its header fills its box, however big it's drawn.
            !body && !container && 'flex-1 justify-center [&>[data-slot=diagram-node-title]]:flex-initial [&>[data-slot=diagram-node-title]]:text-center',
            kind === 'region' && '[&>[data-slot=diagram-node-title]]:font-medium',
          )}
        />
      ) : null}
      {body ? (
        // A box's sections end on a hairline (where its own edges to what it holds start), as its header does.
        <div data-slot="diagram-node-content" className={cn('flex min-w-0 flex-col gap-2 px-2.5 pt-2 pb-2.5', container && kind !== 'region' && '[box-shadow:inset_0_-1px_0_var(--border)]')}>
          {node.description ? <div data-slot="diagram-node-description" className={cn('[overflow-wrap:anywhere] text-muted-foreground', DIAGRAM_TEXT_CLASS.description, FAR_HIDDEN)}>{node.description}</div> : null}
          {sections ? <DiagramSections sections={sections} owner={{ kind: 'node', id: node.id }} pressable={pressable} focused={focusedItem} /> : null}
        </div>
      ) : null}
      {children}
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
  /** Whether its items can be pressed. */
  pressable?: boolean;
  /** The item the keys are on, as `section\0item`. */
  focusedItem?: string;
  renderNode?: (node: DiagramNode<any>) => ReactNode;
}

/** What a node's items are doing, for a `DiagramNodeBody` that `renderNode` draws without being told. */
const ItemState = createContext<{ pressable: boolean; focused?: string }>({ pressable: false });

/** What's selected, what has focus, and what's current, each drawn its own way, so they don't rely on color (the kit's
 *  `--ring` and `--primary` are one blue), and the same thickness on screen at any zoom. The kit's rows are the model:
 *  selected is a fill and a line on its edge, with no gap; focus is a ring outside it, past a gap; both is both. Current
 *  is a bar along its start side. Box-shadows, as Chrome rounds a border or an outline under 1 px up to 1 px before the
 *  board's scale makes it thicker. These sit in a layer of their own, and it's only that layer and the lines that get
 *  `--diagram-z`, in steps: a custom property that changes restyles everything under it. Written out whole, so
 *  Tailwind sees each class. */
const RING_SELECTED = 'bg-primary/12 [box-shadow:0_0_0_calc(1.5px/var(--diagram-z))_var(--primary)]';
/** Something that holds others is selected by its line alone: a fill would wash over what's inside it. */
const RING_SELECTED_CONTAINER = '[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--primary)]';
const RING_FOCUSED = '[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--background),0_0_0_calc(4.5px/var(--diagram-z))_var(--ring)]';
const RING_FOCUSED_SELECTED = 'bg-primary/12 [box-shadow:0_0_0_calc(1.5px/var(--diagram-z))_var(--primary),0_0_0_calc(3.5px/var(--diagram-z))_var(--background),0_0_0_calc(6px/var(--diagram-z))_var(--ring)]';
const RING_FOCUSED_SELECTED_CONTAINER = '[box-shadow:0_0_0_calc(2px/var(--diagram-z))_var(--primary),0_0_0_calc(4px/var(--diagram-z))_var(--background),0_0_0_calc(6.5px/var(--diagram-z))_var(--ring)]';
const CURRENT_LEAF = '[box-shadow:inset_calc(4px/var(--diagram-z))_0_0_0_var(--primary),0_0_0_calc(1px/var(--diagram-z))_var(--primary)]';
const CURRENT_CONTAINER = '[box-shadow:inset_calc(4px/var(--diagram-z))_0_0_0_var(--primary)]';
const ringClass = (container: boolean, selected: boolean, focused: boolean) => (
  focused && selected ? (container ? RING_FOCUSED_SELECTED_CONTAINER : RING_FOCUSED_SELECTED)
    : focused ? RING_FOCUSED
      : container ? RING_SELECTED_CONTAINER : RING_SELECTED
);
const nodeRadius = (n: DiagramNode<any>) => (isContainer(n) ? 'rounded-card' : n.kind === 'marker' ? 'rounded-full' : 'rounded-ctl');

/** The same node drawn the same, though it's a new object: new data from a layout or an owner's state is mostly what was
 *  there, and redrawing thousands of nodes for it would take a frame of its own. */
const sameNode = (a: DiagramNode<unknown>, b: DiagramNode<unknown>) => a === b || (
  a.id === b.id && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.kind === b.kind && a.variant === b.variant && a.title === b.title
  && a.description === b.description && a.icon === b.icon && a.trailing === b.trailing && a.sections === b.sections && a.entry === b.entry && a.tone === b.tone
  && a.parent === b.parent && a.data === b.data && a.ports === b.ports
);
const sameNodeView = (a: NodeViewProps, b: NodeViewProps) =>
  a.selected === b.selected && a.selectable === b.selectable && a.current === b.current && a.label === b.label && a.renderNode === b.renderNode
  && a.pressable === b.pressable && a.focusedItem === b.focusedItem && sameNode(a.node, b.node);

const NodeView = memo(function NodeView({ node, selected, selectable, current, label, pressable = false, focusedItem, renderNode }: NodeViewProps) {
  const items = useMemo(() => ({ pressable, focused: focusedItem }), [pressable, focusedItem]);
  return (
    <div
      data-slot="diagram-node"
      data-node={node.id}
      data-kind={node.kind ?? 'node'}
      data-variant={node.variant}
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
      <ItemState.Provider value={items}>
        {renderNode ? renderNode(node) : <DiagramNodeBody node={node} />}
      </ItemState.Provider>
      {node.entry ? <DiagramEntryMarker /> : null}
    </div>
  );
}, sameNodeView);

/* ── An edge ── */

interface EdgeViewProps {
  edge: DiagramEdge<unknown>; d: string; arrow: string; selected?: boolean; selectable?: boolean; current?: boolean; label: string;
  /** It starts inside the box it's from (a box's own edge to what it holds): a dot there says where. */
  origin?: boolean;
}

/** An edge is drawn from its route, its kind and its name, which are all that's compared. */
const sameEdgeView = (a: EdgeViewProps, b: EdgeViewProps) =>
  a.d === b.d && a.arrow === b.arrow && a.selected === b.selected && a.selectable === b.selectable && a.current === b.current && a.label === b.label && a.origin === b.origin
  && a.edge.id === b.edge.id && a.edge.variant === b.edge.variant && a.edge.tone === b.edge.tone;

const EdgeView = memo(function EdgeView({ edge, d, arrow, selected, selectable, current, label, origin }: EdgeViewProps) {
  const variant = edgeVariant(edge.variant), tone = edgeTone(edge.tone);
  const look = selected || current ? '-selected' : tone === 'destructive' ? '-problem' : variant === 'strong' ? '-strong' : '';
  return (
    <path
      data-slot="diagram-edge"
      data-edge={edge.id}
      data-variant={edge.variant}
      data-tone={edge.tone}
      data-selected={selected ? '' : undefined}
      data-current={current ? '' : undefined}
      role="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={selectable ? !!selected : undefined}
      aria-current={current || undefined}
      d={d}
      markerEnd={`url(#${arrow}${look})`}
      markerStart={origin ? `url(#${arrow}-origin${look})` : undefined}
      className={edgeClass(`${variant}:${tone}:${selected ? '1' : ''}:${current ? '1' : ''}`)}
    />
  );
}, sameEdgeView);

interface EdgeLabelProps {
  edge: DiagramEdge<unknown>;
  box: Rect;
  selected?: boolean;
  focused?: boolean;
  current?: boolean;
  /** Whether its chips can be pressed, one by one. */
  pressable?: boolean;
  /** Whether the label as a whole can be pressed (`DiagramProps.pressable`). */
  pressableLabel?: boolean;
  focusedItem?: string;
}

const sameEdgeLabel = (a: EdgeLabelProps, b: EdgeLabelProps) =>
  a.edge.id === b.edge.id && a.edge.title === b.edge.title && a.edge.icon === b.edge.icon && a.edge.sections === b.edge.sections && a.edge.tone === b.edge.tone
  && a.box.x === b.box.x && a.box.y === b.box.y && a.box.w === b.box.w && a.box.h === b.box.h
  && a.selected === b.selected && a.focused === b.focused && a.current === b.current && a.pressable === b.pressable && a.pressableLabel === b.pressableLabel && a.focusedItem === b.focusedItem;

const LABEL_SELECTED = 'border-primary [box-shadow:0_0_0_1px_var(--primary)]';
/** A label that does something when pressed: a primary ring two lines thick, a play badge on its corner (so it isn't told by
 *  color alone), and hover and press looks. */
const LABEL_PRESSABLE = 'pointer-events-auto cursor-pointer border-primary [box-shadow:0_0_0_1px_var(--primary)] motion-safe:transition-colors hover:bg-primary/8 active:bg-primary/15';
const LABEL_FOCUSED = '[box-shadow:0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]';
const LABEL_FOCUSED_SELECTED = 'border-primary [box-shadow:0_0_0_1px_var(--primary),0_0_0_3px_var(--background),0_0_0_5px_var(--ring)]';

/** An edge's label: a pill, or a card with its items. It's part of its edge: pressing it presses the edge, and the edge's
 *  name says what it says. */
const EdgeLabel = memo(function EdgeLabel({ edge, box, selected, focused, current, pressable = false, pressableLabel = false, focusedItem }: EdgeLabelProps) {
  const sections = edge.sections?.some((s) => s.items.length || s.title) ? edge.sections : undefined;
  const variant = sections ? 'card' : 'pill';
  return (
    <div
      data-slot="diagram-edge-label"
      data-edge={edge.id}
      data-variant={variant}
      data-tone={edge.tone}
      data-selected={selected ? '' : undefined}
      data-focused={focused ? '' : undefined}
      data-current={current ? '' : undefined}
      data-pressable={pressableLabel ? '' : undefined}
      // The edge's own name says this, along with what it joins, and Enter on the edge presses it.
      aria-hidden="true"
      className={cn(
        diagramEdgeLabelVariants({ variant }),
        pressableLabel && LABEL_PRESSABLE,
        'group-data-[zoom=far]/diagram:hidden group-data-[zoom=mid]/diagram:hidden',
        edge.tone === 'destructive' && 'border-dashed border-destructive/60',
        current && 'border-primary',
        focused && selected ? LABEL_FOCUSED_SELECTED : focused ? LABEL_FOCUSED : selected ? LABEL_SELECTED : '',
      )}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      {edge.title || edge.icon ? (
        <div data-slot="diagram-edge-label-title" className={cn('flex min-w-0 items-center gap-1 whitespace-nowrap', DIAGRAM_TEXT_CLASS.edge, edge.tone === 'destructive' && 'text-destructive')}>
          {edge.icon ? <span data-part="glyph" className="flex min-w-3 shrink-0 items-center justify-center text-muted-foreground"><Glyph glyph={edge.icon} size={12} /></span> : null}
          {edge.title}
        </div>
      ) : null}
      {sections ? <DiagramSections sections={sections} owner={{ kind: 'edge', id: edge.id }} pressable={pressable && !pressableLabel} focused={focusedItem} className="gap-2 self-stretch" /> : null}
      {pressableLabel ? (
        <span data-part="press" className="pointer-events-none absolute -top-2 -left-2 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground shadow-hairline">
          <Icon name="play" size={9} />
        </span>
      ) : null}
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

/** Where a box's own edge to what it holds leaves it: a dot on the edge under its sections, the size of a port's. */
function OriginMarker({ id, className }: { id: string; className: string }) {
  return (
    <marker id={id} viewBox="-4 -4 8 8" refX="0" refY="0" markerWidth="4.4" markerHeight="4.4" markerUnits="strokeWidth" orient="auto" overflow="visible">
      <circle r="4" className={cn('[transform:scale(clamp(0.4,var(--diagram-z),1))]', className)} />
    </marker>
  );
}

/* ── Ports, and what's drawn while connecting ── */

const DOT = 'pointer-events-none absolute rounded-full [transform:translate(-50%,-50%)]';

/** A port's dot: the same size on screen down to a zoom where it would crowd its node (a phone's fitted view of a big
 *  system), and from there no bigger than a few board units, so it shrinks with the board. */
const PORT_DOT = 'size-[min(calc(6px/var(--diagram-z)),7px)] [box-shadow:inset_0_0_0_min(calc(1.2px/var(--diagram-z)),1.4px)_var(--muted-foreground)]';
const PORT_DOT_ACTIVE = 'size-[min(calc(10px/var(--diagram-z)),11px)] [box-shadow:inset_0_0_0_min(calc(1.6px/var(--diagram-z)),1.8px)_var(--primary)]';

/** A place to connect. It sits over every node, so one underneath can still be reached. */
const PortDot = memo(function PortDot({ at, node, port, side, active }: { at: Pt; node: string; port?: string; side?: DiagramSide; active: boolean }) {
  return (
    <span
      data-slot="diagram-port"
      data-port-of={node}
      data-port={port}
      data-side={side}
      aria-hidden="true"
      className={cn(DOT, 'bg-background', active ? PORT_DOT_ACTIVE : PORT_DOT)}
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
  /** Each edge with its route, the route's bounds, and its path data (corners rounded). */
  edges: { edge: DiagramEdge<E>; geometry: ConnectorGeometry; box: Rect; d: string }[];
  labels: { edge: DiagramEdge<E>; box: Rect }[];
  dividers: DiagramDivider[];
  /** Edges from a box to what it holds that start inside it, under its sections: drawn with a dot where they start. */
  origins: Set<string>;
  bounds: Rect | null;
}

/** A route's path data: a curve as it is, and anything square with its corners rounded. */
const routeD = (edge: DiagramEdge<unknown>, g: ConnectorGeometry) => ((edge.route === 'curve' && !edge.points) ? g.d : roundedPolylineD(g.pts, ROUTE_RADIUS));

/** Up to this many nodes and edges, hand-placed edges go round the cards in their way (not while something's dragged). */
const AVOID_UP_TO = 200;
/** Up to this many, edges between ports, and any that would run along another, get lanes of their own (`routeInLanes`). */
const LANES_UP_TO = 120;

function layOut<N, E>(given: readonly DiagramNode<N>[], givenEdges: readonly DiagramEdge<E>[], text: TextMeasurer, moving = false): Laid<N, E> {
  const edges = placeLoops(given, givenEdges, text);
  // A port on a card's row sits at the end of the row that faces where its edges go.
  const nodes = facePorts(given, edges);
  const index = indexDiagram(nodes);
  const headOf = (n: DiagramNode<N>) => (n.title || n.sections?.length ? Math.max(GROUP_TITLE_ROOM, nodeAnatomy(n, text).top) : GROUP_TITLE_ROOM);
  // Edges in lanes of their own come with their labels, on runs of their own.
  const laned = new Map<string, Rect>();
  const geometries = edgeGeometries(edges, index, {
    avoid: !moving && nodes.length + edges.length <= AVOID_UP_TO,
    ...(nodes.length + edges.length <= LANES_UP_TO ? { headOf, labelSize: (e: DiagramEdge<E>) => edgeLabelSize(e, text), labels: laned } : null),
  });
  const drawn: Laid<N, E>['edges'] = [];
  const labels: Laid<N, E>['labels'] = [];
  // A label sits on its route, the edge running into it and out of it: where a layout put it if that's clear, or else
  // the first clear place along the route, then beside it, or else where it covers least. It keeps off the nodes, off
  // the labels already placed (two edges on one route) and off the other routes, so it isn't read as theirs. A group is
  // only in the way along its header and sections.
  for (const edge of edges) {
    const geometry = geometries.get(edge.id);
    if (geometry) drawn.push({ edge, geometry, box: rectOf(geometry.pts), d: routeD(edge, geometry) });
  }
  // A label a layout placed with its route (or a lane's) stays where it is: only one with no place yet looks for one, and
  // only then is everything it keeps off indexed (every card and every run of every route: at 2,000 nodes, most of a
  // drag's frame, for nothing).
  const placedBy = (edge: DiagramEdge<E>) => laned.get(edge.id) ?? (edge.labelBox && edge.points && edge.points.length >= 2 ? edge.labelBox : null);
  const unplaced = drawn.some((d) => hasEdgeLabel(d.edge) && !placedBy(d.edge));
  if (!unplaced) {
    for (const { edge } of drawn) if (hasEdgeLabel(edge)) labels.push({ edge, box: placedBy(edge)! });
  } else {
    const room = rectIndex(nodes.flatMap((n) => (n.kind === 'root' || n.kind === 'region' || n.kind === 'marker' ? []
      : holdsNodes(n) ? [{ x: n.x, y: n.y, w: n.w, h: headOf(n) }] : [n])));
    const routes = new Map<string, Set<Rect>>();
    for (const { edge, geometry } of drawn) {
      const own = new Set<Rect>();
      for (let i = 1; i < geometry.pts.length; i++) {
        const a = geometry.pts[i - 1], b = geometry.pts[i];
        const r = { x: Math.min(a.x, b.x) - 1, y: Math.min(a.y, b.y) - 1, w: Math.abs(b.x - a.x) + 2, h: Math.abs(b.y - a.y) + 2 };
        own.add(r);
        room.add(r);
      }
      routes.set(edge.id, own);
    }
    for (const { edge } of drawn) {
      const box = laned.get(edge.id);
      if (box && hasEdgeLabel(edge)) room.add(box);
    }
    for (const { edge, geometry } of drawn) {
      if (!hasEdgeLabel(edge)) continue;
      const own = routes.get(edge.id)!;
      const size = edge.labelBox ?? edgeLabelSize(edge, text)!;
      // A route and a label a layout worked out together stay together: the route runs through the label. So do a lane's.
      const lane = laned.get(edge.id);
      const box = lane ?? (edge.labelBox && edge.points && edge.points.length >= 2 ? edge.labelBox : labelBoxAvoiding(geometry.pts, size, (b) => room.overlap(b, (r) => own.has(r)), edge.labelBox));
      if (!lane) room.add(box);
      labels.push({ edge, box });
    }
  }
  // Outer containers first, so what's inside draws over them, however the nodes were listed.
  const depth = (n: DiagramNode<N>) => index.depth.get(n.id) ?? 0;
  const containers = nodes.filter(isContainer).map((n, i) => ({ n, i })).sort((a, b) => depth(a.n) - depth(b.n) || a.i - b.i).map(({ n }) => n);
  const leaves = nodes.filter((n) => !isContainer(n));
  // An entry marker stands out past its node's corner.
  const entries = nodes.filter((n) => n.entry).map((n) => ({ x: n.x - 22, y: n.y - 16, w: 22, h: 16 }));
  const origins = new Set<string>();
  for (const { edge, geometry } of drawn) {
    const box = index.byId.get(edge.from);
    if (!box || !isInside(index, edge.to, edge.from)) continue;
    const p = geometry.start;
    if (p.x > box.x + 1 && p.x < box.x + box.w - 1 && p.y > box.y + 1 && p.y < box.y + box.h - 1) origins.add(edge.id);
  }
  return {
    index, geometries, edgesAt: edgesByNode(drawn.map((d) => d.edge)), containers, leaves, edges: drawn, labels, dividers: regionDividers(index), origins,
    bounds: diagramBounds([...nodes, ...entries], geometries.values(), labels.map((l) => l.box)),
  };
}

/** A placed card's self-loops with no route of their own, each beside it with its label on it (`loopsBeside`). */
function placeLoops<N, E>(nodes: readonly DiagramNode<N>[], edges: readonly DiagramEdge<E>[], text: TextMeasurer): readonly DiagramEdge<E>[] {
  const loops = new Map<string, DiagramEdge<E>[]>();
  for (const e of edges) if (e.from === e.to && !e.points) loops.set(e.from, [...(loops.get(e.from) ?? []), e]);
  if (!loops.size) return edges;
  const placed = new Map<string, { points: Pt[]; labelBox?: Rect }>();
  for (const n of nodes) {
    const list = loops.get(n.id);
    if (!list || holdsNodes(n) || n.kind === 'marker') continue;
    for (const [id, at] of loopsBeside(n, list.map((e) => ({ id: e.id, size: edgeLabelSize(e, text) })))) placed.set(id, at);
  }
  return placed.size ? edges.map((e) => { const at = placed.get(e.id); return at ? { ...e, ...at } : e; }) : edges;
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
  /** The diagram's own methods: select, delete, connect, undo… (the controller's, and only those). */
  diagram: DiagramController<any, any>;
  /** The board's view: zoom, fit, pan. */
  canvas: CanvasController;
  /** What undo and redo drive here: the `history` it was given, its own when it's `editable`, or null for none. */
  history: DiagramHistory | null;
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
  /** Let the pointer and the keys select nodes and edges: one at a time, more with Shift or ⌘, or with a marquee. On by
   *  default, read-only too: a diagram without `editable` is a picture you can select in and read. */
  selectable?: boolean;
  /** Let the pointer and the keys move, connect and delete things, with undo. */
  editable?: boolean;
  /** Whether dragging and ⇧ with an arrow move things, for when where they are isn't up to you. On when `editable` is. */
  movable?: boolean;
  /** A history to drive instead of the diagram's own (`useDiagramHistory`), for a diagram drawn from something that keeps
   *  its own (a StateDiagram's config, a CloudflareDiagram's system). ⌘Z, ⇧⌘Z and ⌘Y, DiagramToolbar's Undo and Redo, a
   *  controller and an agent all undo and redo it, and the diagram keeps none of its own. */
  history?: DiagramHistory;
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
  /** Enter on a focused node, edge or item, a double click, or a press (`press`) on what `pressable` says can be: an edge's
   *  label (`details.part` `label`, the item is the edge) or a chip (`item`, with its `section` and `item` addresses). */
  onAction?: (item: DiagramItem, details: DiagramActionDetails) => void;
  /** What a press acts on, read-only too: `true` for every card's chips and every edge's label as a whole; a selection for
   *  the chips of those nodes and the labels of those edges (a simulation's transitions it can take now). A pressable label
   *  has a primary ring and a play badge. An `editable` diagram with `onAction` has pressable chips as well. */
  pressable?: boolean | DiagramSelection;
  /** What a screen reader calls a node (default `node`): a state, a service. */
  noun?: string;
  /** What a screen reader says for a node. The default says what it is, what it's in and what it connects to. */
  describeNode?: (node: DiagramNode<N>) => string;
  describeEdge?: (edge: DiagramEdge<E>) => string;
  /** Controlled view. Left out, the diagram fits its content, and goes on fitting until the view's moved. */
  viewport?: Viewport;
  defaultViewport?: Viewport;
  onViewportChange?: (viewport: Viewport, details: CanvasViewportChangeDetails) => void;
  /** How much air to leave around the content when fitting it, in px (default 24), on every side or on each. The chrome
   *  over the board (a DiagramToolbar, the minimap, a DiagramFrameBar) is added to it. */
  fitPadding?: number | Partial<DiagramInsets>;
  /** Size each node to its words, measured in the real font, around its center. A node that holds others keeps its size. */
  autoSize?: boolean;
  /** Draw only what's near the view. By default that's on above 200 nodes and edges. */
  cull?: boolean;
  /** An overview in a corner, on `CanvasMiniMap` (`side`, `align`). `auto`: only while the diagram can't be seen whole at a
   *  readable size (a good part of it out of view) on a board that has room for it (720 × 600 px or more), above a frame's bar. */
  minimap?: boolean | 'auto' | Omit<CanvasMiniMapProps, 'items'>;
  /** Draws a node's insides, within a box it's placed in. Keep the function stable, as it's what the nodes memoize on. */
  renderNode?: (node: DiagramNode<N>) => ReactNode;
  /** What shows with no nodes (and not `loading`). Default an `EmptyState`; `null` for nothing. */
  emptyState?: ReactNode;
  /** The data isn't here yet (a layout is running): a spinner, and no empty state. */
  loading?: boolean;
  /** Why the diagram can't be drawn: an alert over the board, under the toolbar's row, in place of the empty state. */
  error?: ReactNode;
  /** Drives it from outside: `createDiagramController()`. */
  controller?: DiagramController<N, E>;
  /** Its name, for people and agents (default `Diagram`). The board inside is named `<name> board`. */
  'aria-label'?: string;
  /** Drawn over the diagram in screen space: a `DiagramToolbar`, a status. `useDiagram` works here. */
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

/** Where a diagram opens, until the view's moved: all of it, centered, when that can be read; otherwise at the least size
 *  that can be read, from its top-start corner (where a machine's name and context are, and a system's), across its width
 *  (centered) when that fits, to be scrolled. Only on a board too narrow for a column of cards (a phone's), where that
 *  corner would leave where it starts (its first entry marker) out of view, is that put in the middle instead. Never past
 *  100%, and always in the part of the board nothing covers (`pad`: the toolbar, the minimap, a frame's bar and drawer). */
function firstView(box: Rect | null, size: { width: number; height: number }, pad: DiagramInsets, start?: Rect | null): Viewport {
  const fit = fitViewport(box, size, pad);
  if (!box || box.w <= 0 || box.h <= 0 || fit.zoom >= DIAGRAM_LEGIBLE_ZOOM) return fit;
  const room = Math.max(1, size.width - pad.left - pad.right);
  const zoom = DIAGRAM_LEGIBLE_ZOOM;
  let x = box.w * zoom <= room ? pad.left + (room - box.w * zoom) / 2 - box.x * zoom : pad.left - box.x * zoom;
  if (start && size.width < NARROW_BOARD && box.w * zoom > room && (start.x + start.w) * zoom + x > pad.left + room) {
    const centered = pad.left + room / 2 - (start.x + start.w / 2) * zoom;
    x = Math.min(pad.left - box.x * zoom, Math.max(centered, pad.left + room - (box.x + box.w) * zoom));
  }
  return { zoom, x, y: pad.top - box.y * zoom };
}

/** From this big, a board has room for `minimap="auto"`'s overview: smaller (a phone, a docs page's fence), the overview
 *  would cover a third of it, and Fit is a press away. */
const MINIMAP_AUTO_FROM = { width: 720, height: 600 };
/** `minimap="auto"` shows when a whole fit would be under this share of the readable size: a good part of it out of view at
 *  that size, not the last few units of a drawing that nearly fits. */
const MINIMAP_AUTO_SHARE = 0.8;

/** Narrower than this, a board can't show a container's header and sections and much else: a phone's. A regular frame's
 *  board beside its panel is wider (432 px at the least). */
const NARROW_BOARD = 420;

/** A diagram on a `Canvas`. Sits in its host like any BL UI container: it fills the nearest positioned box. */
export function Diagram<N = unknown, E = unknown>({
  nodes: givenNodes, edges: givenEdges, defaultNodes = EMPTY, defaultEdges = EMPTY, onDataChange, selectable = true, editable = false, movable: movableProp, history: givenHistory, portsOnly = false, connectable: connectableProp,
  isValidConnection, createEdge, selection: selectionProp, defaultSelection = NOTHING_SELECTED, current = NOTHING_SELECTED, onSelectionChange, onAction, pressable: pressableProp, noun, describeNode: nodeLabel, describeEdge: edgeLabel,
  viewport: controlled, defaultViewport, onViewportChange, fitPadding = 24, autoSize, cull, minimap, renderNode, emptyState, loading = false, error, controller,
  background, panning, autoFocus, 'aria-label': ariaLabel = 'Diagram', overlay, children, className, style, ref: refProp,
}: DiagramProps<N, E>) {
  const connectable = connectableProp ?? editable;
  const movable = movableProp ?? editable;
  // Its own history when it's editable and wasn't handed one.
  const ownHistory = editable && !givenHistory;
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
    selectable, editable: editable || movable || connectable, undoable: ownHistory, history: givenHistory, isValidConnection, createEdge, controller,
  } as DiagramOptions<any, any>);
  const { instance, api } = handle;
  const subscribe = useCallback((listener: () => void) => instance.subscribe(listener), [instance]);
  const read = useCallback(() => instance.get(), [instance]);
  const state = useSyncExternalStore(subscribe, read, read);
  const data = (givenData ?? state.data) as DiagramData<N, E>;
  const selection = selectionProp ?? state.selection;
  const canUndo = ownHistory && state.past > 0;
  const canRedo = ownHistory && state.future > 0;
  const history = useMemo<DiagramHistory | null>(() => givenHistory ?? (ownHistory ? {
    canUndo, canRedo, undo: (event?: Event) => { api.undo(event); }, redo: (event?: Event) => { api.redo(event); },
  } : null), [givenHistory, ownHistory, canUndo, canRedo, api]);

  /* ── What a drag shows before it's committed ── */
  const [draft, setDraft] = useState<DiagramData<N, E> | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [connecting, setConnecting] = useState<Extract<DiagramGesture, { k: 'connect' }> | null>(null);
  const [status, setStatus] = useState('');

  const shown = draft ?? data;
  const text = useDiagramText(ref, shown.nodes, shown.edges, !!autoSize || shown.nodes.length <= AVOID_UP_TO || shown.edges.some((e) => !e.labelBox && hasEdgeLabel(e)));
  /** What can be pressed: chips in an editable diagram that says what a press does, and whatever `pressable` names. */
  const chipsEverywhere = (editable && !!onAction) || pressableProp === true;
  const pressSets = useMemo(() => (typeof pressableProp === 'object' ? { nodes: new Set(pressableProp.nodes), edges: new Set(pressableProp.edges) } : null), [pressableProp]);
  const chipsOf = (id: string) => chipsEverywhere || !!pressSets?.nodes.has(id);
  const labelPressable = (id: string) => pressableProp === true || !!pressSets?.edges.has(id);
  const pressable = chipsEverywhere || !!pressSets?.nodes.size;
  // A card given a size is drawn that size, unless what it says needs more (a diagram this small: past it, as given).
  const nodes = useMemo(() => (autoSize ? sizeNodesToText(shown.nodes, text) : shown.nodes.length <= AVOID_UP_TO ? growNodesToText(shown.nodes, text) : shown.nodes), [autoSize, shown.nodes, text]);
  const laid = useMemo(() => layOut(nodes, shown.edges, text, !!draft), [nodes, shown.edges, text, draft]);

  /* ── The chrome over the board (its toolbar, its minimap, a frame's bar) and the room a fit leaves for it ── */
  // A frame's board around it is a scope too (its bar), and in one, the board's foot is the bar's.
  const around = useDiagramChrome();
  const chrome = useDiagramChromeScope(ref, { frame: !!around?.frame });
  const pad = typeof fitPadding === 'number' ? { top: fitPadding, right: fitPadding, bottom: fitPadding, left: fitPadding } : { top: 24, right: 24, bottom: 24, left: 24, ...fitPadding };
  const miniSide = typeof minimap === 'object' && minimap.side === 'top' ? 'top' : 'bottom';
  const miniHeight = (typeof minimap === 'object' ? minimap.height ?? 120 : 120) + 12;
  // A frame's bar along the same edge: the map sits above it.
  const under = miniSide === 'bottom' ? around?.insets.bottom ?? 0 : 0;
  const inset = (side: keyof DiagramInsets, withMap: boolean) => {
    const map = withMap && side === miniSide ? miniHeight + under : 0;
    const over = Math.max(chrome.insets[side], around?.insets[side] ?? 0, map);
    // Past the chrome, a little air: less than the padding asked for, as the chrome already has its own margin.
    return over ? Math.max(pad[side], over + 12) : pad[side];
  };
  const insetsWith = (withMap: boolean): DiagramInsets => ({ top: inset('top', withMap), right: inset('right', withMap), bottom: inset('bottom', withMap), left: inset('left', withMap) });
  // `auto`: shown while what's drawn can't be seen whole at a size that can be read, and there's room for an overview.
  const showMap = minimap === 'auto'
    ? !!laid.bounds && size.width >= MINIMAP_AUTO_FROM.width && size.height >= MINIMAP_AUTO_FROM.height && fitViewport(laid.bounds, size, insetsWith(false)).zoom < DIAGRAM_LEGIBLE_ZOOM * MINIMAP_AUTO_SHARE
    : !!minimap;
  const fitInsets = insetsWith(showMap);
  const fitKey = `${fitInsets.top},${fitInsets.right},${fitInsets.bottom},${fitInsets.left}`;
  // `fitKey` stands for `fitInsets`, a new object each render.
  const fitPad = useMemo(() => fitInsets, [fitKey]);

  // Where it starts: the first entry marker, the highest of the shallowest.
  const start = useMemo(() => {
    let best: DiagramNode<N> | null = null;
    for (const n of laid.index.nodes) {
      if (!n.entry) continue;
      const d = laid.index.depth.get(n.id) ?? 0, bd = best ? laid.index.depth.get(best.id) ?? 0 : Infinity;
      if (!best || d < bd || (d === bd && n.y < best.y)) best = n;
    }
    return best ? { x: best.x - 22, y: best.y - 16, w: best.w + 22, h: best.h + 16 } : null;
  }, [laid.index]);
  // What has the eye: what's selected, or else what's current (a machine's state), whichever changed last. It's kept in the
  // part of the board nothing covers: in the first view, and from then on as the board's room changes (a panel opening beside
  // or over it), as it changes, and as it moves; by as little a pan as does that, never a new fit.
  const selectionKey = `${selection.nodes.join('\0')}\0\0${selection.edges.join('\0')}`;
  const currentKey = `${current.nodes.join('\0')}\0\0${current.edges.join('\0')}`;
  const watch = useRef<{ selection: string; current: string; on: 'selection' | 'current' }>({ selection: selectionKey, current: currentKey, on: selection.nodes.length || selection.edges.length ? 'selection' : 'current' });
  if (watch.current.selection !== selectionKey) watch.current = { ...watch.current, selection: selectionKey, on: selection.nodes.length || selection.edges.length ? 'selection' : 'current' };
  if (watch.current.current !== currentKey) watch.current = { ...watch.current, current: currentKey, on: 'current' };
  const eyeOn = watch.current.on === 'selection' && (selection.nodes.length || selection.edges.length) ? selection : current;
  const eye = useMemo(() => {
    const rects: Rect[] = [];
    // The innermost of them: a state, not the box around it that's current as well.
    const set = new Set(eyeOn.nodes);
    const holdsOne = new Set<string>();
    for (const id of eyeOn.nodes) for (let p = laid.index.parent.get(id); p; p = laid.index.parent.get(p) ?? null) { if (set.has(p)) holdsOne.add(p); }
    for (const id of eyeOn.nodes) { const n = laid.index.byId.get(id); if (n && !holdsOne.has(id)) rects.push(n); }
    for (const id of eyeOn.edges) {
      const l = laid.labels.find((x) => x.edge.id === id)?.box;
      const g = l ? null : laid.geometries.get(id);
      if (l) rects.push(l);
      else if (g) rects.push({ x: g.mid.x - 1, y: g.mid.y - 1, w: 2, h: 2 });
    }
    if (!rects.length) return null;
    const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
    return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
  }, [eyeOn, laid]);
  const opening = firstView(laid.bounds, size, fitPad, start);
  const viewport = controlled ?? own ?? (eye ? viewportToKeep(opening, eye, size, fitPad) : opening);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  /** Every move of the view comes through the canvas, ours included (the keys following focus go through its
   *  controller), so `onViewportChange` always hears why. */
  const change = (next: Viewport, details: CanvasViewportChangeDetails) => {
    onViewportChange?.(next, details);
    if (!details.canceled) setOwn(next);
  };

  // After the first view, what has the eye is kept in view by a pan, once the board has settled after a change to it.
  const eyeKey = eye ? `${Math.round(eye.x)},${Math.round(eye.y)},${Math.round(eye.w)},${Math.round(eye.h)}|${size.width}x${size.height}|${fitKey}` : null;
  const keptFor = useRef<string | null>(null);
  useEffect(() => {
    if (!eyeKey || keptFor.current === eyeKey) return;
    keptFor.current = eyeKey;
    // Not while something's dragged (it's under the pointer), nor in the first view, which keeps it itself.
    if (!eye || draft || gesture.current.k !== 'idle' || (!controlled && !own)) return;
    const v = viewportRef.current;
    const next = viewportToKeep(v, eye, size, fitPad);
    if (next !== v) canvas.setViewport(next, { reason: 'imperative' });
    // `eyeKey` stands for `eye`, `size` and `fitPad`.
  }, [eyeKey, draft]);

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
  const nameOf = (id: string) => laid.index.byId.get(id)?.title || id;
  /** A press that started on an item, to report if it ends without a drag. */
  const pressedItem = useRef<{ item: DiagramItem; part: 'label' | 'item'; at: Pt } | null>(null);
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
      const target = e.target as Element | null;
      const chip = target?.closest?.('[data-slot=diagram-item][data-pressable]');
      const owner = chip?.closest('[data-slot=diagram-node],[data-slot=diagram-edge-label]');
      const label = chip ? null : target?.closest?.('[data-slot=diagram-edge-label][data-pressable]');
      pressedItem.current = chip && owner ? {
        item: { kind: owner.getAttribute('data-slot') === 'diagram-node' ? 'node' : 'edge', id: owner.getAttribute(owner.getAttribute('data-slot') === 'diagram-node' ? 'data-node' : 'data-edge') ?? '', section: chip.getAttribute('data-section') ?? '', item: chip.getAttribute('data-item') ?? '' },
        part: 'item',
        at: { x: e.clientX, y: e.clientY },
      } : label ? { item: { kind: 'edge', id: label.getAttribute('data-edge') ?? '' }, part: 'label', at: { x: e.clientX, y: e.clientY } } : null;
      // A press ends connecting by keyboard, and the keys carry on from what was pressed.
      cancel();
      setRingOn(null);
      if (hit?.kind === 'node' || hit?.kind === 'edge') { focus.current = { kind: hit.kind, id: hit.id }; focusPlace.current = board; }
      send({ type: 'down', hit, board, screen, additive: e.shiftKey || e.metaKey || e.ctrlKey }, e);
    },
    onCanvasPointerMove: (e: PointerEvent, { board, screen }: CanvasPointerInfo) => { if (gesture.current.k !== 'idle') send({ type: 'move', board, screen, noSnap: e.metaKey || e.ctrlKey }, e); },
    onCanvasPointerUp: (e: PointerEvent) => {
      send(e.type === 'pointercancel' ? { type: 'cancel' } : { type: 'up' }, e);
      const pressed = pressedItem.current;
      pressedItem.current = null;
      // An item pressed without a drag: the owner's selected by the press, and the item is what's reported.
      if (pressed && e.type !== 'pointercancel' && Math.hypot(e.clientX - pressed.at.x, e.clientY - pressed.at.y) < 6) onAction?.(pressed.item, { reason: 'press', event: e, part: pressed.part });
    },
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
    // An item keeps focus on its owner, which has a name of its own: the item is said aloud instead.
    if (item.item !== undefined) {
      const owner = item.kind === 'node' ? laid.index.byId.get(item.id) : laid.edges.find((d) => d.edge.id === item.id)?.edge;
      const whose = item.kind === 'node' ? nameOf(item.id) : (owner as DiagramEdge<E> | undefined)?.title || 'edge';
      setStatus(`${describeItem(item, owner?.sections, whose)}.${pressable ? ' Enter presses it.' : ''}`);
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
    const ctx = { index: laid.index, edges: laid.edges.map((d) => d.edge), items: pressable };
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
      else if (focus.current?.item !== undefined) go('out', e);
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
      if (f.item !== undefined) {
        // An item: its owner's selected, and the item's what's reported.
        if (selectable) select(f.kind === 'node' ? { nodes: [f.id], edges: [] } : { nodes: [], edges: [f.id] }, 'keyboard', e);
        onAction?.(f, { reason: 'enter-key', event: e });
        return;
      }
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
    <NodeView key={n.id} node={n} selected={selectedSets.nodes.has(n.id)} selectable={selectable} current={currentSets.nodes.has(n.id)} pressable={chipsOf(n.id)} focusedItem={ringOn?.kind === 'node' && ringOn.id === n.id && ringOn.item !== undefined ? `${ringOn.section}\0${ringOn.item}` : undefined} renderNode={renderNode as NodeViewProps['renderNode']} label={(nodeLabel as DiagramProps<any, any>['describeNode'])?.(n) ?? describeNode(n, laid.index, laid.edgesAt.get(n.id), noun)} />
  );
  const containers = useMemo(() => drawn.containers.map(nodeView),
    [drawn.containers, selectedSets.nodes, currentSets.nodes, selectable, chipsEverywhere, pressSets, ringOn, renderNode, nodeLabel, noun, laid.edgesAt]);
  const leaves = useMemo(() => drawn.leaves.map(nodeView),
    [drawn.leaves, selectedSets.nodes, currentSets.nodes, selectable, chipsEverywhere, pressSets, ringOn, renderNode, nodeLabel, noun, laid.edgesAt]);
  const lines = useMemo(() => (
    <>
      <defs>
        <ArrowMarker id={arrow} className="fill-muted-foreground" />
        <ArrowMarker id={`${arrow}-strong`} className="fill-foreground" />
        <ArrowMarker id={`${arrow}-selected`} className="fill-primary" />
        <ArrowMarker id={`${arrow}-problem`} className="fill-destructive" />
        <OriginMarker id={`${arrow}-origin`} className="fill-muted-foreground" />
        <OriginMarker id={`${arrow}-origin-strong`} className="fill-foreground" />
        <OriginMarker id={`${arrow}-origin-selected`} className="fill-primary" />
        <OriginMarker id={`${arrow}-origin-problem`} className="fill-destructive" />
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
      {drawn.edges.map(({ edge, d }) => <EdgeView key={edge.id} edge={edge} d={d} arrow={arrow} origin={laid.origins.has(edge.id)} selected={selectedSets.edges.has(edge.id)} selectable={selectable} current={currentSets.edges.has(edge.id)} label={(edgeLabel as DiagramProps<any, any>['describeEdge'])?.(edge) ?? describeEdge(edge, laid.index)} />)}
    </>
  ), [drawn.dividers, drawn.edges, arrow, selectedSets.edges, currentSets.edges, selectable, edgeLabel, laid.index, laid.origins]);
  const labelViews = useMemo(() => drawn.labels.map(({ edge, box }) => {
    const on = ringOn?.kind === 'edge' && ringOn.id === edge.id ? ringOn : null;
    return (
      <EdgeLabel
        key={edge.id} edge={edge} box={box} selected={selectedSets.edges.has(edge.id)} current={currentSets.edges.has(edge.id)} pressable={chipsEverywhere} pressableLabel={labelPressable(edge.id)}
        focused={!!on && on.item === undefined} focusedItem={on && on.item !== undefined ? `${on.section}\0${on.item}` : undefined}
      />
    );
  }), [drawn.labels, selectedSets.edges, currentSets.edges, chipsEverywhere, pressableProp, pressSets, ringOn]);
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
    const focusedOn = (n: DiagramNode<N>) => ringOn?.kind === 'node' && ringOn.id === n.id && ringOn.item === undefined;
    const ringed = all.filter((n) => selectedSets.nodes.has(n.id) || focusedOn(n));
    return currentUp.concat(ringed.map((n) => (
      <span
        key={n.id}
        data-slot="diagram-ring"
        data-ring-of={n.id}
        data-focused={focusedOn(n) ? '' : undefined}
        data-selected={selectedSets.nodes.has(n.id) ? '' : undefined}
        aria-hidden="true"
        className={cn('absolute', nodeRadius(n), ringClass(isContainer(n), selectedSets.nodes.has(n.id), focusedOn(n)))}
        style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
      />
    )));
  }, [drawn.containers, drawn.leaves, selectedSets.nodes, currentSets.nodes, ringOn]);
  const focusedEdge = ringOn?.kind === 'edge' && ringOn.item === undefined ? laid.edges.find((d) => d.edge.id === ringOn.id)?.d ?? null : null;
  const marks = useMemo<CanvasMiniMapItem[]>(() => (showMap ? nodes.filter((n) => n.kind !== 'root').map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h })) : []), [showMap, nodes]);
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

  // Only the controller's methods: what the gestures commit with stays inside.
  const methods = useMemo<DiagramController<any, any>>(() => ({
    getData: api.getData, getSelection: api.getSelection, select: api.select, selectAll: api.selectAll, clearSelection: api.clearSelection,
    deleteSelection: api.deleteSelection, moveNodes: api.moveNodes, connect: api.connect, undo: api.undo, redo: api.redo, canUndo: api.canUndo, canRedo: api.canRedo,
  }), [api]);
  const context = useMemo<DiagramContextValue>(() => ({ diagram: methods, canvas, history, zoom: viewport.zoom }), [methods, canvas, history, viewport.zoom]);
  const empty = !loading && !error && !laid.index.nodes.length;
  // The shortcuts are spelled for the platform (⌘ on Apple's, Ctrl elsewhere), once it's known: a server can't tell.
  const [platform, setPlatform] = useState<boolean | undefined>(false);
  useEffect(() => { setPlatform(undefined); }, []);
  const keys = [
    'Arrows move between nodes and along edges; [ and ] step through a node’s edges; Page Up and Page Down go through everything; Enter selects and opens',
    connectable ? '; C connects from what has focus, Shift+C moves an edge’s start' : '',
    movable ? '; Shift and an arrow moves it' : '',
    editable ? '; Delete deletes' : '',
    history ? `; ${formatShortcutText('mod+z', platform)} undoes and ${formatShortcutText('mod+shift+z', platform)} redoes` : '',
    `. Plus and minus zoom, ${formatShortcutText('mod+0', platform)} fits.`,
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
    // Undo and redo, from anywhere in the diagram (the board, its toolbar), but not from a field: one place for the keys.
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (!history || e.defaultPrevented || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      e.preventDefault();
      cancel();
      if (key === 'y' || e.shiftKey) history.redo(e.nativeEvent);
      else history.undo(e.nativeEvent);
    },
    onLostPointerCapture: cancel,
    // What the keys go to is the board's: focus on the toolbar or a field in the overlay has left it, ring and all.
    onFocus: (e: ReactFocusEvent) => { focusWithin.current = onBoard(e.target); },
    onBlur: (e: ReactFocusEvent) => { if (!onBoard(e.relatedTarget)) { focusWithin.current = false; setRingOn(null); } },
    children: (
      <DiagramContext.Provider value={context}>
        <DiagramChromeProvider value={chrome}>
        <Canvas
          viewport={viewport}
          onViewportChange={(next, details) => {
            // The keys follow focus themselves, moving as little as they can, and a long edge by its middle.
            if (details.reason === 'focus-in') { details.cancel(); return; }
            change(next, details);
          }}
          controller={canvas}
          fit={laid.bounds}
          fitPadding={fitPad}
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
          overlay={showMap ? <CanvasMiniMap items={marks} {...(typeof minimap === 'object' ? minimap : null)} {...(under ? { style: { bottom: under + 8, ...(typeof minimap === 'object' ? minimap.style : null) } } : null)} /> : null}
        >
          <div data-slot="diagram-layer" data-zoom={zoom} className="group/diagram pointer-events-none absolute top-0 left-0">
            {containers}
            {focusedEdge ? (
              <svg data-slot="diagram-edge-focus" aria-hidden="true" className="absolute top-0 left-0 overflow-visible" width={1} height={1} style={{ '--diagram-z': lineZoom } as CSSProperties}>
                <path d={focusedEdge} className="fill-none stroke-ring/35 [stroke-width:calc(9px/var(--diagram-z))] [stroke-linecap:round] [stroke-linejoin:round]" />
              </svg>
            ) : null}
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
          {error ? (
            <div data-slot="diagram-error" role="alert" className="pointer-events-auto absolute inset-x-3 rounded-ctl bg-popover p-3 text-footnote text-destructive shadow-raised" style={{ top: Math.max(12, chrome.insets.top + 8) }}>
              {error}
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
        </DiagramChromeProvider>
      </DiagramContext.Provider>
    ),
  }, 'div');
  return root;
}

/* ── DiagramToolbar: zoom, fit, undo, redo ── */

export type DiagramToolbarProps = Omit<ToolbarProps, 'children'> & {
  /** Where it floats over the board: default `top` in a DiagramFrame (whose bar is at the foot), `bottom` elsewhere. */
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  /** More tools after the diagram's own: ToolbarButtons, ToolbarSeparators. */
  children?: ReactNode;
};

function Tool({ label, shortcut, icon, disabled, onClick }: { label: string; shortcut: string; icon: Parameters<typeof Icon>[0]['name']; disabled?: boolean; onClick: (event: Event) => void }) {
  return (
    <Tooltip type="label" shortcut={shortcut}>
      <TooltipTrigger render={<ToolbarButton data-action={label.toLowerCase().replace(/ /g, '-')} aria-label={label} size="icon-sm" disabled={disabled} onClick={(e) => onClick(e.nativeEvent)} />}>
        <Icon name={icon} size={16} />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <TooltipShortcut />
      </TooltipContent>
    </Tooltip>
  );
}

/** A floating Toolbar for a Diagram's `overlay`: zoom out, zoom in and fit, and undo and redo when the diagram has a
 *  history (its own, or the one it was handed). One tab stop, arrows between the tools; each names its shortcut in its
 *  tooltip. A fit leaves room for it. */
export function DiagramToolbar({ side: sideProp, align = 'start', variant = 'floating', size = 'sm', className, children, 'aria-label': label = 'Diagram tools', ref: refProp, ...props }: DiagramToolbarProps) {
  const { canvas, history } = useDiagram();
  const scope = useDiagramChrome();
  // In a frame, the board's foot is the frame's bar.
  const side = sideProp ?? (scope?.frame ? 'top' : 'bottom');
  const own = useRef<HTMLDivElement | null>(null);
  useDiagramChromeInset(own, side);
  const ref = useCallback((el: HTMLDivElement | null) => {
    own.current = el;
    if (typeof refProp === 'function') refProp(el);
    else if (refProp) refProp.current = el;
  }, [refProp]);
  return (
    <Toolbar
      ref={ref}
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
      {history ? (
        <>
          <ToolbarSeparator />
          <Tool label="Undo" shortcut="mod+z" icon="arrow-uturn-backward" disabled={!history.canUndo} onClick={(e) => history.undo(e)} />
          <Tool label="Redo" shortcut="mod+shift+z" icon="arrow-uturn-forward" disabled={!history.canRedo} onClick={(e) => history.redo(e)} />
        </>
      ) : null}
      {children}
    </Toolbar>
  );
}

