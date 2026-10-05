/* Rendering a scene: one function for the canvas (design time: the initial state, inert, nothing animates unless
   you press Play) and the preview (live: state, events, outlets, gestures and exits). Every node is a `motion.div`
   box that takes its size from its parent stack and carries the node's motion; inside it is the real component
   from the catalog (a stack's box is the stack itself). The box is what the canvas hit-tests, outlines and drags,
   and what an outlet points at. */
import { createContext, use, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion, type MotionStyle, type TargetAndTransition, type Variants } from 'framer-motion';
import { fontStack, useGoogleFont } from '@/lib/google-fonts';
import { ThemeScope, type Appearance } from '@/lib/theme';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { appearValuesAt, appearVariants, instanceKey, is3d, toFramerTarget, type Slot } from './appear';
import { specOf, type ComponentSpec } from './catalog';
import { springSpec, toFramer, type TransitionSpec } from './easing';
import { refPath, valueOf, type Scope } from './expr';
import { cssColor, type Align, type AppFonts, type Axis, type ContextDef, type Device, type Distribute, type Doc, type Layout, type Node, type Scene, type Target } from './model';
import { SHADOWS } from './palette';
import type { Instance } from './runtime';
import { num, SceneNavContext, type SceneNav } from './spec';
import { SceneHost, SimulatedNav } from './hosts';

/* ── What a render can do ── */

export interface RenderEnv {
  /** The preview (true), or the canvas. */
  live: boolean;
  /** Animation speed: 1, or slower for Slow Animations. */
  speed: number;
  /** Run a node's event (live). */
  fire: (node: Node, event: string, value: unknown, scope: Scope) => void;
  /** Write a two-way binding back: `email`, or `session.user` (live). */
  write: (path: string[], value: unknown, scope: Scope) => void;
  /** An outlet's element came or went (live). */
  outlet: (name: string, el: HTMLElement | null) => void;
  /** An outlet as a ref, for drag constraints (live). */
  outletRef: (name: string) => RefObject<HTMLElement | null>;
  contexts: ContextDef[];
  /** When each node's appear starts (scene.tsx builds it per scene). */
  schedule: Map<string, Slot>;
  /** The canvas: play the appear animations (a new number replays them). */
  play: number;
  /** The canvas: a still frame of the appear, this many ms in (the timeline's playhead). */
  frameAt: number | null;
  /** The preview: the transition Magic Motion morphs shared elements with. */
  morph: TransitionSpec;
  /** The canvas: something is being dragged, so empty slots show where they are. */
  dragging: boolean;
  /** The document (embedded scenes and contexts come from it). */
  doc: Doc;
  /** The scene being rendered. */
  scene: Scene | null;
  /** The preview: the scene's running instance. */
  inst: Instance | null;
  /** How many embedded scenes deep this is. */
  depth: number;
}

const noop = () => undefined;

export const designEnv = (patch: Partial<RenderEnv> = {}): RenderEnv => ({
  live: false,
  speed: 1,
  fire: noop,
  write: noop,
  outlet: noop,
  outletRef: () => ({ current: null }),
  contexts: [],
  schedule: new Map(),
  play: 0,
  frameAt: null,
  morph: springSpec(0.45, 0.15),
  dragging: false,
  doc: EMPTY_DOC,
  scene: null,
  inst: null,
  depth: 0,
  ...patch,
});

const EMPTY_DOC: Doc = { version: 1, name: '', device: 'iphone', entry: '', scenes: [], segues: [], contexts: [] };

export const EnvContext = createContext<RenderEnv>(designEnv());
/** The canvas: props shown for now (a font hovered in the font list), outside the document. */
export const PreviewContext = createContext<{ target: string; props: Record<string, unknown> } | null>(null);
export const ScopeContext = createContext<Scope>({});
/** The nearest box, for drag constraints of `parent`. */
const ParentContext = createContext<RefObject<HTMLElement | null>>({ current: null });
/** When the scene started rendering: nodes in its first render take their stagger slot; later ones appear at once. */
const SceneStartContext = createContext(0);

/* ── Layout as CSS ── */

const ALIGN: Record<Align, CSSProperties['alignItems']> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const GRID_ALIGN: Record<Align, CSSProperties['alignItems']> = { start: 'start', center: 'center', end: 'end', stretch: 'stretch' };
const JUSTIFY: Record<Distribute, CSSProperties['justifyContent']> = {
  start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around', evenly: 'space-evenly',
};

