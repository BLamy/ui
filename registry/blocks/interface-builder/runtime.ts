/* The preview's engine. Every scene that's on screen is an instance: a small store with the scene's state (what its
   useState calls would hold), its outlets, and the containers its navigation goes to — the nearest NavigationStack
   (push, back), the nearest SplitView (show detail), the app's presentation layer (modal, fade, Magic Motion,
   replace) and the instance that embedded it. A store rather than component state, because a NavigationStack
   shows a scene's bar items and its content in different places, and both read the same state. Actions run here:
   each reads the latest state, so a sequence sees its own changes. */
import { animate } from 'framer-motion';
import { toFramerTarget } from './appear';
import { toFramer, type TransitionSpec } from './easing';
import { evaluate, preview, valueOf, type Scope } from './expr';
import type { Action, Doc, Node, Scene, SegueKind } from './model';
import { propDefaults, stateDefaults, withMemos } from './scope';
import { allNodes, findNode } from './tree';

export type LogKind = 'event' | 'action' | 'nav' | 'warn';

/** What the whole preview shares: the document (live), the contexts, the app layer, logging. */
export interface AppRuntime {
  doc: () => Doc;
  speed: () => number;
  contexts: () => Record<string, Record<string, unknown>>;
  setContext: (alias: string, field: string, value: unknown) => void;
  /** Present over the app (modal, fade, magic) or replace its root. */
  present: (from: Instance, sceneId: string, props: Record<string, unknown>, kind: SegueKind, transition: TransitionSpec) => void;
  log: (text: string, kind?: LogKind) => void;
  toast: (message: string) => void;
  /** Every live instance, for the responder chain. */
  instances: Set<Instance>;
  /** A scene came on screen (the debug area follows it). */
  appear: (inst: Instance) => void;
  /** A scene left the screen. */
  disappear: (inst: Instance) => void;
}

/** A NavigationStack's way to push and pop. */
export interface StackHost {
  push: (sceneId: string, props: Record<string, unknown>, transition: TransitionSpec) => void;
  /** Pop `inst`'s page (and anything above it); false when it's the stack's root. */
  pop: (inst: Instance) => boolean;
  popTo: (sceneId: string) => boolean;
}

/** A SplitView's way to show a scene in its detail column. */
export interface SplitHost {
  showDetail: (sceneId: string, props: Record<string, unknown>) => void;
}

/** A presented layer (a sheet, a fade): it can be dismissed. */
export interface FrameHost {
  dismiss: () => boolean;
}

export interface Hosts {
  stack?: StackHost;
  split?: SplitHost;
  frame?: FrameHost;
}

let seq = 1;

export class Instance {
  readonly key = seq++;
  readonly sceneId: string;
  props: Record<string, unknown>;
  private state: Record<string, unknown>;
  private version = 0;
  private listeners = new Set<() => void>();
  readonly outlets = new Map<string, HTMLElement>();
  readonly outletRefs = new Map<string, { current: HTMLElement | null }>();
  /** The element the scene renders in (for the responder chain). */
  el: HTMLElement | null = null;
  hosts: Hosts;
  readonly parent: Instance | null;
  readonly app: AppRuntime;
  /** How it came on screen: navigated to (pushed, presented, shown as a detail), or embedded in another scene. */
  arrived: 'navigated' | 'embedded' = 'embedded';

  constructor(app: AppRuntime, sceneId: string, props: Record<string, unknown>, hosts: Hosts, parent: Instance | null) {
    this.app = app;
    this.sceneId = sceneId;
    this.props = props;
    this.hosts = hosts;
    this.parent = parent;
    const scene = this.scene;
    this.state = scene ? stateDefaults(scene, this.baseScope()) : {};
  }

  get scene(): Scene | undefined {
    return this.app.doc().scenes.find((s) => s.id === this.sceneId);
  }

  /* ── The store ── */

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  /** Something it reads changed (its props, a context): re-render what shows it. */
  touch() { this.version++; this.listeners.forEach((l) => l()); }

  setProps(props: Record<string, unknown>) {
    const same = Object.keys(props).length === Object.keys(this.props).length && Object.entries(props).every(([k, v]) => Object.is(this.props[k], v) || (typeof v === 'function' && typeof this.props[k] === 'function'));
    this.props = props;
    if (!same) this.touch();
  }

  private baseScope(): Scope {
    const scene = this.scene;
    const ctx = this.app.contexts();
    const s: Scope = { ...ctx, ...(scene ? propDefaults(scene, ctx) : null) };
    for (const [k, v] of Object.entries(this.props)) s[k] = v;
    return s;
  }

