/* Document operations as pure functions: Doc in, Doc out. The store records each as an undo step; tests call them
   directly. Renames rewrite every expression that reads the old name (the way an IDE's rename does), and deleting
   a scene or segue removes what pointed at it. */
import { makeNode } from './catalog';
import { physicsSpec, springSpec, tweenSpec, instantSpec, type TransitionSpec } from './easing';
import { renameIn } from './expr';
import {
  DEVICES, newId, pascal, uniqueName, type Action, type ActionInit, type ContextDef, type DeviceId, type Doc, type Node, type Scene, type Segue,
  type SegueKind,
} from './model';
import { allNodes, cloneNode, findNode, insertNode, mapNode, mapScene, placeOf, removeNode, sceneOf, within, type Place } from './tree';

/* ── Factories ── */

/** How each kind of segue moves, unless you change it. */
export function segueTransition(kind: SegueKind): TransitionSpec {
  switch (kind) {
    case 'push': return physicsSpec(380, 40);
    case 'detail': return physicsSpec(380, 40);
    case 'modal': return physicsSpec(520, 44);
    case 'fade': return tweenSpec(0.28, 'easeOut');
    case 'magic': return springSpec(0.5, 0.18);
    case 'replace': return instantSpec();
  }
}

export const SEGUE_KINDS: { id: SegueKind; label: string; help: string }[] = [
  { id: 'push', label: 'Push', help: 'Show: onto the nearest NavigationStack, with the kit’s push and back button' },
  { id: 'detail', label: 'Show Detail', help: 'Into the nearest SplitView’s detail column (a push when it’s collapsed)' },
  { id: 'modal', label: 'Modal', help: 'Present Modally: a sheet from the bottom; swipe down or dismiss to close' },
  { id: 'fade', label: 'Fade', help: 'Cross dissolve' },
  { id: 'magic', label: 'Magic Motion', help: 'Elements with the same layoutId fly between the scenes; the rest cross-fade' },
  { id: 'replace', label: 'Replace', help: 'Swaps the whole stack for the destination (signing in)' },
];

/** A blank scene: an empty Screen (its bar shows when a NavigationStack holds it). */
export function newScene(doc: Doc, x: number, y: number, name = 'NewScene'): Scene {
  const title = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  return {
    id: newId('s'),
    name: uniqueName(pascal(name), doc.scenes.map((s) => s.name)),
    x, y,
    props: [], state: [], memos: [], effects: [],
    background: null,
    root: makeNode('Screen', { name: 'Screen', props: { title, largeTitle: true, grouped: false } }),
  };
}

/** The air between scenes on the storyboard, across and down. */
const SCENE_GAP = { x: 167, y: 248 };

/**
 * Lay every scene out for another device: the scenes keep their places on the storyboard's grid, which grows and
 * shrinks with the device, so a storyboard drawn for iPhone doesn't overlap itself on a Desktop.
 */
export function setDevice(doc: Doc, device: DeviceId): Doc {
  if (device === doc.device) return doc;
  const from = DEVICES[doc.device], to = DEVICES[device];
  const kx = (to.w + SCENE_GAP.x) / (from.w + SCENE_GAP.x), ky = (to.h + SCENE_GAP.y) / (from.h + SCENE_GAP.y);
  return { ...doc, device, scenes: doc.scenes.map((s) => ({ ...s, x: Math.round(s.x * kx), y: Math.round(s.y * ky) })) };
}

/** A container scene around `child`: a NavigationStack, a TabView or a SplitView showing it. */
export function containerScene(doc: Doc, kind: 'NavigationStack' | 'TabView' | 'SplitView', child: Scene, x: number, y: number): Scene {
  const ref = makeNode('SceneRef', { props: { scene: child.id } });
  const base = { id: newId('s'), x, y, props: [], state: [], memos: [], effects: [], background: null };
  if (kind === 'NavigationStack') return { ...base, name: uniqueName(`${child.name}Nav`, doc.scenes.map((s) => s.name)), root: makeNode('NavigationStack', { children: [ref] }) };
  if (kind === 'TabView') return { ...base, name: uniqueName(`${child.name}Tabs`, doc.scenes.map((s) => s.name)), root: makeNode('TabView', { props: { tabs: `${child.name}:star`, selectedKey: child.name }, children: [ref] }) };
  return { ...base, name: uniqueName(`${child.name}Split`, doc.scenes.map((s) => s.name)), root: makeNode('SplitView', { slots: { sidebar: [ref], supplementary: [], detail: [] } }) };
}