export const padCss = (p: Layout['padding']) => (p == null ? undefined : Array.isArray(p) ? p.map((v) => `${v}px`).join(' ') : p);

/** A container's own layout: a flex column or row, or a grid whose children share one cell (overlay). */
export function stackStyle(L: Layout = {}): CSSProperties {
  const axis = L.axis ?? 'vertical';
  const overflow = L.overflow === 'scroll' ? (axis === 'horizontal' ? { overflowX: 'auto' as const, overflowY: 'hidden' as const } : { overflowY: 'auto' as const }) : L.overflow === 'hidden' ? { overflow: 'hidden' as const } : null;
  if (axis === 'overlay') {
    const v = L.distribute === 'center' || L.distribute === 'end' || L.distribute === 'start' ? L.distribute : 'center';
    return { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: GRID_ALIGN[L.align ?? 'center'], alignItems: GRID_ALIGN[v], padding: padCss(L.padding), ...overflow };
  }
  return {
    display: 'flex',
    flexDirection: axis === 'vertical' ? 'column' : 'row',
    gap: L.gap ?? 0,
    padding: padCss(L.padding),
    alignItems: ALIGN[L.align ?? 'start'],
    justifyContent: JUSTIFY[L.distribute ?? 'start'],
    flexWrap: L.wrap ? 'wrap' : undefined,
    ...overflow,
  };
}

