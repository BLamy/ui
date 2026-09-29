/* The notes list, grouped Pinned · Today · Yesterday · Previous 7 Days · Previous 30 Days · months, and the
   gallery of thumbnails. Rows are one flat, keyed list with the section headers in it, so a note that gets
   pinned (or edited to the top of Today) glides to its new place on the smooth spring instead of jumping;
   new notes grow in, deleted ones collapse out. Swipe right to pin, left to lock or delete (ListRow actions). */
import { useRef, type ReactNode } from 'react';
import { Haptics, Icon, ListRow, cn, springs, useMotion, useSplitView } from '@brett_lamy/ui';
import { FOLDERS, shortDate, snippet, title, type Note } from './data';
import type { NotesState } from './use-notes';

const folderName = (id: string) => FOLDERS.find((f) => f.id === id)?.title ?? 'Notes';

/* ListRow draws a card row: kept for the phone's inset cards; on the column it's transparent, 20px in. */
const PLAIN = '[&>[data-slot=list-row-content]]:bg-transparent [&>[data-slot=list-row-content]]:pl-5';

function NoteRow({ notes, n, selected, inset, first, last, isEdge, onOpen }: {
  notes: NotesState; n: Note; selected: boolean; inset?: boolean; first: boolean; last: boolean;
  isEdge?: (x: number) => boolean; onOpen: (id: string) => void;
}) {
  const { motion } = useMotion();
  const locked = !!n.locked;
  const showFolder = !!notes.folder.match || !!notes.tag || !!notes.query;
  return (
    <ListRow divider={false} isEdge={isEdge} onPress={() => { Haptics.selection(); onOpen(n.id); }}
      className={cn(inset ? cn(first && 'rounded-t-[12px]', last && 'rounded-b-[12px]') : PLAIN)}
      // Index 0 is the outermost action: the one a long swipe fires.
      leadingActions={n.folder === 'deleted' ? undefined : [{
        label: n.pinned ? 'Unpin' : 'Pin', icon: n.pinned ? 'pushpin-slash' : 'pushpin-fill', tint: '#FF9F0A', onAction: () => notes.togglePin(n.id),
      }]}
      trailingActions={[
        { label: 'Delete', icon: 'trash', destructive: true, onAction: () => notes.remove(n.id) },
        { label: locked ? 'Unlock' : 'Lock', icon: locked ? 'lock-open' : 'lock', tint: '#8E8E93', onAction: () => notes.toggleLock(n.id) },
      ]}
      trailing={locked ? <Icon name={notes.isLocked(n) ? 'lock-fill' : 'lock-open'} size={16}
        className={cn('relative', selected ? 'text-primary-foreground' : 'text-muted-foreground')} /> : null}
      title={<>
        {/* Positioned against the row body (which starts where the text does). */}
        {selected ? (
          <motion.span layoutId="note-selection" transition={springs.snappy} aria-hidden="true"
            className="absolute inset-y-[2px] -right-2 -left-3 rounded-[9px] bg-primary" />
        ) : null}
        <span className={cn('relative block py-[3px]', selected && 'text-primary-foreground')}>
          <span className="block truncate text-[15.5px] leading-[1.35] font-semibold tracking-[-.15px]">{title(n)}</span>
          <span className="flex gap-2 text-[14px] leading-[1.35]">
            <span className={cn('shrink-0 font-medium', selected ? 'opacity-90' : 'text-foreground/80')}>{shortDate(n.updated)}</span>
            <span className={cn('min-w-0 truncate', selected ? 'opacity-75' : 'text-muted-foreground')}>{notes.isLocked(n) ? 'Locked' : snippet(n)}</span>
          </span>
          {showFolder ? (
            <span className={cn('mt-0.5 flex items-center gap-1 text-[12.5px]', selected ? 'opacity-75' : 'text-muted-foreground')}>
              <Icon name="folder" size={13} weight="medium" />{folderName(n.folder === 'deleted' ? n.deletedFrom ?? 'notes' : n.folder)}
            </span>
          ) : null}
        </span>
        {!last ? <span aria-hidden="true" className={cn('absolute -right-4 bottom-0 left-0 h-px bg-border', selected && 'opacity-0')} /> : null}
      </>} />
  );
}

const Header = ({ children, inset }: { children: ReactNode; inset?: boolean }) => (
  <h2 className={cn('m-0', inset ? 'px-1 pt-5 pb-2 text-[20px] font-bold tracking-[-.3px]' : 'px-5 pt-4 pb-1.5 text-[13px] font-semibold text-muted-foreground')}>{children}</h2>
);

function Empty({ notes }: { notes: NotesState }) {
  return (
    <div className="px-6 pt-20 text-center">
      <div className="mb-2 grid place-items-center text-tertiary-foreground"><Icon name="note" size={44} sw={1.3} /></div>
      <div className="text-[18px] font-semibold text-muted-foreground">{notes.query ? 'No Results' : 'No Notes'}</div>
      {notes.query ? <div className="mt-1 text-[14px] text-tertiary-foreground">Nothing matches “{notes.query}”.</div> : null}
    </div>
  );
}