/**
 * Xcode's Editor › Embed In: a new container scene to the left of `sceneId` showing it. The container takes the
 * entry point, and segues that presented the scene (anything but a push) now present the container.
 */
export function embedScene(doc: Doc, sceneId: string, kind: 'NavigationStack' | 'TabView' | 'SplitView'): [Doc, string] {
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (!scene) return [doc, ''];
  const box = containerScene(doc, kind, scene, scene.x - 520, scene.y);
  return [{
    ...doc,
    entry: doc.entry === sceneId ? box.id : doc.entry,
    scenes: [...doc.scenes, box],
    segues: doc.segues.map((g) => (g.to === sceneId && g.kind !== 'push' && g.kind !== 'detail' ? { ...g, to: box.id } : g)),
  }, box.id];
}

export function newSegue(doc: Doc, from: string, to: string, kind: SegueKind = 'push'): Segue {
  const dest = doc.scenes.find((s) => s.id === to);
  const base = `show${dest?.name ?? 'Scene'}`;
  return {
    id: newId('g'),
    identifier: uniqueName(base, doc.segues.map((g) => g.identifier)),
    from, to, kind,
    transition: segueTransition(kind),
    args: {},
    delegates: {},
  };
}

export function newContext(doc: Doc): ContextDef {
  const name = uniqueName('AppContext', doc.contexts.map((c) => c.name));
  return { id: newId('c'), name, alias: uniqueName('app', doc.contexts.map((c) => c.alias)), fields: [{ name: 'value', type: 'string', initial: "''" }] };
}

export const newAction = (a: ActionInit): Action => ({ id: newId('a'), ...a } as Action);

/* ── Expressions everywhere ── */

/** Every expression in an action, rewritten by `fn` (paths like a Set's target too). */
function mapActionExprs(a: Action, fn: (src: string) => string): Action {
  const next: Action = { ...a, ...(a.if ? { if: fn(a.if) } : null) } as Action;
  switch (next.do) {
    case 'set': return { ...next, target: fn(next.target), value: fn(next.value) };
    case 'call': return { ...next, args: next.args.map(fn) };
    case 'toast': return { ...next, message: fn(next.message) };
    default: return next;
  }
}

const mapActions = (list: Action[] | undefined, fn: (src: string) => string) => list?.map((a) => mapActionExprs(a, fn));
const mapRecord = <T,>(r: Record<string, T> | undefined, fn: (v: T) => T) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fn(v)])) : r);

/** Every expression in a node and its subtree, rewritten by `fn`. */
function mapNodeExprs(n: Node, fn: (src: string) => string): Node {
  const m = n.motion;
  return {
    ...n,
    ...(n.bind ? { bind: mapRecord(n.bind, fn) } : null),
    ...(n.when ? { when: fn(n.when) } : null),
    ...(n.repeat ? { repeat: { ...n.repeat, each: fn(n.repeat.each), key: n.repeat.key ? fn(n.repeat.key) : n.repeat.key } } : null),
    ...(n.on ? { on: mapRecord(n.on, (l) => mapActions(l, fn)!) } : null),
    ...(n.responds ? { responds: mapRecord(n.responds, (l) => mapActions(l, fn)!) } : null),
    ...(m && (m.animate || m.layoutId) ? { motion: { ...m, ...(m.animate ? { animate: fn(m.animate) } : null), ...(m.layoutId ? { layoutId: fn(m.layoutId) } : null) } } : null),
    ...(n.children ? { children: n.children.map((c) => mapNodeExprs(c, fn)) } : null),
    ...(n.slots ? { slots: mapRecord(n.slots, (l) => l.map((c) => mapNodeExprs(c, fn))) } : null),
  };
}