/** The box of a node: its size in its parent (fixed, fill or fit, Framer's rules), its fill, corners and border. */
export function boxStyle(node: Node, spec: ComponentSpec, parent: Axis): MotionStyle {
  const L = node.layout ?? {}, S = node.style ?? {};
  const st: CSSProperties & { transformPerspective?: number } = { position: 'relative', boxSizing: 'border-box', minWidth: 0, minHeight: 0 };
  const size = (dim: 'width' | 'height', v: Layout['width']) => {
    const main = (dim === 'width' && parent === 'horizontal') || (dim === 'height' && parent === 'vertical');
    if (typeof v === 'number') {
      st[dim] = v;
      if (main) st.flexShrink = 0;
    } else if (v === 'fill') {
      if (parent === 'overlay') st[dim === 'width' ? 'justifySelf' : 'alignSelf'] = 'stretch';
      else if (main) { st.flexGrow = 1; st.flexBasis = 0; }
      else st.alignSelf = 'stretch';
    } else if (dim === 'width') st.maxWidth = '100%';
  };
  size('width', L.width ?? 'fit');
  size('height', L.height ?? 'fit');
  if (parent === 'overlay') st.gridArea = '1 / 1';
  if (S.fill) st.background = cssColor(S.fill);
  if (S.radius) st.borderRadius = S.radius;
  if (S.borderWidth) st.border = `${S.borderWidth}px solid ${cssColor(S.borderColor) ?? 'var(--border)'}`;
  if (S.shadow && S.shadow !== 'none') st.boxShadow = SHADOWS[S.shadow];
  if (S.opacity != null && S.opacity !== 1) st.opacity = S.opacity;
  if (spec.container === 'frame') Object.assign(st, stackStyle(L));
  else Object.assign(st, { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' });
  if (is3d(node.motion?.appear?.target) || is3d(node.motion?.hover?.target) || is3d(node.motion?.press?.target)) st.transformPerspective = 800;
  return st as MotionStyle;
}

/* ── Motion ── */

type MotionProps = Record<string, unknown>;

const gesture = (t: Target, spec: TransitionSpec, speed: number): TargetAndTransition =>
  ({ ...toFramerTarget(t), transition: toFramer(spec, speed) }) as TargetAndTransition;

/**
 * framer-motion props for a node. Appear is a pair of variants (`hidden` → `shown`) the scene root drives, with the
 * node's whole scheduled delay in its transition; hover, press, exit and drag are framer-motion's gesture props;
 * named variants are chosen by the node's `animate` expression (state-driven) or by an `animate` action.
 */
function motionProps(node: Node, env: RenderEnv, scope: Scope, slot: Slot | undefined, fresh: boolean, focused: boolean, parentRef: RefObject<HTMLElement | null>): MotionProps {
  const m = node.motion;
  if (!m) return {};
  const out: MotionProps = {};
  const variants: Variants = {};
  if (m.appear) {
    const { hidden, shown } = appearVariants(m.appear.target, node);
    const delay = fresh && slot ? slot.start / 1000 : m.appear.transition.delay;
    variants.hidden = toFramerTarget(hidden) as Variants[string];
    variants.shown = { ...toFramerTarget(shown), transition: toFramer({ ...m.appear.transition, delay }, env.speed) } as Variants[string];
  }
  for (const [name, eff] of Object.entries(m.variants ?? {})) variants[name] = gesture(eff.target, eff.transition, env.speed) as Variants[string];
  if (m.focus) variants.__focus = gesture(m.focus.target, m.focus.transition, env.speed) as Variants[string];
  if (Object.keys(variants).length) out.variants = variants;

  // Its own labels (state-driven variant, focus) make it its own variant root; otherwise it follows the scene's.
  const chosen = env.live && m.animate ? valueOf<unknown>(m.animate, scope, null) : null;
  const labels = [chosen].flat().filter((l): l is string => typeof l === 'string' && !!variants[l]);
  if (focused && m.focus) labels.push('__focus');
  if (m.appear?.trigger === 'inView') {
    out.initial = env.live || env.play ? 'hidden' : false;
    out.whileInView = 'shown';
    out.viewport = { once: m.appear.once, amount: 0.3 };
    if (labels.length) out.animate = labels;
  } else if (labels.length || (m.focus && env.live)) {
    if (m.appear) out.initial = env.live || env.play ? 'hidden' : false;
    out.animate = m.appear ? ['shown', ...labels] : labels;
  }
  if (env.live) {
    if (m.hover) out.whileHover = gesture(m.hover.target, m.hover.transition, env.speed);
    if (m.press) out.whileTap = gesture(m.press.target, m.press.transition, env.speed);
    if (m.exit) out.exit = gesture(m.exit.target, m.exit.transition, env.speed);
    if (m.drag) {
      out.drag = m.drag.axis === 'both' ? true : m.drag.axis;
      out.dragElastic = m.drag.elastic;
      out.dragSnapToOrigin = m.drag.snapBack;
      out.dragMomentum = m.drag.momentum;
      if (m.drag.constraints === 'parent') out.dragConstraints = parentRef;
      else if (m.drag.constraints && m.drag.constraints !== 'none') out.dragConstraints = env.outletRef(m.drag.constraints);
      if (Object.keys(m.drag.target).length) out.whileDrag = toFramerTarget(m.drag.target);
    }
    if (m.layoutId) {
      const id = valueOf<unknown>(m.layoutId, scope, null);
      if (id != null && id !== '') out.layoutId = String(id);
    }
    if (m.layout) out.layout = true;
  }
  // How it returns from a gesture, and how layout changes (and Magic Motion) move.
  const back = m.press?.transition ?? m.hover?.transition ?? m.focus?.transition ?? m.transition;
  out.transition = { ...(back ? toFramer(back, env.speed) : null), layout: toFramer(m.transition ?? env.morph, env.speed) };
  return out;
}

/* ── Nodes ── */

/** A node, wherever it is: repeated over a list, shown when its condition holds, or plain. */
export function NodeView({ node, parent, root }: { node: Node; parent: Axis; root?: boolean }) {
  if (node.repeat) return <Repeated node={node} parent={parent} />;
  return <Conditional node={node} parent={parent} instance={null} ghost={false} root={root} />;
}

function Repeated({ node, parent }: { node: Node; parent: Axis }) {
  const scope = use(ScopeContext);
  const env = use(EnvContext);
  const r = node.repeat!;
  const list = valueOf<unknown>(r.each, scope, []);
  let items = Array.isArray(list) ? list : [];
  // The canvas keeps a prototype cell visible even when its list starts empty.
  const ghost = !env.live && items.length === 0;
  if (ghost) items = [{}];
  const as = r.as || 'item';
  const rows = items.map((it, index) => {
    const inner = { ...scope, [as]: it, index };
    const k = r.key ? valueOf<unknown>(r.key, inner, index) : index;
    return (
      <ScopeContext.Provider key={String(k ?? index)} value={inner}>
        <Conditional node={node} parent={parent} instance={index} ghost={ghost} />
      </ScopeContext.Provider>
    );
  });
  return env.live ? <AnimatePresence>{rows}</AnimatePresence> : <>{rows}</>;
}

function Conditional({ node, parent, instance, ghost, root }: { node: Node; parent: Axis; instance: number | null; ghost: boolean; root?: boolean }) {
  const scope = use(ScopeContext);
  const env = use(EnvContext);
  const shown = node.when ? !!valueOf<unknown>(node.when, scope, true) : true;
  if (!env.live || !node.when) return <Box node={node} parent={parent} instance={instance} ghost={ghost || !shown} root={root} />;
  return <AnimatePresence>{shown ? <Box key={node.id} node={node} parent={parent} instance={instance} ghost={false} /> : null}</AnimatePresence>;
}

function Box({ node, parent, instance, ghost, root }: { node: Node; parent: Axis; instance: number | null; ghost: boolean; root?: boolean }) {
  const spec = specOf(node.type);
  const scope = use(ScopeContext);
  const env = use(EnvContext);
  const parentRef = use(ParentContext);
  const sceneStart = use(SceneStartContext);
  const self = useRef<HTMLElement | null>(null);
  // Nodes in the scene's first render take their stagger slot; ones that mount later (a new row) appear at once.
  const fresh = useRef(performance.now() - sceneStart < 150).current;
  const [focused, setFocused] = useState(false);

  // Props: literals, with bindings evaluated (a binding that fails keeps the literal), and on the canvas what's
  // being previewed on top.
  const preview = use(PreviewContext);
  const p: Record<string, unknown> = {};
  for (const ps of spec.props) {
    const lit = node.props[ps.name] ?? ps.default;
    const b = node.bind?.[ps.name];
    const v = b ? valueOf<unknown>(b, scope, lit) : lit;
    // On the canvas a binding with nothing to show yet (an empty prototype cell) shows its placeholder.
    p[ps.name] = v === undefined && !env.live ? lit : v;
  }
  if (!env.live && preview?.target === node.id) Object.assign(p, preview.props);

  // Events: run the node's actions; a two-way prop's event writes its binding back first.
  const on: Record<string, (v?: unknown) => void> = {};
  for (const ev of spec.events) {
    on[ev.name] = (v?: unknown) => {
      if (!env.live) return;
      const two = spec.props.find((ps) => ps.twoWay === ev.name && node.bind?.[ps.name]);
      const path = two ? refPath(node.bind![two.name]) : null;
      if (path) env.write(path, v, scope);
      env.fire(node, ev.name, v, scope);
    };
  }
  const wired = (ev: string) => !!node.on?.[ev]?.length;

  // A provider overrides its context's fields for everything inside it.
  let inner = scope;
  if (node.type === 'Provider') {
    const ctx = env.contexts.find((c) => c.id === node.props.context);
    if (ctx) {
      const base = (scope[ctx.alias] ?? {}) as Record<string, unknown>;
      const over = Object.fromEntries(ctx.fields.filter((f) => node.bind?.[f.name]).map((f) => [f.name, valueOf<unknown>(node.bind![f.name], scope, base[f.name])]));
      inner = { ...scope, [ctx.alias]: { ...base, ...over } };
    }
  }

  const axis = node.layout?.axis ?? 'vertical';
  const children = node.children?.map((c) => <NodeView key={c.id} node={c} parent={axis} />);
  // A screen container's slots are its columns (a SplitView's): each fills its column. Anyone else's are a row of
  // items (a bar's buttons, a row's accessory).
  const slots = Object.fromEntries(Object.entries(node.slots ?? {}).map(([k, list]) => [k, (
    <SlotArea key={k} id={`${node.id}:${k}`} empty={!list.length} fill={!!spec.screen}>
      {list.map((c) => <NodeView key={c.id} node={c} parent={spec.screen ? 'vertical' : 'horizontal'} />)}
    </SlotArea>
  )]));
  const content = spec.render({ node, p, on, wired, children, childList: children ?? [], slots, box: spec.container === 'component' ? stackStyle(node.layout) : {}, live: env.live });

  const slot = env.schedule.get(instanceKey(node.id, instance));
  let motionAttrs: MotionProps;
  if (env.frameAt != null && !env.live) {
    // Scrubbing: a still frame of the appear.
    const at = appearValuesAt(node, slot, env.frameAt);
    motionAttrs = { initial: false, animate: at ? toFramerTarget(at) : undefined, transition: { duration: 0 } };
  } else {
    motionAttrs = motionProps(node, env, scope, slot, fresh, focused, parentRef);
    if (root) {
      motionAttrs.initial = env.live || env.play ? 'hidden' : false;
      motionAttrs.animate = 'shown';
    }
  }
  if (env.live && node.on?.onTap?.length) motionAttrs.onTap = () => env.fire(node, 'onTap', undefined, scope);

  const setRef = (el: HTMLDivElement | null) => {
    self.current = el;
    if (env.live && node.ref) env.outlet(node.ref, el);
  };

  // A container filling the screen, an embedded scene filling its tab or column (block parents have no flex to fill).
  const fillsHost = (spec.screen && root) || (node.type === 'SceneRef' && parent !== 'horizontal' && node.layout?.height === 'fill');
  // A Screen on its own centers its content at its readable width on a wide screen (in a stack, the stack does).
  const readable = node.type === 'Screen' && root ? num(node.props.maxWidth, 720) : 0;
  const style = spec.float ? ({ display: 'contents' } as MotionStyle)
    : spec.screen && root ? ({ ...boxStyle(node, spec, parent), position: 'absolute', inset: 0, width: 'auto', height: 'auto' } as MotionStyle)
      : fillsHost ? ({ ...boxStyle(node, spec, parent), width: '100%', height: '100%', overflow: 'hidden' } as MotionStyle)
        : readable ? ({ ...boxStyle(node, spec, parent), width: '100%', maxWidth: readable, marginInline: 'auto' } as MotionStyle)
          : boxStyle(node, spec, parent);
  return (
    <motion.div
      ref={setRef}
      data-ib-node={node.id}
      data-ib-instance={instance ?? undefined}
      data-ib-ghost={ghost || undefined}
      className={cn(spec.wrapperClass, ghost && 'opacity-35')}
      style={style}
      onFocus={node.motion?.focus && env.live ? () => setFocused(true) : undefined}
      onBlur={node.motion?.focus && env.live ? (e: FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Element | null)) setFocused(false); } : undefined}
      {...motionAttrs}
    >
      <ParentContext.Provider value={self}>
        {inner === scope ? content : <ScopeContext.Provider value={inner}>{content}</ScopeContext.Provider>}
      </ParentContext.Provider>
    </motion.div>
  );
}

