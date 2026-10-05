/* Code: the storyboard as React. Each scene is a component file whose hooks are its definitions — useContext for
   the contexts it reads, useState, useMemo, useRef for its outlets, useEffect, useResponder — and whose JSX is its
   view tree on the kit's components, sized and styled with Tailwind classes, animated with framer-motion props.
   Actions become statements in its handlers; a segue's delegate becomes the callback the scene passes as it
   performs it. App.tsx registers the scenes and segues; contexts.tsx provides the contexts; storyboard.tsx is the
   small navigation and responder runtime they share. Expressions go in exactly as written. */
import { itemsOf, num, q, specOf, textClass, type CodeArgs } from './catalog';
import { codeOf } from './easing';
import { freeNames, refPath } from './expr';
import { cssColor, type Action, type Axis, type Doc, type Layout, type Motion, type MotionValue, type Node, type Scene, type Sizing, type Target } from './model';
import { outletsOf } from './ops';
import { appFontRules } from './render';
import { namesReadIn } from './inspect-scene';
import { allNodes, sceneActions } from './tree';

export interface CodeFile { path: string; code: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const setter = (name: string) => `set${cap(name)}`;
const indent = (s: string, n: number) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

/* ── Tailwind ── */

/** px as a Tailwind spacing step: 16 → 4, 6 → 1.5, 13 → [13px]. */
const step = (px: number) => (px % 2 === 0 ? String(px / 4) : `[${px}px]`);

function padClasses(p: Layout['padding']): string[] {
  if (p == null || p === 0) return [];
  if (!Array.isArray(p)) return [`p-${step(p)}`];
  const [t, r, b, l] = p;
  if (t === b && r === l) return [t === r ? `p-${step(t)}` : `px-${step(r)} py-${step(t)}`].filter((x) => !x.includes('-0 ') && x !== 'p-0');
  return [t ? `pt-${step(t)}` : '', r ? `pr-${step(r)}` : '', b ? `pb-${step(b)}` : '', l ? `pl-${step(l)}` : ''].filter(Boolean);
}

const ITEMS = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' } as const;
const JUSTIFY = { start: '', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around', evenly: 'justify-evenly' } as const;

function colorClass(prefix: 'bg' | 'text' | 'border', c: string | null | undefined): string {
  if (!c) return '';
  return c.startsWith('$') ? `${prefix}-${c.slice(1)}` : `${prefix}-[${c.replace(/\s+/g, '')}]`;
}

function sizeClasses(dim: 'w' | 'h', v: Sizing | undefined, parent: Axis): string[] {
  const main = (dim === 'w' && parent === 'horizontal') || (dim === 'h' && parent === 'vertical');
  if (typeof v === 'number') return [`${dim}-${step(v)}`, ...(main ? ['shrink-0'] : [])];
  if (v === 'fill') return parent === 'overlay' ? [dim === 'w' ? 'justify-self-stretch' : 'self-stretch'] : main ? ['flex-1', `min-${dim}-0`] : ['self-stretch'];
  return [];
}

/** The classes a node's box gets: its stack, its size in its parent, its style. */
export function classesOf(n: Node, parent: Axis): string {
  const spec = specOf(n.type);
  const L = n.layout ?? {}, S = n.style ?? {};
  const out: string[] = [];
  if (spec.container === 'frame') {
    const axis = L.axis ?? 'vertical';
    if (axis === 'overlay') out.push('grid', '[&>*]:[grid-area:1/1]', 'place-items-center');
    else {
      out.push('flex', axis === 'vertical' ? 'flex-col' : 'flex-row');
      if (L.gap) out.push(`gap-${step(L.gap)}`);
      out.push(ITEMS[L.align ?? 'start'], JUSTIFY[L.distribute ?? 'start']);
      if (L.wrap) out.push('flex-wrap');
    }
    out.push(...padClasses(L.padding));
    if (L.overflow === 'scroll') out.push(axis === 'horizontal' ? 'overflow-x-auto' : 'overflow-y-auto');
    else if (L.overflow === 'hidden') out.push('overflow-hidden');
  }
  out.push(...sizeClasses('w', L.width, parent), ...sizeClasses('h', L.height, parent));
  if (parent === 'overlay') out.push('[grid-area:1/1]');
  out.push(colorClass('bg', S.fill));
  if (S.radius) out.push(`rounded-[${S.radius}px]`);
  if (S.borderWidth) out.push(S.borderWidth === 1 ? 'border' : `border-[${S.borderWidth}px]`, colorClass('border', S.borderColor) || 'border-border');
  if (S.shadow && S.shadow !== 'none') out.push(`shadow-${S.shadow}`);
  if (S.opacity != null && S.opacity !== 1) out.push(`opacity-[${S.opacity}]`);
  return out.filter(Boolean).join(' ');
}

/* ── Motion ── */

const val = (v: MotionValue) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v));

function targetSrc(t: Target): string {
  return `{ ${Object.entries(t).map(([k, v]) => {
    if (k === 'blur') return `filter: ${Array.isArray(v) ? `[${(v as (number | string)[]).map((x) => `'blur(${x}px)'`).join(', ')}]` : `'blur(${v}px)'`}`;
    if (k === 'backgroundColor') return `backgroundColor: ${Array.isArray(v) ? `[${(v as string[]).map((x) => `'${cssColor(x)}'`).join(', ')}]` : `'${cssColor(String(v))}'`}`;
    return `${k}: ${val(v as MotionValue)}`;
  }).join(', ')} }`;
}

const withTransition = (t: Target, spec: Parameters<typeof codeOf>[0]) => `{ ...${targetSrc(t)}, transition: ${codeOf(spec)} }`.replace('{ ...{ ', '{ ').replace(' }, transition', ', transition');

