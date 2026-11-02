/* Where everything sits on the board (board units are the recorded page's px). Shared chrome (a header, a sidebar)
   stands in a column on the left, so what's clicked in it fans out to the pages. Each page is a block — its states left
   to right, four to a line (a state that changed one part of the page is just that part), then the layers opened over
   it, each layer a row of its own states — and the blocks follow the order the recordings reach them from the entry,
   wrapped into lines so the whole map is about as wide as a screen. Segues
   leave from where the click landed and enter their target's nearest side. */
import type { Pt, Rect } from '@/lib/canvas-math';
import type { AppMap, Evidence, MapNode, OverlayType, Segue, StateRef } from './analyze';

/** A measured layer: where it sits in the recorded viewport (px). */
export type Crops = Record<string, Rect>;

export interface FrameBox extends Rect {
  /** `node/state`. */
  key: string;
  node: MapNode;
  state: string;
  /** Drawn as one element of the page (a layer, the content, a part, the chrome) rather than the whole viewport. */
  cropped: boolean;
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
const BLOCK_GAP = 900;
const STATES_PER_LINE = 4;
const CHROME_GAP = 480;

/** A part's size before it's been measured. */
const PART_GUESS = { w: 560, h: 140 };

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
  const measured = (key: string) => { const c = crops[key]; return c && c.w > 4 && c.h > 4 ? c : undefined; };
  /** A page or chrome state's size: as measured, else a guess from what its first moment shows. */
  const sizeOf = (key: string, ev: Evidence | undefined) =>
    measured(key) ?? (ev?.scope === 'part' ? PART_GUESS : ev?.scope === 'chrome' ? { w: viewport.w, h: 64 } : { w: viewport.w, h: viewport.h });

  // The chrome column, right-aligned to x = -CHROME_GAP.
  let cy = 0;
  for (const c of map.chrome) {
    const key = `${c.id}/base`;
    const size = sizeOf(key, c.states[0]?.evidence[0]);
    boxes.push({ key, node: c, state: 'base', x: -CHROME_GAP - size.w, y: cy, w: size.w, h: size.h, cropped: true });
    cy += size.h + LAYER_GAP_Y;
  }

  // Each page as a block of its own (its states, then the layers opened over it), in local coordinates.
  const blocks: { boxes: FrameBox[]; w: number; h: number }[] = [];
  for (const pageId of order) {
    const page = map.pages.find((p) => p.id === pageId);
    if (!page) continue;
    const own: FrameBox[] = [];
    // States left to right, a few to a line so a page many journeys changed doesn't run off forever.
    let x = 0, y = 0, lineH = 0, right = 0;
    page.states.forEach((s, i) => {
      if (i > 0 && i % STATES_PER_LINE === 0) { x = 0; y += lineH + LAYER_GAP_Y; lineH = 0; }
      const key = `${page.id}/${s.id}`;
      const ev = s.evidence[0];
      const size = sizeOf(key, ev);
      own.push({ key, node: page, state: s.id, x, y, w: size.w, h: size.h, cropped: !!ev?.path || !!measured(key) });
      x += size.w + STATE_GAP;
      lineH = Math.max(lineH, size.h);
      right = Math.max(right, x - STATE_GAP);
    });
    let ly = 0;
    const lx = right + LAYER_GAP_X;
    for (const layer of map.overlays.filter((o) => o.hosts[0] === page.id)) {
      let sx = lx;
      let rowH = 0;
      for (const s of layer.states) {
        const crop = crops[`${layer.id}/${s.id}`];
        const size = crop && crop.w > 4 && crop.h > 4 ? crop : GUESS[layer.type];
        own.push({ key: `${layer.id}/${s.id}`, node: layer, state: s.id, x: sx, y: ly, w: size.w, h: size.h, cropped: true });
        sx += size.w + STATE_GAP;
        rowH = Math.max(rowH, size.h);
      }
      ly += rowH + LAYER_GAP_Y;
    }
    const b = unionOf(own);
    blocks.push({ boxes: own, w: b.w, h: b.h });
  }

  // Blocks in reading order, wrapped into lines about as wide as the whole board is tall (times 1.6), so a big app
  // fits a screen rather than running down one long column.
  const area = blocks.reduce((a, b) => a + (b.w + BLOCK_GAP) * (b.h + ROW_GAP), 0);
  const lineW = Math.max(...blocks.map((b) => b.w), Math.sqrt(area * 1.6));
  let bx = 0, by = 0, bh = 0;
  for (const b of blocks) {
    if (bx > 0 && bx + b.w > lineW) { bx = 0; by += bh + ROW_GAP; bh = 0; }
    for (const box of b.boxes) boxes.push({ ...box, x: box.x + bx, y: box.y + by });
    bx += b.w + BLOCK_GAP;
    bh = Math.max(bh, b.h);
  }
  return boxes;
}

function unionOf(boxes: Rect[]): Rect {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  return { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 };
}

function bez(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A segue's curve: from the click (in its frame) to the target frame's nearest side, moved `offset` board units to its
 *  side (one curve per journey that took it, side by side). */
export function seguePath(segue: Segue, from: FrameBox, to: FrameBox, crops: Crops, offset = 0): SeguePath {
  const crop = from.cropped ? crops[from.key] : undefined;
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
  if (offset) {
    const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const nx = (-(end.y - start.y) / len) * offset, ny = ((end.x - start.x) / len) * offset;
    for (const pt of [start, c1, c2, end]) { pt.x += nx; pt.y += ny; }
  }
  return { segue, d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`, start, end, mid: bez(start, c1, c2, end, 0.5), angle: Math.atan2(end.y - c2.y, end.x - c2.x) };
}