/** A slot's children: in a row, or (`fill`, a column) filling it. The canvas drops into it; while something is
    dragged, an empty one shows where it is. */
export function SlotArea({ id, empty, fill, children }: { id: string; empty: boolean; fill?: boolean; children: ReactNode }) {
  const env = use(EnvContext);
  if (empty && (env.live || !env.dragging)) return null;
  return (
    <div
      data-ib-slot={id}
      className={cn(
        fill ? 'flex size-full min-h-0 min-w-0 flex-col' : 'flex min-w-0 items-center gap-1',
        empty && 'rounded-lg outline-dashed outline-1 outline-primary/60',
        empty && (fill ? '-outline-offset-8' : 'size-8'),
      )}
    >
      {children}
    </div>
  );
}

/* ── Scenes ── */

/**
 * CSS that sets an app's fonts inside `scope`: the kit's `font-sans` and `font-mono` utilities carry their stacks
 * as literals, so a family of the app's own has to be set on them (and on what inherits) rather than through
 * `--font-sans`. The variables are set too, for CSS that reads them (syntax highlighting).
 */
export function appFontRules(scope: string, fonts: AppFonts | undefined): string {
  const sans = fontStack(fonts?.sans), mono = fontStack(fonts?.mono, 'monospace');
  return [
    sans ? `${scope}, ${scope} .font-sans { --font-sans: ${sans}; font-family: ${sans}; }` : '',
    mono ? `${scope} { --font-mono: ${mono}; } ${scope} :is(.font-mono, code, pre, kbd, samp) { font-family: ${mono}; }` : '',
  ].filter(Boolean).join('\n');
}

