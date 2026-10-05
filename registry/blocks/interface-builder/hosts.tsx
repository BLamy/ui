/* The kit's containers, hosting scenes. A scene renders through a SceneHost: on the canvas with its design-time
   values, in the preview through its Instance (runtime.ts). The containers are the kit's own:
   - NavigationStack: one page per scene, each page's bar from the scene's Screen root (its title, large title,
     grouped background and leading and trailing items) — the kit draws the bar, pushes with its own spring and
     edge swipe, and its back button pops. A push segue from any scene inside it pushes here.
   - TabView: one tab per child (an embedded scene usually), the bar at the bottom; tabs keep their state.
   - SplitView: sidebar, supplementary and detail columns that collapse into a stack on a narrow device; a Show
     Detail segue puts its scene in the detail column.
   - an embedded scene (SceneRef): another scene rendered as a component, its props from bindings and its callback
     props from actions — React composition, the storyboard's container view. */
import { createContext, use, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { NavigationStack, type Screen } from '@/components/ui/navigation-stack';
import { SplitView, SplitViewDetail, SplitViewSidebar, SplitViewSupplementary, useSplitView } from '@/components/ui/split-view';
import { TabView, TabViewBar, TabViewList, TabViewPanel, TabViewPanels, TabViewTab, type TabViewPlacement } from '@/components/ui/tab-view';
import { useContainerWidth } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { appearSchedule } from './appear';
import { itemsOf, num, SceneNavContext, str, type RenderArgs } from './spec';
import { valueOf, type Scope } from './expr';
import type { Doc, Node, Scene } from './model';
import { designEnv, EnvContext, NodeView, ScopeContext, SlotArea, type RenderEnv } from './render';
import { Instance, type Hosts } from './runtime';
import { designScope } from './scope';

/* ── Which scene renders where ── */

/** The scenes being embedded above this point (a scene can't embed itself). */
const ChainContext = createContext<string[]>([]);

/** The containers instances made below this point navigate in (a NavigationStack's pages, a SplitView column). */
const HostsContext = createContext<Partial<Hosts>>({});

export const MAX_DEPTH = 5;

/** The env and scope a scene renders with: design-time values, or its live instance's. */
export function useSceneRender(scene: Scene, outer: RenderEnv, inst: Instance | null): { env: RenderEnv; scope: Scope } {
  // Live: re-render when the instance's state, props or contexts change.
  const version = useSyncExternalStore(inst?.subscribe ?? noopSubscribe, inst?.getVersion ?? zero, zero);
  const scope = useMemo(() => (inst ? inst.scope() : designScope(outer.doc, scene)), [inst, version, outer.doc, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  const schedule = useMemo(() => appearSchedule(scene.root, (n) => {
    const list = n.repeat ? valueOf<unknown>(n.repeat.each, scope, []) : [];
    return Array.isArray(list) ? Math.max(outer.live ? 0 : 1, list.length) : 1;
  }), [scene.root, scope, outer.live]);
  const env = useMemo<RenderEnv>(() => (inst
    ? {
        ...outer,
        scene,
        inst,
        schedule,
        fire: (node, event, value, s) => inst.fire(node, event, value, s),
        write: (path, value) => inst.write(path, value),
        outlet: (name, el) => inst.setOutlet(name, el),
        outletRef: (name) => inst.outletRef(name),
      }
    : { ...designEnv(), ...outer, scene, inst: null, schedule }), [outer, scene, inst, schedule]);
  return { env, scope };
}

const noopSubscribe = () => () => {};
const zero = () => 0;

/** A scene's whole view, or one part of its Screen root: `content` (its children), `leading`, `trailing`. */
export type ScenePart = 'all' | 'content' | 'leading' | 'trailing';

export function SceneHost({ scene, inst, part = 'all', embedded }: { scene: Scene; inst: Instance | null; part?: ScenePart; embedded?: boolean }) {
  const outer = use(EnvContext);
  const chain = use(ChainContext);
  const base = useMemo(() => (embedded ? { ...outer, depth: outer.depth + 1 } : outer), [outer, embedded]);
  const { env, scope } = useSceneRender(scene, base, inst);
  const root = scene.root;
  let body: ReactNode;
  if (part === 'all') body = <NodeView node={root} parent="vertical" root />;
  else if (part === 'content') body = <ScreenContent node={root} />;
  else {
    const list = root.slots?.[part] ?? [];
    body = list.length ? <span className="flex items-center gap-1">{list.map((c) => <NodeView key={c.id} node={c} parent="horizontal" />)}</span> : null;
  }
  return (
    <ChainContext.Provider value={[...chain, scene.id]}>
      <EnvContext.Provider value={env}>
        <ScopeContext.Provider value={scope}>
          {inst && (part === 'all' || part === 'content') ? <Lifecycle inst={inst}>{body}</Lifecycle> : body}
        </ScopeContext.Provider>
      </EnvContext.Provider>
    </ChainContext.Provider>
  );
}

/** A Screen root's children, laid out by the Screen's stack (what a NavigationStack page shows under its bar). */
function ScreenContent({ node }: { node: Node }) {
  return <NodeView node={{ ...node, slots: undefined, type: node.type === 'Screen' ? 'Stack' : node.type, layout: { ...node.layout, width: 'fill', height: undefined, overflow: 'visible' } }} parent="vertical" root />;
}

/** An instance on screen: registered for the responder chain, its first responder, and its effects. */
function Lifecycle({ inst, children }: { inst: Instance; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    inst.el = el.current;
    inst.app.instances.add(inst);
    inst.app.appear(inst);
    const scene = inst.scene;
    const raf = requestAnimationFrame(() => {
      const auto = scene ? allAuto(scene.root) : null;
      if (auto) {
        const target = el.current?.querySelector<HTMLElement>(`[data-ib-node="${auto.id}"]`)?.querySelector<HTMLElement>('input,textarea,button,[tabindex]:not([tabindex="-1"])');
        target?.focus({ preventScroll: true });
        if (target) inst.app.log(`${auto.name ?? auto.type} becomes first responder (autoFocus)`);
      }
      scene?.effects.filter((e) => e.on === 'appear').forEach((e) => inst.run(e.actions));
    });
    return () => {
      cancelAnimationFrame(raf);
      inst.app.instances.delete(inst);
      inst.app.disappear(inst);
      inst.scene?.effects.filter((e) => e.on === 'disappear').forEach((e) => inst.run(e.actions));
    };
  }, [inst]);
  // Change effects: useEffect(…, [deps]), never on the first render.
  const prev = useRef<Record<string, unknown> | null>(null);
  const version = useSyncExternalStore(inst.subscribe, inst.getVersion, zero);
  useEffect(() => {
    const scene = inst.scene;
    if (!scene) return;
    const s = inst.scope();
    const now = Object.fromEntries([...scene.state, ...scene.memos].map((d) => [d.name, s[d.name]]));
    if (prev.current) for (const e of scene.effects.filter((x) => x.on === 'change')) if (e.deps.some((d) => !Object.is(prev.current![d], now[d]))) inst.run(e.actions);
    prev.current = now;
  }, [inst, version]);
  return <div ref={el} data-ib-instance-root={inst.sceneId} className="contents">{children}</div>;
}

function allAuto(root: Node): Node | null {
  if (root.autoFocus) return root;
  for (const c of [...(root.children ?? []), ...Object.values(root.slots ?? {}).flat()]) {
    const hit = allAuto(c);
    if (hit) return hit;
  }
  return null;
}

/* ── Embedded scenes ── */

/** The scene a SceneRef points at, and an instance for it in the preview (its props from bindings, its callbacks
    from actions in the scene that embeds it). */
function useEmbedded(node: Node, hosts: Partial<Hosts> = {}): { scene: Scene | null; inst: Instance | null } {
  const env = use(EnvContext);
  const scope = use(ScopeContext);
  const extra = use(HostsContext);
  const scene = env.doc.scenes.find((s) => s.id === node.props.scene) ?? null;
  const parent = env.inst;
  const props = useMemo(() => (scene && parent ? embedProps(scene, node, scope, parent) : {}), [scene, node, scope, parent]);
  const [inst] = useState(() => (scene && parent ? new Instance(parent.app, scene.id, props, { ...parent.hosts, ...extra, ...hosts }, parent) : null));
  useEffect(() => { inst?.setProps(props); }, [inst, props]);
  return { scene, inst };
}

/** A SceneRef's props for its scene: bound values, and callbacks that run the SceneRef's actions in the parent. */
function embedProps(scene: Scene, node: Node, scope: Scope, parent: Instance): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of scene.props) {
    if (p.callback) {
      const list = node.on?.[p.name];
      if (list?.length) out[p.name] = (...xs: unknown[]) => parent.run(list, Object.fromEntries((p.params ?? []).map((n, i) => [n, xs[i]])));
    } else if (node.bind?.[p.name]) out[p.name] = valueOf(node.bind[p.name], scope, null);
  }
  return out;
}

