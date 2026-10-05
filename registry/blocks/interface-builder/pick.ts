/* Picking on the canvas: which node is drawn under the pointer, and where a dragged component lands, asked of the
   browser's own hit-testing, so what a scroll view clips, what a tab bar covers and what's in another tab is never
   picked. A scene's content is inert on the canvas (nothing in it reacts or takes focus) and hit-testing skips inert
   elements, so the frame under the pointer is made hit-testable for as long as the question takes. An instance of a
   node is which of its elements in one scene's frame it is: a scene shown in place inside another scene is drawn in
   that one's frame too, and a repeated row is drawn once per item. */
import type { Camera, Pt, Rect } from '@/lib/canvas-math';
import { specOf } from './catalog';
import { contains, inflate, nodeIndex, shows, toBoardRect, union, type At, type DropTarget, type Measured } from './geometry';
import type { Axis, Doc } from './model';
import { childrenIn, walk } from './tree';

const NODE = '[data-ib-node]';
const FRAME = '[data-ib-scene-frame]';

const frameEl = (root: ParentNode, frame: string) => root.querySelector<HTMLElement>(`[data-ib-scene-frame="${CSS.escape(frame)}"]`);
const nodeEls = (in_: ParentNode, id: string) => in_.querySelectorAll<HTMLElement>(`[data-ib-node="${CSS.escape(id)}"]`);

/** What's drawn at a client point in a frame, topmost first. (While a text in it is edited, its content isn't
    inert but takes no pointer; that's lifted for the moment too.) */
function elementsAt(frame: HTMLElement, x: number, y: number): Element[] {
  const content = frame.querySelector<HTMLElement>('[data-ib-content]');
  const inert = content?.inert ?? false, pointer = content?.style.pointerEvents ?? '';
  if (content) { content.inert = false; content.style.pointerEvents = ''; }
  try {
    return document.elementsFromPoint(x, y).filter((el) => frame.contains(el));
  } finally {
    if (content) { content.inert = inert; content.style.pointerEvents = pointer; }
  }
}

/** The instance a node's element is. */
function atOf(el: HTMLElement): At | null {
  const f = el.closest<HTMLElement>(FRAME);
  const id = el.dataset.ibNode;
  if (!f || !id) return null;
  return { id, frame: f.dataset.ibSceneFrame!, k: Math.max(0, [...nodeEls(f, id)].indexOf(el)) };
}

/** An instance's element, now. */
export function elementAt(root: ParentNode, at: At): HTMLElement | null {
  const f = frameEl(root, at.frame);
  return f ? nodeEls(f, at.id)[at.k] ?? null : null;
}

/** Every node under a client point in a frame: the one drawn on top, then the ones it's drawn in, out to the frame's
    root (across embedded scenes: a scene shown in place sits in the SceneRef or container showing it). */
export function stackAt(root: ParentNode, frame: string, x: number, y: number): At[] {
  const f = frameEl(root, frame);
  if (!f) return [];
  const out: At[] = [];
  let el = elementsAt(f, x, y)[0]?.closest<HTMLElement>(NODE) ?? null;
  while (el && f.contains(el)) {
    const at = atOf(el);
    if (at) out.push(at);
    el = el.parentElement?.closest<HTMLElement>(NODE) ?? null;
  }
  return out;
}

/** The node an instance is drawn in, on screen: across an embedded scene, the SceneRef or container showing it. */
export function parentAt(root: ParentNode, at: At): At | null {
  const el = elementAt(root, at);
  const up = el?.parentElement?.closest<HTMLElement>(NODE);
  return up && up.closest(FRAME) === el?.closest(FRAME) ? atOf(up) : null;
}

/** The first node drawn directly inside an instance, on screen (an embedded scene's root, inside a SceneRef). */
export function firstChildAt(root: ParentNode, at: At): At | null {
  const el = elementAt(root, at);
  if (!el) return null;
  const kid = [...el.querySelectorAll<HTMLElement>(NODE)].find((c) => c.parentElement?.closest(NODE) === el);
  return kid ? atOf(kid) : null;
}

/** An element's box, or what it draws when it takes no space itself (`display: contents`). */
function boxOf(el: Element): DOMRect {
  const r = el.getBoundingClientRect();
  return !r.width && !r.height && el.firstElementChild ? el.firstElementChild.getBoundingClientRect() : r;
}

/**
 * Where something dropped at a client point in a frame lands: the innermost container or slot drawn there, in
 * whichever scene it belongs to (a component drops into a scene shown in place), and the index among its children
 * there by their midpoints along its axis. `moving` (a node being dragged) and everything inside it are passed over,
 * so the index is where it ends up once it has left its old place; and a drop that would show a scene inside itself
 * isn't one.
 */
