/* The storyboard's geometry: where every rendered node is (measured once per change, in board units, so camera
   moves don't invalidate it), which scene is under a point, and the paths of the segue arrows. Which node is under
   the pointer, and where a dragged component lands, are pick.ts's: the browser's own hit-testing answers those. */
import type { Camera, Pt, Rect } from '@/lib/canvas-math';
import type { Device, Doc, Node, Scene } from './model';
import { walk, type Place } from './tree';

/* ── Measuring ── */

/** One element drawn for a node: where, in which scene's frame (a scene shown in place inside another is drawn in
    that one's frame too), and which of the node's elements in that frame it is (a repeated row has several). */
export interface Hit {
  id: string;
  rect: Rect;
  frame: string | null;
  k: number;
}

export interface SlotHit {
  key: string;
  rect: Rect;
  frame: string | null;
}

export interface Measured {
  /** Every rendered node, by id: one rect per element drawn for it, everywhere. Board units. */
  nodes: Map<string, Rect[]>;
  hits: Hit[];
  /** Slot areas (`nodeId:slot`), for dropping into an empty one. */
  slotHits: SlotHit[];
}

export const EMPTY_MEASURE: Measured = { nodes: new Map(), hits: [], slotHits: [] };

/** A client rect in board units, for a storyboard whose box is `base`. */
export const toBoardRect = (r: DOMRect, base: DOMRect, camera: Camera): Rect => ({
  x: (r.left - base.left - camera.x) / camera.z,
  y: (r.top - base.top - camera.y) / camera.z,
  w: r.width / camera.z,
  h: r.height / camera.z,
});

const frameOf = (el: Element) => el.closest('[data-ib-scene-frame]')?.getAttribute('data-ib-scene-frame') ?? null;

