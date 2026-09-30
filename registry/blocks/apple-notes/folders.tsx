/* Folders: iCloud (with All iCloud and Recently Deleted) and On My Mac, each collapsible, with note counts,
   plus tags. Tiled or floating beside the list on wide screens; on the phone it is the root of the stack (with a
   large title and a bottom bar), and picking a folder or a tag pushes its notes. */
import { NumberMorph } from '@/components/ui/number-morph';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { ICLOUD, ON_MY_MAC, TAGS } from './data';
import { BarButton, BottomBar } from './parts';
import type { NotesState } from './use-notes';

const SECTIONS = [
  { title: 'iCloud', folders: ICLOUD },
  { title: 'On My Mac', folders: ON_MY_MAC },
];

function Tags({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  return (
    <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
      {TAGS.map((t) => {
        const on = notes.tag === t;
        return (
          <button key={t} type="button" aria-pressed={on}
            onClick={() => { notes.openTag(on ? null : t); if (!on && s.collapsed) s.show('supplementary'); }}
            className={cn('bl-btn cursor-pointer rounded-full border-0 px-3 py-1.5 [font-family:inherit] text-[14px] transition-colors duration-150',
              on ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary-strong')}>#{t}</button>
        );
      })}
    </div>
  );
}

export function FoldersSidebar({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  return (
    <SplitViewSidebar aria-label="Folders" width={240} minWidth={200}>
      <SplitViewHeader title="Folders" largeTitle={s.collapsed}
        trailing={<BarButton label="New folder"><Icon name="folder-badge-plus" /></BarButton>} />
      <SplitViewContent>
        <div className="px-2.5 pb-16">
          {SECTIONS.map((sec) => (
            <SplitViewSection key={sec.title} title={sec.title} collapsible>
              {sec.folders.map((f) => (
                <SplitViewItem key={f.id} id={f.id} title={f.title} icon={<Icon name={f.icon ?? 'folder'} size={21} />}
                  badge={<NumberMorph value={notes.count(f)} />} onPress={() => notes.openFolder(f.id)} />
              ))}
            </SplitViewSection>
          ))}
          <SplitViewSection title="Tags" collapsible><Tags notes={notes} /></SplitViewSection>
        </div>
      </SplitViewContent>
      {s.collapsed ? (
        <BottomBar className="justify-end px-3">
          <BarButton label="New note" onPress={() => { notes.create(); s.show('detail'); }}><Icon name="compose" size={24} /></BarButton>
        </BottomBar>
      ) : null}
    </SplitViewSidebar>
  );
}
