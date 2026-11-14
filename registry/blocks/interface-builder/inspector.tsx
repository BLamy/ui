/* The inspector, Xcode's: a row of tabs for what's selected (⌥⌘1–5), and under it the panels. An element has
   Attributes (its props), Layout, Connections (outlet, first responder, actions), Motion and Code; a scene has its
   hooks and its code; a segue, a context, the entry point, a scene's First Responder and Exit each have their own;
   with nothing selected it inspects the storyboard. */
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { useShortcut, useShortcutHint } from '@ui-sdk/react/shortcuts';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { Icon, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { nodeLabel, specOf } from './catalog';
import { CodePanel } from './code';
import { IconAction, TextInput } from './fields';
import { ContextPanel, DeleteScene, DocPanel, EntryPanel, SeguePanel } from './inspect-doc';
import { MotionPanel } from './inspect-motion';
import { AttributesPanel, ConnectionsPanel, Empty, LayoutPanel, type NodeCtx } from './inspect-node';
import { ExitPanel, ResponderPanel, ScenePanel } from './inspect-scene';
import { mapNodeIn } from './ops';
import { namesAt, scopeAt } from './scope';
import { useBuilder } from './store';
import { pathTo } from './tree';

/** Glyphs the icon set doesn't have (24px grid). */
const G_RULER: IconShape[] = [{ r: [3, 8, 18, 8, 1.5] }, { d: 'M7 8v3M11 8v4M15 8v3M19 8v4' }];
const G_BRACES: IconShape[] = [{ d: 'M9 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2.5 3 1.5.5 2.5 1.5 2.5 3v2c0 2 1 3 3 3' }, { d: 'M15 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2.5 3-1.5.5-2.5 1.5-2.5 3v2c0 2-1 3-3 3' }];
const G_CONNECT: IconShape[] = [{ c: [12, 12, 8.5] }, { d: 'M8.5 12h7M13 9l3 3-3 3' }];

interface TabDef { id: string; label: string; icon?: string; shapes?: IconShape[]; panel: ReactNode }

export function Inspector({ onPlay }: { onPlay: () => void }) {
  const b = useBuilder();
  const { doc, selection } = b;
  const [tabByKind, setTabByKind] = useState<Record<string, string>>({});

  let header: ReactNode = null;
  let tabs: TabDef[] = [];
  const kind = selection.kind === 'node' && selection.ids.length > 1 ? 'multi' : selection.kind;

  if (selection.kind === 'node' && b.scene && b.nodes.length === 1) {
    const scene = b.scene, node = b.nodes[0];
    const ctx: NodeCtx = {
      doc, scene, node,
      names: namesAt(doc, scene, node.id),
      scope: scopeAt(doc, scene, node.id),
      update: (fn, live) => (live ? b.patch((d) => mapNodeIn(d, scene.id, node.id, fn)) : b.updateNode(node.id, fn)),
      begin: b.begin,
      preview: (props) => b.setPreview(props ? { target: node.id, props } : null),
    };
    header = <NodeHeader ctx={ctx} />;
    tabs = [
      { id: 'attributes', label: 'Attributes', icon: 'sliders', panel: <AttributesPanel ctx={ctx} /> },
      { id: 'layout', label: 'Layout', shapes: G_RULER, panel: <LayoutPanel ctx={ctx} /> },
      { id: 'connections', label: 'Connections', shapes: G_CONNECT, panel: <ConnectionsPanel ctx={ctx} onSelectSegue={(id) => b.select({ kind: 'segue', segue: id })} /> },
      { id: 'motion', label: 'Motion', icon: 'sparkle', panel: <MotionPanel ctx={ctx} onPlay={onPlay} /> },
      { id: 'code', label: 'Code', shapes: G_BRACES, panel: <CodePanel doc={doc} scene={scene} node={node} /> },
    ];
  } else if (kind === 'multi' && b.scene) {
    header = <MultiHeader count={b.nodes.length} />;
    tabs = [{ id: 'selection', label: 'Selection', icon: 'square-on-square', panel: <Empty>{b.nodes.map((n) => nodeLabel(n, doc)).join(', ')}</Empty> }];
  } else if (selection.kind === 'scene' && b.scene) {
    const scene = b.scene;
    header = <SimpleHeader icon="circle-fill" title={scene.name} subtitle="Scene · a React component" tone="warning" />;
    tabs = [
      { id: 'scene', label: 'Scene', icon: 'circle-fill', panel: <><ScenePanel scene={scene} doc={doc} /><DeleteScene sceneId={scene.id} doc={doc} /></> },
      { id: 'code', label: 'Code', shapes: G_BRACES, panel: <CodePanel doc={doc} scene={scene} node={null} /> },
    ];
  } else if (selection.kind === 'responder' && b.scene) {
    header = <SimpleHeader icon="bolt-fill" title="First Responder" subtitle={b.scene.name} tone="warning" />;
    tabs = [{ id: 'responder', label: 'First Responder', icon: 'bolt-fill', panel: <ResponderPanel scene={b.scene} doc={doc} /> }];
  } else if (selection.kind === 'exit' && b.scene) {
    header = <SimpleHeader icon="arrow-uturn-backward" title="Exit" subtitle={b.scene.name} tone="destructive" />;
    tabs = [{ id: 'exit', label: 'Exit', icon: 'arrow-uturn-backward', panel: <ExitPanel scene={b.scene} doc={doc} /> }];
  } else if (selection.kind === 'segue') {
    const segue = doc.segues.find((g) => g.id === selection.segue);
    if (segue) {
      header = <SimpleHeader icon="arrow-right" title={segue.identifier} subtitle="Segue" />;
      tabs = [{ id: 'segue', label: 'Segue', icon: 'arrow-right', panel: <SeguePanel segue={segue} doc={doc} /> }];
    }
  } else if (selection.kind === 'context') {
    const ctx = doc.contexts.find((c) => c.id === selection.context);
    if (ctx) {
      header = <SimpleHeader icon="square-on-square" title={ctx.name} subtitle="Context" tone="success" />;
      tabs = [{ id: 'context', label: 'Context', icon: 'square-on-square', panel: <ContextPanel ctx={ctx} doc={doc} /> }];
    }
  } else if (selection.kind === 'entry') {
    header = <SimpleHeader icon="arrow-right" title="Entry Point" subtitle="Storyboard" />;
    tabs = [{ id: 'entry', label: 'Entry Point', icon: 'arrow-right', panel: <EntryPanel doc={doc} /> }];
  }
  if (!tabs.length) {
    header = <SimpleHeader icon="doc" title={doc.name} subtitle="Storyboard" />;
    tabs = [
      { id: 'storyboard', label: 'Storyboard', icon: 'doc', panel: <DocPanel doc={doc} /> },
      { id: 'code', label: 'Code', shapes: G_BRACES, panel: <CodePanel doc={doc} scene={null} node={null} /> },
    ];
  }

  const current = tabs.find((t) => t.id === tabByKind[kind]) ?? tabs[0];
  const setTab = (id: string) => setTabByKind((m) => ({ ...m, [kind]: id }));
  const root = useRef<HTMLDivElement>(null);

  return (
    <Tabs ref={root} value={current.id} onValueChange={(k) => k != null && setTab(k)} className="flex min-h-0 flex-1 flex-col">
      <TabsList aria-label="Inspectors" className="flex h-10 shrink-0 items-center justify-center gap-0.5 border-b border-border px-2">
        {tabs.map((t, i) => <InspectorTab key={t.id} tab={t} n={i + 1} root={root} onPick={() => setTab(t.id)} />)}
      </TabsList>
      {header}
      {tabs.map((t) => (
        <TabsPanel key={t.id} value={t.id} className="bl-scroll min-h-0 flex-1 overflow-y-auto outline-none">
          {t.panel}
        </TabsPanel>
      ))}
    </Tabs>
  );
}

/** A tab, and its ⌥⌘1…5 shortcut, as in Xcode: it works while focus is anywhere in this builder. */
function InspectorTab({ tab, n, root, onPick }: { tab: TabDef; n: number; root: RefObject<HTMLElement | null>; onPick: () => void }) {
  const keys = `alt+mod+${n}`;
  const hint = useShortcutHint(keys);
  useShortcut(keys, () => onPick(), {
    when: () => !!root.current?.closest('[data-slot=interface-builder]')?.contains(document.activeElement),
    description: `${tab.label} inspector`,
  });
  return (
    <TabsTab
      value={tab.id}
      aria-label={tab.label}
      aria-keyshortcuts={hint.ariaKeyshortcuts}
      className="grid size-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-selected:bg-primary/12 data-selected:text-primary"
    >
      <span title={`${tab.label} (${hint.text})`}><Icon name={tab.icon} shapes={tab.shapes} size={17} sw={1.9} /></span>
    </TabsTab>
  );
}

function SimpleHeader({ icon, title, subtitle, tone }: { icon: string; title: string; subtitle: string; tone?: 'warning' | 'destructive' | 'success' }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-3.5 py-2.5">
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-white', tone === 'warning' ? 'bg-warning' : tone === 'destructive' ? 'bg-destructive' : tone === 'success' ? 'bg-success' : 'bg-primary')}>
        <Icon name={icon} size={16} sw={2.2} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-footnote font-semibold">{title}</span>
        <span className="truncate text-caption2 text-muted-foreground">{subtitle}</span>
      </span>
    </div>
  );
}

