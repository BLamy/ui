/* Folders: iCloud (with All iCloud and Recently Deleted) and On My Mac, each collapsible, with note counts,
   plus tags. The split layout draws them as sidebar pills; the phone as an inset grouped list. */
import { useState } from 'react';
import {
  AnimatedHeight, Chevron, Haptics, ListRow, ListSection, NumberMorph, SplitViewContent, SplitViewHeader, SplitViewItem,
  SplitViewSidebar, cn,
} from '@brett_lamy/ui';
import { ICLOUD, ON_MY_MAC, TAGS, type Folder } from './data';
import { G } from './glyphs';
import { BarButton } from './parts';
import type { NotesState } from './use-notes';

const SECTIONS = [
  { id: 'icloud', title: 'iCloud', folders: ICLOUD },
  { id: 'mac', title: 'On My Mac', folders: ON_MY_MAC },
];
const glyph = (f: Folder) => f.glyph ?? 'folder';

function useCollapsed() {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return {
    isOpen: (id: string) => !closed[id],
    toggle: (id: string) => { setClosed((c) => ({ ...c, [id]: !c[id] })); Haptics.selection(); },
  };
}

function SectionToggle({ title, open, onToggle, className }: { title: string; open: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle}
      className={cn('bl-btn flex w-full cursor-pointer items-center border-0 bg-transparent [font-family:inherit] outline-none', className)}>
      <span className="flex-1 text-left">{title}</span>
      <Chevron direction={open ? 'down' : 'right'} size={14} sw={2.6} className="text-primary" />
    </button>
  );
}

function Tags({ notes }: { notes: NotesState }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
      {TAGS.map((t) => {
        const on = notes.tag === t;
        return (
          <button key={t} type="button" aria-pressed={on} onClick={() => notes.openTag(on ? null : t)}
            className={cn('bl-btn cursor-pointer rounded-full border-0 px-3 py-1.5 [font-family:inherit] text-[14px] transition-colors duration-150',
              on ? 'bg-primary text-primary-foreground' : 'bg-bl-fill text-foreground hover:bg-bl-fill2')}>#{t}</button>
        );
      })}
    </div>
  );
}

export function FoldersSidebar({ notes }: { notes: NotesState }) {
  const sec = useCollapsed();
  return (
    <SplitViewSidebar aria-label="Folders" width={240} minWidth={200}>
      <SplitViewHeader title="Folders" trailing={<BarButton label="New folder"><G name="folderPlus" /></BarButton>} />
      <SplitViewContent className="px-2.5 pb-6">
        {SECTIONS.map((s) => (
          <div key={s.id}>
            <SectionToggle title={s.title} open={sec.isOpen(s.id)} onToggle={() => sec.toggle(s.id)}
              className="px-2.5 pt-4 pb-1.5 text-[13px] font-semibold text-muted-foreground" />
            <AnimatedHeight>
              {sec.isOpen(s.id) ? (
                <div className="flex flex-col gap-px">
                  {s.folders.map((f) => (
                    <SplitViewItem key={f.id} id={f.id} title={f.title} icon={<G name={glyph(f)} size={21} />}
                      badge={<NumberMorph value={notes.count(f)} />} onPress={() => notes.openFolder(f.id)} />
                  ))}
                </div>
              ) : null}
            </AnimatedHeight>
          </div>
        ))}
        <SectionToggle title="Tags" open={sec.isOpen('tags')} onToggle={() => sec.toggle('tags')}
          className="px-2.5 pt-4 pb-2 text-[13px] font-semibold text-muted-foreground" />
        <AnimatedHeight>{sec.isOpen('tags') ? <Tags notes={notes} /> : null}</AnimatedHeight>
      </SplitViewContent>
    </SplitViewSidebar>
  );
}

/** Phone: inset grouped sections; pressing a folder pushes its notes. */
export function FoldersList({ notes, onOpen }: { notes: NotesState; onOpen: () => void }) {
  const sec = useCollapsed();
  return (
    <div className="px-4 pt-2">
      {SECTIONS.map((s) => (
        <ListSection key={s.id} title={
          <SectionToggle title={s.title} open={sec.isOpen(s.id)} onToggle={() => sec.toggle(s.id)}
            className="pt-2 text-[20px] font-bold tracking-[-.3px] text-foreground normal-case" />
        }>
          <AnimatedHeight>
            {sec.isOpen(s.id) ? (
              <div>
                {s.folders.map((f, i) => (
                  <ListRow key={f.id} title={f.title} accessory="chevron" divider={i < s.folders.length - 1}
                    leading={<span className="text-primary"><G name={glyph(f)} size={24} /></span>}
                    trailing={<span className="text-[17px] text-muted-foreground tabular-nums"><NumberMorph value={notes.count(f)} /></span>}
                    onPress={() => { Haptics.selection(); notes.openFolder(f.id); onOpen(); }} />
                ))}
              </div>
            ) : null}
          </AnimatedHeight>
        </ListSection>
      ))}
      <ListSection title={<span className="pt-2 text-[20px] font-bold tracking-[-.3px] text-foreground normal-case">Tags</span>}>
        <div className="bg-card px-2 pt-3 pb-1"><Tags notes={{ ...notes, openTag: (t) => { notes.openTag(t); if (t) onOpen(); } }} /></div>
      </ListSection>
    </div>
  );
}
