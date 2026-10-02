/* Selection and group edits for Freeform's items. The handle, resize, rotate and snap math is the canvas toolkit's
   (@/lib/canvas-math); what is here knows what an item is: a connector has two ends, a stroke has points. */
import { ALL_HANDLES, EDGE_HANDLES, MIN_SIZE, frameHandles, rectOf, unionRect, cornersOf, type Frame, type Handle, type Pt } from '@/lib/canvas-math';
import { connectorGeometry } from './geometry';
import { isAttached, type Item } from './model';

export type SelectionKind = 'none' | 'single' | 'group' | 'connector';

export interface SelectionFrame {
  kind: SelectionKind;
  /** The frame the handles sit on (a single item's own, rotated; a group's bounding box). */
  frame: Frame | null;
  handles: Handle[];
}

export function selectionFrame(selected: Item[], byId: Map<string, Item>, z: number): SelectionFrame {
  const live = selected.filter((i) => !i.locked);
  if (selected.length === 1 && selected[0].kind === 'connector') {
    const c = selected[0];
    if (c.locked) return { kind: 'connector', frame: null, handles: [] };
    const g = connectorGeometry(c, byId);
    return { kind: 'connector', frame: null, handles: [{ id: 'from', pt: g.start }, { id: 'to', pt: g.end }] };
  }
  if (selected.length === 1 && selected[0].kind !== 'connector') {
    const it = selected[0];
    const frame: Frame = { x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot };
    if (it.locked) return { kind: 'single', frame, handles: [] };
    const ids = it.kind === 'text' || it.kind === 'link' ? EDGE_HANDLES : ALL_HANDLES;
    return { kind: 'single', frame, handles: frameHandles(frame, z, { ids, rotate: it.kind !== 'stroke' }) };
  }
  const rects = selected.map((i) => rectOf(i.kind === 'connector' ? connectorGeometry(i, byId).pts : cornersOf(i)));
  const box = unionRect(rects);
  if (!box) return { kind: 'none', frame: null, handles: [] };
  const frame: Frame = { ...box, rot: 0 };
  if (!live.length) return { kind: 'group', frame, handles: [] };
  const corners: [Handle['id'], Pt][] = [
    ['nw', { x: box.x, y: box.y }], ['ne', { x: box.x + box.w, y: box.y }],
    ['se', { x: box.x + box.w, y: box.y + box.h }], ['sw', { x: box.x, y: box.y + box.h }],
  ];
  return { kind: 'group', frame, handles: corners.map(([id, pt]) => ({ id, pt })) };
}

/** `item` scaled by (sx, sy) about `origin` — a group resize. Fonts follow the smaller scale. */
export function scaleItem(item: Item, sx: number, sy: number, origin: Pt): Item {
  const mx = (x: number) => origin.x + (x - origin.x) * sx;
  const my = (y: number) => origin.y + (y - origin.y) * sy;
  const s = Math.min(Math.abs(sx), Math.abs(sy));
  if (item.kind === 'connector') {
    const end = (e: typeof item.from) => (isAttached(e) ? e : { x: mx(e.x), y: my(e.y) });
    return { ...item, from: end(item.from), to: end(item.to) };
  }
  if (item.kind === 'stroke') {
    return { ...item, x: mx(item.x), y: my(item.y), w: item.w * sx, h: item.h * sy, points: item.points.map(([x, y, p]) => [mx(x), my(y), p]) };
  }
  const size = 'size' in item ? { size: Math.max(6, Math.round(item.size * s)) } : null;
  return { ...item, x: mx(item.x), y: my(item.y), w: Math.max(MIN_SIZE, item.w * sx), h: Math.max(MIN_SIZE, item.h * sy), ...size } as Item;
}

export function moveItem(item: Item, dx: number, dy: number): Item {
  if (item.kind === 'connector') {
    const end = (e: typeof item.from) => (isAttached(e) ? e : { x: e.x + dx, y: e.y + dy });
    return { ...item, from: end(item.from), to: end(item.to) };
  }
  if (item.kind === 'stroke') return { ...item, x: item.x + dx, y: item.y + dy, points: item.points.map(([x, y, p]) => [x + dx, y + dy, p]) };
  return { ...item, x: item.x + dx, y: item.y + dy };
}
