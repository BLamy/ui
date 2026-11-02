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
   what isn't, and every frame and segue keeps the moments (`Evidence`) it was seen at, to be drawn from any of them.
   Two things keep the map small:
   - an update that changes one part of the page (a switch, a row) is a frame of just that part, not another screen;
   - chrome — a header, a navigation bar, a sidebar, a footer, by landmark or class — seen on two or more pages is a
     frame of its own: the page frames show only their content, and what's clicked in the chrome leaves from it. */
import type { ReplayEvent } from '@/components/ui/replay-preview';
import { VDom, isElement, type MutationData, type VNode } from './vdom';

export interface Recording {
  id: string;
  name: string;
  events: ReplayEvent[];
}

/** A moment in one recording that shows something: `path` scopes the frame to one element (a layer's panel, the
 *  page's content without its chrome, the part an update changed, or the chrome itself), `hide` hides open layers. */
export interface Evidence {
  recording: string;
  /** ms from the recording's first event. */
  time: number;
  path?: number[];
  /** What `path` is when it isn't a layer: these keep the page's background. */
  scope?: 'content' | 'part' | 'chrome';
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
  /** Its content's first heading, which names it when it has neither a title nor a route. */
  heading?: string;
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

export type ChromeType = 'header' | 'nav' | 'sidebar' | 'footer';

/** Chrome shared by pages: drawn once, the pages without it. */
export interface ChromeNode {
  kind: 'chrome';
  id: string;
  type: ChromeType;
  label: string;
  states: ScreenState[];
  /** The pages it was seen on. */
  pages: string[];
  recordings: string[];
}

export type MapNode = PageNode | OverlayNode | ChromeNode;

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
  /** Chrome seen on two or more pages. */
  chrome: ChromeNode[];
  segues: Segue[];
  entry: StateRef | null;
  recordings: RecordingSummary[];
}

/* ── Reading the DOM ── */

const MAX_EVIDENCE = 8;
/** How long after an interaction its effects are counted (ms), unless the next one comes first. */
const WINDOW = 1500;
/** A page that reloads can take longer to render: its interaction's effects are counted this long. */
const RELOAD_WINDOW = 5000;
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

/** A control's text as a name: without the times, dates and counts that change from one recording to the next, or
 *  the glyphs around it (× Close, ↶ Undo, Personal 2). A name that's only a number is no name. */
function nameOf(s: string): string {
  const name = s
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\s?([AP]M)?\b/gi, '')
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}(, \d{4})?\b/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?\b/g, '')
    .replace(/\b(today|yesterday|just now|\d+ (seconds?|minutes?|hours?|days?) ago)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s+\d{1,4}$/, '')
    .trim();
  return /^[\d\s.,:/%+-]*$/.test(name) ? '' : name;
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

/* ── Chrome and parts ── */

const CHROME_TAGS: Record<string, ChromeType> = { header: 'header', nav: 'nav', aside: 'sidebar', footer: 'footer' };
const CHROME_ROLES: Record<string, ChromeType> = { banner: 'header', navigation: 'nav', complementary: 'sidebar', contentinfo: 'footer' };
const CHROME_CLASS: [RegExp, ChromeType][] = [
  [/^(app-|site-|page-)?(header|topbar|top-bar|navbar|appbar|app-bar|masthead)$/i, 'header'],
  [/^(app-|site-)?(sidebar|side-bar|sidenav|side-nav|leftnav|rail)$/i, 'sidebar'],
  [/^(app-|site-)?footer$/i, 'footer'],
];
const CHROME_LABEL: Record<ChromeType, string> = { header: 'Header', nav: 'Navigation', sidebar: 'Sidebar', footer: 'Footer' };
const SKIP_TAGS = ['script', 'style', 'noscript', 'template', 'link', 'meta'];

/** A layer, unless it holds most of the page: an app shell pinned full-screen (`position: fixed; inset: 0`) is layout. */
function isLayer(vdom: VDom, n: VNode): boolean {
  const body = vdom.body();
  return isOverlayish(vdom, n) && !(body && vdom.elements(n).length > vdom.elements(body).length * 0.5);
}

