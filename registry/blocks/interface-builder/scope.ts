/* What a scene's expressions can read: the contexts (by alias), its props, its state and its memos, in that order,
   each able to read the ones before it. The canvas shows a scene in its initial state (design time); the preview
   keeps the live values. */
import { sceneNames } from './diagnostics';
import { valueOf, type Scope } from './expr';
import type { Doc, MemoDef, Scene } from './model';
import { pathTo } from './tree';

/** Each context's initial value, by alias. */
export function contextDefaults(doc: Doc): Record<string, Record<string, unknown>> {
  return Object.fromEntries(doc.contexts.map((c) => [c.alias, Object.fromEntries(c.fields.map((f) => [f.name, valueOf(f.initial, {}, null)]))]));
}

/** The scene's props as they are when nothing passes them: their defaults (callbacks do nothing). */
export function propDefaults(scene: Scene, base: Scope): Record<string, unknown> {
  return Object.fromEntries(scene.props.map((p) => [p.name, p.callback ? () => undefined : valueOf(p.default, base, null)]));
}

/** The scene's state as `useState` starts it. */
export function stateDefaults(scene: Scene, base: Scope): Record<string, unknown> {
  return Object.fromEntries(scene.state.map((s) => [s.name, valueOf(s.initial, base, null)]));
}

/** `scope` with the memos computed in order, each seeing the ones before. */
export function withMemos(memos: MemoDef[], scope: Scope): Scope {
  const out: Scope = { ...scope };
  for (const m of memos) out[m.name] = valueOf(m.expr, out, null);
  return out;
}

/** The scope the canvas renders a scene with: everything at its initial value. */
export function designScope(doc: Doc, scene: Scene): Scope {
  const base: Scope = { ...contextDefaults(doc) };
  Object.assign(base, propDefaults(scene, base));
  Object.assign(base, stateDefaults(scene, base));
  return withMemos(scene.memos, base);
}

/** The names a scene's expressions can use, and what each is: for completion and the Hooks list. */
export function namesIn(doc: Doc, scene: Scene): { name: string; kind: 'context' | 'prop' | 'callback' | 'state' | 'memo' }[] {
  return [
    ...doc.contexts.map((c) => ({ name: c.alias, kind: 'context' as const })),
    ...scene.props.map((p) => ({ name: p.name, kind: p.callback ? ('callback' as const) : ('prop' as const) })),
    ...scene.state.map((s) => ({ name: s.name, kind: 'state' as const })),
    ...scene.memos.map((m) => ({ name: m.name, kind: 'memo' as const })),
  ];
}

/** The design scope a node's expressions see: the scene's, plus the first item of every list it repeats over. */
export function scopeAt(doc: Doc, scene: Scene, nodeId: string): Scope {
  let scope = designScope(doc, scene);
  for (const n of pathTo(scene.root, nodeId)) {
    if (!n.repeat) continue;
    const list = valueOf<unknown>(n.repeat.each, scope, []);
    scope = { ...scope, [n.repeat.as || 'item']: Array.isArray(list) ? list[0] : undefined, index: 0 };
  }
  return scope;
}

/** The names a node's expressions may read: the scene's, plus each repeat's item and index above it (and its own). */
export function namesAt(doc: Doc, scene: Scene, nodeId: string): Set<string> {
  const out = sceneNames(doc, scene);
  for (const n of pathTo(scene.root, nodeId)) if (n.repeat) { out.add(n.repeat.as || 'item'); out.add('index'); }
  return out;
}