/** An embedded scene, on its own (not as a NavigationStack page). A new scene is a new instance. */
export function SceneRefHost({ node }: { node: Node }) {
  return <EmbeddedScene key={String(node.props.scene)} node={node} />;
}

function EmbeddedScene({ node }: { node: Node }) {
  const env = use(EnvContext);
  const chain = use(ChainContext);
  const column = use(ColumnContext);
  const { scene, inst } = useEmbedded(node);
  if (!scene) return <Placeholder icon="question-circle" text="Pick a scene" />;
  if (chain.includes(scene.id) || env.depth >= MAX_DEPTH) return <Placeholder icon="repeat" text={`${scene.name} (embedded in itself)`} />;
  // A Screen in a SplitView's column has the column's own bar, as UISplitViewController wraps each column in a
  // navigation controller. (Only the column's own scene: what that one embeds is just embedded.)
  return (
    <ColumnContext.Provider value={false}>
      {column && scene.root.type === 'Screen'
        ? <NavFrame page={{ key: 'column', scene, inst: env.live ? inst : null, root: true }} embedded />
        : <SceneHost scene={scene} inst={env.live ? inst : null} embedded />}
    </ColumnContext.Provider>
  );
}

/** Inside a SplitView's column. */
const ColumnContext = createContext(false);