export function dropAt(doc: Doc, root: HTMLElement, frame: string, client: Pt, camera: Camera, m: Measured, moving: string | null): DropTarget | null {
  const f = frameEl(root, frame);
  if (!f) return null;
  const index = nodeIndex(doc);
  const skip = new Set<string>();
  const shown: string[] = [];
  const mv = moving ? index.get(moving) : null;
  if (mv) walk(mv.node, (n) => {
    skip.add(n.id);
    if (n.type === 'SceneRef' && typeof n.props.scene === 'string') shown.push(n.props.scene);
  });
  const base = root.getBoundingClientRect();
  const board = (r: DOMRect) => toBoardRect(r, base, camera);
  const p = { x: (client.x - base.left - camera.x) / camera.z, y: (client.y - base.top - camera.y) / camera.z };

  // The innermost container or slot under the point.
  let target: { el: HTMLElement; id: string; slot: string | null } | null = null;
  for (let el = (elementsAt(f, client.x, client.y)[0] ?? null) as HTMLElement | null; el && el !== f; el = el.parentElement) {
    const key = el.dataset?.ibSlot;
    const id = key ? key.split(':')[0] : el.dataset?.ibNode;
    const e = id && !skip.has(id) ? index.get(id) : null;
    if (!e || e.node.repeat) continue;
    if (key) { target = { el, id: e.node.id, slot: key.split(':')[1] }; break; }
    if (specOf(e.node.type).container) { target = { el, id: e.node.id, slot: null }; break; }
  }
  // An empty slot shows itself only while something is dragged, and it's small: a few px from one is in it.
  const near = m.slotHits
    .filter((s) => s.frame === frame && contains(inflate(s.rect, 6), p) && !skip.has(s.key.split(':')[0]))
    .sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h)[0];
  const nearEl = near ? [...f.querySelectorAll<HTMLElement>(`[data-ib-slot="${CSS.escape(near.key)}"]`)].find((el) => contains(inflate(board(el.getBoundingClientRect()), 6), p)) : null;
  if (near && nearEl && (!target || (target.slot == null && target.el.contains(nearEl)))) {
    const [id, slot] = near.key.split(':');
    if (index.get(id) && !index.get(id)!.node.repeat) target = { el: nearEl, id, slot };
  }
  if (!target) return null;
  const owner = index.get(target.id)!;
  if (shown.some((s) => shows(doc, s, owner.scene))) return null;

  // Its children's boxes in this instance: the node elements drawn directly inside it.
  const kids = childrenIn(owner.node, target.slot).filter((k) => k.id !== moving);
  const inside = target.slot ? '[data-ib-slot], [data-ib-node]' : NODE;
  const rects = new Map<string, Rect[]>();
  target.el.querySelectorAll<HTMLElement>(NODE).forEach((c) => {
    if (c.parentElement?.closest(inside) !== target.el) return;
    const r = boxOf(c);
    if (r.width || r.height) rects.set(c.dataset.ibNode!, [...(rects.get(c.dataset.ibNode!) ?? []), board(r)]);
  });
  const box = board(boxOf(target.el));
  const boxes = kids.map((k, i) => union(rects.get(k.id) ?? []) ?? { ...box, h: 0, y: box.y + i });
  const axis: Axis = target.slot ? 'horizontal' : owner.node.layout?.axis ?? 'vertical';
  const vertical = axis !== 'horizontal';
  let at = kids.length;
  if (axis !== 'overlay') at = boxes.filter((b) => (vertical ? b.y + b.h / 2 : b.x + b.w / 2) < (vertical ? p.y : p.x)).length;
  let line: Rect | null = null;
  if (boxes.length && axis !== 'overlay') {
    const prev = boxes[at - 1], next = boxes[at];
    if (vertical) {
      const y = prev && next ? (prev.y + prev.h + next.y) / 2 : prev ? prev.y + prev.h + 3 : next.y - 3;
      line = { x: box.x + 6, y, w: Math.max(8, box.w - 12), h: 0 };
    } else {
      const x = prev && next ? (prev.x + prev.w + next.x) / 2 : prev ? prev.x + prev.w + 3 : next.x - 3;
      line = { x, y: box.y + 4, w: 0, h: Math.max(8, box.h - 8) };
    }
  }
  return { scene: owner.scene, place: { parent: target.id, slot: target.slot, index: at }, line, box };
}
