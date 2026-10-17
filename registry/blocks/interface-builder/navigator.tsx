/* The navigator: the document outline (Xcode's) and the library. The outline is the library's Tree (Trees) — arrows
   move, → and ← open and close, typing searches, Return on a scene focuses it — and stays in step with the canvas: select a row and the canvas selects it;
   select on the canvas and the outline opens to it. Every scene lists its view tree (slots by name), its First
   Responder and Exit proxies, and the segues that leave it. Badges say what a node is wired to: @outlet, ƒ binding,
   ↻ repeat, if, ⚡ actions, ✦ motion. */
import { useMemo, useState } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { Segmented } from '@/components/ui/segmented';
import { Tree, type TreeNode } from '@/components/ui/tree';
import { Icon, type IconName } from '@/lib/icon';
import { nodeLabel, specOf } from './catalog';
import { LibraryList } from './library';
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

/** An outline row: the item's name, an icon for leaves, and what it's wired to after the label. */
function toNode(item: Item): TreeNode {
  const kids = 'children' in item && item.children.length ? { children: item.children.map(toNode) } : {};
  switch (item.kind) {
    case 'entry': return { id: item.id, name: item.label, icon: 'arrow-right' };
    case 'contexts': return { id: item.id, name: 'Contexts', ...kids };
    case 'context': return { id: item.id, name: item.ctx.name, icon: 'circle-fill', detail: item.ctx.alias, detailTitle: 'Read it as' };
    case 'scene': return { id: item.id, name: item.scene.name, ...kids };
    case 'responder': {
      const handles = Object.keys(item.scene.responds ?? {}).length;
      return { id: item.id, name: 'First Responder', icon: 'bolt-fill', ...(handles ? { detail: String(handles), detailTitle: 'Commands it handles' } : {}) };
    }
    case 'exit': return { id: item.id, name: 'Exit', icon: 'arrow-uturn-backward' };
    case 'segue': return { id: item.id, name: `${SEGUE_KINDS.find((k) => k.id === item.segue.kind)?.label} → ${item.to}`, icon: SEGUE_GLYPH[item.segue.kind] as IconName };
    case 'slot': return { id: item.id, name: item.label.toUpperCase(), dimmed: true, ...kids };
    case 'node': {
      const n = item.node, spec = specOf(n.type);
      const actions = Object.values(n.on ?? {}).reduce((k, l) => k + l.length, 0);
      const m = n.motion;
      const moves = !!(m && (m.appear || m.hover || m.press || m.focus || m.exit || m.drag || m.layoutId || m.layout || Object.keys(m.variants ?? {}).length));
      const badges: [string, string][] = [
        ...(n.ref ? [[`@${n.ref}`, `Outlet: useRef → ${n.ref}`] as [string, string]] : []),
        ...(n.bind && Object.keys(n.bind).length ? [['ƒ', `Bound: ${Object.keys(n.bind).join(', ')}`] as [string, string]] : []),
        ...(n.repeat ? [['↻', `Repeats over ${n.repeat.each}`] as [string, string]] : []),
        ...(n.when ? [['if', `Shown when ${n.when}`] as [string, string]] : []),
        ...(actions ? [[`⚡${actions}`, `${actions} action${actions === 1 ? '' : 's'}`] as [string, string]] : []),
        ...(moves ? [['✦', 'Animated'] as [string, string]] : []),
      ];
      return {
        id: item.id, name: item.root ? `${item.label} (root)` : item.label,
        ...(typeof spec.icon === 'string' ? { icon: spec.icon as IconName } : {}),
        ...(badges.length ? { detail: badges.map(([b]) => b).join(' '), detailTitle: badges.map(([, t]) => t).join('; ') } : {}),
        ...kids,
      };
    }
  }
}

export function Outline({ onFocusScene }: { onFocusScene: (id: string) => void }) {
  const b = useBuilder();
  const items = useMemo(() => itemsOf(b.doc), [b.doc]);
  const selected = keyOf(b.selection);
  const nodes = useMemo(() => items.map(toNode), [items]);

  // Open the outline to whatever the canvas selected (the Tree scrolls the selected row into view).
  const opened = useMemo(() => {
    const sel = b.selection;
    const sceneId = sel.kind === 'node' || sel.kind === 'scene' || sel.kind === 'responder' || sel.kind === 'exit' ? sel.scene : sel.kind === 'segue' ? b.doc.segues.find((g) => g.id === sel.segue)?.from : null;
    const scene = sceneId ? b.doc.scenes.find((s) => s.id === sceneId) : undefined;
    if (!scene) return [];
    const path = sel.kind === 'node' ? pathTo(scene.root, sel.ids[0]).slice(0, -1) : [];
    const keys = [`scene:${scene.id}`, ...path.map((n) => n.id)];
    // A node in a slot: open the slot's row too.
    if (sel.kind === 'node' && path.length) {
      const parent = path[path.length - 1];
      for (const [slot, list] of Object.entries(parent.slots ?? {})) if (list.some((c) => c.id === sel.ids[0])) keys.push(`slot:${parent.id}:${slot}`);
    }
    return keys;
  }, [b.selection, b.doc]);

  return (
    <div data-ib-outline className="flex min-h-0 flex-1 flex-col">
      <Tree
        aria-label="Document outline"
        items={nodes}
        icons="none"
        density="compact"
        defaultExpanded={['contexts', ...b.doc.scenes.map((s) => `scene:${s.id}`)]}
        expandedIds={opened}
        selectedIds={selected ? [selected] : []}
        onSelectionChange={([k]) => { if (k != null) b.select(selectionOf(k, b.doc)); }}
        onAction={(node) => { if (node.id.startsWith('scene:')) onFocusScene(node.id.slice(6)); }}
        className="min-h-0 flex-1 px-1.5 py-1"
      />
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
