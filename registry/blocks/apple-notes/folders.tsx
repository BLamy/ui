import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import type { Folder } from './data';
import { ItemMenu } from './item-menu';
import { FolderActions } from './master-actions';
import { BarButton, BottomBar } from './parts';
import type { NotesState } from './use-notes';

/** The sidebar lists the places notes live. Each one is its own master list; + adds another. */
export function FoldersSidebar({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const local = notes.roots.filter((f) => f.source === 'local');
  const browser = notes.roots.find((f) => f.source === 'browser');
  const open = (f: Folder) => { notes.openFolder(f.id); if (s.collapsed) s.show('supplementary'); };
  return <SplitViewSidebar aria-label="Folders" width={240} minWidth={200}>
    <SplitViewHeader title="Folders" largeTitle={s.collapsed} trailing={<FolderActions notes={notes} onOpen={() => s.show('detail')} />} />
    <SplitViewContent>
      <div className="px-2.5 pb-16">
        <SplitViewSection title="On My Mac" collapsible>
          {local.map((f) => <ItemMenu key={f.id} notes={notes} id={f.id} label={f.title}>
            <SplitViewItem id={f.id} title={f.title}
              subtitle={f.connected === false ? 'Reconnect folder' : undefined}
              icon={<Icon name="folder" size={21} />} badge={notes.count(f)} onPress={() => open(f)} />
          </ItemMenu>)}
          {!local.length ? <p className="m-0 px-2.5 py-3 text-detail leading-relaxed text-muted-foreground">Add the folders where you keep your notes.</p> : null}
        </SplitViewSection>
        {browser ? <SplitViewSection title="In This Browser" collapsible>
          <ItemMenu notes={notes} id={browser.id} label="Notes">
            <SplitViewItem id={browser.id} title="Notes" icon={<Icon name="note" size={21} />} badge={notes.count(browser)} onPress={() => open(browser)} />
          </ItemMenu>
        </SplitViewSection> : null}
        {!notes.files.canOpenFolder ? <p className="px-2.5 pt-4 text-caption leading-relaxed text-muted-foreground">Open in Chrome or Edge to add folders from your Mac.</p> : null}
      </div>
    </SplitViewContent>
    {s.collapsed ? <BottomBar className="justify-end px-3">
      <BarButton label="New note" onPress={() => notes.startCreating('file')}><Icon name="compose" size={24} /></BarButton>
    </BottomBar> : null}
  </SplitViewSidebar>;
}