function chromeType(n: VNode): ChromeType | undefined {
  if (n.attrs.role === 'dialog' || n.attrs.role === 'alertdialog' || n.attrs['aria-modal'] === 'true') return undefined;
  return CHROME_ROLES[n.attrs.role ?? ''] ?? CHROME_TAGS[n.tag] ?? CHROME_CLASS.find(([re]) => stableClasses(n).some((c) => re.test(c)))?.[1];
}

/** The words of an element's text, to tell chrome (the same labels on every page) from content. */
const wordsOf = (vdom: VDom, n: VNode) => new Set(vdom.textOf(n).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1));

/** The page's regions when it has no landmarks: where the layout splits into big blocks (a sidebar beside the rest, a
 *  header above the content), every block but the biggest at each split, which is where the content goes on. Only the
 *  shell's splits count — while the biggest block still holds most of the page — not the content's own columns. */
function regionsOf(vdom: VDom, skip: Set<number>): { node: VNode; type: ChromeType }[] {
  const body = vdom.body();
  if (!body) return [];
  const big = (n: VNode) => vdom.elements(n).length >= 6 && vdom.textOf(n).length >= 8;
  const actions = (n: VNode) => vdom.elements(n).filter((e) => e.tag === 'a' || e.tag === 'button' || e.attrs.role === 'button' || e.attrs.role === 'link').length;
  const out: { node: VNode; type: ChromeType }[] = [];
  const all = vdom.elements(body).length;
  let n = body;
  for (let d = 0, splits = 0; d < 12 && splits < 2; d++) {
    const kids = vdom.elementChildren(n).filter((c) => !skip.has(c.id) && !SKIP_TAGS.includes(c.tag) && !isLayer(vdom, c) && big(c));
    if (!kids.length) break;
    const content = kids.reduce((a, c) => (vdom.elements(c).length > vdom.elements(a).length ? c : a));
    if (vdom.elements(content).length < all * 0.7) break;
    if (kids.length > 1) {
      splits++;
      const at = vdom.elementChildren(n).indexOf(content);
      for (const c of kids) {
        if (c === content || vdom.elements(c).length < 10) continue;
        const before = vdom.elementChildren(n).indexOf(c) < at;
        out.push({ node: c, type: actions(c) >= 6 ? 'sidebar' : before ? 'header' : 'footer' });
      }
    }
    n = content;
  }
  return out;
}

/** The page's chrome: the outermost landmarks outside `main` that aren't layers, else its layout's side regions. */
function chromeOf(vdom: VDom, skip: Set<number>): { node: VNode; type: ChromeType; landmark: boolean }[] {
  const body = vdom.body();
  if (!body) return [];
  const out: { node: VNode; type: ChromeType; landmark: boolean }[] = [];
  const walk = (n: VNode, d: number) => {
    if (!isElement(n) || skip.has(n.id) || d > 6 || SKIP_TAGS.includes(n.tag)) return;
    if (n.tag === 'main' || n.attrs.role === 'main') return;
    const type = chromeType(n);
    if (type && vdom.elements(n).length >= 3 && vdom.textOf(n)) { out.push({ node: n, type, landmark: true }); return; }
    if (isLayer(vdom, n)) return;
    for (const c of vdom.elementChildren(n)) walk(c, d + 1);
  };
  for (const c of vdom.elementChildren(body)) walk(c, 0);
  if (out.length) return out;
  return regionsOf(vdom, skip).map((r) => ({ ...r, landmark: false }));
}

/** The page without its chrome: `main` if there is one, else the biggest chrome-free block beside it. */
function contentOf(vdom: VDom, chrome: readonly VNode[], skip: Set<number>): VNode | undefined {
  const body = vdom.body();
  if (!body || !chrome.length) return undefined;
  const main = vdom.find((e) => (e.tag === 'main' || e.attrs.role === 'main') && !chrome.some((c) => vdom.within(e.id, c.id)), body.id);
  if (main) return main;
  const ids = new Set(chrome.map((c) => c.id));
  const hasChrome = (n: VNode) => chrome.some((c) => vdom.within(c.id, n.id));
  let n = body;
  for (let d = 0; d < 8; d++) {
    const kids = vdom.elementChildren(n).filter((c) => !ids.has(c.id) && !skip.has(c.id) && !SKIP_TAGS.includes(c.tag) && !isLayer(vdom, c));
    const top = kids.map((c) => ({ c, size: vdom.elements(c).length })).sort((a, b) => b.size - a.size)[0];
    if (!top) return undefined;
    if (!hasChrome(top.c)) return top.c;
    n = top.c;
  }
  return undefined;
}

