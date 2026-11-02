/* From rrweb recordings to a map of the app they were recorded in. Each recording is replayed into a VDom and read one
   interaction (click or right-click) at a time: what changed in the moment after it says what the interaction did.
   - navigate: the title changed, a new page loaded (a Meta event), or a link went somewhere else → a page;
   - present: a layer appeared — a subtree added at the top of the body, or a dialog, menu, sheet, popover or toast
     (by role, class or fixed position), or one already there was revealed by a class or attribute (`open`, `hidden`);
   - update: what was clicked changed an open layer (a validation message, "Link copied") or the page (a new row);
   - dismiss: a layer went away and nothing else changed.
   Every recording folds into one map: pages are the same page when their routes match (`/projects/1` and `/projects/3`
   are `/projects/:id`), their titles match, or their skeletons (the tag-and-class structure, no text) mostly do; layers
   by kind, structure and their buttons' labels; states by the control that led to them; segues by where they start,
   what was clicked and where they end. So each recording added confirms what's there (the counts go up) and fills in
   what isn't, and every frame and segue keeps the moments (`Evidence`) it was seen at, to be drawn from any of them. */
import type { ReplayEvent } from '@/components/ui/replay-preview';
import { VDom, isElement, type MutationData, type VNode } from './vdom';

export interface Recording {
  id: string;
  name: string;
  events: ReplayEvent[];
}

/** A moment in one recording that shows something: `path` scopes the frame to a layer, `hide` hides open layers. */
export interface Evidence {
  recording: string;
  /** ms from the recording's first event. */
  time: number;
  path?: number[];
  hide?: number[][];
}

export interface ScreenState {
  id: string;
  label: string;
  evidence: Evidence[];
}

export interface PageNode {
  kind: 'page';
  id: string;
  label: string;
  /** The route pattern, when a URL was seen (`/projects/:id`). */
  route?: string;
  titles: string[];
  states: ScreenState[];
  recordings: string[];
}

export type OverlayType = 'dialog' | 'menu' | 'sheet' | 'popover' | 'toast' | 'panel';

export interface OverlayNode {
  kind: 'overlay';
  id: string;
  type: OverlayType;
  label: string;
  /** The pages it was opened over, the first one first. */
  hosts: string[];
  states: ScreenState[];
  recordings: string[];
}

export type SegueKind = 'navigate' | 'present' | 'update' | 'dismiss';

export interface StateRef {
  node: string;
  state: string;
}

export interface Segue {
  id: string;
  kind: SegueKind;
  from: StateRef;
  to: StateRef;
  action: 'click' | 'contextmenu';
  /** What was clicked, as it reads ("New project"); a repeated item lists the ones clicked. */
  label: string;
  /** Where it was clicked, in the recorded viewport (px). */
  point: { x: number; y: number };
  evidence: Evidence[];
}

export interface RecordingSummary {
  id: string;
  name: string;
  duration: number;
  interactions: number;
}

export interface AppMap {
  pages: PageNode[];
  overlays: OverlayNode[];
  segues: Segue[];
  entry: StateRef | null;
  recordings: RecordingSummary[];
}

/* ── Reading the DOM ── */

const MAX_EVIDENCE = 8;
/** How long after an interaction its effects are counted (ms), unless the next one comes first. */
const WINDOW = 1500;
/** When a state is drawn: this long after the interaction, or just before the next one. */
const SETTLE = 1200;

const STATE_CLASS = /^(on|active|open|opened|show|shown|visible|selected|current|hover|focus|focused|disabled|bad|error|invalid|checked|expanded|in|is-.*|has-.*)$/;
const OPEN_CLASS = /^(open|opened|show|shown|visible|active|in|expanded|is-open|is-visible|is-active)$/;
const OVERLAY_ROLES = new Set(['dialog', 'alertdialog', 'menu', 'listbox', 'tooltip', 'status', 'alert']);
const OVERLAY_CLASS = /(modal|dialog|menu|popover|popup|dropdown|drawer|sheet|toast|tooltip|overlay|backdrop|snackbar|lightbox|flyout)/i;
const INTERACTIVE = new Set(['a', 'button', 'select', 'input', 'textarea', 'summary', 'label', 'option']);
const INTERACTIVE_ROLES = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'switch', 'checkbox', 'option', 'radio', 'treeitem', 'row']);

