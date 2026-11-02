/* Hover cards for the navigator: what a library component, a scene, a segue or a context is, beside its row while the
   pointer rests on it (Xcode's library shows one per component; a storyboard's outline is names until you go and
   look, so its scenes and segues get one too). Each is drawn by the canvas's own renderer, at design time and inert:
   the card shows the component or the scene itself, not a picture of it.
   - A library item: the component as it's inserted (a screen container, a Screen or a TabBar on the document's
     device, scaled to fit; anything else at its own size on a small stage), where it comes from, and its props,
     events and slots.
   - A scene: its thumbnail as the canvas draws it (in its NavigationStack's bars), its props and state, and its
     segues in and out.
   - A segue: both ends, the kind and its transition, and what it hands the destination.
   - A context: its alias and its fields with their initial values.
   A preview copy of a scene takes another id, so nothing that looks a scene up in the page (the canvas, its tests)
   finds the card's copy. A component that can't draw outside a scene falls back to its icon. */
import { Component, useMemo, type ReactNode } from 'react';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { Icon, type IconName } from '@/lib/icon';
import { useAppearance } from '@/lib/theme';
import { makeNode, specOf, type LibraryItem } from './catalog';
import { describe } from './easing';
import { navigationOf } from './hosts';
import { DEVICES, type ContextDef, type Doc, type Node, type Scene, type Segue } from './model';
import { SEGUE_KINDS } from './ops';
import { designEnv, EnvContext, NodeView, SceneView } from './render';
import { SEGUE_GLYPH } from './storyboard';

/** A component that throws while drawing outside its usual place shows `fallback` instead of taking the card down. */
class Safe extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const glyph = (icon: LibraryItem['icon']) => (typeof icon === 'string' ? { name: icon as IconName } : { shapes: icon });

function Tile({ icon }: { icon: LibraryItem['icon'] }) {
  return (
    <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
      <Icon {...glyph(icon)} size={20} sw={1.8} />
    </span>
  );
}

