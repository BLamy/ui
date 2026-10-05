/* Issues, Xcode's: every expression must parse and read only names its scope has; actions must point at segues,
   outlets, callbacks and state that exist; a delegate nobody implements and a command nobody handles are warned
   about. Each issue knows what to select, so the issues list takes you to it. */
import { freeNames, parse } from './expr';
import type { Action, Doc, Node, Scene } from './model';
import { commandsIn, outletsOf } from './ops';
import type { Selection } from './store';
import { eachChild } from './tree';

export interface Issue {
  level: 'error' | 'warning';
  message: string;
  /** Where it is, in words. */
  where: string;
  select: Selection;
}

/** What's wrong with an expression in a scope of `known` names, or null. */
export function exprProblem(src: string, known: Set<string>): string | null {
  const p = parse(src);
  if (!p.ok) return p.error;
  for (const name of freeNames(src).keys()) if (!known.has(name)) return `Cannot find name '${name}'`;
  return null;
}

/** The names a scene's expressions can read. */
export function sceneNames(doc: Doc, scene: Scene): Set<string> {
  return new Set([
    ...doc.contexts.map((c) => c.alias),
    ...scene.props.map((p) => p.name),
    ...scene.state.map((s) => s.name),
    ...scene.memos.map((m) => m.name),
  ]);
}