/** The status bar of a device: the time, cellular, Wi-Fi and battery. */
export function StatusBar({ device }: { device: Device }) {
  if (!device.top) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-150 flex items-center justify-between px-8 pt-1 text-foreground" style={{ height: device.top }}>
      <span className="w-14 text-center text-callout font-semibold tracking-[-.3px]">9:41</span>
      {device.radius > 30 ? <span className="h-[34px] w-[124px] rounded-full bg-black" /> : null}
      <span className="flex w-14 items-center justify-end gap-1">
        <Icon name="cellularbars" size={17} sw={2} />
        <Icon name="wifi" size={17} sw={2} />
        <Icon name="battery-full" size={24} sw={1.6} />
      </span>
    </div>
  );
}

export interface SceneViewProps {
  scene: Scene;
  device: Device;
  /** The outer env: design (the canvas) or live (a preview frame), with the doc. */
  env: RenderEnv;
  /** The preview: the scene's instance. */
  inst?: Instance | null;
  appearance: Appearance;
  /** Round the screen's corners like the device's (the canvas does; the preview's frame does it itself). */
  rounded?: boolean;
  /** Draw the status bar and home indicator (the preview draws one set over every scene). */
  chrome?: boolean;
  /** The canvas: show a Screen inside the NavigationStack it's in (Xcode's simulated bars), pushed or not. */
  simulateNav?: { inStack: boolean; pushed: string | null } | null;
  /** Where it is in the app's own stack (the preview's back button for a scene presented without a NavigationStack). */
  nav?: Partial<SceneNav>;
  /** The canvas: a text in it is being edited where it's drawn, so its content isn't inert (but takes no pointer:
      only the edited element does). */
  editing?: boolean;
  className?: string;
  children?: ReactNode;
}