const classes = (n: VNode) => (n.attrs.class ?? '').split(/\s+/).filter(Boolean);
const stableClasses = (n: VNode) => classes(n).filter((c) => !STATE_CLASS.test(c));

/** An element's structural signature: tag, stable classes and role. */
function sig(n: VNode): string {
  const cls = stableClasses(n).sort().join('.');
  return `${n.tag}${cls ? `.${cls}` : ''}${n.attrs.role ? `[${n.attrs.role}]` : ''}`;
}

function clip(s: string, n = 48): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** The tag-and-class structure under `root` (no text), as a set of paths, leaving out `skip`. */
function skeleton(vdom: VDom, root: VNode, skip: Set<number>, depth = 7): Set<string> {
  const out = new Set<string>();
  const walk = (n: VNode, path: string, d: number) => {
    if (!isElement(n) || skip.has(n.id) || d > depth || ['script', 'style', 'noscript', 'template'].includes(n.tag)) return;
    const own = `${path}>${n.tag}${stableClasses(n)[0] ? `.${stableClasses(n)[0]}` : ''}`;
    out.add(own);
    for (const c of vdom.elementChildren(n)) walk(c, own, d + 1);
  };
  walk(root, '', 0);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
}

/** A URL's route pattern: the path (or a hash route), ids as `:id`. */
export function routeOf(href: string | undefined, base?: string): string | undefined {
  if (!href) return undefined;
  let url: URL;
  try {
    url = new URL(href, base ?? 'https://app.invalid/');
  } catch {
    return undefined;
  }
  const path = url.hash.startsWith('#/') ? url.hash.slice(1).split('?')[0] : url.pathname;
  return (
    path
      .split('/')
      .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8,}$/i.test(seg) || /^[0-9a-f-]{32,36}$/i.test(seg) || (/\d/.test(seg) && /[a-z]/i.test(seg) && seg.length >= 12) ? ':id' : seg))
      .join('/')
      .replace(/\/+$/, '') || '/'
  );
}

function isOverlayish(vdom: VDom, n: VNode): boolean {
  if (!isElement(n)) return false;
  if (OVERLAY_ROLES.has(n.attrs.role ?? '') || n.attrs['aria-modal'] === 'true' || n.tag === 'dialog') return true;
  if (OVERLAY_CLASS.test(n.attrs.class ?? '') || /position:\s*fixed/.test(n.attrs.style ?? '')) return true;
  // A portal: a subtree added straight under the body that brings a role-ed layer with it.
  const parent = vdom.get(n.parent);
  return !!parent && (parent.tag === 'body' || parent.tag === 'html') && vdom.elements(n).some((e) => OVERLAY_ROLES.has(e.attrs.role ?? '') || e.attrs['aria-modal'] === 'true');
}

function overlayType(vdom: VDom, n: VNode): OverlayType {
  const cls = vdom.elements(n).slice(0, 4).map((e) => e.attrs.class ?? '').join(' ');
  if (/sheet|drawer/i.test(cls) || n.tag === 'aside') return 'sheet';
  if (/toast|snackbar/i.test(cls)) return 'toast';
  if (/popover|popup|tooltip|flyout/i.test(cls)) return 'popover';
  if (/menu|dropdown/i.test(cls)) return 'menu';
  const roles = vdom.elements(n).map((e) => e.attrs.role ?? '');
  if (roles.some((r) => r === 'dialog' || r === 'alertdialog') || vdom.elements(n).some((e) => e.attrs['aria-modal'] === 'true' || e.tag === 'dialog')) return 'dialog';
  if (roles.some((r) => r === 'menu' || r === 'listbox')) return 'menu';
  if (roles.some((r) => r === 'status' || r === 'alert')) return 'toast';
  if (/modal|dialog|backdrop|overlay|lightbox/i.test(cls)) return 'dialog';
  return 'panel';
}