/** The part of the page an update changed, grown to a whole component (a row, a card), or nothing when the change is
 *  spread over the page. */
function partOf(vdom: VDom, ids: number[], chrome: readonly VNode[], content?: VNode): VNode | undefined {
  const body = vdom.body();
  const els = ids.map((id) => vdom.get(id)).map((n) => (n && n.type !== 2 ? vdom.get(n.parent) : n)).filter(isElement);
  if (!body || !els.length) return undefined;
  // The nearest element holding every change.
  let part: VNode | undefined = els[0];
  for (const e of els.slice(1)) while (part && !vdom.within(e.id, part.id)) part = vdom.get(part.parent);
  if (!part) return undefined;
  // Grown until it reads as a component: a few elements and some text of its own.
  while (part.id !== body.id && (vdom.elements(part).length < 5 || vdom.textOf(part).length < 16)) {
    const up = vdom.get(part.parent);
    if (!up || up.id === body.id) break;
    part = up;
  }
  const all = vdom.elements(body).length;
  // The whole content (or more) isn't a part; a big table re-sorting under its filters still is.
  if (part.id === body.id || (content && vdom.within(content.id, part.id)) || vdom.elements(part).length > all * (content ? 0.9 : 0.6)) return undefined;
  if (chrome.some((c) => vdom.within(c.id, part!.id))) return undefined;
  return part;
}

/** Two routes as one template, when they differ in exactly one segment below the top (`/shop/lamps`, `/shop/desks` →
 *  `/shop/:slug`); a top-level page (/settings, /profile) is its own page. */
function slugPattern(a: string, b: string): string | undefined {
  const x = a.split('/'), y = b.split('/');
  if (x.length !== y.length || x.length < 3) return undefined;
  const diff = x.map((s, i) => (s === y[i] ? -1 : i)).filter((i) => i >= 0);
  if (diff.length !== 1 || diff[0] < 2) return undefined;
  return x.map((s, i) => (i === diff[0] ? (s.startsWith(':') ? s : ':slug') : s)).join('/');
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
  // A data: or blob: document (a stylesheet, a download) isn't a page of the app.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  const path = url.hash.startsWith('#/') ? url.hash.slice(1).split('?')[0] : url.pathname;
  return (
    path
      .split('/')
      .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8,}$/i.test(seg) || /^[0-9a-f-]{32,36}$/i.test(seg) || (/\d/.test(seg) && /[a-z]/i.test(seg) && seg.length >= 12) || /^[a-z]{1,6}-?\d{2,}$/i.test(seg) ? ':id' : seg))
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
  label = clip(nameOf(label) || type, 48);
  const shape = hash([...skeleton(vdom, n, new Set(), 5)].sort().join('|'));
  const key = type === 'toast' ? `toast|${text.split(' ')[0] ?? ''}` : `${type}|${shape}|${buttons.join(',')}`;
  return { key, label };
}

/** A control with no name of its own, by what it is. */
const KIND_NAME: Record<string, string> = {
  button: 'button', a: 'link', link: 'link', input: 'field', textarea: 'text field', select: 'menu', checkbox: 'checkbox',
  switch: 'switch', tab: 'tab', menuitem: 'menu item', option: 'option', row: 'row', li: 'list item', tr: 'row', img: 'image', svg: 'icon',
};

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
  // Its own name, else the nearest name around it (the row or card it's in), else what kind of control it is.
  const own = (m: VNode) => nameOf(m.attrs['aria-label'] || vdom.textOf(m) || m.attrs.placeholder || m.attrs.title || m.attrs.alt || '');
  const around = vdom.ancestors(n.id).slice(0, 5).map((m) => (m.attrs['aria-label'] ? nameOf(m.attrs['aria-label']) : '')).find(Boolean);
  const label = clip(own(n) || around || KIND_NAME[n.attrs.role ?? n.tag] || 'control', 32);
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
  /** The content's first heading: its name when it has neither title nor route. */
  heading?: string;
  /** The words of its content (without chrome). */
  words: Set<string>;
}

