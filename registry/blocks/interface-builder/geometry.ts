/* The storyboard's geometry: where every rendered node is (measured once per change, in board units, so view
   moves don't invalidate it) and which scene is under a point. Which node is under the pointer, and where a dragged
   component lands, are pick.ts's: the browser's own hit-testing answers those. Segue arrows are the diagram model's, in
   @/lib/diagram-model. */
import type { Pt, Rect, Viewport } from '@/lib/canvas-math';
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
export const toBoardRect = (r: DOMRect, base: DOMRect, view: Viewport): Rect => ({
  x: (r.left - base.left - view.x) / view.zoom,
  y: (r.top - base.top - view.y) / view.zoom,
  w: r.width / view.zoom,
  h: r.height / view.zoom,
});

const frameOf = (el: Element) => el.closest('[data-ib-scene-frame]')?.getAttribute('data-ib-scene-frame') ?? null;

/** Reads every node's box under `root`, converted to board units with the canvas's `view`. */
export function measure(root: HTMLElement, view: Viewport): Measured {
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
    // A box that takes no space (a tab bar placing itself): measure what it draws.
    if (!r.width && !r.height && el.firstElementChild) r = el.firstElementChild.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const rect = toBoardRect(r, base, view);
    nodes.set(id, [...(nodes.get(id) ?? []), rect]);
    hits.push({ id, rect, frame, k });
  });
  const slotHits: SlotHit[] = [];
  root.querySelectorAll<HTMLElement>('[data-ib-slot]').forEach((el) => {
    slotHits.push({ key: el.dataset.ibSlot!, rect: toBoardRect(el.getBoundingClientRect(), base, view), frame: frameOf(el) });
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