function Placeholder({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="grid size-full min-h-24 place-items-center rounded-panel bg-secondary/60 p-4 text-center text-footnote text-muted-foreground">
      <span className="flex flex-col items-center gap-1.5"><Icon name={icon} size={20} sw={1.9} />{text}</span>
    </div>
  );
}

/* ── NavigationStack ── */

interface Page { key: string; scene: Scene; inst: Instance | null; root: boolean }

/** A scene as one of the stack's screens: its Screen root's bar, its content under it. */
/** A Screen's readable width: its content centers at this on a wide screen (none when 0). */
const readableWidth = (n: Node) => num(n.props.maxWidth, 720) || undefined;

function screenOf(page: Page, embedded: boolean, own?: { title: string; largeTitle: boolean; grouped: boolean; maxW?: number }): Screen {
  const r = page.scene.root;
  const isScreen = r.type === 'Screen';
  const title = isScreen ? <ScreenTitle scene={page.scene} inst={page.inst} /> : own?.title;
  return {
    key: page.key,
    title,
    largeTitle: isScreen ? r.props.largeTitle !== false : own?.largeTitle,
    grouped: isScreen ? !!r.props.grouped : own?.grouped,
    maxW: isScreen ? readableWidth(r) : own?.maxW,
    leading: isScreen ? <SceneHost scene={page.scene} inst={page.inst} part="leading" embedded={embedded} /> : undefined,
    trailing: isScreen ? <SceneHost scene={page.scene} inst={page.inst} part="trailing" embedded={embedded} /> : undefined,
    content: <SceneHost scene={page.scene} inst={page.inst} part={isScreen ? 'content' : 'all'} embedded={embedded} />,
  };
}

