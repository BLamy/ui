/* Freeform's data model: a board is a list of items in z-order (first is backmost). Everything is plain data, so
   undo is a snapshot of the list and a board serializes as-is. Coordinates are board units: px at 100% zoom. */
import type { PencilDrawTool, PencilPoint } from '@/components/ui/pencilkit/constants';

export type Side = 't' | 'r' | 'b' | 'l';

export type ShapeKind =
  | 'rect' | 'round' | 'ellipse' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon'
  | 'star' | 'plus' | 'arrow' | 'bubble' | 'heart';

export type Align = 'left' | 'center' | 'right';

interface ItemBase {
  id: string;
  /** Locked items can be selected but not moved, resized, erased or deleted. */
  locked?: boolean;
  /** Items sharing a group id select and move together. */
  group?: string;
}

/** Position, size and rotation (degrees, about the center) of an item you can resize. */
export interface Frame { x: number; y: number; w: number; h: number; rot: number }

export interface StickyItem extends ItemBase, Frame {
  kind: 'sticky';
  color: string;
  text: string;
  size: number;
}

export interface ShapeItem extends ItemBase, Frame {
  kind: 'shape';
  shape: ShapeKind;
  /** null: no fill. */
  fill: string | null;
  /** null: the theme's foreground. */
  stroke: string | null;
  sw: number;
  dashed: boolean;
  opacity: number;
  text: string;
  size: number;
  bold: boolean;
  align: Align;
  /** null: the theme's foreground. */
  textColor: string | null;
}

export interface TextItem extends ItemBase, Frame {
  kind: 'text';
  text: string;
  size: number;
  bold: boolean;
  italic: boolean;
  align: Align;
  /** null: the theme's foreground. */
  color: string | null;
}

export interface ImageItem extends ItemBase, Frame {
  kind: 'image';
  /** A data or object URL. */
  src?: string;
  /** Without `src`, one of the generated pictures (ART in data.ts). */
  art?: number;
  caption?: string;
}

export interface LinkItem extends ItemBase, Frame {
  kind: 'link';
  url: string;
  title: string;
}

/** A freehand stroke: points are board coordinates; x/y/w/h is their bounding box, kept in step by `strokeFrame`. */
export interface StrokeItem extends ItemBase, Frame {
  kind: 'stroke';
  tool: PencilDrawTool;
  color: string;
  /** Width multiplier (PK_W[i].m). */
  width: number;
  pen: boolean;
  points: PencilPoint[];
}

/** Where a connector end is: glued to a side of an item (it follows the item), or free on the board. */
export type ConnectorEnd = { id: string; side: Side } | { x: number; y: number };
export type Route = 'straight' | 'elbow' | 'curve';
export type Heads = 'none' | 'end' | 'both';

export interface ConnectorItem extends ItemBase {
  kind: 'connector';
  from: ConnectorEnd;
  to: ConnectorEnd;
  route: Route;
  heads: Heads;
  /** null: the theme's foreground. */
  color: string | null;
  width: number;
  dashed: boolean;
}

export type BoxItem = StickyItem | ShapeItem | TextItem | ImageItem | LinkItem;
export type Item = BoxItem | StrokeItem | ConnectorItem;
export type ItemKind = Item['kind'];

export const isBox = (i: Item): i is BoxItem => i.kind !== 'stroke' && i.kind !== 'connector';
/** Items with a frame (everything but connectors). */
export const hasFrame = (i: Item): i is BoxItem | StrokeItem => i.kind !== 'connector';
export const isAttached = (e: ConnectorEnd): e is { id: string; side: Side } => 'id' in e;

export type Background = 'dots' | 'grid' | 'none';

export interface Board {
  id: string;
  title: string;
  items: Item[];
  favorite: boolean;
  /** When it was last edited, as shown ("Today, 9:12 AM"). */
  edited: string;
  background: Background;
}

export interface Camera { x: number; y: number; z: number }

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const MIN_SIZE = 24;

let counter = 0;
/** A fresh id for an item, group or board. */
export const newId = (prefix = 'i') => `${prefix}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ── Factories: what each insert button adds ── */

export const makeSticky = (x: number, y: number, color: string, text = ''): StickyItem => ({
  id: newId(), kind: 'sticky', x, y, w: 168, h: 168, rot: 0, color, text, size: 22,
});

export const makeShape = (x: number, y: number, shape: ShapeKind, fill: string | null = null, text = ''): ShapeItem => ({
  id: newId(), kind: 'shape', x, y, w: shape === 'arrow' ? 200 : 180, h: shape === 'arrow' ? 110 : shape === 'round' ? 100 : 140, rot: 0,
  shape, fill, stroke: null, sw: 2, dashed: false, opacity: 1, text, size: 20, bold: false, align: 'center', textColor: null,
});

export const makeText = (x: number, y: number, text = '', size = 28): TextItem => ({
  id: newId(), kind: 'text', x, y, w: 260, h: Math.round(size * 1.35), rot: 0, text, size, bold: false, italic: false, align: 'left', color: null,
});

export const makeImage = (x: number, y: number, art: number, caption?: string): ImageItem => ({
  id: newId(), kind: 'image', x, y, w: 260, h: 190, rot: 0, art, caption,
});

export const makeLink = (x: number, y: number, url: string, title: string): LinkItem => ({
  id: newId(), kind: 'link', x, y, w: 280, h: 84, rot: 0, url, title,
});

export const makeConnector = (from: ConnectorEnd, to: ConnectorEnd, patch: Partial<ConnectorItem> = {}): ConnectorItem => ({
  id: newId(), kind: 'connector', from, to, route: 'elbow', heads: 'end', color: null, width: 3, dashed: false, ...patch,
});