export function diagnose(doc: Doc): Issue[] {
  const out: Issue[] = [];
  const commands = new Set(commandsIn(doc));
  const sentAnywhere = new Set<string>();

  for (const scene of doc.scenes) {
    const names = sceneNames(doc, scene);
    const outlets = outletsOf(scene);
    const where = (label: string) => `${scene.name} › ${label}`;
    const check = (src: string | undefined, known: Set<string>, label: string, select: Selection) => {
      if (src == null || src === '') return;
      const problem = exprProblem(src, known);
      if (problem) out.push({ level: 'error', message: problem, where: where(label), select });
    };
    const checkActions = (list: Action[] | undefined, known: Set<string>, label: string, select: Selection) => {
      for (const a of list ?? []) {
        check(a.if, known, `${label} (condition)`, select);
        switch (a.do) {
          case 'set': {
            const root = a.target.split('.')[0];
            const isState = scene.state.some((s) => s.name === a.target);
            const ctx = doc.contexts.find((c) => c.alias === root);
            const isCtx = !!ctx && a.target.includes('.') && ctx.fields.some((f) => f.name === a.target.split('.')[1]);
            if (!isState && !isCtx) out.push({ level: 'error', message: `Set: '${a.target}' isn't state or a context field`, where: where(label), select });
            check(a.value, known, `${label} (value)`, select);
            break;
          }
          case 'segue': {
            const g = doc.segues.find((x) => x.id === a.segue);
            if (!g) out.push({ level: 'error', message: 'Perform Segue: the segue is gone', where: where(label), select });
            else if (g.from !== scene.id) out.push({ level: 'error', message: `Perform Segue: “${g.identifier}” leaves another scene`, where: where(label), select });
            break;
          }
          case 'animate': case 'focus':
            if (!outlets.includes(a.ref)) out.push({ level: 'error', message: `${a.do === 'animate' ? 'Animate' : 'Focus'}: no outlet named '${a.ref || '—'}'`, where: where(label), select });
            break;
          case 'call':
            if (!scene.props.some((p) => p.callback && p.name === a.prop)) out.push({ level: 'error', message: `Call: no callback prop named '${a.prop}'`, where: where(label), select });
            a.args.forEach((x) => check(x, known, `${label} (argument)`, select));
            break;
          case 'toast': check(a.message, known, `${label} (message)`, select); break;
          case 'send': sentAnywhere.add(a.command); if (!commands.has(a.command)) out.push({ level: 'warning', message: `Nothing responds to '${a.command}'`, where: where(label), select }); break;
          case 'unwind':
            if (!doc.scenes.some((s) => s.id === a.scene)) out.push({ level: 'error', message: 'Unwind: that scene is gone', where: where(label), select });
            break;
          default: break;
        }
      }
    };

    // Definitions, in order: a memo can read the ones before it.
    const base = new Set(doc.contexts.map((c) => c.alias));
    scene.props.forEach((p) => { if (!p.callback) check(p.default, base, `prop ${p.name}`, { kind: 'scene', scene: scene.id }); });
    const withProps = new Set([...base, ...scene.props.map((p) => p.name)]);
    scene.state.forEach((s) => check(s.initial, withProps, `state ${s.name}`, { kind: 'scene', scene: scene.id }));
    const seen = new Set([...withProps, ...scene.state.map((s) => s.name)]);
    for (const m of scene.memos) { check(m.expr, seen, `memo ${m.name}`, { kind: 'scene', scene: scene.id }); seen.add(m.name); }
    scene.effects.forEach((e) => checkActions(e.actions, names, `effect on ${e.on}`, { kind: 'scene', scene: scene.id }));
    for (const [cmd, list] of Object.entries(scene.responds ?? {})) checkActions(list, names, `responds to ${cmd}`, { kind: 'responder', scene: scene.id });

    // The tree: a repeat adds its item and index to everything inside it.
    const dupes = outlets.filter((o, i) => outlets.indexOf(o) !== i);
    for (const d of new Set(dupes)) out.push({ level: 'error', message: `Two outlets are named '${d}'`, where: where('outlets'), select: { kind: 'scene', scene: scene.id } });
    const visit = (n: Node, known: Set<string>) => {
      const select: Selection = { kind: 'node', scene: scene.id, ids: [n.id] };
      const label = n.name ?? n.type;
      let inner = known;
      if (n.repeat) {
        check(n.repeat.each, known, `${label} (repeat)`, select);
        inner = new Set([...known, n.repeat.as || 'item', 'index']);
        check(n.repeat.key, inner, `${label} (key)`, select);
      }
      check(n.when, inner, `${label} (visible when)`, select);
      for (const [prop, src] of Object.entries(n.bind ?? {})) check(src, inner, `${label}.${prop}`, select);
      check(n.motion?.animate, inner, `${label} (animate)`, select);
      check(n.motion?.layoutId, inner, `${label} (Magic Motion id)`, select);
      const withEvent = new Set([...inner, 'event']);
      // An embedded scene's events are its callback props: their parameters are in scope.
      const embedded = n.type === 'SceneRef' ? doc.scenes.find((x) => x.id === n.props.scene) : null;
      for (const [ev, list] of Object.entries(n.on ?? {})) {
        const params = embedded?.props.find((p) => p.callback && p.name === ev)?.params ?? [];
        checkActions(list, params.length ? new Set([...withEvent, ...params]) : withEvent, `${label} ${ev}`, select);
      }
      for (const [cmd, list] of Object.entries(n.responds ?? {})) checkActions(list, inner, `${label} responds to ${cmd}`, select);
      if (n.motion?.drag && !['none', 'parent', ''].includes(n.motion.drag.constraints) && !outlets.includes(n.motion.drag.constraints)) {
        out.push({ level: 'error', message: `Drag: no outlet named '${n.motion.drag.constraints}'`, where: where(label), select });
      }
      eachChild(n).forEach((c) => visit(c.node, inner));
    };
    visit(scene.root, names);
  }

  // Segues: their arguments run in the source scene, their delegates too (with the callback's parameters).
  for (const g of doc.segues) {
    const from = doc.scenes.find((s) => s.id === g.from), to = doc.scenes.find((s) => s.id === g.to);
    const select: Selection = { kind: 'segue', segue: g.id };
    if (!from || !to) { out.push({ level: 'error', message: `Segue “${g.identifier}” points at a missing scene`, where: g.identifier, select }); continue; }
    const names = sceneNames(doc, from);
    // A segue from a repeated row passes the row's item: its name is in scope there.
    const items = repeatNames(from.root);
    const argNames = new Set([...names, ...items]);
    for (const [prop, src] of Object.entries(g.args)) {
      if (!to.props.some((p) => p.name === prop && !p.callback)) out.push({ level: 'warning', message: `${to.name} has no prop '${prop}'`, where: `${from.name} → ${to.name}`, select });
      const problem = exprProblem(src, argNames);
      if (problem) out.push({ level: 'error', message: problem, where: `${from.name} → ${to.name} (${prop})`, select });
    }
    for (const p of to.props.filter((x) => x.callback)) {
      const list = g.delegates[p.name];
      if (!list?.length) { out.push({ level: 'warning', message: `${to.name}.${p.name} isn't implemented: nothing happens when it's called`, where: `${from.name} → ${to.name} (delegate)`, select }); continue; }
      const known = new Set([...names, ...(p.params ?? [])]);
      for (const a of list) {
        const srcs = [a.if, a.do === 'set' ? a.value : undefined, a.do === 'toast' ? a.message : undefined, ...(a.do === 'call' ? a.args : [])];
        for (const src of srcs) {
          if (!src) continue;
          const problem = exprProblem(src, known);
          if (problem) out.push({ level: 'error', message: problem, where: `${from.name} → ${to.name} (${p.name})`, select });
        }
      }
    }
  }

  // Contexts: their initial values read nothing.
  for (const c of doc.contexts) for (const f of c.fields) {
    const problem = exprProblem(f.initial, new Set());
    if (problem) out.push({ level: 'error', message: problem, where: `${c.name}.${f.name}`, select: { kind: 'context', context: c.id } });
  }
  return out;
}

/** The item names repeats introduce in a tree (a segue from a row can pass `plant`). */
function repeatNames(root: Node): string[] {
  const out: string[] = [];
  const visit = (n: Node) => {
    if (n.repeat) out.push(n.repeat.as || 'item', 'index');
    eachChild(n).forEach((c) => visit(c.node));
  };
  visit(root);
  return out;
}