/** A Screen's title: a literal, or bound to the scene's state (`plant.name`). */
function ScreenTitle({ scene, inst }: { scene: Scene; inst: Instance | null }) {
  const outer = use(EnvContext);
  const { scope } = useSceneRender(scene, outer, inst);
  const r = scene.root;
  const b = r.bind?.title;
  return <>{str(b ? valueOf(b, scope, r.props.title) : r.props.title)}</>;
}

/** The kit's NavigationStack, hosting its child as the root page; pushes add pages, its back button pops them. */
export function NavStackHost({ r }: { r: RenderArgs }) {
  return <NavStack key={String(r.node.children?.[0]?.props.scene ?? 'inline')} r={r} />;
}

function NavStack({ r }: { r: RenderArgs }) {
  const env = use(EnvContext);
  const nav = use(SceneNavContext);
  const extra = use(HostsContext);
  const child = r.node.children?.[0];
  const own = { title: str(r.p.title), largeTitle: r.p.largeTitle !== false, grouped: !!r.p.grouped, maxW: num(r.p.maxWidth, 720) || undefined };
  const ref = child?.type === 'SceneRef' ? child : null;
  const live = env.live && !!env.inst;

  // The stack's pages: its root (the embedded scene, or this scene's own content), then what was pushed.
  const [pushed, setPushed] = useState<Page[]>([]);
  const pushedRef = useRef(pushed);
  pushedRef.current = pushed;
  const stack = useMemo(() => ({
    push: (sceneId: string, props: Record<string, unknown>) => {
      const scene = env.doc.scenes.find((s) => s.id === sceneId);
      if (!scene || !env.inst) return;
      const inst = new Instance(env.inst.app, scene.id, props, { ...env.inst.hosts, ...extra, stack }, env.inst);
      inst.arrived = 'navigated';
      setPushed((p) => [...p, { key: `p${inst.key}`, scene, inst, root: false }]);
    },
    pop: (inst: { key: number }) => {
      const i = pushedRef.current.findIndex((p) => p.inst?.key === inst.key);
      if (i < 0) return false;
      setPushed((p) => p.slice(0, i));
      return true;
    },
    popTo: (sceneId: string) => {
      const i = pushedRef.current.findIndex((p) => p.scene.id === sceneId);
      if (i >= 0) { setPushed((p) => p.slice(0, i + 1)); return true; }
      if (ref && ref.props.scene === sceneId) { setPushed([]); return true; }
      return false;
    },
  }), [env.doc, env.inst, ref, extra]);

  const embedded = useEmbedded(ref ?? { id: '', type: 'SceneRef', props: {} }, { stack });
  const rootScene = ref ? embedded.scene : null;

  const pages: Page[] = [];
  if (ref && rootScene) pages.push({ key: 'root', scene: rootScene, inst: live ? embedded.inst : null, root: true });
  const screens: Screen[] = [];
  if (ref && rootScene) screens.push(screenOf(pages[0], true));
  else screens.push({ key: 'root', title: own.title, largeTitle: own.largeTitle, grouped: own.grouped, maxW: own.maxW, content: <div style={r.box}>{r.children}</div> });
  if (live) for (const p of pushed) screens.push(screenOf(p, true));

  // Inline content (no embedded scene) pushes from this scene's own instance.
  useEffect(() => {
    if (!ref && env.inst) env.inst.hosts = { ...env.inst.hosts, stack };
  }, [ref, env.inst, stack]);

  return (
    <HostsContext.Provider value={{ ...extra, stack }}>
      <NavigationStack
        screens={screens}
        onPop={() => setPushed((p) => p.slice(0, -1))}
        safeTop={nav.safeTop}
        rootBack={nav.canGoBack ? { title: nav.backTitle, onPress: nav.goBack } : undefined}
      />
    </HostsContext.Provider>
  );
}

