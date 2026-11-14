/* The library (Xcode's ⇧⌘L): every component the catalog offers, searchable, grouped by kind. Drag one onto a scene
   (the canvas shows where it will land), or press it (Return) to add it to the selected container. Items are raw
   elements because they carry a pointer drag, so they keep their own button role and keyboard handling. Resting on one
   (or tabbing to it) shows the list's one hover card: the component drawn as it's inserted, where it comes from, and its props,
   events and slots (previews.tsx). Pressing closes it, so it's never over the canvas a drag is aiming at. */
import { useMemo, useState, type PointerEvent, type RefObject } from 'react';
import { bindDrag, dragThreshold } from '@ui-sdk/core';
import { createHoverCardController, HoverCard, HoverCardContent, HoverCardTrigger, type HoverCardController } from '@/components/ui/hover-card';
import { SearchField } from '@/components/ui/search-field';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { LIBRARY, SECTIONS, specOf, type LibraryItem } from './catalog';
import { libraryDrag, useLibraryDrag } from './dnd';
import { LibraryCard } from './previews';
import { findNode, placeOf } from './tree';
import { useBuilder, type Builder } from './store';

/** Where a pressed library item goes: into the selected container, after the selected node, or into the selected scene. */
export function insertFromLibrary(b: Builder, item: LibraryItem): boolean {
  const scene = b.scene ?? b.doc.scenes.find((s) => s.id === b.doc.entry) ?? null;
  if (!scene) return false;
  const sel = b.selection.kind === 'node' ? b.selection.ids[0] : null;
  const target = sel ? findNode(scene.root, sel) : null;
  if (target && specOf(target.type).container) {
    b.insert(item.make(), { parent: target.id, slot: null, index: target.children?.length ?? 0 });
    return true;
  }
  const at = sel ? placeOf(scene.root, sel) : null;
  if (at) b.insert(item.make(), { ...at, index: at.index + 1 });
  else b.insert(item.make(), { parent: scene.root.id, slot: null, index: scene.root.children?.length ?? 0 });
  return true;
}

export function LibraryList({ onDragStart, onInserted, autoFocus, className }: { onDragStart?: () => void; onInserted?: () => void; autoFocus?: boolean; className?: string }) {
  const b = useBuilder();
  const [q, setQ] = useState('');
  // One card for every row: it follows the row the pointer rests on (or focus is on).
  const [previews] = useState(() => createHoverCardController<LibraryItem>());
  const groups = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = LIBRARY.filter((it) => words.every((w) => `${it.title} ${it.keywords} ${it.description}`.toLowerCase().includes(w)));
    return SECTIONS.map((c) => ({ section: c, items: hits.filter((it) => it.section === c) })).filter((g) => g.items.length);
  }, [q]);
  return (
    <div data-slot="ib-library" className={cn('flex min-h-0 flex-col', className)}>
      <div className="p-2.5 pb-1.5">
        <SearchField value={q} onValueChange={setQ} placeholder="Filter components" autoFocus={autoFocus} aria-label="Filter components" />
      </div>
      <div className="bl-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {groups.length ? groups.map((g) => (
          <section key={g.section} aria-label={g.section} className="pt-2">
            <h3 className="m-0 flex items-center justify-between px-2 pb-1 text-caption2 font-semibold tracking-wide text-muted-foreground uppercase">
              {g.section}
              <span className="font-mono font-normal tracking-normal normal-case">{g.section === 'Layout' ? 'HTML + Tailwind' : g.section === 'React' ? 'react' : '@brett_lamy/ui'}</span>
            </h3>
            {g.items.map((it) => (
              <LibraryRow key={it.id} item={it} previews={previews} onDragStart={onDragStart} onInsert={() => { if (insertFromLibrary(b, it)) onInserted?.(); }} />
            ))}
          </section>
        )) : <p className="m-0 px-3 py-6 text-center text-footnote text-muted-foreground">No components match “{q}”.</p>}
      </div>
      <HoverCard controller={previews}>
        <HoverCardContent<LibraryItem> side="right" align="start" className="w-80">
          {({ payload }) => (payload ? <LibraryCard item={payload} doc={b.doc} /> : null)}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

function LibraryRow({ item, previews, onDragStart, onInsert }: { item: LibraryItem; previews: HoverCardController<LibraryItem>; onDragStart?: () => void; onInsert: () => void }) {
  // A press that moves past the drag threshold picks the item up; one that doesn't is a click, and a click (or Enter
  // or Space) inserts it. The gesture follows the pointer on the document, so it carries on after a drag closes the
  // library popover this row is in; `bindDrag` swallows the click a drag's release sends.
  const down = (e: PointerEvent<HTMLElement>) => {
    previews.close();
    if (e.button !== 0) return;
    let dragging = false;
    bindDrag(e.currentTarget, e.nativeEvent, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onStart: (ev) => {
        dragging = true;
        libraryDrag.start(item, ev.clientX, ev.clientY);
        onDragStart?.();
      },
      onMove: ({ x, y }) => libraryDrag.move(x, y),
      onEnd: (_, canceled) => {
        if (!dragging) return;
        if (canceled) libraryDrag.cancel();
        else libraryDrag.end();
      },
    });
  };
  return (
    <HoverCardTrigger
      controller={previews}
      payload={item}
      render={<button type="button" />}
      aria-label={`${item.title}: ${item.description}`}
      onPointerDown={down}
      onClick={onInsert}
      className="group flex w-full cursor-grab touch-none items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-inherit no-underline outline-none select-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary group-hover:bg-background">
        <Icon name={typeof item.icon === 'string' ? item.icon : undefined} shapes={typeof item.icon === 'string' ? undefined : item.icon} size={18} sw={1.8} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-footnote font-medium text-foreground">{item.source === 'kit' ? `<${item.title}>` : item.title}</span>
        <span className="truncate text-caption2 text-muted-foreground">{item.description}</span>
      </span>
    </HoverCardTrigger>
  );
}

/** The item being dragged, under the pointer (placed in `root`, which may sit inside a transformed demo frame). */
export function LibraryGhost({ root }: { root: RefObject<HTMLElement | null> }) {
  const d = useLibraryDrag();
  const r = root.current?.getBoundingClientRect();
  if (!d || !r) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[2000] flex items-center gap-2 rounded-xl bg-popover py-1.5 pr-3 pl-1.5 text-footnote font-medium text-foreground shadow-[0_10px_30px_black] shadow-black/25 ring-1 ring-border"
      style={{ left: d.x - r.left + 12, top: d.y - r.top + 10 }}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Icon name={typeof d.item.icon === 'string' ? d.item.icon : undefined} shapes={typeof d.item.icon === 'string' ? undefined : d.item.icon} size={16} sw={1.9} />
      </span>
      {d.item.title}
    </div>
  );
}