  /** What its expressions read now: contexts, props, state (new state starts at its initial value), memos. */
  scope(): Scope {
    const scene = this.scene;
    if (!scene) return {};
    const base = this.baseScope();
    const missing = scene.state.filter((s) => !(s.name in this.state));
    if (missing.length) this.state = { ...stateDefaults({ ...scene, state: missing }, base), ...this.state };
    return withMemos(scene.memos, { ...base, ...this.state });
  }

  values(): Record<string, unknown> { return this.state; }

  setVar(name: string, value: unknown) {
    this.state = { ...this.state, [name]: value };
    this.touch();
  }

  /** A two-way binding or a Set: state, or a context field. */
  write(path: string[], value: unknown) {
    const scene = this.scene;
    if (path.length === 1 && scene?.state.some((s) => s.name === path[0])) this.setVar(path[0], value);
    else if (path.length === 2 && this.app.doc().contexts.some((c) => c.alias === path[0])) this.app.setContext(path[0], path[1], value);
    else this.app.log(`Can't write ${path.join('.')}: it isn't state or a context field`, 'warn');
  }

  outletRef(name: string) {
    let r = this.outletRefs.get(name);
    if (!r) { r = { current: this.outlets.get(name) ?? null }; this.outletRefs.set(name, r); }
    return r;
  }

  setOutlet(name: string, el: HTMLElement | null) {
    if (el) this.outlets.set(name, el); else this.outlets.delete(name);
    const r = this.outletRefs.get(name);
    if (r) r.current = el;
  }

  /* ── Actions ── */

  /** An event on one of its nodes: the node's actions, with the node's scope (a row's item) and the event's value. */
  fire(node: Node, event: string, value: unknown, nodeScope: Scope) {
    const list = node.on?.[event];
    if (!list?.length) return;
    this.app.appear(this);
    this.app.log(`${this.scene?.name} › ${node.name ?? node.type} ${event}${value !== undefined ? `(${preview(value)})` : ''}`, 'event');
    const own = this.scope();
    const extra: Scope = { event: value };
    for (const [k, v] of Object.entries(nodeScope)) if (!(k in own) || k === 'index') extra[k] = v;
    this.run(list, extra);
  }

  run(actions: Action[], extra: Scope = {}) {
    for (const a of actions) {
      const scene = this.scene;
      if (!scene) return;
      const s = { ...this.scope(), ...extra };
      if (a.if) {
        const ok = evaluate(a.if, s);
        if (!ok.ok) { this.app.log(`if ${a.if}: ${ok.error}`, 'warn'); continue; }
        if (!ok.value) continue;
      }
      switch (a.do) {
        case 'segue': this.perform(a.segue, s); break;
        case 'back': this.back(); break;
        case 'unwind': this.unwind(a.scene); break;
        case 'set': {
          const r = evaluate(a.value, s);
          if (!r.ok) { this.app.log(`set ${a.target}: ${r.error}`, 'warn'); break; }
          this.write(a.target.split('.'), r.value);
          this.app.log(`${a.target} = ${preview(r.value)}`);
          break;
        }
        case 'animate': {
          const el = this.outlets.get(a.ref);
          const node = allNodes(scene.root).find((n) => n.ref === a.ref);
          const v = node?.motion?.variants?.[a.variant];
          if (!el || !v) { this.app.log(`animate @${a.ref} → ${a.variant}: no such outlet or variant`, 'warn'); break; }
          this.app.log(`animate @${a.ref} → ${a.variant}`);
          animate(el, toFramerTarget(v.target) as Parameters<typeof animate>[1], toFramer(v.transition, this.app.speed()) as Parameters<typeof animate>[2]);
          break;
        }
        case 'focus': {
          const el = this.outlets.get(a.ref);
          const target = el?.matches('input,textarea,button,[tabindex]') ? el : el?.querySelector<HTMLElement>('input,textarea,[role=switch],[role=slider],button,[tabindex]:not([tabindex="-1"])');
          if (target) { target.focus(); this.app.log(`@${a.ref} becomes first responder`); } else this.app.log(`focus @${a.ref}: nothing to focus`, 'warn');
          break;
        }
        case 'blur': (document.activeElement as HTMLElement | null)?.blur(); this.app.log('resign first responder'); break;
        case 'send': this.app.log(`send “${a.command}” to the first responder`); this.send(a.command); break;
        case 'call': {
          const fn = s[a.prop];
          const args = a.args.map((x) => valueOf<unknown>(x, s, undefined));
          if (typeof fn === 'function') (fn as (...xs: unknown[]) => void)(...args);
          else this.app.log(`${a.prop} isn't passed to ${scene.name}`, 'warn');
          break;
        }
        case 'toast': {
          const r = evaluate(a.message, s);
          this.app.toast(r.ok ? String(r.value) : a.message);
          break;
        }
      }
    }
  }

