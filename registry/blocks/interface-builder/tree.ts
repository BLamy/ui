/* The view tree as plain functions: find a node, its path and its parent, change one immutably, insert, remove,
   move and clone. A node's children live in `children` (the default slot) and in named `slots`; a place in the tree
   is `{ parent, slot, index }` where `slot` is null for the default one. */
import { newId, type Action, type Doc, type Node, type Scene } from './model';

export interface Place {
  parent: string;
  /** A named slot, or null for `children`. */
  slot: string | null;
  index: number;
}

/** A node's children in a slot. */
export const childrenIn = (n: Node, slot: string | null): Node[] => (slot ? n.slots?.[slot] ?? [] : n.children ?? []);

/** Every child, default slot first, with where it sits. */
export function eachChild(n: Node): { node: Node; slot: string | null; index: number }[] {
  const out: { node: Node; slot: string | null; index: number }[] = [];
  (n.children ?? []).forEach((c, index) => out.push({ node: c, slot: null, index }));
  for (const [slot, list] of Object.entries(n.slots ?? {})) list.forEach((c, index) => out.push({ node: c, slot, index }));
  return out;
}

/** Depth-first, parents before children. Return false to skip a node's subtree. */
export function walk(root: Node, fn: (n: Node, parent: Node | null, depth: number) => boolean | void, parent: Node | null = null, depth = 0): void {
  if (fn(root, parent, depth) === false) return;
  for (const c of eachChild(root)) walk(c.node, fn, root, depth + 1);
}

export function allNodes(root: Node): Node[] {
  const out: Node[] = [];
  walk(root, (n) => { out.push(n); });
  return out;
}

export function findNode(root: Node, id: string): Node | null {
  let hit: Node | null = null;
  walk(root, (n) => {
    if (hit) return false;
    if (n.id === id) { hit = n; return false; }
    return true;
  });
  return hit;
}

/** The nodes from the root down to `id`, inclusive; empty when it isn't there. */
export function pathTo(root: Node, id: string): Node[] {
  if (root.id === id) return [root];
  for (const c of eachChild(root)) {
    const p = pathTo(c.node, id);
    if (p.length) return [root, ...p];
  }
  return [];
}

/** Where `id` sits: its parent, slot and index. */
export function placeOf(root: Node, id: string): Place | null {
  const path = pathTo(root, id);
  if (path.length < 2) return null;
  const parent = path[path.length - 2];
  const c = eachChild(parent).find((x) => x.node.id === id);
  return c ? { parent: parent.id, slot: c.slot, index: c.index } : null;
}

/** Is `id` inside `ancestor` (or the same node)? */
export const within = (root: Node, ancestor: string, id: string) => pathTo(root, id).some((n) => n.id === ancestor);

/** `root` with the node `id` replaced by `fn(node)` (the same object when nothing changed). */
export function mapNode(root: Node, id: string, fn: (n: Node) => Node): Node {
  if (root.id === id) return fn(root);
  let changed = false;
  const kids = root.children?.map((c) => {
    const next = mapNode(c, id, fn);
    if (next !== c) changed = true;
    return next;
  });
  let slots = root.slots;
  if (root.slots) {
    const entries = Object.entries(root.slots).map(([k, list]) => [k, list.map((c) => {
      const next = mapNode(c, id, fn);
      if (next !== c) changed = true;
      return next;
    })] as const);
    if (changed) slots = Object.fromEntries(entries);
  }
  return changed ? { ...root, ...(root.children ? { children: kids } : null), ...(root.slots ? { slots } : null) } : root;
}

/** `root` without the node `id`, and the node that was removed. */
export function removeNode(root: Node, id: string): [Node, Node | null] {
  const at = placeOf(root, id);
  if (!at) return [root, null];
  let removed: Node | null = null;
  const next = mapNode(root, at.parent, (p) => {
    const list = childrenIn(p, at.slot);
    removed = list[at.index] ?? null;
    return setChildren(p, at.slot, list.filter((_, i) => i !== at.index));
  });
  return [next, removed];
}

export function setChildren(p: Node, slot: string | null, list: Node[]): Node {
  return slot ? { ...p, slots: { ...p.slots, [slot]: list } } : { ...p, children: list };
}

/** `root` with `node` inserted at `place`. */
export function insertNode(root: Node, place: Place, node: Node): Node {
  return mapNode(root, place.parent, (p) => {
    const list = [...childrenIn(p, place.slot)];
    list.splice(Math.max(0, Math.min(list.length, place.index)), 0, node);
    return setChildren(p, place.slot, list);
  });
}

/* ── The document ── */

/** The scene a node belongs to. */
export function sceneOf(doc: Doc, nodeId: string): Scene | null {
  return doc.scenes.find((s) => findNode(s.root, nodeId)) ?? null;
}

/** `doc` with one scene changed. */
export const mapScene = (doc: Doc, id: string, fn: (s: Scene) => Scene): Doc => ({ ...doc, scenes: doc.scenes.map((s) => (s.id === id ? fn(s) : s)) });

/** `doc` with one node changed, wherever it is. */
export function mapDocNode(doc: Doc, nodeId: string, fn: (n: Node) => Node): Doc {
  const scene = sceneOf(doc, nodeId);
  return scene ? mapScene(doc, scene.id, (s) => ({ ...s, root: mapNode(s.root, nodeId, fn) })) : doc;
}

/* ── Copies ── */

const freshActions = (list: Action[]) => list.map((a) => ({ ...a, id: newId('a') }));

/** A deep copy of `node` with new ids (for duplicate and paste). Outlet names are dropped: they must stay unique. */
export function cloneNode(node: Node, keepRefs = false): Node {
  const copy: Node = {
    ...node,
    id: newId(),
    ...(node.ref && !keepRefs ? { ref: undefined } : null),
    ...(node.on ? { on: Object.fromEntries(Object.entries(node.on).map(([k, v]) => [k, freshActions(v)])) } : null),
    ...(node.children ? { children: node.children.map((c) => cloneNode(c, keepRefs)) } : null),
    ...(node.slots ? { slots: Object.fromEntries(Object.entries(node.slots).map(([k, v]) => [k, v.map((c) => cloneNode(c, keepRefs))])) } : null),
  };
  if (!copy.ref) delete copy.ref;
  return copy;
}

/** Every action list in a scene (events, commands, effects), for finding references. */
export function sceneActions(scene: Scene): Action[] {
  const out: Action[] = [];
  walk(scene.root, (n) => {
    for (const list of Object.values(n.on ?? {})) out.push(...list);
    for (const list of Object.values(n.responds ?? {})) out.push(...list);
  });
  for (const e of scene.effects) out.push(...e.actions);
  for (const list of Object.values(scene.responds ?? {})) out.push(...list);
  return out;
}

/** The node whose event performs a segue (the arrow's start), when one does. */
export function segueSource(scene: Scene, segueId: string): Node | null {
  let hit: Node | null = null;
  walk(scene.root, (n) => {
    if (hit) return false;
    if (Object.values(n.on ?? {}).some((list) => list.some((a) => a.do === 'segue' && a.segue === segueId))) hit = n;
    return true;
  });
  return hit;
}