/** Wide layouts draw the selection; `inset` draws iOS inset-grouped cards (the phone). */
export function NoteList({ notes, onOpen, inset }: { notes: NotesState; onOpen: (id: string) => void; inset?: boolean }) {
  const { motion, AnimatePresence, LayoutGroup } = useMotion();
  const s = useSplitView();
  const list = useRef<HTMLDivElement | null>(null);
  // On the phone the leading edge belongs to the back swipe.
  const isEdge = s.collapsed ? (x: number) => x - (list.current?.getBoundingClientRect().left ?? 0) < 28 : undefined;
  const items = notes.groups.flatMap((g) => [
    { key: `h:${g.title}`, header: g.title } as const,
    ...g.notes.map((n, i) => ({ key: n.id, note: n, first: i === 0, last: i === g.notes.length - 1 }) as const),
  ]);
  return (
    <div className={cn('pb-16', inset && 'px-4')}>
      <LayoutGroup id={`notes-${notes.folderId}-${notes.tag}`}>
        <div ref={list} key={`${notes.folderId}-${notes.tag}`}>
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.div key={it.key} layout="position" className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ layout: springs.smooth, height: springs.smooth, opacity: { duration: 0.18 } }}>
                {'header' in it
                  ? <Header inset={inset}>{it.header}</Header>
                  : <NoteRow notes={notes} n={it.note} first={it.first} last={it.last} inset={inset} isEdge={isEdge}
                      selected={!s.collapsed && notes.selectedId === it.note.id} onOpen={onOpen} />}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      {items.length === 0 ? <Empty notes={notes} /> : null}
    </div>
  );
}

/* ── Gallery ── */
function Thumbnail({ n, locked }: { n: Note; locked: boolean }) {
  if (locked) return <div className="grid h-full place-items-center text-muted-foreground"><Icon name="lock-fill" size={30} /></div>;
  const lines = n.body.split('\n').filter((l) => l.trim() && !/^\s*\|?\s*-{3}/.test(l)).slice(0, 12);
  return (
    <div className="flex flex-col gap-[3px] text-[8.5px] leading-[1.3] text-foreground">
      {lines.map((l, i) => {
        const task = /^[-*]\s+\[([ x])\]\s*(.*)$/.exec(l);
        if (i === 0) return <div key={i} className="truncate text-[11px] font-bold">{l.replace(/^#+\s*/, '')}</div>;
        if (/^#+\s/.test(l)) return <div key={i} className="truncate pt-[2px] text-[9.5px] font-bold">{l.replace(/^#+\s*/, '')}</div>;
        if (task) return (
          <div key={i} className="flex items-center gap-[4px] truncate">
            <span className={cn('size-[7px] shrink-0 rounded-full', task[1] === 'x' ? 'bg-primary' : 'shadow-[inset_0_0_0_1px_var(--tertiary-foreground)]')} />
            <span className={cn('truncate', task[1] === 'x' && 'text-muted-foreground')}>{task[2]}</span>
          </div>
        );
        if (l.trim().startsWith('|')) return (
          <div key={i} className="grid grid-flow-col gap-px bg-border">
            {l.split('|').slice(1, -1).map((c, j) => <span key={j} className="truncate bg-card px-[2px]">{c.trim()}</span>)}
          </div>
        );
        return <div key={i} className="line-clamp-2">{l.replace(/^[-*]\s+|^\d+\.\s+/, '• ')}</div>;
      })}
    </div>
  );
}

/** `selected` draws a tinted ring around that note's card. */
export function NoteGallery({ notes, onOpen, selected }: { notes: NotesState; onOpen: (id: string) => void; selected?: string | null }) {
  const { motion, AnimatePresence } = useMotion();
  return (
    <div className="px-4 pb-16">
      {notes.groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <Header>{g.title}</Header>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-4 px-1">
            <AnimatePresence initial={false}>
              {g.notes.map((n) => {
                const on = selected === n.id;
                return (
                  <motion.button key={n.id} type="button" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }} transition={springs.smooth} data-note-card=""
                    onClick={() => { Haptics.selection(); onOpen(n.id); }}
                    className="bl-btn flex min-w-0 cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 [font-family:inherit] text-foreground">
                    <span className={cn('block aspect-[4/3.3] w-full overflow-hidden rounded-[10px] bg-card p-2.5 text-left',
                      'shadow-[0_0_0_1px_var(--border),0_1px_3px_rgba(0,0,0,.06)] transition-shadow duration-200',
                      on && 'shadow-[0_0_0_3px_var(--primary)]')}>
                      <Thumbnail n={n} locked={notes.isLocked(n)} />
                    </span>
                    <span className="mt-1 w-full truncate text-center text-[13px] font-semibold">{title(n)}</span>
                    <span className="-mt-0.5 text-[12px] text-muted-foreground">{shortDate(n.updated)}</span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      ))}
      {notes.groups.length === 0 ? <Empty notes={notes} /> : null}
    </div>
  );
}