  /** A segue: its destination's props from this scope (prepare(for:sender:)); its callbacks run back here. */
  perform(segueId: string, s: Scope) {
    const doc = this.app.doc();
    const g = doc.segues.find((x) => x.id === segueId);
    const dest = g && doc.scenes.find((x) => x.id === g.to);
    if (!g || !dest) { this.app.log('Perform segue: it no longer exists', 'warn'); return; }
    const props = this.argsFor(dest, g.args, g.delegates, s);
    this.app.log(`perform ${g.identifier}: ${g.kind} → ${dest.name}`, 'nav');
    if (g.kind === 'push' || g.kind === 'detail') {
      if (g.kind === 'detail' && this.hosts.split) { this.hosts.split.showDetail(dest.id, props); return; }
      if (this.hosts.stack) { this.hosts.stack.push(dest.id, props, g.transition); return; }
      this.app.log(`${this.scene?.name} isn't in a NavigationStack: presenting ${dest.name} instead`, 'warn');
      this.app.present(this, dest.id, props, 'push', g.transition);
      return;
    }
    this.app.present(this, dest.id, props, g.kind, g.transition);
  }

  /** The props a scene gets: values from expressions in this scope; callbacks that run actions here. */
  argsFor(dest: Scene, args: Record<string, string>, delegates: Record<string, Action[]>, s: Scope): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const p of dest.props) {
      if (p.callback) {
        const list = delegates[p.name] ?? [];
        props[p.name] = (...xs: unknown[]) => {
          this.app.log(`${dest.name} calls ${p.name}(${xs.map((a) => preview(a)).join(', ')}) → ${this.scene?.name}`, 'event');
          if (!list.length) { this.app.log(`${p.name} has no delegate here`, 'warn'); return; }
          this.run(list, Object.fromEntries((p.params ?? []).map((n, i) => [n, xs[i]])));
        };
      } else if (args[p.name]) props[p.name] = valueOf(args[p.name], s, null);
    }
    return props;
  }

  /** Try `fn` on this instance, then on the ones it's embedded in, outward, until one does it. */
  private outward(fn: (i: Instance) => boolean): boolean {
    return fn(this) || (this.parent?.outward(fn) ?? false);
  }

  /** Dismiss / Back: pop the nearest pushed page (this scene's, or the one it's embedded in), else close the
      layer it was presented in (a Cancel in a sheet's first screen closes the sheet). */
  back() {
    if (this.outward((i) => !!i.hosts.stack?.pop(i))) return;
    if (this.hosts.frame?.dismiss()) return;
    this.app.log('Dismiss: nothing to go back to', 'warn');
  }

  unwind(sceneId: string) {
    if (this.outward((i) => !!i.hosts.stack?.popTo(sceneId))) return;
    this.app.log(`Unwind: ${this.app.doc().scenes.find((s) => s.id === sceneId)?.name ?? '?'} isn't behind this scene`, 'warn');
  }

  /** The responder chain: from the focused element up its nodes and scenes, then the app. */
  send(command: string) {
    const doc = this.app.doc();
    const focused = document.activeElement as HTMLElement | null;
    const inside = [...this.app.instances].filter((i) => focused && i.el?.contains(focused));
    // The innermost instance that holds the focus, else this one.
    let at: Instance | null = inside.sort((a, b) => (a.el!.contains(b.el) ? 1 : -1))[0] ?? this;
    if (focused && at.el?.contains(focused)) {
      for (let el: HTMLElement | null = focused.closest('[data-ib-node]'); el && at.el.contains(el); el = el.parentElement?.closest('[data-ib-node]') ?? null) {
        const node = at.scene && findNode(at.scene.root, el.dataset.ibNode ?? '');
        const list = node?.responds?.[command];
        if (list) { this.app.log(`“${command}” → ${node!.name ?? node!.type} in ${at.scene!.name}`, 'event'); at.run(list); return; }
      }
    }
    for (; at; at = at.parent) {
      const list = at.scene?.responds?.[command];
      if (list) { this.app.log(`“${command}” → ${at.scene!.name}`, 'event'); at.run(list); return; }
    }
    const app = doc.responds?.[command];
    if (app) { this.app.log(`“${command}” → the app`, 'event'); this.run(app); return; }
    this.app.log(`No responder handles “${command}”`, 'warn');
  }
}