const BUTTONISH = (n: VNode) => n.tag === 'button' || n.tag === 'a' || ['button', 'menuitem', 'option', 'link'].includes(n.attrs.role ?? '');

function overlayIdentity(vdom: VDom, n: VNode, type: OverlayType): { key: string; label: string } {
  const els = vdom.elements(n);
  const buttons = els.filter(BUTTONISH).map((b) => clip(b.attrs['aria-label'] || vdom.textOf(b), 24)).filter(Boolean);
  const labelled = n.attrs['aria-labelledby'] ? vdom.find((e) => e.attrs.id === n.attrs['aria-labelledby']) : undefined;
  const named = els.find((e) => e.attrs['aria-label'] && (OVERLAY_ROLES.has(e.attrs.role ?? '') || e === n));
  const heading = els.find((e) => /^h[1-6]$/.test(e.tag));
  const text = vdom.textOf(n);
  let label =
    named?.attrs['aria-label'] ||
    (labelled && vdom.textOf(labelled)) ||
    (heading && vdom.textOf(heading)) ||
    (type === 'menu' && buttons.length ? `${buttons.slice(0, 3).join(', ')}${buttons.length > 3 ? '…' : ''}` : '') ||
    clip(text, 40) ||
    type;
  label = clip(label, 48);
  const shape = hash([...skeleton(vdom, n, new Set(), 5)].sort().join('|'));
  const key = type === 'toast' ? `toast|${text.split(' ')[0] ?? ''}` : `${type}|${shape}|${buttons.join(',')}`;
  return { key, label };
}

/** What a press landed on: the control it means, its label, and a key that's the same for every item of a list. */
function triggerOf(vdom: VDom, id: number): { label: string; key: string } {
  let n = vdom.get(id);
  for (let k = 0, m = n; m && k < 6; k++, m = vdom.get(m.parent)) {
    if (INTERACTIVE.has(m.tag) || INTERACTIVE_ROLES.has(m.attrs.role ?? '') || m.attrs.tabindex !== undefined) { n = m; break; }
  }
  if (n && !vdom.textOf(n) && !n.attrs['aria-label']) {
    for (let m = vdom.get(n.parent), k = 0; m && k < 4; k++, m = vdom.get(m.parent)) if (vdom.textOf(m)) { n = m; break; }
  }
  if (!n) return { label: 'something', key: 'unknown' };
  const label = clip(n.attrs['aria-label'] || vdom.textOf(n) || n.attrs.placeholder || n.attrs.title || n.attrs.alt || n.tag, 40);
  // An item of a list (a row, a card): keyed by its structure, not its text, so every row's menu is the same segue.
  let path = sig(n);
  for (let m: VNode | undefined = n, k = 0; m && k < 4; k++) {
    const parent = vdom.get(m.parent);
    if (!parent) break;
    const same = vdom.elementChildren(parent).filter((c) => sig(c) === sig(m!)).length;
    if (same >= 2) return { label, key: `item:${sig(parent)}>${path}` };
    m = parent;
    path = `${sig(m)}>${path}`;
  }
  return { label, key: `${sig(n)}|${label}` };
}

/* ── Merging into one map ── */

interface PageObs {
  route?: string;
  title: string;
  tokens: Set<string>;
}

interface PageEntry {
  node: PageNode;
  routes: Set<string>;
  titles: Set<string>;
  tokens: Set<string>;
}

class MapBuilder {
  pages: PageEntry[] = [];
  overlays = new Map<string, OverlayNode>();
  segues = new Map<string, Segue>();
  entry: StateRef | null = null;
  recordings: RecordingSummary[] = [];