function NodeHeader({ ctx }: { ctx: NodeCtx }) {
  const b = useBuilder();
  const { node, scene } = ctx;
  const spec = specOf(node.type);
  const isRoot = scene.root.id === node.id;
  const path = pathTo(scene.root, node.id);
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Icon name={typeof spec.icon === 'string' ? spec.icon : undefined} shapes={typeof spec.icon === 'string' ? undefined : spec.icon} size={16} sw={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-footnote font-semibold">{spec.title}</span>
          <span className="truncate font-mono text-caption2 text-muted-foreground">{spec.module ? `<${spec.tag}> · ${spec.module.replace('@/components/ui/', '')}` : `<${spec.tag}>`}</span>
        </span>
        {!isRoot ? (
          <>
            <DropdownMenu onAction={(k) => b.embed([node.id], k as 'vertical' | 'horizontal' | 'overlay')}>
              <DropdownMenuTrigger aria-label="Embed in stack" title="Embed in Stack" className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <Icon name="square-on-square" size={13} sw={2.2} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem value="vertical">Embed in Vertical Stack</DropdownMenuItem>
                <DropdownMenuItem value="horizontal">Embed in Horizontal Stack</DropdownMenuItem>
                <DropdownMenuItem value="overlay">Embed in Overlay Stack</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <IconAction icon="copy" label="Duplicate (⌘D)" onClick={() => b.duplicate([node.id])} />
            <IconAction icon="trash" label="Delete (⌫)" tone="danger" onClick={() => b.remove([node.id])} />
          </>
        ) : null}
      </div>
      <TextInput label="Name" value={node.name ?? ''} placeholder={nodeLabel({ ...node, name: undefined }, b.doc)} onCommit={(v) => ctx.update((n) => ({ ...n, name: v.trim() || undefined }))} />
      {path.length > 1 ? (
        <nav aria-label="Path" className="flex min-w-0 flex-wrap items-center gap-0.5 text-caption2 text-muted-foreground">
          <PlainButton onClick={() => b.select({ kind: 'scene', scene: scene.id })} className="cursor-pointer rounded border-0 bg-transparent px-0.5 text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{scene.name}</PlainButton>
          {path.map((n) => (
            <span key={n.id} className="flex items-center gap-0.5">
              <Icon name="chevron-right" size={9} sw={2.6} />
              <PlainButton onClick={() => b.selectNode(n.id)} className={cn('max-w-28 cursor-pointer truncate rounded border-0 bg-transparent px-0.5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring', n.id === node.id ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {nodeLabel(n, b.doc)}
              </PlainButton>
            </span>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function MultiHeader({ count }: { count: number }) {
  const b = useBuilder();
  const ids = b.nodes.map((n) => n.id);
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3.5 py-3">
      <span className="text-footnote font-semibold">{count} elements</span>
      <div className="flex flex-wrap gap-1.5">
        {(['vertical', 'horizontal', 'overlay'] as const).map((axis) => (
          <PlainButton key={axis} onClick={() => b.embed(ids, axis)} className="h-7 cursor-pointer rounded-md border-0 bg-secondary px-2 text-caption font-medium outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">
            Embed in {axis === 'vertical' ? 'V' : axis === 'horizontal' ? 'H' : 'Overlay'} Stack
          </PlainButton>
        ))}
        <PlainButton onClick={() => b.duplicate(ids)} className="h-7 cursor-pointer rounded-md border-0 bg-secondary px-2 text-caption font-medium outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">Duplicate</PlainButton>
        <PlainButton onClick={() => b.remove(ids)} className="h-7 cursor-pointer rounded-md border-0 bg-secondary px-2 text-caption font-medium text-destructive outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">Delete</PlainButton>
      </div>
    </div>
  );
}