/** Every expression a scene owns (its tree, memos, effects, commands, state and prop defaults), rewritten by `fn`. */
export function mapSceneExprs(s: Scene, fn: (src: string) => string): Scene {
  return {
    ...s,
    props: s.props.map((p) => ({ ...p, default: fn(p.default) })),
    state: s.state.map((v) => ({ ...v, initial: fn(v.initial) })),
    memos: s.memos.map((m) => ({ ...m, expr: fn(m.expr) })),
    effects: s.effects.map((e) => ({ ...e, actions: mapActions(e.actions, fn)! })),
    responds: mapRecord(s.responds, (l) => mapActions(l, fn)!),
    root: mapNodeExprs(s.root, fn),
  };
}

/** A segue's expressions (its arguments and delegate actions run in the source scene). */
const mapSegueExprs = (g: Segue, fn: (src: string) => string): Segue => ({
  ...g,
  args: mapRecord(g.args, fn)!,
  delegates: mapRecord(g.delegates, (l) => mapActions(l, fn)!)!,
});

/**
 * Renames a name a scene's expressions read (a state variable, a memo, a prop) everywhere: the scene, the segues
 * that leave it (they run in its scope), and, for a prop, the segues that pass it.
 */
export function renameInScene(doc: Doc, sceneId: string, from: string, to: string): Doc {
  if (!to || from === to) return doc;
  const fn = (src: string) => renameIn(src, from, to);
  const scene = doc.scenes.find((s) => s.id === sceneId);
  const isProp = scene?.props.some((p) => p.name === from);
  return {
    ...doc,
    scenes: doc.scenes.map((s) => (s.id === sceneId ? renameDefs(mapSceneExprs(s, fn), from, to) : s)),
    segues: doc.segues.map((g) => {
      let next = g.from === sceneId ? mapSegueExprs(g, fn) : g;
      if (isProp && g.to === sceneId) {
        next = { ...next, args: renameKey(next.args, from, to), delegates: renameKey(next.delegates, from, to) };
      }
      return next;
    }),
  };
}

const renameKey = <T,>(r: Record<string, T>, from: string, to: string): Record<string, T> =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k === from ? to : k, v]));

/** The definition itself, and what refers to it by name (effect deps, Call actions). */
function renameDefs(s: Scene, from: string, to: string): Scene {
  const renameCalls = (n: Node): Node => ({
    ...n,
    ...(n.on ? { on: mapRecord(n.on, (l) => l.map((a) => (a.do === 'call' && a.prop === from ? { ...a, prop: to } : a))) } : null),
    ...(n.children ? { children: n.children.map(renameCalls) } : null),
    ...(n.slots ? { slots: mapRecord(n.slots, (l) => l.map(renameCalls)) } : null),
  });
  return {
    ...s,
    props: s.props.map((p) => (p.name === from ? { ...p, name: to } : p)),
    state: s.state.map((v) => (v.name === from ? { ...v, name: to } : v)),
    memos: s.memos.map((m) => (m.name === from ? { ...m, name: to } : m)),
    effects: s.effects.map((e) => ({ ...e, deps: e.deps.map((d) => (d === from ? to : d)) })),
    root: renameCalls(s.root),
  };
}

/** Renames a context's alias in every scene (and the segues, whose expressions run in their source scenes). */
export function renameContextAlias(doc: Doc, contextId: string, to: string): Doc {
  const ctx = doc.contexts.find((c) => c.id === contextId);
  if (!ctx || !to || ctx.alias === to) return doc;
  const fn = (src: string) => renameIn(src, ctx.alias, to);
  return {
    ...doc,
    contexts: doc.contexts.map((c) => (c.id === contextId ? { ...c, alias: to } : c)),
    scenes: doc.scenes.map((s) => mapSceneExprs(s, fn)),
    segues: doc.segues.map((g) => mapSegueExprs(g, fn)),
  };
}