  page(obs: PageObs, recording: string): PageNode {
    let best: PageEntry | undefined;
    let score = 0;
    for (const p of this.pages) {
      const routeKnown = obs.route !== undefined && p.routes.size > 0;
      if (routeKnown && !p.routes.has(obs.route!)) continue;
      const s = routeKnown ? 3 : obs.title && p.titles.has(obs.title) ? 2 : jaccard(obs.tokens, p.tokens) >= 0.8 ? 1 : 0;
      if (s > score) { best = p; score = s; }
    }
    if (!best) {
      best = { node: { kind: 'page', id: `page-${this.pages.length + 1}`, label: '', titles: [], states: [{ id: 'base', label: 'Page', evidence: [] }], recordings: [] }, routes: new Set(), titles: new Set(), tokens: obs.tokens };
      this.pages.push(best);
    }
    if (obs.route) best.routes.add(obs.route);
    if (obs.title) best.titles.add(obs.title);
    const n = best.node;
    n.route = [...best.routes][0];
    n.titles = [...best.titles];
    n.label = (n.titles.length === 1 ? n.titles[0] : n.route ?? n.titles[0]) || 'Page';
    if (!n.recordings.includes(recording)) n.recordings.push(recording);
    return n;
  }

  overlay(key: string, type: OverlayType, label: string, host: string, recording: string): OverlayNode {
    let o = this.overlays.get(key);
    if (!o) {
      o = { kind: 'overlay', id: `layer-${this.overlays.size + 1}`, type, label, hosts: [], states: [{ id: 'open', label: 'Open', evidence: [] }], recordings: [] };
      this.overlays.set(key, o);
    }
    if (!o.hosts.includes(host)) o.hosts.push(host);
    if (!o.recordings.includes(recording)) o.recordings.push(recording);
    return o;
  }

  nodeById(id: string): PageNode | OverlayNode | undefined {
    return this.pages.find((p) => p.node.id === id)?.node ?? [...this.overlays.values()].find((o) => o.id === id);
  }

  state(node: string, id: string, label: string, ev: Evidence): void {
    const n = this.nodeById(node);
    if (!n) return;
    let s = n.states.find((x) => x.id === id);
    if (!s) n.states.push((s = { id, label, evidence: [] }));
    if (s.evidence.length < MAX_EVIDENCE && !s.evidence.some((e) => e.recording === ev.recording)) s.evidence.push(ev);
    else if (s.evidence.length < MAX_EVIDENCE) s.evidence.push(ev);
  }

  segue(kind: SegueKind, from: StateRef, to: StateRef, action: Segue['action'], trigger: { label: string; key: string }, point: { x: number; y: number }, ev: Evidence) {
    const key = `${from.node}/${from.state}|${action}|${trigger.key}|${to.node}/${to.state}`;
    let s = this.segues.get(key);
    if (!s) {
      s = { id: `segue-${this.segues.size + 1}`, kind, from, to, action, label: trigger.label, point, evidence: [] };
      this.segues.set(key, s);
    } else if (!s.label.split(', ').includes(trigger.label) && trigger.key.startsWith('item:')) {
      const seen = s.label.split(', ');
      s.label = seen.length >= 3 ? s.label : [...seen, trigger.label].join(', ');
    }
    if (s.evidence.length < MAX_EVIDENCE * 2) s.evidence.push(ev);
  }

  build(): AppMap {
    return {
      pages: this.pages.map((p) => p.node),
      overlays: [...this.overlays.values()],
      segues: [...this.segues.values()],
      entry: this.entry,
      recordings: this.recordings,
    };
  }
}

/* ── Reading one recording ── */

interface OpenLayer {
  id: string;
  state: string;
  node: number;
  /** Revealed by these classes (or attributes) rather than added: closed when they go. */
  reveal: string[] | null;
}

interface Pending {
  t: number;
  action: Segue['action'];
  target: number;
  point: { x: number; y: number };
  trigger: { label: string; key: string };
  from: StateRef;
  title: string;
  link?: string;
  meta?: string;
  reload: boolean;
  added: number[];
  removedFrom: number[];
  removed: number[];
  attrs: { id: number; before: Record<string, string | undefined>; after: Record<string, unknown> }[];
  texts: number[];
}

