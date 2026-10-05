/* The library (Xcode's ⇧⌘L): every component the catalog offers, searchable, grouped by kind. Drag one onto a scene
   (the canvas shows where it will land), or press it (Return) to add it to the selected container. Items are raw
   elements because they carry a pointer drag, so they keep their own button role and keyboard handling. */
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { SearchField } from '@/components/ui/search-field';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { LIBRARY, SECTIONS, specOf, type LibraryItem } from './catalog';
import { libraryDrag, useLibraryDrag } from './dnd';
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
  const groups = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = LIBRARY.filter((it) => words.every((w) => `${it.title} ${it.keywords} ${it.description}`.toLowerCase().includes(w)));
    return SECTIONS.map((c) => ({ section: c, items: hits.filter((it) => it.section === c) })).filter((g) => g.items.length);
  }, [q]);
  return (
    <div data-slot="ib-library" className={cn('flex min-h-0 flex-col', className)}>
      <div className="p-2.5 pb-1.5">
        <SearchField value={q} onChange={setQ} placeholder="Filter components" autoFocus={autoFocus} aria-label="Filter components" />
      </div>
      <div className="bl-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {groups.length ? groups.map((g) => (
          <section key={g.section} aria-label={g.section} className="pt-2">
            <h3 className="m-0 flex items-center justify-between px-2 pb-1 text-caption2 font-semibold tracking-wide text-muted-foreground uppercase">
              {g.section}
              <span className="font-mono font-normal tracking-normal normal-case">{g.section === 'Layout' ? 'HTML + Tailwind' : g.section === 'React' ? 'react' : '@brett_lamy/ui'}</span>
            </h3>
            {g.items.map((it) => (
              <LibraryRow key={it.id} item={it} onDragStart={onDragStart} onInsert={() => { if (insertFromLibrary(b, it)) onInserted?.(); }} />
            ))}
          </section>
        )) : <p className="m-0 px-3 py-6 text-center text-footnote text-muted-foreground">No components match “{q}”.</p>}
      </div>
    </div>
  );
}

function LibraryRow({ item, onDragStart, onInsert }: { item: LibraryItem; onDragStart?: () => void; onInsert: () => void }) {
  const start = useRef<{ x: number; y: number; id: number; dragging: boolean } | null>(null);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    if (!s.dragging) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return;
      s.dragging = true;
      libraryDrag.start(item, e.clientX, e.clientY);
      onDragStart?.();
    }
    libraryDrag.move(e.clientX, e.clientY);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    if (s.dragging) libraryDrag.end();
    else onInsert();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInsert(); }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.title}: ${item.description}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { if (start.current?.dragging) libraryDrag.cancel(); start.current = null; }}
      onKeyDown={key}
      className="group flex cursor-grab touch-none items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none select-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary group-hover:bg-background">
        <Icon name={typeof item.icon === 'string' ? item.icon : undefined} shapes={typeof item.icon === 'string' ? undefined : item.icon} size={18} sw={1.8} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-footnote font-medium text-foreground">{item.source === 'kit' ? `<${item.title}>` : item.title}</span>
        <span className="truncate text-caption2 text-muted-foreground" title={item.description}>{item.description}</span>
      </span>
    </div>
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