interface PageEntry {
  node: PageNode;
  /** The route pattern once two slugs of it were seen (`/incidents/:slug`). */
  template?: string;
  words: Set<string>;
  routes: Set<string>;
  titles: Set<string>;
  tokens: Set<string>;
}

interface SegueObs {
  kind: SegueKind;
  from: StateRef;
  to: StateRef;
  action: Segue['action'];
  trigger: { label: string; key: string };
  point: { x: number; y: number };
  ev: Evidence;
  /** The chrome the click landed in: the segue leaves from it once it's shared. */
  via?: string;
}

class MapBuilder {
  pages: PageEntry[] = [];
  overlays = new Map<string, OverlayNode>();
  chromes: { node: ChromeNode; tokens: Set<string>; words?: Set<string>; place?: string }[] = [];
  segueObs: SegueObs[] = [];
  /** A page frame's content without its chrome, applied when that chrome turns out to be shared. */
  contents = new Map<Evidence, { path: number[]; chrome: string[] }>();
  entry: StateRef | null = null;
  recordings: RecordingSummary[] = [];
  /** Per page, what each of its states looked like (fingerprints): a later state that looks the same is that state. */
  looks = new Map<string, Map<string, string>>();

  lookalike(node: string, fp: string): string | undefined {
    return this.looks.get(node)?.get(fp);
  }

  remember(node: string, fp: string, state: string): void {
    let m = this.looks.get(node);
    if (!m) this.looks.set(node, (m = new Map()));
    if (!m.has(fp)) m.set(fp, state);
  }

  /** `words` and `place` for chrome found by layout rather than landmarks: it must read much the same too, or it's
   *  just content — less so where it sits in the same place of the layout (a nav whose open section changes). */
  chrome(type: ChromeType, label: string, tokens: Set<string>, page: string, recording: string, ev: Evidence, words?: Set<string>, place?: string): ChromeNode {
    const reads = (c: { words?: Set<string>; place?: string }) =>
      !words || !c.words || jaccard(c.words, words) >= (place && c.place === place ? 0.35 : 0.6);
    let best = this.chromes.find((c) => c.node.type === type && !!place && c.place === place && reads(c))
      ?? this.chromes.find((c) => c.node.type === type && jaccard(c.tokens, tokens) >= 0.6 && reads(c));
    if (!best) {
      best = { node: { kind: 'chrome', id: `chrome-${this.chromes.length + 1}`, type, label, states: [{ id: 'base', label, evidence: [] }], pages: [], recordings: [] }, tokens, words, place };
      this.chromes.push(best);
    }
    const n = best.node;
    if (!n.pages.includes(page)) n.pages.push(page);
    if (!n.recordings.includes(recording)) n.recordings.push(recording);
    const st = n.states[0];
    if (st.evidence.length < MAX_EVIDENCE && !st.evidence.some((e) => e.recording === ev.recording)) st.evidence.push(ev);
    return n;
  }