/** Renames an outlet (and the actions that animate or focus it, and drag constraints that name it). */
export function renameOutlet(doc: Doc, sceneId: string, nodeId: string, to: string | undefined): Doc {
  return mapScene(doc, sceneId, (s) => {
    const from = findNode(s.root, nodeId)?.ref;
    const fix = (n: Node): Node => ({
      ...n,
      ...(n.id === nodeId ? { ref: to || undefined } : null),
      ...(n.on && from ? { on: mapRecord(n.on, (l) => l.map((a) => ((a.do === 'animate' || a.do === 'focus') && a.ref === from ? { ...a, ref: to ?? '' } : a))) } : null),
      ...(n.motion?.drag && from && n.motion.drag.constraints === from ? { motion: { ...n.motion, drag: { ...n.motion.drag, constraints: to ?? 'none' } } } : null),
      ...(n.children ? { children: n.children.map(fix) } : null),
      ...(n.slots ? { slots: mapRecord(n.slots, (l) => l.map(fix)) } : null),
    });
    const root = fix(s.root);
    if (!to) {
      // `ref: undefined` keeps the key; drop it so the node reads cleanly.
      const strip = (n: Node): Node => {
        const out = { ...n };
        if (out.ref === undefined) delete out.ref;
        if (out.children) out.children = out.children.map(strip);
        if (out.slots) out.slots = mapRecord(out.slots, (l) => l.map(strip));
        return out;
      };
      return { ...s, root: strip(root) };
    }
    return { ...s, root };
  });
}

/* ── Nodes ── */

/** Inserts `node` at `place` in whichever scene holds the parent. */
export function insertAt(doc: Doc, place: Place, node: Node): Doc {
  const scene = sceneOf(doc, place.parent);
  return scene ? mapScene(doc, scene.id, (s) => ({ ...s, root: insertNode(s.root, place, node) })) : doc;
}

/**
 * Moves a node to `place` (possibly in another scene). `place.index` is where it ends up once it has left its old
 * place (the drop target counts the list without it). A node can't move into itself.
 */
export function moveTo(doc: Doc, id: string, place: Place): Doc {
  const from = sceneOf(doc, id);
  const to = sceneOf(doc, place.parent);
  if (!from || !to || from.root.id === id || within(from.root, id, place.parent)) return doc;
  const [root, node] = removeNode(from.root, id);
  if (!node) return doc;
  return insertAt(mapScene(doc, from.id, (s) => ({ ...s, root })), place, node);
}

/** Removes nodes (never a scene's root). */
export function removeNodes(doc: Doc, ids: string[]): Doc {
  let next = doc;
  for (const id of ids) {
    const s = sceneOf(next, id);
    if (!s || s.root.id === id) continue;
    next = mapScene(next, s.id, (sc) => ({ ...sc, root: removeNode(sc.root, id)[0] }));
  }
  return next;
}

/** Copies of nodes, each placed after its original. Returns the doc and the copies' ids. */
export function duplicateNodes(doc: Doc, ids: string[]): [Doc, string[]] {
  let next = doc;
  const made: string[] = [];
  for (const id of ids) {
    const s = sceneOf(next, id);
    const n = s && findNode(s.root, id);
    const at = s && placeOf(s.root, id);
    if (!s || !n || !at) continue;
    const copy = cloneNode(n);
    made.push(copy.id);
    next = insertAt(next, { ...at, index: at.index + 1 }, copy);
  }
  return [next, made];
}

/** Wraps nodes (siblings) in a new stack, Xcode's Embed In → Stack View. */
export function embedIn(doc: Doc, ids: string[], axis: 'vertical' | 'horizontal' | 'overlay'): [Doc, string | null] {
  const s = ids.length ? sceneOf(doc, ids[0]) : null;
  if (!s) return [doc, null];
  const places = ids.map((id) => placeOf(s.root, id)).filter((p): p is Place => !!p);
  if (places.length !== ids.length || places.some((p) => p.parent !== places[0].parent || p.slot !== places[0].slot)) return [doc, null];
  const nodes = ids.map((id) => findNode(s.root, id)!).sort((a, b) => placeOf(s.root, a.id)!.index - placeOf(s.root, b.id)!.index);
  const first = Math.min(...places.map((p) => p.index));
  const stack = makeNode('Stack', {
    layout: { axis, gap: 12, align: axis === 'horizontal' ? 'center' : 'start', distribute: 'start', width: 'fill' },
    children: nodes,
  });
  const without = removeNodes(doc, ids);
  return [insertAt(without, { parent: places[0].parent, slot: places[0].slot, index: first }, stack), stack.id];
}