function revealed(before: Record<string, string | undefined>, after: Record<string, unknown>): string[] | null {
  const was = new Set((before.class ?? '').split(/\s+/).filter(Boolean));
  if ('class' in after) {
    const added = String(after.class ?? '').split(/\s+/).filter((c) => c && !was.has(c) && OPEN_CLASS.test(c));
    if (added.length) return added;
  }
  if ('hidden' in after && after.hidden === null && before.hidden !== undefined) return ['@hidden'];
  if ('aria-hidden' in after && before['aria-hidden'] === 'true' && after['aria-hidden'] !== 'true') return ['@aria-hidden'];
  if ('open' in after && after.open !== null && before.open === undefined) return ['@open'];
  if ('data-state' in after && after['data-state'] === 'open') return ['@data-state'];
  return null;
}

function stillRevealed(n: VNode | undefined, reveal: string[]): boolean {
  if (!n) return false;
  return reveal.every((r) =>
    r === '@hidden' ? n.attrs.hidden === undefined
      : r === '@aria-hidden' ? n.attrs['aria-hidden'] !== 'true'
        : r === '@open' ? n.attrs.open !== undefined
          : r === '@data-state' ? n.attrs['data-state'] === 'open'
            : classes(n).includes(r),
  );
}

function analyzeRecording(rec: Recording, b: MapBuilder) {
  const events = [...rec.events].sort((x, y) => x.timestamp - y.timestamp);
  if (!events.length) return;
  const t0 = events[0].timestamp;
  const end = events[events.length - 1].timestamp - t0;
  const vdom = new VDom();
  let href: string | undefined;
  let route: string | undefined;
  let page: StateRef | null = null;
  let open: OpenLayer[] = [];
  let pending: Pending | null = null;
  let interactions = 0;
  let needEntry = false;

  const paths = (layers: OpenLayer[]) => layers.map((l) => vdom.path(l.node)).filter((p): p is number[] => !!p);
  const enterPage = (time: number) => {
    const body = vdom.body();
    if (!body) return;
    const skip = new Set(open.map((l) => l.node));
    const node = b.page({ route, title: vdom.title(), tokens: skeleton(vdom, body, skip) }, rec.id);
    page = { node: node.id, state: 'base' };
    b.state(node.id, 'base', 'Page', { recording: rec.id, time, hide: paths(open) });
    if (!b.entry) b.entry = { ...page };
  };

  const finalize = (p: Pending, next: number) => {
    const settle = Math.max(p.t + 60, Math.min(next - 40, p.t + SETTLE));
    const titleAfter = vdom.title();
    const link = p.link ? routeOf(p.link, href) : undefined;
    const churn = p.added.length + p.removed.length;
    const navigated = p.reload || (!!titleAfter && titleAfter !== p.title) || (link !== undefined && link !== route && churn >= 2);
    const closed = open.filter((l) => !vdom.attached(l.node) || (l.reveal && !stillRevealed(vdom.get(l.node), l.reveal)));
    let still = open.filter((l) => !closed.includes(l));
    const host = page?.node;

    // New layers: added subtrees, or ones revealed by an attribute.
    const fresh: { node: VNode; reveal: string[] | null }[] = [];
    for (const id of p.added) {
      const n = vdom.get(id);
      if (!n || !isElement(n) || !vdom.attached(id) || still.some((l) => vdom.within(id, l.node))) continue;
      if (isOverlayish(vdom, n) && (vdom.textOf(n) || vdom.elements(n).length >= 3)) fresh.push({ node: n, reveal: null });
    }
    for (const a of p.attrs) {
      const n = vdom.get(a.id);
      if (!n || !vdom.attached(a.id) || vdom.within(p.target, a.id) || still.some((l) => l.node === a.id)) continue;
      const reveal = revealed(a.before, a.after);
      if (reveal && isOverlayish(vdom, n)) fresh.push({ node: n, reveal });
    }
    const layerNodes = [...open.map((l) => l.node), ...fresh.map((f) => f.node.id)];
    const inLayer = (id: number) => layerNodes.some((l) => vdom.within(id, l));
    const segueEv: Evidence = { recording: rec.id, time: p.t };

    if (navigated) {
      if (p.meta) href = p.meta;
      else if (p.link && link !== undefined) href = new URL(p.link, href ?? 'https://app.invalid/').href;
      route = p.meta ? routeOf(p.meta) : link !== undefined && link !== route ? link : undefined;
      open = fresh.map((f) => ({ id: '', state: 'open', node: f.node.id, reveal: f.reveal }));
      enterPage(settle);
      const pageNow = page as StateRef | null;
      if (pageNow) b.segue('navigate', p.from, pageNow, p.action, p.trigger, p.point, segueEv);
      for (const l of open) {
        const n = vdom.get(l.node)!;
        const type = overlayType(vdom, n);
        const id = overlayIdentity(vdom, n, type);
        l.id = b.overlay(id.key, type, id.label, pageNow?.node ?? '', rec.id).id;
        b.state(l.id, 'open', 'Open', { recording: rec.id, time: settle, path: vdom.path(l.node) ?? undefined });
        b.segue('present', p.from, { node: l.id, state: 'open' }, p.action, p.trigger, p.point, segueEv);
      }
      return;
    }

    let changed = false;
    // Changes inside layers that stay open: a new state of that layer.
    for (const l of still) {
      const touched =
        p.added.some((id) => vdom.within(id, l.node)) ||
        p.removedFrom.some((id) => vdom.within(id, l.node)) ||
        p.attrs.some((a) => vdom.within(a.id, l.node)) ||
        p.texts.some((id) => vdom.within(id, l.node));
      if (!touched) continue;
      const state = `after:${p.trigger.key}`;
      const addedText = p.added.map((id) => vdom.get(id)).filter((n) => n && vdom.within(n.id, l.node)).map((n) => (n!.type === 3 ? n!.text : vdom.textOf(n!))).find((s) => s.trim());
      const textNow = p.texts.map((id) => vdom.get(id)?.text ?? '').find((s) => s.trim());
      const label = clip((addedText || textNow || `After “${p.trigger.label}”`).trim(), 48);
      b.state(l.id, state, label, { recording: rec.id, time: settle, path: vdom.path(l.node) ?? undefined });
      b.segue('update', p.from, { node: l.id, state }, p.action, p.trigger, p.point, segueEv);
      l.state = state;
      changed = true;
    }
    // New layers.
    for (const f of fresh) {
      const type = overlayType(vdom, f.node);
      const id = overlayIdentity(vdom, f.node, type);
      const o = b.overlay(id.key, type, id.label, host ?? '', rec.id);
      b.state(o.id, 'open', 'Open', { recording: rec.id, time: settle, path: vdom.path(f.node.id) ?? undefined });
      b.segue('present', p.from, { node: o.id, state: 'open' }, p.action, p.trigger, p.point, segueEv);
      still = [...still.filter((l) => l.id !== o.id), { id: o.id, state: 'open', node: f.node.id, reveal: f.reveal }];
      changed = true;
    }
    // Changes to the page itself.
    const closedNodes = new Set(closed.map((l) => l.node));
    const pageChanged =
      p.added.some((id) => vdom.attached(id) && !inLayer(id) && underBody(vdom, id)) ||
      p.removed.some((id, i) => !closedNodes.has(id) && !inLayer(p.removedFrom[i]) && underBody(vdom, p.removedFrom[i])) ||
      p.attrs.some((a) => vdom.attached(a.id) && !inLayer(a.id) && !closedNodes.has(a.id) && underBody(vdom, a.id)) ||
      p.texts.some((id) => vdom.attached(id) && !inLayer(id) && underBody(vdom, id));
    open = still;
    if (page && pageChanged) {
      const state = `after:${p.trigger.key}`;
      b.state(page.node, state, `After “${p.trigger.label}”`, { recording: rec.id, time: settle, hide: paths(open) });
      b.segue('update', p.from, { node: page.node, state }, p.action, p.trigger, p.point, segueEv);
      page = { node: page.node, state };
      changed = true;
    }
    if (!changed && closed.length && page) b.segue('dismiss', p.from, page, p.action, p.trigger, p.point, segueEv);
  };

  for (const e of events) {
    const time = e.timestamp - t0;
    const data = (e.data ?? {}) as Record<string, unknown>;
    if (pending && time > pending.t + WINDOW) {
      finalize(pending, time);
      pending = null;
    }
    if (e.type === 4) {
      const next = typeof data.href === 'string' ? data.href : undefined;
      if (href === undefined) { href = next; route = routeOf(next); }
      else if (pending) { pending.meta = next; pending.reload = true; }
      else { href = next; route = routeOf(next); needEntry = true; }
    } else if (e.type === 2) {
      vdom.load((data as { node: Parameters<VDom['load']>[0] }).node);
      open = [];
      if (pending) pending.reload = true;
      else needEntry = true;
    } else if (e.type === 3) {
      const source = data.source as number;
      if (source === 0) {
        const m = data as unknown as MutationData;
        const before = m.attributes.map((a) => ({ id: a.id, before: { ...(vdom.get(a.id)?.attrs ?? {}) } as Record<string, string | undefined> }));
        const { added } = vdom.apply(m);
        if (pending) {
          pending.added.push(...added);
          for (const r of m.removes) { pending.removed.push(r.id); pending.removedFrom.push(r.parentId); }
          m.attributes.forEach((a, i) => pending!.attrs.push({ id: a.id, before: before[i].before, after: a.attributes }));
          pending.texts.push(...m.texts.map((t) => t.id));
        } else {
          // On its own (a toast timing out): layers that went away just close.
          open = open.filter((l) => vdom.attached(l.node) && (!l.reveal || stillRevealed(vdom.get(l.node), l.reveal)));
        }
      } else if (source === 5 && typeof data.id === 'number') {
        vdom.values.set(data.id, String(data.text ?? ''));
      } else if (source === 2 && (data.type === 2 || data.type === 3) && typeof data.id === 'number') {
        if (pending) finalize(pending, time);
        pending = null;
        if (needEntry || !page) { needEntry = false; enterPage(Math.max(1, time - 40)); }
        if (!page) continue;
        interactions++;
        const target = data.id;
        const layer = [...open].reverse().find((l) => vdom.within(target, l.node));
        const anchor = [vdom.get(target), ...vdom.ancestors(target)].find((n) => n?.tag === 'a' && n.attrs.href);
        pending = {
          t: time,
          action: data.type === 3 ? 'contextmenu' : 'click',
          target,
          point: { x: Number(data.x ?? 0), y: Number(data.y ?? 0) },
          trigger: triggerOf(vdom, target),
          from: layer ? { node: layer.id, state: layer.state } : { ...(page as StateRef) },
          title: vdom.title(),
          link: anchor?.attrs.href,
          reload: false,
          added: [], removedFrom: [], removed: [], attrs: [], texts: [],
        };
      }
    }
  }
  if (pending) finalize(pending, end + 40);
  if (needEntry || !page) enterPage(Math.max(1, end - 40));
  b.recordings.push({ id: rec.id, name: rec.name, duration: end, interactions });
}

function underBody(vdom: VDom, id: number): boolean {
  const body = vdom.body();
  return !!body && vdom.within(id, body.id);
}

/** One map of the app from every recording: each one added confirms what's there and fills in what isn't. */
export function analyzeRecordings(recordings: readonly Recording[]): AppMap {
  const b = new MapBuilder();
  for (const rec of recordings) analyzeRecording(rec, b);
  return b.build();
}