/* ── TabView ── */

/** Wide enough for a side rail instead of a tab bar (an iPad's regular width, a desktop window). */
const RAIL_AT = 700;

export function TabViewHost({ r }: { r: RenderArgs }) {
  const tabs = itemsOf(r.p.tabs);
  const selected = str(r.p.selectedKey, tabs[0]?.id);
  const [box, width] = useContainerWidth<HTMLDivElement>(393);
  const asked = (['bottom', 'start', 'top'] as const).find((p) => p === r.p.placement);
  const placement: TabViewPlacement = asked ?? (width >= RAIL_AT ? 'start' : 'bottom');
  return (
    <div ref={box} className="relative size-full">
    <TabView
      placement={placement}
      selectedKey={selected}
      onSelectionChange={(k) => r.on.onSelectionChange?.(String(k))}
      className="relative size-full"
    >
      <TabViewBar hideOnScroll={false}>
        <TabViewList aria-label="Tabs">
          {tabs.map((t) => <TabViewTab key={t.id} id={t.id} icon={t.icon ?? 'circle'} title={t.label} />)}
        </TabViewList>
      </TabViewBar>
      <TabViewPanels>
        {tabs.map((t, i) => (
          <TabViewPanel key={t.id} id={t.id} shouldForceMount className="overflow-hidden">
            {r.childList[i] ?? <Placeholder icon="plus" text={`Drop a scene here for “${t.label}”`} />}
          </TabViewPanel>
        ))}
      </TabViewPanels>
    </TabView>
    </div>
  );
}

/* ── SplitView ── */

/** A Show Detail segue from inside a column: put its scene in the detail column, and show it (a push when
    collapsed). */
function useDetail(): [Page | null, (column: 'sidebar' | 'supplementary') => NonNullable<Hosts['split']>] {
  const env = use(EnvContext);
  const extra = use(HostsContext);
  const [detail, setDetail] = useState<Page | null>(null);
  const split = useSplitView();
  const make = (column: 'sidebar' | 'supplementary') => ({
    showDetail: (sceneId: string, props: Record<string, unknown>) => {
      const scene = env.doc.scenes.find((s) => s.id === sceneId);
      if (!scene || !env.inst) return;
      const inst = new Instance(env.inst.app, scene.id, props, { ...env.inst.hosts, ...extra }, env.inst);
      inst.arrived = 'navigated';
      setDetail({ key: `d${inst.key}`, scene, inst, root: false });
      split.select(column, String(inst.key));
    },
  });
  return [detail, make];
}

function SplitColumns({ r }: { r: RenderArgs }) {
  const env = use(EnvContext);
  const [detail, splitFor] = useDetail();
  const slot = (k: 'sidebar' | 'supplementary' | 'detail') => r.node.slots?.[k] ?? [];
  const has = (k: 'sidebar' | 'supplementary' | 'detail') => slot(k).length > 0;
  return (
    <>
      {has('sidebar') ? (
        <SplitViewSidebar aria-label="Sidebar">
          <ColumnHosts split={splitFor('sidebar')}>{r.slots.sidebar}</ColumnHosts>
        </SplitViewSidebar>
      ) : null}
      {has('supplementary') ? (
        <SplitViewSupplementary aria-label="Supplementary">
          <ColumnHosts split={splitFor('supplementary')}>{r.slots.supplementary}</ColumnHosts>
        </SplitViewSupplementary>
      ) : null}
      <SplitViewDetail aria-label="Detail">
        {detail && env.live ? (
          <NavFrame page={detail} />
        ) : has('detail') ? <ColumnContext.Provider value>{r.slots.detail}</ColumnContext.Provider> : <Placeholder icon="rectangle-split" text="The detail column: a Show Detail segue puts a scene here" />}
      </SplitViewDetail>
    </>
  );
}

