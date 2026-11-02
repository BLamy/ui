/* Where everything sits on the board (board units are the recorded page's px). Pages go top to bottom in the order the
   recordings reach them from the entry; each page's row holds its states left to right, then the layers opened over
   it, each layer a row of its own states. Segues leave from where the click landed and enter their target's nearest
   side. */
import type { Pt, Rect } from '@/lib/canvas-math';
import type { AppMap, OverlayNode, OverlayType, PageNode, Segue, StateRef } from './analyze';

/** A measured layer: where it sits in the recorded viewport (px). */
export type Crops = Record<string, Rect>;

export interface FrameBox extends Rect {
  /** `node/state`. */
  key: string;
  node: PageNode | OverlayNode;
  state: string;
}

export interface SeguePath {
  segue: Segue;
  d: string;
  start: Pt;
  end: Pt;
  mid: Pt;
  /** Direction at the end (radians), for the arrowhead. */
  angle: number;
}

export const frameKey = (r: StateRef) => `${r.node}/${r.state}`;

const STATE_GAP = 240;
const LAYER_GAP_X = 420;
const LAYER_GAP_Y = 280;
const ROW_GAP = 640;

/** A layer's size before it's been measured. */
const GUESS: Record<OverlayType, { w: number; h: number }> = {
  dialog: { w: 440, h: 300 }, menu: { w: 200, h: 180 }, sheet: { w: 380, h: 800 }, popover: { w: 300, h: 180 }, toast: { w: 220, h: 48 }, panel: { w: 400, h: 300 },
};

export function layoutMap(map: AppMap, viewport: { w: number; h: number }, crops: Crops): FrameBox[] {
  // Pages in the order they're reached from the entry (layers lead to their host).
  const hostOf = (id: string) => map.overlays.find((o) => o.id === id)?.hosts[0] ?? id;
  const order: string[] = [];
  const queue = map.entry ? [map.entry.node] : [];
  while (queue.length || order.length < map.pages.length) {
    const id = queue.shift() ?? map.pages.find((p) => !order.includes(p.id))!.id;
    if (order.includes(id)) continue;
    order.push(id);
    for (const s of map.segues) if (hostOf(s.from.node) === id) queue.push(hostOf(s.to.node));
  }

  const boxes: FrameBox[] = [];
  let y = 0;
  for (const pageId of order) {
    const page = map.pages.find((p) => p.id === pageId);
    if (!page) continue;
    let x = 0;
    for (const s of page.states) {
      boxes.push({ key: `${page.id}/${s.id}`, node: page, state: s.id, x, y, w: viewport.w, h: viewport.h });
      x += viewport.w + STATE_GAP;
    }
    let ly = y;
    const lx = x - STATE_GAP + LAYER_GAP_X;
    for (const layer of map.overlays.filter((o) => o.hosts[0] === page.id)) {
      let sx = lx;
      let rowH = 0;
      for (const s of layer.states) {
        const crop = crops[`${layer.id}/${s.id}`];
        const size = crop && crop.w > 4 && crop.h > 4 ? crop : GUESS[layer.type];
        boxes.push({ key: `${layer.id}/${s.id}`, node: layer, state: s.id, x: sx, y: ly, w: size.w, h: size.h });
        sx += size.w + STATE_GAP;
        rowH = Math.max(rowH, size.h);
      }
      ly += rowH + LAYER_GAP_Y;
    }
    y = Math.max(y + viewport.h, ly - LAYER_GAP_Y) + ROW_GAP;
  }
  return boxes;
}

function bez(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A segue's curve: from the click (in its frame) to the target frame's nearest side. */
export function seguePath(segue: Segue, from: FrameBox, to: FrameBox, crops: Crops): SeguePath {
  const crop = from.node.kind === 'overlay' ? crops[from.key] : undefined;
  const local = crop ? { x: segue.point.x - crop.x, y: segue.point.y - crop.y } : segue.point;
  const start = { x: from.x + clamp(local.x, 0, from.w), y: from.y + clamp(local.y, 0, from.h) };
  let end: Pt, c1: Pt, c2: Pt;
  if (to.x >= start.x + 60) {
    end = { x: to.x - 10, y: clamp(start.y, to.y + 24, to.y + to.h - 24) };
    const k = Math.max(80, (end.x - start.x) * 0.45);
    c1 = { x: start.x + k, y: start.y };
    c2 = { x: end.x - k, y: end.y };
  } else {
    const below = to.y >= start.y;
    end = { x: to.x + Math.min(to.w / 2, 240), y: below ? to.y - 10 : to.y + to.h + 10 };
    const k = Math.max(160, Math.abs(end.y - start.y) * 0.4);
    const side = Math.max(start.x, end.x) + 220;
    c1 = { x: side, y: start.y };
    c2 = { x: end.x, y: below ? end.y - k : end.y + k };
  }
  return { segue, d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`, start, end, mid: bez(start, c1, c2, end, 0.5), angle: Math.atan2(end.y - c2.y, end.x - c2.x) };
}