/** Reads every node's box under `root`, converted to board units with `camera`. */
export function measure(root: HTMLElement, camera: Camera): Measured {
  const base = root.getBoundingClientRect();
  const nodes = new Map<string, Rect[]>();
  const hits: Hit[] = [];
  const seen = new Map<string, number>();
  root.querySelectorAll<HTMLElement>('[data-ib-node]').forEach((el) => {
    const id = el.dataset.ibNode!;
    const frame = frameOf(el);
    const key = `${frame}|${id}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    let r = el.getBoundingClientRect();
    // A box that takes no space (a TabBar placing itself): measure what it draws.
    if (!r.width && !r.height && el.firstElementChild) r = el.firstElementChild.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const rect = toBoardRect(r, base, camera);
    nodes.set(id, [...(nodes.get(id) ?? []), rect]);
    hits.push({ id, rect, frame, k });
  });
  const slotHits: SlotHit[] = [];
  root.querySelectorAll<HTMLElement>('[data-ib-slot]').forEach((el) => {
    slotHits.push({ key: el.dataset.ibSlot!, rect: toBoardRect(el.getBoundingClientRect(), base, camera), frame: frameOf(el) });
  });
  return { nodes, hits, slotHits };
}

/** Are two measurements the same (within half a pixel)? Avoids re-rendering for nothing. */
export function sameMeasure(a: Measured, b: Measured): boolean {
  if (a.hits.length !== b.hits.length || a.slotHits.length !== b.slotHits.length) return false;
  const near = (r: Rect, s: Rect) => Math.abs(r.x - s.x) < 0.5 && Math.abs(r.y - s.y) < 0.5 && Math.abs(r.w - s.w) < 0.5 && Math.abs(r.h - s.h) < 0.5;
  return a.hits.every((h, i) => { const o = b.hits[i]; return o.id === h.id && o.frame === h.frame && o.k === h.k && near(h.rect, o.rect); })
    && a.slotHits.every((h, i) => { const o = b.slotHits[i]; return o.key === h.key && o.frame === h.frame && near(h.rect, o.rect); });
}

/** One drawn instance of a node: the scene frame it's drawn in, and which of the node's elements there. */
export interface At {
  id: string;
  frame: string;
  k: number;
}

/** Where an instance is now. */
export const rectAt = (m: Measured, at: At): Rect | undefined => m.hits.find((h) => h.id === at.id && h.frame === at.frame && h.k === at.k)?.rect;

/** A node's first box in a frame (its own scene's, usually). */
export const rectIn = (m: Measured, id: string, frame: string): Rect | undefined => m.hits.find((h) => h.id === id && h.frame === frame)?.rect;

export const contains = (r: Rect, p: Pt) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export const inflate = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + d * 2, h: r.h + d * 2 });

/** The smallest rect around several. */
export function union(rs: Rect[]): Rect | null {
  if (!rs.length) return null;
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}

/* ── Scenes ── */

export const sceneRect = (s: Scene, d: Device): Rect => ({ x: s.x, y: s.y, w: d.w, h: d.h });

/** The scene under a board point (the last drawn wins). */
export function sceneAt(doc: Doc, device: Device, p: Pt): Scene | null {
  for (let i = doc.scenes.length - 1; i >= 0; i--) if (contains(sceneRect(doc.scenes[i], device), p)) return doc.scenes[i];
  return null;
}

/** Every node of the document by id, with the scene it belongs to. */
const indexCache = new WeakMap<Doc, Map<string, { node: Node; scene: string }>>();
export function nodeIndex(doc: Doc): Map<string, { node: Node; scene: string }> {
  let out = indexCache.get(doc);
  if (!out) {
    out = new Map();
    for (const s of doc.scenes) walk(s.root, (n) => { out!.set(n.id, { node: n, scene: s.id }); });
    indexCache.set(doc, out);
  }
  return out;
}

/** Does scene `from` show scene `to`, through its embedded scenes (and theirs)? */
export function shows(doc: Doc, from: string, to: string, seen = new Set<string>()): boolean {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  const scene = doc.scenes.find((s) => s.id === from);
  let hit = false;
  if (scene) walk(scene.root, (n) => {
    if (hit) return false;
    if (n.type === 'SceneRef' && typeof n.props.scene === 'string' && shows(doc, n.props.scene, to, seen)) hit = true;
    return true;
  });
  return hit;
}

/* ── Dropping ── */

export interface DropTarget {
  scene: string;
  place: Place;
  /** The insertion line, or null to highlight the whole container (it's empty). */
  line: Rect | null;
  /** The container (or slot) it lands in. */
  box: Rect;
}

/* ── Segue arrows ── */

export interface SegueGeometry {
  d: string;
  start: Pt;
  end: Pt;
  /** Where the badge sits (the curve's middle). */
  mid: Pt;
  /** The arrowhead's direction at the end, radians. */
  angle: number;
}

const bez = (a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

/**
 * A segue's curve: from its source node's trailing edge (or the scene's) to the destination's nearest edge. Mostly
 * sideways when the scenes sit side by side, from above when the destination is below.
 */
export function segueGeometry(from: Rect, to: Rect, src: Rect | null, gap: number): SegueGeometry {
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 }, tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const dx = tc.x - fc.x, dy = tc.y - fc.y;
  const sideways = Math.abs(dx) >= Math.abs(dy) * 0.6;
  let start: Pt, end: Pt, c1: Pt, c2: Pt;
  if (sideways) {
    const dir = dx >= 0 ? 1 : -1;
    start = src ? { x: dir > 0 ? src.x + src.w : src.x, y: src.y + src.h / 2 } : { x: dir > 0 ? from.x + from.w : from.x, y: fc.y };
    end = { x: dir > 0 ? to.x - gap : to.x + to.w + gap, y: Math.max(to.y + 40, Math.min(to.y + to.h - 40, start.y)) };
    const k = Math.max(48, Math.abs(end.x - start.x) * 0.42);
    c1 = { x: start.x + k * dir, y: start.y };
    c2 = { x: end.x - k * dir, y: end.y };
  } else {
    const dir = dy >= 0 ? 1 : -1;
    start = src ? { x: src.x + src.w, y: src.y + src.h / 2 } : { x: fc.x, y: dir > 0 ? from.y + from.h : from.y };
    end = { x: tc.x, y: dir > 0 ? to.y - gap : to.y + to.h + gap };
    const k = Math.max(60, Math.abs(end.y - start.y) * 0.45);
    c1 = src ? { x: start.x + k, y: start.y } : { x: start.x, y: start.y + k * dir };
    c2 = { x: end.x, y: end.y - k * dir };
  }
  return {
    d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    start, end,
    mid: bez(start, c1, c2, end, 0.5),
    angle: Math.atan2(end.y - c2.y, end.x - c2.x),
  };
}

/** Distance from `p` to a segue's curve (sampled), for clicking near a line. */
export function distToSegue(g: SegueGeometry, p: Pt): number {
  const m = /M ([-\d.e]+) ([-\d.e]+) C ([-\d.e]+) ([-\d.e]+), ([-\d.e]+) ([-\d.e]+), ([-\d.e]+) ([-\d.e]+)/.exec(g.d);
  if (!m) return Infinity;
  const v = m.slice(1).map(Number);
  const a = { x: v[0], y: v[1] }, b = { x: v[2], y: v[3] }, c = { x: v[4], y: v[5] }, d = { x: v[6], y: v[7] };
  let best = Infinity;
  for (let i = 0; i <= 40; i++) {
    const q = bez(a, b, c, d, i / 40);
    best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y));
  }
  return best;
}