/** A scene at its device's size: the background, the status bar, and its view — a Screen in the safe area, or a
    container (NavigationStack, TabView, SplitView) over the whole screen with the safe area as its inset. */
export function SceneView({ scene, device, env, inst = null, appearance, rounded = true, chrome = true, simulateNav, nav, editing, className, children }: SceneViewProps) {
  // A replay is a new first render: its nodes take their stagger slots again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => performance.now(), [env.play]);
  const root = scene.root;
  const simulated = !env.live && root.type === 'Screen' && !!simulateNav?.inStack;
  const fills = !!specOf(root.type).screen || simulated;
  const navValue: SceneNav = { canGoBack: false, backTitle: 'Back', goBack: () => {}, ...nav, safeTop: fills ? device.top : 0 };
  // The app's fonts: what every component's text is set in (the kit's font-sans and font-mono).
  const preview = use(PreviewContext);
  const fonts: AppFonts = { ...env.doc.fonts, ...(!env.live && preview?.target === 'doc' ? preview.props as AppFonts : null) };
  useGoogleFont([...(fonts.sans ?? []), ...(fonts.mono ?? [])]);
  const fontRules = appFontRules(`[data-ib-scene="${scene.id}"]`, fonts);
  return (
    <ThemeScope
      appearance={appearance}
      data-ib-scene={scene.id}
      className={cn('relative overflow-hidden font-sans text-foreground', className)}
      style={{
        width: device.w, height: device.h, background: cssColor(scene.background) ?? (root.props.grouped ? 'var(--muted)' : 'var(--background)'), borderRadius: rounded ? device.radius : undefined,
      }}
    >
      {fontRules ? <style>{fontRules}</style> : null}
      {chrome ? <StatusBar device={device} /> : null}
      <div
        inert={!env.live && !editing}
        data-ib-content
        className="absolute inset-x-0 flex flex-col"
        style={{ ...(fills ? { top: 0, bottom: 0 } : { top: device.top, bottom: device.bottom }), pointerEvents: editing ? 'none' : undefined }}
      >
        <SceneNavContext.Provider value={navValue}>
          <EnvContext.Provider value={env}>
            <SceneStartContext.Provider value={start}>
              {simulated
                ? <SimulatedNav key={env.play} scene={scene} pushed={simulateNav?.pushed ?? null} />
                : <SceneHost key={env.play} scene={scene} inst={inst} />}
            </SceneStartContext.Provider>
          </EnvContext.Provider>
        </SceneNavContext.Provider>
      </div>
      {chrome && device.bottom ? <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 z-130 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-foreground" /> : null}
      {children}
    </ThemeScope>
  );
}