/** framer-motion attributes for a node (appear as initial/animate; the rest as their props). */
function motionAttrs(n: Node): string[] {
  const m: Motion | undefined = n.motion;
  if (!m) return [];
  const out: string[] = [];
  if (m.appear) {
    const rest = Object.keys(m.appear.target).map((k) => `${k === 'blur' ? 'filter' : k}: ${k === 'opacity' ? n.style?.opacity ?? 1 : k === 'scale' ? 1 : k === 'blur' ? "'blur(0px)'" : k === 'borderRadius' ? n.style?.radius ?? 0 : k === 'backgroundColor' ? `'${cssColor(n.style?.fill) ?? 'transparent'}'` : 0}`);
    const from: Target = Object.fromEntries(Object.entries(m.appear.target).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
    out.push(`initial={${targetSrc(from)}}`);
    out.push(m.appear.trigger === 'inView' ? `whileInView={{ ${rest.join(', ')} }}` : `animate={{ ${rest.join(', ')} }}`);
    if (m.appear.trigger === 'inView') out.push(`viewport={{ once: ${m.appear.once} }}`);
    out.push(`transition={${codeOf(m.appear.transition)}}`);
  }
  if (m.variants && Object.keys(m.variants).length) {
    out.push(`variants={{ ${Object.entries(m.variants).map(([k, v]) => `${k}: ${withTransition(v.target, v.transition)}`).join(', ')} }}`);
    if (m.animate) out.push(`animate={${m.animate}}`);
  }
  if (m.hover) out.push(`whileHover={${withTransition(m.hover.target, m.hover.transition)}}`);
  if (m.press) out.push(`whileTap={${withTransition(m.press.target, m.press.transition)}}`);
  if (m.focus) out.push(`whileFocus={${withTransition(m.focus.target, m.focus.transition)}}`);
  if (m.exit) out.push(`exit={${withTransition(m.exit.target, m.exit.transition)}}`);
  if (m.drag) {
    out.push(m.drag.axis === 'both' ? 'drag' : `drag="${m.drag.axis}"`);
    if (m.drag.constraints === 'parent') out.push('dragConstraints={parentRef}');
    else if (m.drag.constraints && m.drag.constraints !== 'none') out.push(`dragConstraints={${m.drag.constraints}}`);
    out.push(`dragElastic={${m.drag.elastic}}`);
    if (m.drag.snapBack) out.push('dragSnapToOrigin');
    if (!m.drag.momentum) out.push('dragMomentum={false}');
    if (Object.keys(m.drag.target).length) out.push(`whileDrag={${targetSrc(m.drag.target)}}`);
  }
  if (m.layout) out.push('layout');
  if (m.layoutId) out.push(`layoutId={${m.layoutId}}`);
  if (m.stagger) out.push(`/* stagger: ${m.stagger.each}s each, after ${m.stagger.delay}s */`);
  return out;
}

/* ── Actions ── */

interface SceneCode {
  doc: Doc;
  scene: Scene;
  imports: Set<string>;
  framer: Set<string>;
  react: Set<string>;
  /** The Google Fonts families its text is set in (loaded when it mounts). */
  fonts: Set<string>;
  /** What it uses of the storyboard runtime (NavStack, SplitHost, useScreen…). */
  runtime: Set<string>;
  /** The scenes it shows as components. */
  scenes: Set<string>;
  /** Hooks its JSX needs (a TabView measuring its width). */
  hooks: string[];
  /** For unique names. */
  seq: number;
}

const sceneCode = (doc: Doc, scene: Scene): SceneCode => ({
  doc, scene, imports: new Set(), framer: new Set(), react: new Set(), fonts: new Set(), runtime: new Set(), scenes: new Set(), hooks: [], seq: 0,
});

function stmt(a: Action, c: SceneCode): string {
  const body = (() => {
    switch (a.do) {
      case 'segue': {
        const g = c.doc.segues.find((x) => x.id === a.segue);
        if (!g) return '/* missing segue */';
        const to = c.doc.scenes.find((s) => s.id === g.to);
        const args = Object.entries(g.args).map(([k, v]) => (k === v ? k : `${k}: ${v}`));
        for (const p of to?.props.filter((x) => x.callback) ?? []) {
          const list = g.delegates[p.name];
          if (list?.length) args.push(`${p.name}: (${(p.params ?? []).map((x) => `${x}: any`).join(', ')}) => {\n${indent(list.map((x) => stmt(x, c)).join('\n'), 2)}\n}`);
        }
        return `perform('${g.identifier}'${args.length ? `, { ${args.join(', ')} }` : ''});`;
      }
      case 'back': return 'dismiss();';
      case 'unwind': return `unwind('${c.doc.scenes.find((s) => s.id === a.scene)?.name ?? '?'}');`;
      case 'set': {
        const path = a.target.split('.');
        if (path.length > 1) return `${path[0]}.set({ ${path[1]}: ${a.value} });`;
        // A new value that reads the old one is a functional update, so quick repeats don't read stale state.
        return freeNames(a.value).has(a.target) ? `${setter(a.target)}((${a.target}) => ${a.value});` : `${setter(a.target)}(${a.value});`;
      }
      case 'animate': {
        c.framer.add('animate');
        const target = allNodes(c.scene.root).find((n) => n.ref === a.ref);
        const v = target?.motion?.variants?.[a.variant];
        return v ? `animate(${a.ref}.current!, ${targetSrc(v.target)}, ${codeOf(v.transition)});` : `/* ${a.ref} has no variant “${a.variant}” */`;
      }
      case 'focus': c.runtime.add('focus'); return `focus(${a.ref});`;
      case 'blur': return '(document.activeElement as HTMLElement | null)?.blur();';
      case 'send': c.runtime.add('sendAction'); return `sendAction('${a.command}');`;
      case 'call': return `${a.prop}?.(${a.args.join(', ')});`;
      case 'toast': c.imports.add('toast'); return `toast(${a.message});`;
    }
  })();
  return a.if ? `if (${a.if}) ${body}` : body;
}

/** Do the actions read `event` (the value their event sent)? */
const readsEvent = (list: Action[]) =>
  list.some((a) => [a.if, a.do === 'set' ? a.value : '', a.do === 'toast' ? a.message : '', ...(a.do === 'call' ? a.args : [])].some((s) => s && freeNames(s).has('event')));

const handler = (list: Action[], c: SceneCode, param = '') => {
  const lines = list.map((a) => stmt(a, c));
  const p = param || (readsEvent(list) ? 'event' : '');
  return lines.length === 1 && lines[0].length < 60 ? `(${p}) => ${lines[0].replace(/;$/, '')}` : `(${p}) => {\n${indent(lines.join('\n'), 2)}\n}`;
};

/** An event's handler: its actions, after writing a two-way binding back; `map` converts the value first (a Key to
    a string, a date to ISO). Null when nothing listens. */
function eventHandler(n: Node, c: SceneCode, ev: string, map?: (v: string) => string): string | null {
  const list = n.on?.[ev] ?? [];
  const two = specOf(n.type).props.find((ps) => ps.twoWay === ev && n.bind?.[ps.name]);
  const path = two ? refPath(n.bind![two.name]) : null;
  const value = map ? map('v') : 'v';
  const write = path ? (path.length > 1 ? `${path[0]}.set({ ${path[1]}: ${value} })` : `${setter(path[0])}(${value})`) : null;
  if (!list.length) return write ? `(v) => ${write}` : null;
  if (!write && !map) return handler(list, c);
  const lines = [write ? `${write};` : '', readsEvent(list) ? `const event = ${value};` : '', ...list.map((a) => stmt(a, c))].filter(Boolean);
  return `(v) => {\n${indent(lines.join('\n'), 2)}\n}`;
}

const eventAttr = (n: Node, c: SceneCode, ev: string, map?: (v: string) => string) => {
  const h = eventHandler(n, c, ev, map);
  return h ? ` ${ev}={${h}}` : '';
};

/** A literal as JS. */
const jsLiteral = (v: unknown) => (typeof v === 'string' ? q(v) : v == null ? 'null' : JSON.stringify(v));
/** Text as JSX children (in braces when it has JSX's own characters). */
const jsxText = (s: string) => (/[{}<>]/.test(s) ? `{${q(s)}}` : s);

/* ── JSX ── */

/** A prop's value as JSX: a bound expression, or its literal. */
function propSrc(n: Node, name: string, fallback: unknown): string | null {
  const b = n.bind?.[name];
  if (b) return `{${b}}`;
  const v = n.props[name] ?? fallback;
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return JSON.stringify(v);
  return `{${JSON.stringify(v)}}`;
}

function jsx(n: Node, parent: Axis, c: SceneCode, depth = 0): string {
  const spec = specOf(n.type);
  const axis = n.layout?.axis ?? 'vertical';
  const kids = (n.children ?? []).map((k) => jsx(k, axis, c, depth + 1));
  const cls = classesOf(n, parent);
  const motion = motionAttrs(n);
  const events: string[] = [];
  for (const [ev, list] of Object.entries(n.on ?? {})) if (list.length) events.push(`${ev}={${handler(list, c)}}`);
  // Two-way bindings: the value, and the change that writes it back.
  for (const ps of spec.props) {
    const b = n.bind?.[ps.name];
    const path = b && ps.twoWay ? refPath(b) : null;
    if (path && !n.on?.[ps.twoWay!]?.length) events.push(`${ps.twoWay}={${path.length > 1 ? `(v) => ${path[0]}.set({ ${path[1]}: v })` : setter(path[0])}}`);
  }
  const ref = n.ref ? [`ref={${n.ref}}`] : [];

  let el: string;
  if (n.type === 'SceneRef') el = sceneRefJsx(n, c);
  else if (n.type === 'NavigationStack') el = navStackJsx(n, c, depth);
  else if (n.type === 'TabView') el = tabViewJsx(n, c);
  else if (n.type === 'SplitView') el = splitViewJsx(n, c, depth);
  else if (spec.container === 'frame' || n.type === 'Spacer') {
    const tag = motion.length ? 'motion.div' : 'div';
    if (motion.length) c.framer.add('motion');
    const attrs = [cls ? `className="${cls}"` : '', ...ref, ...motion, ...events].filter(Boolean);
    el = kids.length ? `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>\n${indent(kids.join('\n'), 2)}\n</${tag}>` : `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''} />`;
    if (n.type === 'Provider') {
      const ctx = c.doc.contexts.find((x) => x.id === n.props.context);
      if (ctx) {
        const over = ctx.fields.filter((f) => n.bind?.[f.name]).map((f) => `${f.name}: ${n.bind![f.name]}`);
        c.imports.add(`ctx:${ctx.name}`);
        el = `<${ctx.name}.Provider value={{ ...${ctx.alias}${over.length ? `, ${over.join(', ')}` : ''} }}>\n${indent(el, 2)}\n</${ctx.name}.Provider>`;
      }
    }
  } else {
    el = leaf(n, kids, c, events);
    // A box for what a component can't carry itself: size, style, motion, and the outlet (a ref on a box is what
    // focus and animate reach for).
    if (motion.length || cls || ref.length) {
      if (motion.length) c.framer.add('motion');
      const tag = motion.length ? 'motion.div' : 'div';
      el = `<${tag}${cls ? ` className="${cls}"` : ''}${ref.length ? ` ${ref[0]}` : ''}${motion.length ? ` ${motion.join(' ')}` : ''}>\n${indent(el, 2)}\n</${tag}>`;
    }
  }
  if (n.when) {
    const presence = !!n.motion?.exit;
    if (presence) c.framer.add('AnimatePresence');
    el = presence ? `<AnimatePresence>\n  {${n.when} && (\n${indent(el, 4)}\n  )}\n</AnimatePresence>` : `{${n.when} && (\n${indent(el, 2)}\n)}`;
  }
  if (n.repeat) {
    const as = n.repeat.as || 'item';
    const keyed = el.replace(/^<([\w.]+)/, `<$1 key={${n.repeat.key || 'index'}}`);
    el = `{${n.repeat.each}.map((${as}, index) => (\n${indent(keyed, 2)}\n))}`;
  }
  if (n.responds && Object.keys(n.responds).length) {
    c.imports.add('ResponderScope');
    const handles = Object.entries(n.responds).map(([cmd, list]) => `${cmd}: ${handler(list, c)}`).join(', ');
    el = `<ResponderScope handles={{ ${handles} }}>\n${indent(el, 2)}\n</ResponderScope>`;
  }
  return el;
}

/* ── The kit's containers, hosting scenes ── */

/** An embedded scene: its component, its props from bindings here, its callback props from actions here. */
function sceneRefJsx(n: Node, c: SceneCode): string {
  const target = c.doc.scenes.find((s) => s.id === n.props.scene);
  if (!target) return '<div /* an embedded scene that shows nothing yet */ />';
  c.scenes.add(target.name);
  const attrs: string[] = [];
  for (const p of target.props) {
    if (p.callback) {
      const list = n.on?.[p.name];
      if (list?.length) attrs.push(`${p.name}={${handler(list, c, (p.params ?? []).join(', '))}}`);
    } else if (n.bind?.[p.name]) attrs.push(`${p.name}={${n.bind[p.name]}}`);
  }
  return `<${target.name}${attrs.length ? ` ${attrs.join(' ')}` : ''} />`;
}

/** Several elements as one (a fragment when there are several). */
const one = (els: string[]) => (els.length === 1 ? els[0] : `<>\n${indent(els.join('\n'), 2)}\n</>`);

/** A NavigationStack: the storyboard runtime's NavStack, whose root page is the embedded scene (or the stack's own
    content, with the bar its props give it); push segues from inside push onto it. */
function navStackJsx(n: Node, c: SceneCode, depth: number): string {
  c.runtime.add('NavStack');
  const child = n.children?.[0];
  if (child?.type === 'SceneRef') return `<NavStack root={${sceneRefJsx(child, c)}} />`;
  const kids = (n.children ?? []).map((k) => jsx(k, n.layout?.axis ?? 'vertical', c, depth + 1));
  const cls = classesOf({ ...n, type: 'Stack', layout: { ...n.layout, height: undefined, width: undefined } }, 'vertical');
  const bar = [
    `title=${JSON.stringify(String(n.props.title ?? 'Title'))}`,
    n.props.largeTitle === false ? 'largeTitle={false}' : 'largeTitle',
    n.props.grouped ? 'grouped' : '',
    num(n.props.maxWidth, 720) ? `maxW={${num(n.props.maxWidth, 720)}}` : '',
  ].filter(Boolean);
  const content = `<div className="${cls}">\n${indent(kids.join('\n'), 2)}\n</div>`;
  return `<NavStack\n  ${bar.join('\n  ')}\n  root={\n${indent(content, 4)}\n  }\n/>`;
}

/** A TabView: the kit's, a tab per child; `auto` placement measures its own width (a tab bar when narrow, a side
    rail when wide). */
function tabViewJsx(n: Node, c: SceneCode): string {
  for (const part of ['TabView', 'TabViewBar', 'TabViewList', 'TabViewTab', 'TabViewPanels', 'TabViewPanel']) c.imports.add(`@/components/ui/tab-view|${part}`);
  const tabs = itemsOf(n.props.tabs);
  const asked = ['bottom', 'start', 'top'].find((x) => x === n.props.placement);
  let placement = `"${asked}"`;
  let box = '';
  if (!asked) {
    const i = ++c.seq;
    c.imports.add('@/lib/container|useContainerWidth');
    c.hooks.push(`// A tab bar when narrow, a side rail when wide.\nconst [tabBox${i}, tabWidth${i}] = useContainerWidth<HTMLDivElement>();`);
    placement = `{tabWidth${i} >= 700 ? 'start' : 'bottom'}`;
    box = `tabBox${i}`;
  }
  const bound = n.bind?.selectedKey;
  const selection = bound ? `selectedKey={${bound}}` : `defaultSelectedKey=${JSON.stringify(String(n.props.selectedKey ?? tabs[0]?.id ?? ''))}`;
  const change = eventAttr(n, c, 'onSelectionChange', (v) => `String(${v})`);
  const panels = tabs.map((t, i) => {
    const child = n.children?.[i];
    const content = child ? jsx(child, 'vertical', c) : `<div /* drop a scene here for ${t.label} */ />`;
    return `<TabViewPanel id=${JSON.stringify(t.id)} shouldForceMount className="overflow-hidden">\n${indent(content, 2)}\n</TabViewPanel>`;
  });
  const view = `<TabView placement=${placement} ${selection}${change} className="relative size-full">
  <TabViewBar>
    <TabViewList aria-label="Tabs">
${indent(tabs.map((t) => `<TabViewTab id=${JSON.stringify(t.id)} icon=${JSON.stringify(t.icon ?? 'circle')} title=${JSON.stringify(t.label)} />`).join('\n'), 6)}
    </TabViewList>
  </TabViewBar>
  <TabViewPanels>
${indent(panels.join('\n'), 4)}
  </TabViewPanels>
</TabView>`;
  return box ? `<div ref={${box}} className="relative size-full">\n${indent(view, 2)}\n</div>` : view;
}

/** A SplitView: the storyboard runtime's SplitHost over the kit's, a column per slot; a Show Detail segue from a
    column puts its scene in the detail column. */
function splitViewJsx(n: Node, c: SceneCode, depth: number): string {
  c.runtime.add('SplitHost');
  const col = (k: 'sidebar' | 'supplementary' | 'detail') => {
    const list = (n.slots?.[k] ?? []).map((x) => jsx(x, 'vertical', c, depth + 1));
    return list.length ? `${k}={\n${indent(one(list), 4)}\n  }` : '';
  };
  const cols = [col('sidebar'), col('supplementary'), col('detail')].filter(Boolean);
  return cols.length ? `<SplitHost\n  ${cols.join('\n  ')}\n/>` : '<SplitHost />';
}

/** A Screen root: its content, laid out by its stack (the NavigationStack it's in draws its bar from useScreen). */
function screenContent(root: Node, c: SceneCode): string {
  return jsx({ ...root, type: 'Stack', slots: undefined, layout: { ...root.layout, width: 'fill', height: undefined, overflow: undefined } }, 'vertical', c);
}

/** A Screen root's bar, for useScreen: its title, large title, grouped background, readable width and bar items. */
function screenBar(root: Node, c: SceneCode): string {
  const slot = (k: 'leading' | 'trailing') => {
    const list = (root.slots?.[k] ?? []).map((x) => jsx(x, 'horizontal', c));
    return list.length ? `${k}: (\n${indent(one(list), 2)}\n)` : '';
  };
  const maxW = num(root.props.maxWidth, 720);
  return [
    `title: ${root.bind?.title ?? JSON.stringify(String(root.props.title ?? ''))}`,
    `largeTitle: ${root.props.largeTitle !== false}`,
    root.props.grouped ? 'grouped: true' : '',
    maxW ? `maxW: ${maxW}` : '',
    slot('leading'),
    slot('trailing'),
  ].filter(Boolean).join(',\n');
}

/** A catalog component as JSX. */
function leaf(n: Node, kids: string[], c: SceneCode, events: string[]): string {
  const spec = specOf(n.type);
  const lit = (name: string) => n.props[name] ?? spec.props.find((x) => x.name === name)?.default;
  if (spec.code) {
    const g: CodeArgs = {
      expr: (name) => n.bind?.[name] ?? jsLiteral(lit(name)),
      attr: (name, as = name) => {
        const b = n.bind?.[name];
        if (b) return ` ${as}={${b}}`;
        const v = lit(name);
        if (v == null || v === '' || v === false || v === spec.props.find((x) => x.name === name)?.default) return '';
        return v === true ? ` ${as}` : typeof v === 'string' ? ` ${as}=${JSON.stringify(v)}` : ` ${as}={${JSON.stringify(v)}}`;
      },
      list: (name) => (n.bind?.[name] ? null : itemsOf(lit(name))),
      on: (ev, map) => eventAttr(n, c, ev, map),
      // A part calls it with the value, so it always takes one.
      handler: (ev, map) => eventHandler(n, c, ev, map ?? ((v) => v)),
      use: (module, name) => { c.imports.add(`${module}|${name}`); },
      children: kids,
      text: (name) => {
        const b = n.bind?.[name];
        if (b) return `{${b}}`;
        const v = lit(name);
        return v == null || v === '' ? '' : jsxText(String(v));
      },
    };
    return spec.code(g);
  }
  if (spec.module) c.imports.add(`${spec.module}|${spec.tag}`);
  const p = (name: string) => propSrc(n, name, spec.props.find((x) => x.name === name)?.default);
  const children = (text: string | null) => (text ? (text.startsWith('{') ? text : text.slice(1, -1)) : '');
  switch (n.type) {
    case 'Text': {
      const P = n.props;
      const lines = num(P.lines), size = num(P.size), tracking = num(P.tracking), leading = num(P.leading);
      const cls = [
        textClass(P.textStyle, P.weight, P.align), P.italic ? 'italic' : '', colorClass('text', P.color as string | null),
        ['uppercase', 'lowercase', 'capitalize'].includes(String(P.transform)) ? String(P.transform) : '',
        P.decoration === 'underline' ? 'underline' : P.decoration === 'line-through' ? 'line-through' : '',
        lines > 0 ? `line-clamp-${lines}` : '', 'whitespace-pre-wrap',
      ].filter(Boolean).join(' ');
      // What the classes can't say: a Google Fonts family, a size, spacing and line height of its own.
      const style: string[] = [];
      const font = typeof P.font === 'string' && P.font.trim() ? P.font.trim() : null;
      if (font) { c.fonts.add(font); c.imports.add('@/lib/google-fonts|fontStack'); style.push(`fontFamily: fontStack(${JSON.stringify(font)})`); }
      if (size > 0) style.push(`fontSize: ${size}`);
      if (leading > 0 || size > 0) style.push(`lineHeight: ${leading > 0 ? leading : 1.2}`);
      if (tracking) style.push(`letterSpacing: '${tracking / 100}em'`);
      const text = children(p('children'));
      return `<p className="${cls}"${style.length ? ` style={{ ${style.join(', ')} }}` : ''}>${text}</p>`;
    }
    case 'Image': {
      if (n.props.src) return `<img src=${p('src')} alt=${p('alt') ?? '""'} className="size-full rounded-[inherit] object-cover" />`;
      const emoji = children(p('emoji'));
      return `<div role="img" aria-label=${p('alt') ?? JSON.stringify(String(n.props.emoji ?? ''))} className="grid size-full place-items-center rounded-[inherit] text-[48cqmin] [container-type:size]" style={{ background: 'linear-gradient(135deg, ${cssColor(String(n.props.from))}, ${cssColor(String(n.props.to))})' }}>${emoji}</div>`;
    }
    case 'Icon': return `<Icon name=${p('name')} size=${p('size')} sw=${p('sw')}${n.props.color ? ` className="${colorClass('text', n.props.color as string)}"` : ''} />`;
    case 'ListRow': {
      const leading = (n.slots?.leading ?? []).map((x) => jsx(x, 'horizontal', c)).join('\n');
      const attrs = ['title', 'subtitle', 'trailing'].map((k) => [k, p(k)] as const).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`);
      if (n.props.accessory && n.props.accessory !== 'none') attrs.push(`accessory="${n.props.accessory}"`);
      if (leading) attrs.push(`leading={\n${indent(leading, 4)}\n  }`);
      return `<ListRow\n${indent([...attrs, ...events].join('\n'), 2)}\n/>`;
    }
    default: {
      const attrs: string[] = [];
      let text = '';
      for (const ps of spec.props) {
        if (ps.part) continue;
        const v = p(ps.name);
        if (v == null || v === '{false}' || (v === JSON.stringify(ps.default) && !n.bind?.[ps.name])) continue;
        if (ps.name === 'children') text = children(v);
        else attrs.push(`${ps.name}=${v}`);
      }
      if (n.type === 'Button' && n.props.icon) { c.imports.add('@/lib/icon|Icon'); text = `<Icon name=${p('icon')} />${text ? ` ${text}` : ''}`; }
      const all = [...attrs, ...events];
      const inner = text || (kids.length ? `\n${indent(kids.join('\n'), 2)}\n` : '');
      const open = `<${spec.tag}${all.length ? ` ${all.join(' ')}` : ''}`;
      return inner ? `${open}>${inner}</${spec.tag}>` : `${open} />`;
    }
  }
}

/* ── Files ── */

function sceneFile(doc: Doc, scene: Scene): string {
  const c = sceneCode(doc, scene);
  const screen = scene.root.type === 'Screen';
  const body = screen ? screenContent(scene.root, c) : jsx(scene.root, 'vertical', c);
  const bar = screen ? screenBar(scene.root, c) : '';
  const read = namesReadIn(scene);
  const contexts = doc.contexts.filter((x) => read.has(x.alias));
  const outlets = outletsOf(scene);
  const nav = doc.segues.some((g) => g.from === scene.id || g.to === scene.id) || sceneActions(scene).some((a) => a.do === 'segue' || a.do === 'back' || a.do === 'unwind');
  const hooks: string[] = [];
  contexts.forEach((x) => { c.react.add('useContext'); hooks.push(`const ${x.alias} = useContext(${x.name});`); });
  scene.state.forEach((s) => { c.react.add('useState'); hooks.push(`const [${s.name}, ${setter(s.name)}] = useState(${s.initial.includes('\n') ? `${s.initial.trim()}` : s.initial});`); });
  scene.memos.forEach((m) => { c.react.add('useMemo'); hooks.push(`const ${m.name} = useMemo(() => ${m.expr}, [${[...freeNames(m.expr).keys()].join(', ')}]);`); });
  outlets.forEach((o) => { c.react.add('useRef'); hooks.push(`const ${o} = useRef<HTMLDivElement>(null);`); });
  if (body.includes('parentRef')) { c.react.add('useRef'); hooks.push('const parentRef = useRef<HTMLDivElement>(null);'); }
  if (nav) { c.runtime.add('useStoryboard'); hooks.push('const { perform, dismiss, unwind, canGoBack } = useStoryboard();'); }
  hooks.push(...c.hooks);
  if (c.fonts.size) {
    c.imports.add('@/lib/google-fonts|useGoogleFont');
    hooks.push(`// Its Google Fonts families, from the CDN.\n${[...c.fonts].map((f) => `useGoogleFont(${JSON.stringify(f)});`).join('\n')}`);
  }
  const auto = allNodes(scene.root).filter((n) => n.autoFocus && n.ref);
  if (auto.length) { c.react.add('useEffect'); c.runtime.add('focus'); hooks.push(`// First responder when the scene appears.\nuseEffect(() => focus(${auto[0].ref}), []);`); }
  for (const e of scene.effects) {
    c.react.add('useEffect');
    const run = e.actions.map((a) => stmt(a, c)).join('\n');
    hooks.push(e.on === 'disappear' ? `useEffect(() => () => {\n${indent(run, 2)}\n}, []);` : `useEffect(() => {\n${indent(run, 2)}\n}, [${e.on === 'change' ? e.deps.join(', ') : ''}]);`);
  }
  for (const [cmd, list] of Object.entries(scene.responds ?? {})) { c.runtime.add('useResponder'); hooks.push(`useResponder('${cmd}', ${handler(list, c)});`); }
  // Its bar, in the NavigationStack it's shown in (it follows the scene's state).
  if (bar) { c.runtime.add('useScreen'); hooks.push(`useScreen({\n${indent(bar, 2)}\n});`); }

  const props = scene.props;
  const propsType = props.length
    ? `export interface ${scene.name}Props {\n${props.map((p) => `  ${p.name}?: ${p.callback ? `(${(p.params ?? []).map((x) => `${x}: any`).join(', ')}) => void` : p.type === 'list' ? 'any[]' : p.type === 'object' ? 'Record<string, any>' : p.type};`).join('\n')}\n}\n\n`
    : '';
  const destructure = props.length ? `{ ${props.map((p) => (p.callback ? p.name : `${p.name} = ${p.default}`)).join(', ')} }: ${scene.name}Props` : '';

  // Imports.
  const lines: string[] = ["'use client';"];
  if (c.react.size) lines.push(`import { ${[...c.react].sort().join(', ')} } from 'react';`);
  if (c.framer.size) lines.push(`import { ${[...c.framer].sort().join(', ')} } from 'framer-motion';`);
  const byModule = new Map<string, Set<string>>();
  for (const i of c.imports) if (i.includes('|')) { const [mod, name] = i.split('|'); byModule.set(mod, (byModule.get(mod) ?? new Set()).add(name)); }
  for (const [mod, names] of [...byModule].sort()) lines.push(`import { ${[...names].sort().join(', ')} } from '${mod}';`);
  if (c.imports.has('toast')) lines.push("import { toast } from '@/components/ui/toast';");
  const ctxImports = [...new Set([...contexts.map((x) => x.name), ...[...c.imports].filter((i) => i.startsWith('ctx:')).map((i) => i.slice(4))])];
  if (ctxImports.length) lines.push(`import { ${ctxImports.join(', ')} } from '../contexts';`);
  if (c.imports.has('ResponderScope')) c.runtime.add('ResponderScope');
  if (c.runtime.size) lines.push(`import { ${[...c.runtime].sort().join(', ')} } from '../storyboard';`);
  for (const name of [...c.scenes].filter((x) => x !== scene.name).sort()) lines.push(`import { ${name} } from './${name}';`);

  return `${lines.join('\n')}\n\n${propsType}export function ${scene.name}(${destructure}) {\n${indent(hooks.join('\n'), 2)}${hooks.length ? '\n\n' : ''}  return (\n${indent(body, 4)}\n  );\n}\n`;
}

function contextsFile(doc: Doc): string {
  if (!doc.contexts.length) return "'use client';\nimport type { ReactNode } from 'react';\n\n/** No contexts yet: add one in the outline. */\nexport function AppProviders({ children }: { children: ReactNode }) {\n  return <>{children}</>;\n}\n";
  const blocks = doc.contexts.map((x) => {
    const init = `{ ${x.fields.map((f) => `${f.name}: ${f.initial}`).join(', ')} }`;
    return `const ${x.alias}Initial = ${init};\nexport const ${x.name} = createContext({ ...${x.alias}Initial, set: (_: Partial<typeof ${x.alias}Initial>) => {} });`;
  });
  const states = doc.contexts.map((x) => `  const [${x.alias}, set${cap(x.alias)}] = useState(${x.alias}Initial);`);
  let tree = '{children}';
  for (const x of [...doc.contexts].reverse()) {
    tree = `<${x.name}.Provider value={{ ...${x.alias}, set: (patch) => set${cap(x.alias)}((v) => ({ ...v, ...patch })) }}>\n${indent(tree, 2)}\n</${x.name}.Provider>`;
  }
  return `'use client';\nimport { createContext, useState, type ReactNode } from 'react';\n\n${blocks.join('\n\n')}\n\n/** Every context, with its value in state: a Set action on a field updates it for the whole app. */\nexport function AppProviders({ children }: { children: ReactNode }) {\n${states.join('\n')}\n  return (\n${indent(tree, 4)}\n  );\n}\n`;
}

function appFile(doc: Doc): string {
  const entry = doc.scenes.find((s) => s.id === doc.entry);
  const segues = doc.segues.map((g) => {
    const to = doc.scenes.find((s) => s.id === g.to)?.name;
    return `  ${g.identifier}: { to: '${to}', kind: '${g.kind}', transition: ${codeOf(g.transition)} },`;
  });
  // The app's fonts, on the kit's font-sans and font-mono (which carry their stacks as literals, so the families
  // are set on them, and on what inherits, by a rule of the app's own).
  const sans = doc.fonts?.sans ?? [], mono = doc.fonts?.mono ?? [];
  const rules = appFontRules(':root', doc.fonts);
  const fontImports = rules ? `import { useGoogleFont } from '@/lib/google-fonts';\n` : '';
  const fontHook = rules ? `  useGoogleFont(${JSON.stringify([...sans, ...mono])});\n` : '';
  const providers = `<StoryboardProvider scenes={scenes} segues={segues} initial="${entry?.name}" />`;
  const tree = rules ? `<>\n        <style>{${JSON.stringify(rules)}}</style>\n        ${providers}\n      </>` : providers;
  return `'use client';\n${fontImports}import { AppProviders } from './contexts';\nimport { StoryboardProvider } from './storyboard';\n${doc.scenes.map((s) => `import { ${s.name} } from './scenes/${s.name}';`).join('\n')}\n\nconst scenes = { ${doc.scenes.map((s) => s.name).join(', ')} };\n\nconst segues = {\n${segues.join('\n')}\n} as const;\n\nexport default function App() {\n${fontHook}  return (\n    <AppProviders>\n      ${tree}\n    </AppProviders>\n  );\n}\n`;
}

/** The navigation and responder runtime the generated scenes import. */
const RUNTIME = `'use client';
/* A small storyboard runtime over the kit's containers. A segue presents its scene the way its kind says: a push on
   the NavigationStack the scene is in (NavStack), a Show Detail in the SplitView's detail column (SplitHost), and a
   modal, a fade, Magic Motion or a replace over the whole app (StoryboardProvider, on framer-motion). A Screen scene
   describes its bar with useScreen; commands sent to the first responder go up a responder chain. */
import {
  createContext, memo, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ComponentType, type ReactElement, type ReactNode, type RefObject,
} from 'react';
import { AnimatePresence, LayoutGroup, motion, type TargetAndTransition, type Transition } from 'framer-motion';
import { NavigationStack, type Screen } from '@/components/ui/navigation-stack';
import { SplitView, SplitViewDetail, SplitViewSidebar, SplitViewSupplementary, useSplitView } from '@/components/ui/split-view';

type Kind = 'push' | 'detail' | 'modal' | 'fade' | 'magic' | 'replace';
type SegueTable = Record<string, { to: string; kind: Kind; transition: Transition }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Scenes = Record<string, ComponentType<any>>;
type Frame = { key: number; name: string; props: object; kind: Kind; transition: Transition };

let seq = 0;

/* ── The app: scenes presented over it ── */

interface App {
  scenes: Scenes;
  segues: SegueTable;
  present: (frame: Omit<Frame, 'key'>) => void;
  dismiss: () => void;
  unwind: (name: string) => void;
}
const AppCtx = createContext<App | null>(null);
/** How many frames deep a scene is presented (the entry is 0). */
const DepthCtx = createContext(0);

const enter: Record<Kind, TargetAndTransition> = { push: { x: '100%' }, detail: { x: '100%' }, modal: { y: '100%' }, fade: { opacity: 0 }, magic: { opacity: 0 }, replace: { opacity: 1 } };

export function StoryboardProvider({ scenes, segues, initial }: { scenes: Scenes; segues: SegueTable; initial: string }) {
  const [frames, setFrames] = useState<Frame[]>(() => [{ key: seq++, name: initial, props: {}, kind: 'replace', transition: { duration: 0 } }]);
  const app = useMemo<App>(() => ({
    scenes, segues,
    present: (f) => setFrames((st) => (f.kind === 'replace' ? [{ ...f, key: seq++ }] : [...st, { ...f, key: seq++ }])),
    dismiss: () => setFrames((st) => (st.length > 1 ? st.slice(0, -1) : st)),
    unwind: (name) => setFrames((st) => { const i = st.map((f) => f.name).lastIndexOf(name); return i >= 0 ? st.slice(0, i + 1) : st; }),
  }), [scenes, segues]);
  return (
    <AppCtx.Provider value={app}>
      <LayoutGroup>
        <div className="relative h-full w-full overflow-hidden">
          <AnimatePresence initial={false}>
            {frames.map((f, i) => {
              const Scene = scenes[f.name];
              const top = i === frames.length - 1;
              const next = frames[i + 1];
              return (
                <motion.div key={f.key} className="absolute inset-0 overflow-hidden bg-background" style={{ zIndex: i }}
                  initial={enter[f.kind]} animate={top ? { x: 0, y: 0, opacity: 1, scale: 1 } : next?.kind === 'modal' ? { scale: 0.94 } : { opacity: 0 }}
                  exit={enter[f.kind]} transition={(top ? f : next ?? f).transition}>
                  <DepthCtx.Provider value={i}>
                    <Scene {...f.props} />
                  </DepthCtx.Provider>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </AppCtx.Provider>
  );
}

/* ── Navigation stacks ── */

/** What a Screen tells the stack it's in: its title, large title, grouped background, width and bar items. */
export type ScreenBar = Omit<Screen, 'key' | 'content'>;
interface Stack { push: (el: ReactElement) => void; pop: () => boolean; depth: number }
const StackCtx = createContext<Stack | null>(null);
const BarCtx = createContext<((bar: ScreenBar) => void) | null>(null);

/** The kit's NavigationStack with scenes for pages: \`root\` first, then what push segues push. */
export function NavStack({ root, ...rootBar }: { root: ReactElement } & ScreenBar) {
  const [pages, setPages] = useState<{ key: string; el: ReactElement }[]>([]);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const [bars, setBars] = useState<Record<string, ScreenBar>>({});
  const setBar = useCallback((key: string, bar: ScreenBar) => setBars((b) => ({ ...b, [key]: bar })), []);
  const push = useCallback((el: ReactElement) => setPages((p) => [...p, { key: String(++seq), el }]), []);
  const pop = useCallback(() => {
    if (!pagesRef.current.length) return false;
    setPages((p) => p.slice(0, -1));
    return true;
  }, []);
  const all = [{ key: 'root', el: root }, ...pages];
  return (
    <NavigationStack
      screens={all.map((p, i) => ({ ...(i === 0 ? rootBar : null), ...bars[p.key], key: p.key, content: <Page id={p.key} el={p.el} depth={i} setBar={setBar} push={push} pop={pop} /> }))}
      onPop={pop}
    />
  );
}

/** A page: re-rendered by its own scene, not by the stack (so a bar update doesn't come back around). */
const Page = memo(function Page({ id, el, depth, setBar, push, pop }: {
  id: string; el: ReactElement; depth: number; setBar: (key: string, bar: ScreenBar) => void; push: Stack['push']; pop: Stack['pop'];
}) {
  const bar = useCallback((b: ScreenBar) => setBar(id, b), [id, setBar]);
  const stack = useMemo(() => ({ push, pop, depth }), [push, pop, depth]);
  return <StackCtx.Provider value={stack}><BarCtx.Provider value={bar}>{el}</BarCtx.Provider></StackCtx.Provider>;
});

/** A Screen scene's bar in the NavigationStack it's shown in, kept up to date with its state. */
export function useScreen(bar: ScreenBar) {
  const set = use(BarCtx);
  useLayoutEffect(() => { set?.(bar); });
}

/* ── Split views ── */

const SplitCtx = createContext<{ show: (el: ReactElement) => void } | null>(null);

/** The kit's SplitView, a column per part; a Show Detail segue from a column shows its scene in the detail column
    (in a NavigationStack, so a Screen has its bar) and, collapsed, goes to it. */
export function SplitHost({ sidebar, supplementary, detail }: { sidebar?: ReactNode; supplementary?: ReactNode; detail?: ReactNode }) {
  const [shown, setShown] = useState<{ key: number; el: ReactElement } | null>(null);
  const show = useCallback((el: ReactElement) => setShown({ key: ++seq, el }), []);
  return (
    <SplitView aria-label="Split view" className="size-full">
      {sidebar ? <SplitViewSidebar aria-label="Sidebar"><Column column="sidebar" show={show}>{sidebar}</Column></SplitViewSidebar> : null}
      {supplementary ? <SplitViewSupplementary aria-label="Supplementary"><Column column="supplementary" show={show}>{supplementary}</Column></SplitViewSupplementary> : null}
      <SplitViewDetail aria-label="Detail">{shown ? <NavStack key={shown.key} root={shown.el} /> : detail}</SplitViewDetail>
    </SplitView>
  );
}

function Column({ column, show, children }: { column: 'sidebar' | 'supplementary'; show: (el: ReactElement) => void; children: ReactNode }) {
  const split = useSplitView();
  const value = useMemo(() => ({ show: (el: ReactElement) => { show(el); split.select(column, String(seq)); } }), [show, split, column]);
  return <SplitCtx.Provider value={value}>{children}</SplitCtx.Provider>;
}

/* ── Segues ── */

/** Perform a segue by its identifier (its scene's props and delegate callbacks in \`props\`), go back, unwind. */
export function useStoryboard() {
  const app = use(AppCtx);
  const stack = use(StackCtx);
  const split = use(SplitCtx);
  const depth = use(DepthCtx);
  if (!app) throw new Error('useStoryboard must be used inside <StoryboardProvider>');
  return {
    perform: (id: string, props: object = {}) => {
      const s = app.segues[id];
      const Scene = app.scenes[s.to];
      if (s.kind === 'detail' && split) split.show(<Scene {...props} />);
      else if ((s.kind === 'push' || s.kind === 'detail') && stack) stack.push(<Scene {...props} />);
      else app.present({ name: s.to, props, kind: s.kind, transition: s.transition });
    },
    dismiss: () => { if (!stack?.pop()) app.dismiss(); },
    unwind: (name: string) => app.unwind(name),
    canGoBack: (stack?.depth ?? 0) > 0 || depth > 0,
  };
}

/** Focuses an outlet: the first field or control inside it (it becomes the first responder). */
export function focus(ref: RefObject<HTMLElement | null>) {
  const el = ref.current;
  (el?.matches('input,textarea,button,[tabindex]') ? el : el?.querySelector<HTMLElement>('input,textarea,button,[tabindex]'))?.focus();
}

/* ── The responder chain ── */
type Handlers = Record<string, () => void>;
const registry = new Set<{ handles: RefObject<Handlers>; el: RefObject<HTMLElement | null> }>();

/** Handles commands sent to the first responder when focus is inside this subtree. */
export function ResponderScope({ handles, children }: { handles: Handlers; children: ReactNode }) {
  const h = useRef(handles);
  h.current = handles;
  const el = useRef<HTMLDivElement>(null);
  const entry = useRef({ handles: h, el }).current;
  useEffect(() => { registry.add(entry); return () => { registry.delete(entry); }; }, [entry]);
  return <div ref={el} className="contents">{children}</div>;
}

/** A scene-wide responder (the scene's place in the chain). */
export function useResponder(command: string, fn: () => void) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    const entry = { handles: { current: { [command]: () => f.current() } }, el: { current: document.body } };
    registry.add(entry);
    return () => { registry.delete(entry); };
  }, [command]);
}

/** Sends a command up the responder chain, from the focused element: the innermost handler wins. */
export function sendAction(command: string) {
  const focused = document.activeElement ?? document.body;
  const owners = [...registry].filter((r) => r.handles.current[command] && r.el.current?.contains(focused));
  owners.sort((a, b) => (a.el.current!.contains(b.el.current) ? 1 : -1));
  owners[0]?.handles.current[command]();
}
`;

/** Every file of the storyboard, App.tsx first. */
export function generate(doc: Doc): CodeFile[] {
  return [
    { path: 'App.tsx', code: appFile(doc) },
    ...doc.scenes.map((s) => ({ path: `scenes/${s.name}.tsx`, code: sceneFile(doc, s) })),
    { path: 'contexts.tsx', code: contextsFile(doc) },
    { path: 'storyboard.tsx', code: RUNTIME },
  ];
}

/** One node as JSX (the Code tab with an element selected). */
export function nodeSnippet(doc: Doc, scene: Scene, node: Node): string {
  const c = sceneCode(doc, scene);
  return node.type === 'Screen' && node.id === scene.root.id ? `useScreen({\n${indent(screenBar(node, c), 2)}\n});\n\n${screenContent(node, c)}` : jsx(node, 'vertical', c);
}