/** A scene as the canvas draws it, scaled to `width`. */
function Thumb({ scene, doc, width, nav = true }: { scene: Scene; doc: Doc; width: number; nav?: boolean }) {
  const appearance = useAppearance() ?? 'light';
  const device = DEVICES[doc.device];
  const k = width / device.w;
  const env = useMemo(() => designEnv({ doc, contexts: doc.contexts }), [doc]);
  const copy = useMemo(() => ({ ...scene, id: `card-${scene.id}` }), [scene]);
  const simulateNav = useMemo(() => (nav ? navigationOf(doc, scene.id) : null), [nav, doc, scene.id]);
  return (
    <div aria-hidden="true" className="relative shrink-0 overflow-hidden bg-muted ring-1 ring-border" style={{ width, height: device.h * k, borderRadius: device.radius * k }}>
      <div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${k})` }}>
        <Safe fallback={null}>
          <SceneView scene={copy} device={device} env={env} simulateNav={simulateNav} appearance={appearance} />
        </Safe>
      </div>
    </div>
  );
}

/** Label/value lines under a card's header. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  if (!rows.length) return null;
  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-caption">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="m-0 truncate font-mono text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/* ── The library ── */

/** A library item, drawn as it's inserted. */
export function LibraryCard({ item, doc }: { item: LibraryItem; doc: Doc }) {
  // One node per card: its id is fresh, so it can't be mistaken for one on the canvas.
  const node = useMemo(() => item.make(), [item]);
  const spec = specOf(node.type);
  const scene = useMemo((): Scene | null => {
    if (!spec.screen && !spec.float && node.type !== 'Screen') return null;
    const root: Node = spec.screen || node.type === 'Screen' ? node : makeNode('Screen', { children: [node], props: { title: item.title } });
    return { id: 'library', name: item.title, x: 0, y: 0, props: [], state: [], memos: [], effects: [], root };
  }, [spec, node, item.title]);
  const env = useMemo(() => designEnv({ doc, contexts: doc.contexts }), [doc]);
  const from = item.source === 'kit' ? spec.module : item.source === 'html' ? 'HTML + Tailwind' : 'react';
  const slots = spec.slots?.map((s) => s.name) ?? [];
  return (
    <div className="flex flex-col gap-3">
      {scene ? (
        <div className="grid place-items-center rounded-lg bg-secondary py-3"><Thumb scene={scene} doc={doc} width={DEVICES[doc.device].w > DEVICES[doc.device].h ? 220 : 110} nav={false} /></div>
      ) : (
        <div aria-hidden="true" inert className="pointer-events-none flex max-h-44 min-h-20 items-center justify-center overflow-hidden rounded-lg bg-secondary p-4">
          <div className="flex w-full max-w-full justify-center">
            <Safe fallback={<Tile icon={item.icon} />}>
              <EnvContext.Provider value={env}><NodeView node={node} parent="vertical" /></EnvContext.Provider>
            </Safe>
          </div>
        </div>
      )}
      <HoverCardHeader
        media={<Tile icon={item.icon} />}
        title={<span className="font-mono">{item.source === 'kit' ? `<${item.title}>` : item.title}</span>}
        subtitle={<span className="font-mono">{from}</span>}
      />
      <p className="m-0 text-footnote text-muted-foreground">{item.description}</p>
      <Facts rows={[
        ...(spec.props.length ? [['props', spec.props.map((p) => p.name).join(', ')] as [string, ReactNode]] : []),
        ...(spec.events.length ? [['events', spec.events.map((e) => e.name).join(', ')] as [string, ReactNode]] : []),
        ...(slots.length ? [['slots', slots.join(', ')] as [string, ReactNode]] : []),
      ]} />
    </div>
  );
}

/* ── The outline ── */

/** A scene: its thumbnail, what it takes and keeps, and where it goes. */
export function SceneCard({ scene, doc }: { scene: Scene; doc: Doc }) {
  const device = DEVICES[doc.device];
  const wide = device.w > device.h;
  const out = doc.segues.filter((g) => g.from === scene.id);
  const into = doc.segues.filter((g) => g.to === scene.id);
  const name = (id: string) => doc.scenes.find((s) => s.id === id)?.name ?? '?';
  return (
    <div className={wide ? 'flex flex-col gap-3' : 'flex gap-3'}>
      <Thumb scene={scene} doc={doc} width={wide ? 256 : 96} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <HoverCardHeader
          title={<span className="font-mono">{`<${scene.name} />`}</span>}
          subtitle={doc.entry === scene.id ? `Entry point · ${device.name}` : device.name}
        />
        <Facts rows={[
          ...(scene.props.length ? [['props', scene.props.map((p) => p.name).join(', ')] as [string, ReactNode]] : []),
          ...(scene.state.length ? [['state', scene.state.map((s) => s.name).join(', ')] as [string, ReactNode]] : []),
          ...(out.length ? [['to', out.map((g) => name(g.to)).join(', ')] as [string, ReactNode]] : []),
          ...(into.length ? [['from', into.map((g) => name(g.from)).join(', ')] as [string, ReactNode]] : []),
        ]} />
        {!scene.props.length && !scene.state.length && !out.length && !into.length ? (
          <p className="m-0 text-footnote text-muted-foreground">No props, state or segues yet.</p>
        ) : null}
      </div>
    </div>
  );
}

/** A segue: both ends, how it presents, and what it hands over. */
export function SegueCard({ segue, doc }: { segue: Segue; doc: Doc }) {
  const from = doc.scenes.find((s) => s.id === segue.from);
  const to = doc.scenes.find((s) => s.id === segue.to);
  const kind = SEGUE_KINDS.find((k) => k.id === segue.kind);
  const wide = DEVICES[doc.device].w > DEVICES[doc.device].h;
  const args = Object.entries(segue.args).filter(([, v]) => v.trim());
  const delegates = Object.entries(segue.delegates).filter(([, l]) => l.length);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-2 rounded-lg bg-secondary p-3">
        {from ? <Thumb scene={from} doc={doc} width={wide ? 100 : 64} /> : null}
        <Icon name={SEGUE_GLYPH[segue.kind] as IconName} size={18} sw={2.2} className="shrink-0 text-primary" />
        {to ? <Thumb scene={to} doc={doc} width={wide ? 100 : 64} /> : null}
      </div>
      <HoverCardHeader title={<span className="font-mono">{segue.identifier}</span>} subtitle={`${kind?.label ?? segue.kind}: ${from?.name ?? '?'} → ${to?.name ?? '?'}`} />
      {kind ? <p className="m-0 text-footnote text-muted-foreground">{kind.help}</p> : null}
      <Facts rows={[
        ['transition', describe(segue.transition)],
        ...args.map(([k, v]) => [k, v] as [string, ReactNode]),
        ...delegates.map(([k, l]) => [k, plural(l.length, 'action')] as [string, ReactNode]),
      ]} />
    </div>
  );
}

/** A context: how expressions read it, and what it holds. */
export function ContextCard({ ctx }: { ctx: ContextDef }) {
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader
        media={<Tile icon="circle-fill" />}
        title={<span className="font-mono">{ctx.name}</span>}
        subtitle={<span className="font-mono">{`const ${ctx.alias} = useContext(${ctx.name})`}</span>}
      />
      {ctx.fields.length
        ? <Facts rows={ctx.fields.map((f) => [f.name, `${f.type} = ${f.initial || '—'}`] as [string, ReactNode])} />
        : <p className="m-0 text-footnote text-muted-foreground">No fields yet.</p>}
    </div>
  );
}