/* ── Scenes, segues, contexts ── */

/** Removes a scene with the segues to and from it, and the actions that performed them. */
export function removeScene(doc: Doc, id: string): Doc {
  if (doc.scenes.length <= 1) return doc;
  const gone = new Set(doc.segues.filter((g) => g.from === id || g.to === id).map((g) => g.id));
  let next: Doc = { ...doc, scenes: doc.scenes.filter((s) => s.id !== id), segues: doc.segues.filter((g) => !gone.has(g.id)) };
  for (const g of gone) next = dropSegueActions(next, g);
  if (next.entry === id) next = { ...next, entry: next.scenes[0].id };
  return next;
}

/** Removes a segue and every action that performed it. */
export function removeSegue(doc: Doc, id: string): Doc {
  return dropSegueActions({ ...doc, segues: doc.segues.filter((g) => g.id !== id) }, id);
}

function dropSegueActions(doc: Doc, segueId: string): Doc {
  const keep = (l: Action[]) => l.filter((a) => !(a.do === 'segue' && a.segue === segueId));
  const fix = (n: Node): Node => ({
    ...n,
    ...(n.on ? { on: mapRecord(n.on, keep) } : null),
    ...(n.responds ? { responds: mapRecord(n.responds, keep) } : null),
    ...(n.children ? { children: n.children.map(fix) } : null),
    ...(n.slots ? { slots: mapRecord(n.slots, (l) => l.map(fix)) } : null),
  });
  return {
    ...doc,
    scenes: doc.scenes.map((s) => ({ ...s, root: fix(s.root), effects: s.effects.map((e) => ({ ...e, actions: keep(e.actions) })), responds: mapRecord(s.responds, keep) })),
    segues: doc.segues.map((g) => ({ ...g, delegates: mapRecord(g.delegates, keep)! })),
  };
}

/**
 * Connects a node (or a scene) to another scene: a new segue, and, from a node, an action on its main event that
 * performs it. Returns the doc and the segue.
 */
export function connect(doc: Doc, fromScene: string, toScene: string, sourceNode: string | null, event: string | null, kind: SegueKind = 'push'): [Doc, Segue] {
  const segue = newSegue(doc, fromScene, toScene, kind);
  let next: Doc = { ...doc, segues: [...doc.segues, segue] };
  if (sourceNode && event) {
    next = mapScene(next, fromScene, (s) => ({
      ...s,
      root: mapNode(s.root, sourceNode, (n) => ({ ...n, on: { ...n.on, [event]: [...(n.on?.[event] ?? []), newAction({ do: 'segue', segue: segue.id })] } })),
    }));
  }
  return [next, segue];
}

/** Every outlet name in a scene. */
export const outletsOf = (scene: Scene) => allNodes(scene.root).filter((n) => n.ref).map((n) => n.ref as string);

/** Every command something in a scene (or the app) responds to. */
export function commandsIn(doc: Doc): string[] {
  const out = new Set<string>(Object.keys(doc.responds ?? {}));
  for (const s of doc.scenes) {
    Object.keys(s.responds ?? {}).forEach((c) => out.add(c));
    allNodes(s.root).forEach((n) => Object.keys(n.responds ?? {}).forEach((c) => out.add(c)));
  }
  return [...out].sort();
}

/** `doc` with one node of one scene changed. */
export const mapNodeIn = (doc: Doc, sceneId: string, nodeId: string, fn: (n: Node) => Node): Doc =>
  mapScene(doc, sceneId, (s) => ({ ...s, root: mapNode(s.root, nodeId, fn) }));