/** Instances made below this point send Show Detail here (and so does this scene's own inline content). */
function ColumnHosts({ split, children }: { split: NonNullable<Hosts['split']>; children: ReactNode }) {
  const env = use(EnvContext);
  const extra = use(HostsContext);
  useEffect(() => {
    if (env.inst && !env.inst.hosts.split) env.inst.hosts = { ...env.inst.hosts, split };
  }, [env.inst, split]);
  return <HostsContext.Provider value={{ ...extra, split }}><ColumnContext.Provider value>{children}</ColumnContext.Provider></HostsContext.Provider>;
}

/** A detail page: the scene in its own NavigationStack when its root is a Screen (so it has a bar). */
function NavFrame({ page, embedded = false }: { page: Page; embedded?: boolean }) {
  const nav = use(SceneNavContext);
  if (page.scene.root.type !== 'Screen') return <SceneHost scene={page.scene} inst={page.inst} embedded={embedded} />;
  return <NavigationStack screens={[screenOf(page, embedded)]} safeTop={nav.safeTop} />;
}

export function SplitViewHost({ r }: { r: RenderArgs }) {
  const env = use(EnvContext);
  const width = r.p.widthClass;
  return (
    <SplitView
      aria-label="Split view"
      widthClass={width === 'compact' || width === 'medium' || width === 'regular' ? width : undefined}
      sidebarBehavior={(['tile', 'overlay', 'displace'] as const).find((b) => b === r.p.sidebarBehavior) ?? 'auto'}
      className="size-full"
    >
      <SplitColumns r={r} key={env.live ? 'live' : 'design'} />
    </SplitView>
  );
}

/** Is a scene shown inside a NavigationStack somewhere (the canvas draws it with a bar), and was it pushed there
    (a back button)? */
export function navigationOf(doc: Doc, sceneId: string): { inStack: boolean; pushed: string | null } {
  const embeddedIn = (id: string) => doc.scenes.some((s) => s.root.type === 'NavigationStack' && s.root.children?.[0]?.type === 'SceneRef' && s.root.children[0].props.scene === id);
  const push = doc.segues.find((g) => (g.kind === 'push' || g.kind === 'detail') && g.to === sceneId);
  const from = push ? doc.scenes.find((s) => s.id === push.from) : null;
  return { inStack: embeddedIn(sceneId) || !!push, pushed: from ? from.name : null };
}

/* ── The canvas: a Screen as it looks inside its NavigationStack ── */

/** A scene whose Screen sits in a NavigationStack somewhere, drawn the way the stack shows it: the kit's bar with
    its title and bar items (still this scene's own nodes, so they select and take drops), and a back button when
    a segue pushes it. Xcode's simulated metrics. */
export function SimulatedNav({ scene, pushed }: { scene: Scene; pushed: string | null }) {
  const outer = use(EnvContext);
  const nav = use(SceneNavContext);
  const { env, scope } = useSceneRender(scene, outer, null);
  const r = scene.root;
  const title = str(r.bind?.title ? valueOf(r.bind.title, scope, r.props.title) : r.props.title);
  const slot = (k: 'leading' | 'trailing') => {
    const list = r.slots?.[k] ?? [];
    return <SlotArea id={`${r.id}:${k}`} empty={!list.length}>{list.map((c) => <NodeView key={c.id} node={c} parent="horizontal" />)}</SlotArea>;
  };
  return (
    <EnvContext.Provider value={env}>
      <ScopeContext.Provider value={scope}>
        <NavigationStack
          safeTop={nav.safeTop}
          rootBack={pushed ? { title: pushed, onPress: () => {} } : false}
          screens={[{ key: 'screen', title, largeTitle: r.props.largeTitle !== false, grouped: !!r.props.grouped, maxW: readableWidth(r), leading: slot('leading'), trailing: slot('trailing'), content: <ScreenContent node={r} /> }]}
        />
      </ScopeContext.Provider>
    </EnvContext.Provider>
  );
}
