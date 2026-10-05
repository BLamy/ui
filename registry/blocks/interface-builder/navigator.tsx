/* The navigator: the document outline (Xcode's) and the library. The outline is react-aria's Tree — arrows move,
   → and ← open and close, Return selects — and stays in step with the canvas: select a row and the canvas selects it;
   select on the canvas and the outline opens to it. Every scene lists its view tree (slots by name), its First
   Responder and Exit proxies, and the segues that leave it. Badges say what a node is wired to: @outlet, ƒ binding,
   ↻ repeat, if, ⚡ actions, ✦ motion. */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Button as AriaButton, Collection, Tree, TreeItem, TreeItemContent, type Key } from 'react-aria-components';
import { PlainButton } from '@/components/ui/plain-button';
import { Segmented } from '@/components/ui/segmented';
import { Icon, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { nodeLabel, specOf } from './catalog';
import { LibraryList } from './library';
import { DOCK_COLORS } from './palette';
import { type ContextDef, type Doc, type Node, type Scene, type Segue } from './model';
import { newContext, newScene, SEGUE_KINDS } from './ops';
import { useBuilder, type Selection } from './store';
import { SEGUE_GLYPH } from './storyboard';
import { pathTo } from './tree';

type Item =
  | { id: string; kind: 'entry'; label: string }
  | { id: string; kind: 'contexts'; children: Item[] }
  | { id: string; kind: 'context'; ctx: ContextDef }
  | { id: string; kind: 'scene'; scene: Scene; children: Item[] }
  | { id: string; kind: 'node'; node: Node; label: string; root: boolean; children: Item[] }
  | { id: string; kind: 'slot'; label: string; children: Item[] }
  | { id: string; kind: 'responder'; scene: Scene }
  | { id: string; kind: 'exit'; scene: Scene }
  | { id: string; kind: 'segue'; segue: Segue; to: string };

function nodeItem(doc: Doc, n: Node, root = false): Item {
  const kids: Item[] = (n.children ?? []).map((c) => nodeItem(doc, c));
  for (const [slot, list] of Object.entries(n.slots ?? {})) {
    if (list.length) kids.push({ id: `slot:${n.id}:${slot}`, kind: 'slot', label: slot, children: list.map((c) => nodeItem(doc, c)) });
  }
  return { id: n.id, kind: 'node', node: n, label: nodeLabel(n, doc), root, children: kids };
}

function itemsOf(doc: Doc): Item[] {
  const entry = doc.scenes.find((s) => s.id === doc.entry);
  return [
    { id: 'entry', kind: 'entry', label: `Entry Point → ${entry?.name ?? '—'}` },
    { id: 'contexts', kind: 'contexts', children: doc.contexts.map((c) => ({ id: `ctx:${c.id}`, kind: 'context', ctx: c })) },
    ...doc.scenes.map((s): Item => ({
      id: `scene:${s.id}`,
      kind: 'scene',
      scene: s,
      children: [
        nodeItem(doc, s.root, true),
        { id: `responder:${s.id}`, kind: 'responder', scene: s },
        { id: `exit:${s.id}`, kind: 'exit', scene: s },
        ...doc.segues.filter((g) => g.from === s.id).map((g): Item => ({ id: `segue:${g.id}`, kind: 'segue', segue: g, to: doc.scenes.find((x) => x.id === g.to)?.name ?? '?' })),
      ],
    })),
  ];
}

/** The outline row for the store's selection. */
function keyOf(sel: Selection): string | null {
  switch (sel.kind) {
    case 'node': return sel.ids[0];
    case 'scene': return `scene:${sel.scene}`;
    case 'responder': return `responder:${sel.scene}`;
    case 'exit': return `exit:${sel.scene}`;
    case 'context': return `ctx:${sel.context}`;
    case 'segue': return `segue:${sel.segue}`;
    case 'entry': return 'entry';
    default: return null;
  }
}

function selectionOf(key: string, doc: Doc): Selection {
  const [kind, id] = key.includes(':') ? [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)] : [key, ''];
  switch (kind) {
    case 'entry': return { kind: 'entry' };
    case 'scene': return { kind: 'scene', scene: id };
    case 'responder': return { kind: 'responder', scene: id };
    case 'exit': return { kind: 'exit', scene: id };
    case 'ctx': return { kind: 'context', context: id };
    case 'segue': return { kind: 'segue', segue: id };
    case 'contexts': case 'slot': return { kind: 'none' };
    default: {
      const scene = doc.scenes.find((s) => pathTo(s.root, key).length);
      return scene ? { kind: 'node', scene: scene.id, ids: [key] } : { kind: 'none' };
    }
  }
}