  page(obs: PageObs, recording: string): PageNode {
    let best: PageEntry | undefined;
    let score = 0;
    let template: string | undefined;
    for (const p of this.pages) {
      const routeKnown = obs.route !== undefined && p.routes.size > 0;
      let s: number;
      if (routeKnown && !p.routes.has(obs.route!)) {
        // Another route can still be this page: the same template with another slug (/shop/lamps, /shop/desks), or
        // a redirect to the same screen (/ → /login).
        const alike = jaccard(obs.tokens, p.tokens);
        const slug = [...p.routes].map((r) => slugPattern(r, obs.route!)).find(Boolean);
        if (slug && alike >= 0.75) { s = 2.5; if (s > score) template = slug; }
        else if (alike >= 0.92 && (!obs.title || p.titles.has(obs.title))) s = 2.4;
        else continue;
      } else {
        // By structure alone, a page with another title must also read alike (the same labels: one project's page and
        // another's), or it's another page in the same layout (a docs site).
        const retitled = !!obs.title && p.titles.size > 0 && !p.titles.has(obs.title);
        s = routeKnown ? 3 : obs.title && p.titles.has(obs.title) ? 2
          : jaccard(obs.tokens, p.tokens) >= 0.8 && (!retitled || jaccard(obs.words, p.words) >= 0.3) ? 1 : 0;
        if (!s) continue;
      }
      if (s > score) { best = p; score = s; if (s !== 2.5) template = undefined; }
    }
    if (!best) {
      best = { node: { kind: 'page', id: `page-${this.pages.length + 1}`, label: '', titles: [], states: [{ id: 'base', label: 'Page', evidence: [] }], recordings: [] }, routes: new Set(), titles: new Set(), tokens: obs.tokens, words: obs.words };
      this.pages.push(best);
    }
    if (template) { best.template = template; best.routes.add(template); }
    if (obs.route) best.routes.add(obs.route);
    if (obs.title) best.titles.add(obs.title);
    const n = best.node;
    n.route = best.template ?? [...best.routes][0];
    n.titles = [...best.titles];
    if (!n.heading && obs.heading) n.heading = obs.heading;
    n.label = (n.titles.length === 1 ? n.titles[0] : n.route ?? n.titles[0]) || n.heading || 'Page';
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

  nodeById(id: string): MapNode | undefined {
    return this.pages.find((p) => p.node.id === id)?.node ?? [...this.overlays.values()].find((o) => o.id === id);
  }

  state(node: string, id: string, label: string, ev: Evidence, content?: { path: number[]; chrome: string[] }): void {
    const n = this.nodeById(node);
    if (!n) return;
    if (content) this.contents.set(ev, content);
    let s = n.states.find((x) => x.id === id);
    if (!s) n.states.push((s = { id, label, evidence: [] }));
    if (s.evidence.length < MAX_EVIDENCE && !s.evidence.some((e) => e.recording === ev.recording)) s.evidence.push(ev);
    else if (s.evidence.length < MAX_EVIDENCE) s.evidence.push(ev);
  }

  segue(kind: SegueKind, from: StateRef, to: StateRef, action: Segue['action'], trigger: { label: string; key: string }, point: { x: number; y: number }, ev: Evidence, via?: string) {
    this.segueObs.push({ kind, from, to, action, trigger, point, ev, via });
  }

  build(): AppMap {
    // Chrome counts once it's on two pages: then page frames show their content, and clicks in it leave from it.
    const shared = new Set(this.chromes.filter((c) => c.node.pages.length >= 2).map((c) => c.node.id));
    for (const [ev, c] of this.contents) {
      if (!ev.path && c.chrome.some((id) => shared.has(id))) { ev.path = c.path; ev.scope = 'content'; }
    }
    const segues = new Map<string, Segue>();
    for (const o of this.segueObs) {
      const from = o.via && shared.has(o.via) ? { node: o.via, state: 'base' } : o.from;
      const key = `${from.node}/${from.state}|${o.action}|${o.trigger.key}|${o.to.node}/${o.to.state}`;
      let s = segues.get(key);
      if (!s) {
        s = { id: `segue-${segues.size + 1}`, kind: o.kind, from, to: o.to, action: o.action, label: o.trigger.label, point: o.point, evidence: [] };
        segues.set(key, s);
      } else if (!s.label.split(', ').includes(o.trigger.label) && o.trigger.key.startsWith('item:')) {
        const seen = s.label.split(', ');
        s.label = seen.length >= 3 ? s.label : [...seen, o.trigger.label].join(', ');
      }
      if (s.evidence.length < MAX_EVIDENCE * 2) s.evidence.push(o.ev);
    }
    // A title every page has (an app that never changes it) doesn't name a page: its route does.
    const titled = new Map<string, number>();
    for (const p of this.pages) for (const t of p.titles) titled.set(t, (titled.get(t) ?? 0) + 1);
    for (const { node: n } of this.pages) {
      if (n.route && n.titles.length && n.titles.every((t) => (titled.get(t) ?? 0) > 1)) n.label = n.route;
    }
    return {
      pages: this.pages.map((p) => p.node),
      overlays: [...this.overlays.values()],
      chrome: this.chromes.filter((c) => shared.has(c.node.id)).map((c) => c.node),
      segues: [...segues.values()],
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
  /** The chrome the click landed in. */
  via?: string;
  /** When the page last changed after it (ms): its frame is drawn once that's done, not mid-render. */
  lastChange: number;
}

/** Attribute changes that only restyle a control under the pointer or focus: they don't make a new state. */
const NOISE_ATTR = /^(data-(hovered|pressed|focused|focus-visible|focus-within|active|hover|highlighted|state-hover)|aria-activedescendant|aria-describedby|tabindex|title)$/;
const NOISE_CLASS = /^(hover|hovered|focus|focused|focus-visible|active|pressed|is-hovered|is-focused|is-pressed)$/;

function noiseOnly(before: Record<string, string | undefined>, after: Record<string, unknown>): boolean {
  return Object.keys(after).every((name) => {
    if (NOISE_ATTR.test(name)) return true;
    if (name !== 'class') return false;
    const was = new Set((before.class ?? '').split(/\s+/).filter(Boolean));
    const now = new Set(String(after.class ?? '').split(/\s+/).filter(Boolean));
    return [...was, ...now].filter((c) => was.has(c) !== now.has(c)).every((c) => NOISE_CLASS.test(c));
  });
}

/** What a stretch of the page shows, as a hash: its elements (tag, classes and the attributes that change how they
 *  look or what they say), and its text, without the restyling of hover and focus. Two moments with the same
 *  fingerprint look the same. */
function fingerprint(vdom: VDom, root: VNode): string {
  const parts: string[] = [];
  const walk = (n: VNode) => {
    if (n.type === 3) { const t = n.text.trim(); if (t) parts.push(t); return; }
    if (!isElement(n) || SKIP_TAGS.includes(n.tag)) return;
    const cls = classes(n).filter((c) => !NOISE_CLASS.test(c)).sort().join('.');
    const attrs = Object.entries(n.attrs).filter(([k]) => k !== 'class' && k !== 'style' && !NOISE_ATTR.test(k) && !/^data-/.test(k)).map(([k, v]) => `${k}=${v}`).sort().join(',');
    parts.push(`<${n.tag}.${cls}[${attrs}]`);
    for (const c of n.children) walk(vdom.get(c)!);
    parts.push('>');
  };
  walk(root);
  return hash(parts.join('|'));
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
  /** When the page's state is a frame of one part: that part. A click outside it leaves from the page itself. */
  let part: number | null = null;
  let interactions = 0;
  let needEntry = false;

  const paths = (layers: OpenLayer[]) => layers.map((l) => vdom.path(l.node)).filter((p): p is number[] => !!p);
  /** The chrome on the page now, each registered with the page it's on. */
  const chromeNow = (pageId: string, time: number, found = chromeOf(vdom, new Set(open.map((l) => l.node)))) => found.flatMap(({ node, type, landmark }) => {
    const path = vdom.path(node.id);
    if (!path) return [];
    const label = clip(node.attrs['aria-label'] || CHROME_LABEL[type], 32);
    const place = landmark ? undefined : [node, ...vdom.ancestors(node.id)].filter(isElement).map(sig).reverse().join('>');
    const c = b.chrome(type, label, skeleton(vdom, node, new Set(), 5), pageId, rec.id, { recording: rec.id, time, path, scope: 'chrome' }, landmark ? undefined : wordsOf(vdom, node), place);
    return [{ id: c.id, node }];
  });
  /** The page without its chrome, kept with the evidence in case that chrome turns out to be shared. */
  const contentNow = (chrome: { id: string; node: VNode }[]) => {
    const content = contentOf(vdom, chrome.map((c) => c.node), new Set(open.map((l) => l.node)));
    const path = content && vdom.path(content.id);
    return path ? { path, chrome: chrome.map((c) => c.id) } : undefined;
  };
  const enterPage = (time: number) => {
    const body = vdom.body();
    if (!body) return;
    const skip = new Set(open.map((l) => l.node));
    // Pages are told apart by what's in them, not the shell every page shares.
    const found = chromeOf(vdom, skip);
    const shell = new Set([...skip, ...found.map((f) => f.node.id)]);
    const heading = vdom.find((e) => /^h[1-3]$/.test(e.tag) && !found.some((f) => vdom.within(e.id, f.node.id)) && !!vdom.textOf(e), body.id);
    const words = wordsOf(vdom, contentOf(vdom, found.map((f) => f.node), skip) ?? body);
    const node = b.page({ route, title: vdom.title(), tokens: skeleton(vdom, body, shell), words, heading: heading && clip(nameOf(vdom.textOf(heading)), 40) }, rec.id);
    page = { node: node.id, state: 'base' };
    part = null;
    b.state(node.id, 'base', 'Page', { recording: rec.id, time, hide: paths(open) }, contentNow(chromeNow(node.id, time, found)));
    b.remember(node.id, fingerprint(vdom, contentOf(vdom, found.map((f) => f.node), skip) ?? body), 'base');
    if (!b.entry) b.entry = { ...page };
  };

  const finalize = (p: Pending, next: number) => {
    // Drawn once the page has settled: after the last change it made (a reload rendering its content can take a few
    // seconds), at least SETTLE in, and before the next interaction.
    const settle = Math.max(p.t + 60, Math.min(next - 40, Math.max(p.t + SETTLE, p.lastChange + 150)));
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
      if (pageNow) b.segue('navigate', p.from, pageNow, p.action, p.trigger, p.point, segueEv, p.via);
      for (const l of open) {
        const n = vdom.get(l.node)!;
        const type = overlayType(vdom, n);
        const id = overlayIdentity(vdom, n, type);
        l.id = b.overlay(id.key, type, id.label, pageNow?.node ?? '', rec.id).id;
        b.state(l.id, 'open', 'Open', { recording: rec.id, time: settle, path: vdom.path(l.node) ?? undefined });
        b.segue('present', p.from, { node: l.id, state: 'open' }, p.action, p.trigger, p.point, segueEv, p.via);
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
      const label = clip(nameOf(addedText || textNow || '') || `After “${p.trigger.label}”`, 48);
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
      b.segue('present', p.from, { node: o.id, state: 'open' }, p.action, p.trigger, p.point, segueEv, p.via);
      still = [...still.filter((l) => l.id !== o.id), { id: o.id, state: 'open', node: f.node.id, reveal: f.reveal }];
      changed = true;
    }
    // Changes to the page itself.
    const closedNodes = new Set(closed.map((l) => l.node));
    const pageChanged =
      p.added.some((id) => vdom.attached(id) && !inLayer(id) && underBody(vdom, id)) ||
      p.removed.some((id, i) => !closedNodes.has(id) && !inLayer(p.removedFrom[i]) && underBody(vdom, p.removedFrom[i])) ||
      p.attrs.some((a) => vdom.attached(a.id) && !inLayer(a.id) && !closedNodes.has(a.id) && underBody(vdom, a.id) && !noiseOnly(a.before, a.after)) ||
      p.texts.some((id) => vdom.attached(id) && !inLayer(id) && underBody(vdom, id));
    open = still;
    if (page && pageChanged) {
      const state = `after:${p.trigger.key}`;
      // Just the part that changed when the change is in one place (a switch, a row); else the page.
      const onPage = (id: number) => vdom.attached(id) && !inLayer(id) && underBody(vdom, id);
      const touched = [
        ...p.added.filter(onPage), ...p.attrs.filter((a) => !noiseOnly(a.before, a.after)).map((a) => a.id).filter(onPage), ...p.texts.filter(onPage),
        ...p.removedFrom.filter((id, i) => onPage(id) && !closedNodes.has(p.removed[i])),
      ];
      const chrome = chromeNow(page.node, settle);
      // The control pressed restyles itself (a chip turns on); what it changed elsewhere (the table it filters) is the
      // part, unless that restyle is all there is (a switch).
      const control = [vdom.get(p.target), ...vdom.ancestors(p.target)].find((n) => n && (INTERACTIVE.has(n.tag) || INTERACTIVE_ROLES.has(n.attrs.role ?? '')));
      // And when content changed (rows came, text changed), restyles alone — the selection moving from one row of a
      // nav to another — don't widen the part.
      const restyled = new Set(p.attrs.map((a) => a.id));
      const content = touched.filter((id) => !restyled.has(id) || p.added.includes(id) || p.texts.includes(id));
      const shown = content.length ? content : touched;
      const elsewhere = control ? shown.filter((id) => !vdom.within(id, control.id)) : shown;
      const main = vdom.find((e) => e.tag === 'main' || e.attrs.role === 'main', vdom.body()?.id) ?? contentOf(vdom, chrome.map((c) => c.node), new Set(open.map((l) => l.node)));
      const changedPart = partOf(vdom, elsewhere.length ? elsewhere : shown, chrome.map((c) => c.node), main);
      const partPath = changedPart && vdom.path(changedPart.id);
      part = partPath ? changedPart!.id : null;
      // A whole-page state that looks like one the page already has (its first look included) is that state.
      const body = vdom.body()!;
      const fp = partPath ? '' : fingerprint(vdom, contentOf(vdom, chrome.map((c) => c.node), new Set(open.map((l) => l.node))) ?? body);
      const same = fp ? b.lookalike(page.node, fp) : undefined;
      const target = same ?? state;
      if (same) { /* nothing new to draw */ }
      else if (partPath) b.state(page.node, state, `After “${p.trigger.label}”`, { recording: rec.id, time: settle, path: partPath, scope: 'part' });
      else {
        b.state(page.node, state, `After “${p.trigger.label}”`, { recording: rec.id, time: settle, hide: paths(open) }, contentNow(chrome));
        b.remember(page.node, fp, state);
      }
      if (!(p.from.node === page.node && p.from.state === target)) b.segue('update', p.from, { node: page.node, state: target }, p.action, p.trigger, p.point, segueEv, p.via);
      page = { node: page.node, state: target };
      changed = true;
    }
    if (!changed && closed.length && page) b.segue('dismiss', p.from, page, p.action, p.trigger, p.point, segueEv, p.via);
  };

  for (const e of events) {
    const time = e.timestamp - t0;
    const data = (e.data ?? {}) as Record<string, unknown>;
    if (pending && time > pending.t + (pending.reload ? RELOAD_WINDOW : WINDOW)) {
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
      if (pending) { pending.reload = true; pending.lastChange = time; }
      else needEntry = true;
    } else if (e.type === 3) {
      const source = data.source as number;
      if (source === 0) {
        const m = data as unknown as MutationData;
        const before = m.attributes.map((a) => ({ id: a.id, before: { ...(vdom.get(a.id)?.attrs ?? {}) } as Record<string, string | undefined> }));
        const { added } = vdom.apply(m);
        if (pending) {
          pending.lastChange = time;
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
        const via = layer ? undefined : chromeNow((page as StateRef).node, time).find((c) => vdom.within(target, c.node.id))?.id;
        const anchor = [vdom.get(target), ...vdom.ancestors(target)].find((n) => n?.tag === 'a' && n.attrs.href);
        pending = {
          t: time,
          action: data.type === 3 ? 'contextmenu' : 'click',
          target,
          point: { x: Number(data.x ?? 0), y: Number(data.y ?? 0) },
          trigger: triggerOf(vdom, target),
          from: layer ? { node: layer.id, state: layer.state }
            : part !== null && !vdom.within(target, part) ? { node: (page as StateRef).node, state: 'base' }
              : { ...(page as StateRef) },
          title: vdom.title(),
          link: anchor?.attrs.href,
          reload: false,
          added: [], removedFrom: [], removed: [], attrs: [], texts: [],
          via,
          lastChange: time,
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