const Badge = ({ children, title, mono }: { children: ReactNode; title: string; mono?: boolean }) => (
  <span title={title} className={cn('shrink-0 rounded px-1 text-caption2 leading-4 text-muted-foreground', mono && 'font-mono', 'bg-secondary')}>{children}</span>
);

function Glyph({ name, shapes, color, className }: { name?: string; shapes?: readonly IconShape[]; color?: string; className?: string }) {
  return (
    <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-[5px]', color ? 'text-white' : 'text-primary', className)} style={color ? { background: color } : undefined}>
      <Icon name={name} shapes={shapes} size={color ? 12 : 15} sw={color ? 2.6 : 1.9} />
    </span>
  );
}

function RowBody({ item }: { item: Item }) {
  switch (item.kind) {
    case 'entry': return (<><Glyph name="arrow-right" /><span className="truncate">{item.label}</span></>);
    case 'contexts': return (<><Glyph name="square-on-square" /><span className="flex-1 truncate font-medium">Contexts</span></>);
    case 'context': return (<><Glyph name="circle-fill" className="text-success" /><span className="truncate">{item.ctx.name}</span><Badge title="Read it as" mono>{item.ctx.alias}</Badge></>);
    case 'scene': return (<><Glyph name="circle-fill" color={DOCK_COLORS.component} /><span className="truncate font-semibold">{item.scene.name}</span></>);
    case 'responder': return (<><Glyph name="bolt-fill" color={DOCK_COLORS.responder} /><span className="truncate text-muted-foreground">First Responder</span>{Object.keys(item.scene.responds ?? {}).length ? <Badge title="Commands it handles">{Object.keys(item.scene.responds ?? {}).length}</Badge> : null}</>);
    case 'exit': return (<><Glyph name="arrow-uturn-backward" color={DOCK_COLORS.exit} /><span className="truncate text-muted-foreground">Exit</span></>);
    case 'segue': return (<><Glyph name={SEGUE_GLYPH[item.segue.kind]} /><span className="truncate">{SEGUE_KINDS.find((k) => k.id === item.segue.kind)?.label} → {item.to}</span></>);
    case 'slot': return (<><span className="size-[18px] shrink-0" /><span className="truncate text-caption font-medium tracking-wide text-muted-foreground uppercase">{item.label}</span></>);
    case 'node': {
      const n = item.node, spec = specOf(n.type);
      const actions = Object.values(n.on ?? {}).reduce((k, l) => k + l.length, 0);
      const m = n.motion;
      const moves = !!(m && (m.appear || m.hover || m.press || m.focus || m.exit || m.drag || m.layoutId || m.layout || Object.keys(m.variants ?? {}).length));
      return (
        <>
          <Glyph name={typeof spec.icon === 'string' ? spec.icon : undefined} shapes={typeof spec.icon === 'string' ? undefined : spec.icon} />
          <span className="min-w-0 flex-1 truncate">{item.root ? `${item.label} (root)` : item.label}</span>
          {n.ref ? <Badge title={`Outlet: useRef → ${n.ref}`} mono>@{n.ref}</Badge> : null}
          {n.bind && Object.keys(n.bind).length ? <Badge title={`Bound: ${Object.keys(n.bind).join(', ')}`}>ƒ</Badge> : null}
          {n.repeat ? <Badge title={`Repeats over ${n.repeat.each}`}>↻</Badge> : null}
          {n.when ? <Badge title={`Shown when ${n.when}`}>if</Badge> : null}
          {actions ? <Badge title={`${actions} action${actions === 1 ? '' : 's'}`}>⚡{actions}</Badge> : null}
          {moves ? <Badge title="Animated">✦</Badge> : null}
        </>
      );
    }
  }
}

function renderItem(item: Item) {
  const children = 'children' in item ? item.children : null;
  const text = item.kind === 'node' ? item.label : item.kind === 'scene' ? item.scene.name : item.kind === 'context' ? item.ctx.name : item.kind === 'slot' ? item.label : item.kind === 'segue' ? `Segue to ${item.to}` : item.kind === 'responder' ? 'First Responder' : item.kind === 'exit' ? 'Exit' : item.kind === 'contexts' ? 'Contexts' : item.label;
  return (
    <TreeItem
      key={item.id}
      id={item.id}
      textValue={text}
      isDisabled={item.kind === 'slot'}
      className="group/row cursor-default rounded-md outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-inset data-hovered:bg-secondary/70 data-selected:bg-primary/14 data-disabled:cursor-default"
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded, level }) => (
          <div className="flex h-7 min-w-0 items-center gap-1.5 pe-1.5 ps-[calc((var(--level)-1)*0.85rem+0.2rem)] text-footnote" style={{ '--level': level } as CSSProperties}>
            {hasChildItems ? (
              <AriaButton slot="chevron" aria-label={isExpanded ? 'Collapse' : 'Expand'} className="grid size-4 shrink-0 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring">
                <Icon name="chevron-right" size={11} sw={2.6} className={cn('transition-transform duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', isExpanded && 'rotate-90')} />
              </AriaButton>
            ) : <span className="size-4 shrink-0" />}
            <RowBody item={item} />
          </div>
        )}
      </TreeItemContent>
      {children ? <Collection items={children}>{renderItem}</Collection> : null}
    </TreeItem>
  );
}

export function Outline({ onFocusScene }: { onFocusScene: (id: string) => void }) {
  const b = useBuilder();
  const items = useMemo(() => itemsOf(b.doc), [b.doc]);
  const selected = keyOf(b.selection);
  const [expanded, setExpanded] = useState<Set<Key>>(() => new Set(['contexts', ...b.doc.scenes.map((s) => `scene:${s.id}`)]));

  // Open the outline to whatever the canvas selected.
  useEffect(() => {
    const sel = b.selection;
    const sceneId = sel.kind === 'node' || sel.kind === 'scene' || sel.kind === 'responder' || sel.kind === 'exit' ? sel.scene : sel.kind === 'segue' ? b.doc.segues.find((g) => g.id === sel.segue)?.from : null;
    if (!sceneId) return;
    const scene = b.doc.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const path = sel.kind === 'node' ? pathTo(scene.root, sel.ids[0]).slice(0, -1) : [];
    const keys = [`scene:${sceneId}`, ...path.map((n) => n.id)];
    // A node in a slot: open the slot's row too.
    if (sel.kind === 'node' && path.length) {
      const parent = path[path.length - 1];
      for (const [slot, list] of Object.entries(parent.slots ?? {})) if (list.some((c) => c.id === sel.ids[0])) keys.push(`slot:${parent.id}:${slot}`);
    }
    setExpanded((prev) => (keys.every((k) => prev.has(k)) ? prev : new Set([...prev, ...keys])));
    // Keep the selected row in view.
    requestAnimationFrame(() => document.querySelector(`[data-ib-outline] [data-key="${CSS.escape(keyOf(sel) ?? '')}"]`)?.scrollIntoView({ block: 'nearest' }));
  }, [b.selection, b.doc]);

  return (
    <div data-ib-outline className="flex min-h-0 flex-1 flex-col">
      <Tree
        aria-label="Document outline"
        items={items}
        selectionMode="single"
        selectedKeys={selected ? [selected] : []}
        onSelectionChange={(keys) => {
          const k = [...(keys as Set<Key>)][0];
          if (k != null) b.select(selectionOf(String(k), b.doc));
        }}
        onAction={(k) => {
          const key = String(k);
          if (key.startsWith('scene:')) onFocusScene(key.slice(6));
        }}
        expandedKeys={expanded}
        onExpandedChange={(keys) => setExpanded(new Set(keys))}
        className="bl-scroll min-h-0 flex-1 overflow-auto px-1.5 py-1 outline-none"
      >
        {renderItem}
      </Tree>
      <div className="flex shrink-0 items-center gap-1 border-t border-border p-1.5">
        <PlainButton
          onPress={() => {
            const last = b.doc.scenes.reduce((m, s) => (s.x > m.x ? s : m), b.doc.scenes[0]);
            const s = newScene(b.doc, (last?.x ?? 0) + 640, last?.y ?? 0);
            b.commit((d) => ({ ...d, scenes: [...d.scenes, s] }), { kind: 'scene', scene: s.id });
            onFocusScene(s.id);
          }}
          className="flex h-7 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 text-footnote font-medium text-primary outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring"
        >
          <Icon name="plus" size={14} sw={2.4} /> Scene
        </PlainButton>
        <PlainButton
          onPress={() => {
            const c = newContext(b.doc);
            b.commit((d) => ({ ...d, contexts: [...d.contexts, c] }), { kind: 'context', context: c.id });
          }}
          className="flex h-7 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 text-footnote font-medium text-primary outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring"
        >
          <Icon name="plus" size={14} sw={2.4} /> Context
        </PlainButton>
      </div>
    </div>
  );
}

export function Navigator({ onFocusScene }: { onFocusScene: (id: string) => void }) {
  const [tab, setTab] = useState<'outline' | 'library'>('outline');
  return (
    <div data-slot="ib-navigator" className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border p-2">
        <Segmented
          aria-label="Navigator"
          value={tab}
          onChange={(v) => setTab(v as 'outline' | 'library')}
          options={[{ id: 'outline', label: 'Outline' }, { id: 'library', label: 'Library' }]}
        />
      </div>
      {tab === 'outline' ? <Outline onFocusScene={onFocusScene} /> : <LibraryList className="flex-1" />}
    </div>
  );
}
